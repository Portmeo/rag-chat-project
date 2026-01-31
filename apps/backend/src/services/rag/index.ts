import { QdrantVectorStore } from '@langchain/community/vectorstores/qdrant';
import type { Document } from 'langchain/document';
import { BaseRetriever } from 'langchain/schema/retriever';
import { BM25Retriever } from './bm25Retriever';
import { EnsembleRetriever } from './ensembleRetriever';
import { qdrantClient, COLLECTION_NAME } from '../../repositories/qdrantRepository';
import { embeddings, llm, MESSAGES, SIMILARITY_SEARCH_CONFIG, TEXT_SEPARATORS, BM25_CONFIG, RERANKER_CONFIG } from './config';
import { createTextSplitter, buildPrompt, checkCollectionExists, getFileExtension, generateMultipleQueries, getAllDocumentsFromQdrant } from './helpers';
import { extractTechnicalMetadata } from '../documentProcessor/templates';
import type { DocumentMetadata, RAGResponse, AddDocumentResult } from './types';
import { rerankDocuments } from './reranker';

// ============================================================================
// CACHE BM25
// ============================================================================

let bm25RetrieverCache: BM25Retriever | null = null;

async function rebuildBM25Cache(): Promise<void> {
  if (!BM25_CONFIG.enabled) {
    console.log('⏭️  BM25 retriever is disabled, skipping cache rebuild');
    bm25RetrieverCache = null;
    return;
  }

  const allDocuments = await getAllDocumentsFromQdrant();

  if (allDocuments.length === 0) {
    bm25RetrieverCache = null;
    return;
  }

  console.log(`🔄 Rebuilding BM25 cache with ${allDocuments.length} documents`);

  bm25RetrieverCache = new BM25Retriever({
    documents: allDocuments,
    k: SIMILARITY_SEARCH_CONFIG.MAX_RESULTS,
  });
}

export async function addDocumentToVectorStore(
  text: string,
  filename: string,
  uploadDate: string
): Promise<AddDocumentResult> {
  const extension = getFileExtension(filename);
  const textSplitter = createTextSplitter(extension);

  const chunks = await textSplitter.splitText(text);

  const docs: Document[] = chunks.map((chunk, index) => {
    const metadata = extractTechnicalMetadata(chunk, filename, uploadDate, index);
    metadata.total_chunks = chunks.length;

    return {
      pageContent: chunk,
      metadata,
    };
  });

  await QdrantVectorStore.fromDocuments(docs, embeddings, {
    client: qdrantClient,
    collectionName: COLLECTION_NAME,
  });

  await rebuildBM25Cache();

  return { success: true, chunksCount: docs.length };
}

// Filter sources based on rerank score threshold
function filterSourcesByRelevance(relevantDocs: Document[]): DocumentMetadata[] {
  if (!RERANKER_CONFIG.enabled) {
    // If reranker is disabled, don't show sources to prevent weak matches
    console.log(`\n📊 Reranker disabled - sources hidden to prevent showing weak matches`);
    return [];
  }

  // Filter by rerank score threshold
  const filtered = relevantDocs.filter(doc => {
    const rerankScore = (doc as any).rerankScore;
    return rerankScore !== undefined && rerankScore >= RERANKER_CONFIG.minScore;
  });

  console.log(`\n📊 Sources filtered by rerank score: ${relevantDocs.length} → ${filtered.length} (threshold: ${RERANKER_CONFIG.minScore})`);

  return filtered.map(doc => doc.metadata as DocumentMetadata);
}

// Shared function to retrieve relevant documents
async function retrieveRelevantDocuments(question: string) {
  const collectionExists = await checkCollectionExists();

  if (!collectionExists) {
    return null;
  }

  const vectorStore = await QdrantVectorStore.fromExistingCollection(embeddings, {
    client: qdrantClient,
    collectionName: COLLECTION_NAME,
  });

  // Adjust k based on reranker config
  // If reranker is enabled, retrieve more candidates (Top 20-25)
  const retrievalK = RERANKER_CONFIG.enabled
    ? RERANKER_CONFIG.retrievalTopK
    : SIMILARITY_SEARCH_CONFIG.MAX_RESULTS;

  const vectorRetriever = vectorStore.asRetriever({
    k: retrievalK,
  });

  let retriever: BaseRetriever;

  // Configure retriever based on BM25 settings
  if (BM25_CONFIG.enabled) {
    console.log(`🔧 Using Ensemble Retriever (Vector: ${BM25_CONFIG.vectorWeight}, BM25: ${BM25_CONFIG.weight})`);

    if (!bm25RetrieverCache) {
      await rebuildBM25Cache();
    }

    if (!bm25RetrieverCache) {
      console.log('⚠️  BM25 cache failed to build, falling back to vector-only search');
      retriever = vectorRetriever;
    } else {
      retriever = new EnsembleRetriever({
        retrievers: [vectorRetriever, bm25RetrieverCache],
        weights: [BM25_CONFIG.vectorWeight, BM25_CONFIG.weight],
      });
    }
  } else {
    console.log('🔧 Using Vector-only Retriever (BM25 disabled)');
    retriever = vectorRetriever;
  }

  const queries = await generateMultipleQueries(question);
  console.log('Multi-query generated:', queries);

  const allDocs: Document[] = [];
  const seenContent = new Set<string>();

  for (const query of queries) {
    const docs = await retriever.getRelevantDocuments(query);

    for (const doc of docs) {
      const contentHash = `${doc.pageContent}-${(doc.metadata as DocumentMetadata)?.filename}`;
      if (!seenContent.has(contentHash)) {
        seenContent.add(contentHash);
        allDocs.push(doc);
      }
    }
  }

  let candidateDocs = allDocs.slice(0, RERANKER_CONFIG.enabled ? RERANKER_CONFIG.retrievalTopK : SIMILARITY_SEARCH_CONFIG.MAX_RESULTS * 2);

  if (candidateDocs.length === 0) {
    return null;
  }

  console.log(`\n📄 Retrieved ${candidateDocs.length} candidate documents`);

  // Apply reranking if enabled
  let relevantDocs: Document[];

  if (RERANKER_CONFIG.enabled) {
    console.log(`\n🔄 Reranking ${candidateDocs.length} documents to Top ${RERANKER_CONFIG.finalTopK}...`);
    try {
      relevantDocs = await rerankDocuments(question, candidateDocs, RERANKER_CONFIG.finalTopK);
      console.log(`✅ Reranking completed, got ${relevantDocs.length} top documents`);
    } catch (error) {
      console.error('⚠️  Reranking failed, falling back to original retrieval:', error);
      relevantDocs = candidateDocs.slice(0, SIMILARITY_SEARCH_CONFIG.MAX_RESULTS);
    }
  } else {
    console.log('⏭️  Reranker disabled, using retrieval results directly');
    relevantDocs = candidateDocs;
  }

  // DEBUG: Log final documents
  console.log('\n📄 Final documents for LLM:');
  relevantDocs.forEach((doc, idx) => {
    const metadata = doc.metadata as DocumentMetadata;
    const rerankScore = (doc as any).rerankScore;
    console.log(`\n--- Document ${idx + 1} ---`);
    console.log(`File: ${metadata.filename}`);
    console.log(`Chunk: ${metadata.chunk_index}`);
    if (rerankScore !== undefined) {
      console.log(`Rerank Score: ${rerankScore.toFixed(4)}`);
    }
    console.log(`Content preview: ${doc.pageContent.substring(0, 200)}...`);
  });

  const context = relevantDocs
    .map((doc: Document) => doc.pageContent)
    .join(TEXT_SEPARATORS.PARAGRAPH);

  console.log('\n📝 Full context length:', context.length, 'chars');
  console.log('\n📝 Full context being sent to LLM:\n', context);

  const prompt = buildPrompt(context, question);
  console.log('\n🤖 Full prompt being sent:\n', prompt);

  return {
    relevantDocs,
    context,
    prompt,
  };
}

export async function queryRAG(question: string): Promise<RAGResponse> {
  try {
    const retrieved = await retrieveRelevantDocuments(question);

    if (!retrieved) {
      return {
        answer: MESSAGES.NO_DOCUMENTS,
        sources: [],
      };
    }

    const { relevantDocs, prompt } = retrieved;

    const answer = await llm.invoke(prompt);
    console.log('\n💬 LLM answer:', answer);

    return {
      answer,
      sources: filterSourcesByRelevance(relevantDocs),
    };
  } catch (error: any) {
    console.error('Error in queryRAG:', error);
    throw new Error(`${MESSAGES.ERROR_PREFIX}: ${error.message}`);
  }
}

export async function* queryRAGStream(question: string) {
  try {
    const retrieved = await retrieveRelevantDocuments(question);

    if (!retrieved) {
      yield { event: 'token', data: { chunk: MESSAGES.NO_DOCUMENTS } };
      yield { event: 'done', data: { complete: true } };
      return;
    }

    const { relevantDocs, prompt } = retrieved;

    console.log('\n🔄 Starting streaming response...');

    // Stream the LLM response
    const stream = await llm.stream(prompt);

    for await (const chunk of stream) {
      const content = chunk.content || chunk;
      if (content) {
        yield { event: 'token', data: { chunk: content } };
      }
    }

    console.log('\n✅ Streaming completed');

    // Filter and send sources
    const sources = filterSourcesByRelevance(relevantDocs);

    if (sources.length > 0) {
      yield {
        event: 'sources',
        data: { sources },
      };
    } else {
      console.log('⚠️  No sources to show');
    }

    yield { event: 'done', data: { complete: true } };

  } catch (error: any) {
    console.error('Error in queryRAGStream:', error);
    yield { event: 'error', data: { error: error.message } };
  }
}

export async function listDocuments(): Promise<DocumentMetadata[]> {
  try {
    const collectionExists = await checkCollectionExists();

    if (!collectionExists) {
      return [];
    }

    const scrollResult = await qdrantClient.scroll(COLLECTION_NAME, {
      limit: 100,
      with_payload: true,
      with_vector: false,
    });

    const documentsMap = new Map<string, DocumentMetadata>();

    for (const point of scrollResult.points) {
      const payload = point.payload as any;
      const metadata = payload?.metadata as DocumentMetadata;
      if (metadata?.filename && !documentsMap.has(metadata.filename)) {
        documentsMap.set(metadata.filename, metadata);
      }
    }

    return Array.from(documentsMap.values());
  } catch (error: any) {
    console.error(MESSAGES.ERROR_LISTING, error);
    throw new Error(`${MESSAGES.ERROR_LIST_FAILED}: ${error.message}`);
  }
}

export async function clearBM25Cache(): Promise<void> {
  bm25RetrieverCache = null;
  console.log('🗑️  BM25 cache cleared');
}
