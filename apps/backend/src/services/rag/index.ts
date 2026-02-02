import { QdrantVectorStore } from '@langchain/community/vectorstores/qdrant';
import { Document } from 'langchain/document';
import { BaseRetriever } from '@langchain/core/retrievers';
import { randomUUID } from 'crypto';
import { BM25Retriever } from './bm25Retriever';
import { EnsembleRetriever } from './ensembleRetriever';
import { qdrantClient, COLLECTION_NAME } from '../../repositories/qdrantRepository';
import { embeddings, llm, MESSAGES, SIMILARITY_SEARCH_CONFIG, TEXT_SEPARATORS, BM25_CONFIG, RERANKER_CONFIG, PARENT_RETRIEVER_CONFIG } from './config';
import { createTextSplitter, buildPrompt, checkCollectionExists, getFileExtension, generateMultipleQueries, getAllDocumentsFromQdrant, limitHistory } from './helpers';
import { extractTechnicalMetadata } from '../documentProcessor/templates';
import type { TechnicalMetadata } from '../documentProcessor/templates/types';
import type { DocumentMetadata, RAGResponse, RAGSource, AddDocumentResult, ConversationMessage } from './types';
import { rerankDocuments } from './reranker';
import { createParentChildChunks } from './parentChildChunker';

// ============================================================================
// CACHE BM25
// ============================================================================

let bm25RetrieverCache: BM25Retriever | null = null;

// ============================================================================
// PARENT CONTENT CACHE - REMOVED
// ============================================================================
// Parent content is now stored directly in child chunk metadata
// No need for in-memory cache anymore

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

/**
 * Resuelve child chunks a parent chunks (OPTIMIZADO)
 * Recibe: Array de Documents (child chunks)
 * Retorna: Array de Documents (parent chunks)
 *
 * Optimización: Hace UNA sola query a Qdrant para obtener TODOS los parents únicos
 * en lugar de N queries (una por cada parent)
 */
async function resolveParentChunks(childDocs: Document[]): Promise<Document[]> {
  if (!PARENT_RETRIEVER_CONFIG.enabled) {
    return childDocs; // Si no está habilitado, retornar tal cual
  }

  // 1. Agrupar por parent_doc_id
  const parentGroups = new Map<string, Document[]>();

  for (const doc of childDocs) {
    const meta = doc.metadata as TechnicalMetadata;

    if (!meta.parent_child?.parent_doc_id) {
      // No es un child chunk, mantener tal cual
      parentGroups.set(`no_parent_${Math.random()}`, [doc]);
      continue;
    }

    const parentId = meta.parent_child.parent_doc_id;

    if (!parentGroups.has(parentId)) {
      parentGroups.set(parentId, []);
    }

    parentGroups.get(parentId)!.push(doc);
  }

  // 2. Extraer TODOS los parent IDs únicos
  const uniqueParentIds = Array.from(parentGroups.keys())
    .filter(id => !id.startsWith('no_parent_'));

  if (uniqueParentIds.length === 0) {
    // Solo chunks sin parent, retornar tal cual
    const allDocs: Document[] = [];
    for (const children of parentGroups.values()) {
      allDocs.push(...children);
    }
    return allDocs;
  }

  // 3. ✅ UNA SOLA query para TODOS los parents
  let parentMap = new Map<string, any>();

  try {
    const scrollResult = await qdrantClient.scroll(COLLECTION_NAME, {
      filter: {
        must: [
          {
            key: 'metadata.parent_child.parent_doc_id',
            match: {
              any: uniqueParentIds  // ← Query múltiple en una sola llamada
            }
          },
          {
            key: 'metadata.parent_child.is_parent',
            match: { value: true }
          }
        ]
      },
      limit: uniqueParentIds.length,
      with_payload: true,
      with_vector: false,
    });

    // 4. Crear mapa de parents recuperados
    for (const point of scrollResult.points) {
      const parentPayload = point.payload as any;
      const parentId = parentPayload.metadata.parent_child.parent_doc_id;

      parentMap.set(parentId, new Document({
        pageContent: parentPayload.text,
        metadata: parentPayload.metadata,
      }));
    }

    console.log(`✅ Retrieved ${scrollResult.points.length} unique parents in 1 query (from ${childDocs.length} children)`);

  } catch (error) {
    console.error('❌ Error retrieving parents from Qdrant:', error);
    // Si falla la query, parentMap queda vacío y se usará fallback
  }

  // 5. Construir resultado final
  const parentDocs: Document[] = [];

  for (const [parentId, children] of parentGroups.entries()) {
    if (parentId.startsWith('no_parent_')) {
      parentDocs.push(children[0]);
      continue;
    }

    const parentDoc = parentMap.get(parentId);

    if (!parentDoc) {
      console.warn(`⚠️ Parent not found for ${parentId}, using children as fallback`);
      parentDocs.push(...children);
      continue;
    }

    // Preservar mejor rerank score del grupo de children
    const bestChild = children.reduce((best, current) => {
      const bestScore = (best as any).rerankScore || 0;
      const currentScore = (current as any).rerankScore || 0;
      return currentScore > bestScore ? current : best;
    }, children[0]);

    // Transferir rerank score si existe
    if ((bestChild as any).rerankScore !== undefined) {
      (parentDoc as any).rerankScore = (bestChild as any).rerankScore;
    }

    parentDocs.push(parentDoc);
  }

  console.log(`📄 Resolved ${childDocs.length} children to ${parentDocs.length} parents`);

  return parentDocs;
}

export async function addDocumentToVectorStore(
  text: string,
  filename: string,
  uploadDate: string
): Promise<AddDocumentResult> {
  const extension = getFileExtension(filename);

  let docs: Document[];

  if (PARENT_RETRIEVER_CONFIG.enabled) {
    // Parent Document Retriever: Indexar children (con vector) Y parents (sin vector)
    const { children, parents } = await createParentChildChunks(
      text,
      filename,
      uploadDate,
      extension
    );

    // Indexar children con vector embedding (búsqueda vectorial)
    await QdrantVectorStore.fromDocuments(children, embeddings, {
      client: qdrantClient,
      collectionName: COLLECTION_NAME,
    });

    // Indexar parents SIN vector (solo storage, acceso por filtro)
    // Usar vector nulo/dummy ya que Qdrant requiere vector
    const nullVector = new Array(1024).fill(0); // Dimensión del embedding

    for (const parent of parents) {
      await qdrantClient.upsert(COLLECTION_NAME, {
        points: [{
          id: randomUUID(), // Usar UUID en lugar de string
          vector: nullVector,
          payload: {
            text: parent.pageContent,
            metadata: parent.metadata,
          }
        }]
      });
    }

    console.log(`📦 Created ${children.length} child chunks + ${parents.length} parent chunks`);

    // Rebuild cache asynchronously (don't block the response)
    rebuildBM25Cache().catch((error) => {
      console.error('Error rebuilding BM25 cache:', error);
    });

    return { success: true, chunksCount: children.length };
  } else {
    // Modo clásico: chunks únicos
    const textSplitter = createTextSplitter(extension);
    const chunks = await textSplitter.splitText(text);

    docs = chunks.map((chunk, index) => {
      const metadata = extractTechnicalMetadata(chunk, filename, uploadDate, index);
      metadata.total_chunks = chunks.length;

      return {
        pageContent: chunk,
        metadata,
      };
    });

    console.log(`📦 Created ${docs.length} chunks (classic mode)`);
  }

  await QdrantVectorStore.fromDocuments(docs, embeddings, {
    client: qdrantClient,
    collectionName: COLLECTION_NAME,
  });

  // Rebuild cache asynchronously (don't block the response)
  rebuildBM25Cache().catch((error) => {
    console.error('Error rebuilding BM25 cache:', error);
  });

  return { success: true, chunksCount: docs.length };
}

// Convert docs to RAG sources
function docsToSources(docs: Document[]): RAGSource[] {
  return docs.map(doc => ({
    ...(doc.metadata as DocumentMetadata),
    rerankScore: (doc as any).rerankScore
  }));
}

// Filter sources based on rerank score threshold
function filterSourcesByRelevance(relevantDocs: Document[]): RAGSource[] {
  // If reranker is disabled, show all sources (no filtering)
  if (!RERANKER_CONFIG.enabled) {
    console.log(`\n📊 Reranker disabled - showing all ${relevantDocs.length} sources`);
    return docsToSources(relevantDocs);
  }

  // Filter by rerank score threshold when reranker is enabled
  const filtered = relevantDocs.filter(doc => {
    const rerankScore = (doc as any).rerankScore;
    return rerankScore !== undefined && rerankScore >= RERANKER_CONFIG.minScore;
  });

  console.log(`\n📊 Sources filtered by rerank score: ${relevantDocs.length} → ${filtered.length} (threshold: ${RERANKER_CONFIG.minScore})`);

  return docsToSources(filtered);
}

// Shared function to retrieve relevant documents
async function retrieveRelevantDocuments(
  question: string,
  history: ConversationMessage[] = []
) {
  const startTime = Date.now();
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

  // NUEVO: Resolver children a parents ANTES del reranking
  if (PARENT_RETRIEVER_CONFIG.enabled) {
    console.log(`\n🔄 Resolving ${candidateDocs.length} child chunks to parent chunks...`);
    candidateDocs = await resolveParentChunks(candidateDocs);
  }

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

  const prompt = buildPrompt(context, question, history);
  console.log('\n🤖 Full prompt being sent:\n', prompt);

  return {
    relevantDocs,
    context,
    prompt,
  };
}

export interface QueryRAGOptions {
  history?: ConversationMessage[];
}

export async function queryRAG(
  question: string,
  options: QueryRAGOptions = {}
): Promise<RAGResponse> {
  try {
    const { history = [] } = options;
    const limitedHistory = limitHistory(history);
    const retrieved = await retrieveRelevantDocuments(question, limitedHistory);

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

export async function* queryRAGStream(
  question: string,
  history: ConversationMessage[] = []
) {
  try {
    const limitedHistory = limitHistory(history);
    console.log(`\n📜 Using ${limitedHistory.length} messages from history`);

    const retrieved = await retrieveRelevantDocuments(question, limitedHistory);

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
      const content = typeof chunk === 'string' ? chunk : (chunk as any).content || chunk;
      if (content) {
        yield { event: 'token', data: { chunk: String(content) } };
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

export async function deleteDocumentFromVectorStore(filename: string): Promise<{ success: boolean; chunksDeleted: number }> {
  try {
    const collectionExists = await checkCollectionExists();

    if (!collectionExists) {
      return { success: true, chunksDeleted: 0 };
    }

    // Delete all chunks with matching filename
    const deleteResult = await qdrantClient.delete(COLLECTION_NAME, {
      filter: {
        must: [
          {
            key: 'metadata.filename',
            match: { value: filename },
          },
        ],
      },
    });

    const chunksDeleted = deleteResult.operation_id ? deleteResult.operation_id : 0;

    console.log(`🗑️  Deleted ${chunksDeleted} chunks for file: ${filename}`);

    // Rebuild BM25 cache after deletion
    await rebuildBM25Cache();

    return { success: true, chunksDeleted: typeof chunksDeleted === 'number' ? chunksDeleted : 0 };
  } catch (error: any) {
    console.error(`Error deleting document from vector store:`, error);
    throw new Error(`Failed to delete document from vector store: ${error.message}`);
  }
}
