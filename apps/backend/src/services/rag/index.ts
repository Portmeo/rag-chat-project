import { QdrantVectorStore } from '@langchain/community/vectorstores/qdrant';
import { Document } from 'langchain/document';
import { BaseRetriever } from '@langchain/core/retrievers';
import { randomUUID, createHash } from 'crypto';
import { BM25Retriever } from './bm25Retriever';
import { EnsembleRetriever } from './ensembleRetriever';
import { createLogger } from '../../lib/logger.js';

const pipelineLogger = createLogger('PIPELINE');
const qdrantLogger = createLogger('QDRANT');
const parentLogger = createLogger('PARENT');
const rerankerLogger = createLogger('RERANKER');
const llmLogger = createLogger('LLM');
import { qdrantClient, COLLECTION_NAME } from '../../repositories/qdrantRepository';
import { embeddings, llm, MESSAGES, SIMILARITY_SEARCH_CONFIG, TEXT_SEPARATORS, BM25_CONFIG, RERANKER_CONFIG, PARENT_RETRIEVER_CONFIG, CONTEXTUAL_COMPRESSION_CONFIG, ALIGNMENT_OPTIMIZATION_CONFIG, ACTIVE_MODEL } from './config';
import { parentStorage, bm25Storage, queryLogger } from '../../repositories/index.js';
import { compressDocuments } from './contextualCompressor';
import { generateAlignmentQuestions } from './alignmentOptimizer';
import { createTextSplitter, buildPrompt, checkCollectionExists, getFileExtension, generateMultipleQueries, getAllDocumentsFromQdrant, limitHistory } from './helpers';
import { extractTechnicalMetadata } from '../documentProcessor/templates';
import type { TechnicalMetadata } from '../documentProcessor/templates/types';
import type { DocumentMetadata, RAGResponse, RAGSource, AddDocumentResult, ConversationMessage } from './types';
import { rerankDocuments } from './reranker';
import { createParentChildChunks } from './parentChildChunker';

// ============================================================================
// ALIGNMENT STATUS HELPERS
// ============================================================================

const ALIGNMENT_STATUS_TYPE = 'alignment_status';
const NULL_VECTOR = new Array(1024).fill(0);

function filenameToStatusId(filename: string): string {
  const hash = createHash('md5').update(`status:${filename}`).digest('hex');
  return `${hash.slice(0,8)}-${hash.slice(8,12)}-${hash.slice(12,16)}-${hash.slice(16,20)}-${hash.slice(20,32)}`;
}

async function upsertAlignmentStatusPoint(
  filename: string,
  status: 'optimizing' | 'ready',
  progress: number,
  total: number
): Promise<void> {
  await qdrantClient.upsert(COLLECTION_NAME, {
    wait: false,
    points: [{
      id: filenameToStatusId(filename),
      vector: NULL_VECTOR,
      payload: {
        type: ALIGNMENT_STATUS_TYPE,
        metadata: {
          type: ALIGNMENT_STATUS_TYPE,
          filename,
          alignment_status: status,
          alignment_progress: progress,
          alignment_total: total,
        },
      },
    }],
  });
}

const ALIGNMENT_BATCH_SIZE = 5;

async function runAlignmentOptimization(filename: string, parents: Document[]): Promise<void> {
  try {
    // 1. Limpiar alignment questions existentes del filename antes de generar
    await qdrantClient.delete(COLLECTION_NAME, {
      filter: {
        must: [
          { key: 'metadata.parent_child.is_alignment_question', match: { value: true } },
          { key: 'metadata.filename', match: { value: filename } },
        ],
      },
    });

    await upsertAlignmentStatusPoint(filename, 'optimizing', 0, parents.length);

    let progress = 0;
    let totalIndexed = 0;

    // 2. Generar e indexar por batches (no acumular todo en memoria)
    for (let i = 0; i < parents.length; i += ALIGNMENT_BATCH_SIZE) {
      const batch = parents.slice(i, i + ALIGNMENT_BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map(parent => generateAlignmentQuestions(parent, llm, ALIGNMENT_OPTIMIZATION_CONFIG.questionsPerChunk))
      );
      const batchDocs = batchResults.flat();

      if (batchDocs.length > 0) {
        await QdrantVectorStore.fromDocuments(batchDocs, embeddings, {
          client: qdrantClient,
          collectionName: COLLECTION_NAME,
        });
        totalIndexed += batchDocs.length;
      }

      progress += batch.length;
      await upsertAlignmentStatusPoint(filename, 'optimizing', Math.min(progress, parents.length), parents.length);
    }

    await upsertAlignmentStatusPoint(filename, 'ready', parents.length, parents.length);
    pipelineLogger.log(`Alignment optimization complete for ${filename}: ${totalIndexed} questions indexed`);
  } catch (error: any) {
    pipelineLogger.warn(`Alignment optimization failed for ${filename}: ${error.message}`);
  }
}

export async function getAlignmentStatus(filename: string): Promise<{ status: string; progress: number; total: number } | null> {
  try {
    const result = await qdrantClient.retrieve(COLLECTION_NAME, {
      ids: [filenameToStatusId(filename)],
      with_payload: true,
      with_vector: false,
    });
    if (result.length === 0) return null;
    const meta = (result[0].payload as any)?.metadata;
    return {
      status: meta?.alignment_status || 'unknown',
      progress: meta?.alignment_progress || 0,
      total: meta?.alignment_total || 0,
    };
  } catch {
    return null;
  }
}

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
    pipelineLogger.log('BM25 retriever is disabled, skipping cache rebuild');
    bm25RetrieverCache = null;
    return;
  }

  // Try loading from SQLite first (fast, no Qdrant call needed)
  try {
    const cached = await bm25Storage.load();
    if (cached && cached.length > 0) {
      const docs = cached.map(s => new Document({ pageContent: s.content, metadata: s.metadata }));
      bm25RetrieverCache = new BM25Retriever({ documents: docs, k: SIMILARITY_SEARCH_CONFIG.MAX_RESULTS });
      pipelineLogger.log(`BM25 loaded from SQLite (${docs.length} documents)`);
      return;
    }
  } catch (err: any) {
    pipelineLogger.warn(`BM25 SQLite load failed, falling back to Qdrant: ${err.message}`);
  }

  let allDocuments = await getAllDocumentsFromQdrant();

  if (allDocuments.length === 0) {
    bm25RetrieverCache = null;
    return;
  }

  // 🎯 FILTRADO ESTRATÉGICO: Si Parent-Child está habilitado, indexamos SOLO los children en BM25.
  // Esto permite que BM25 encuentre fragmentos específicos (200 chars) que luego resolveParentChunks
  // hidratará a parents (1000 chars). Si indexamos ambos, BM25 tendrá ruido y hits duplicados.
  if (PARENT_RETRIEVER_CONFIG.enabled) {
    const originalCount = allDocuments.length;
    allDocuments = allDocuments.filter(doc => {
      const meta = doc.metadata as TechnicalMetadata;
      return meta.parent_child && meta.parent_child.is_parent === false && !meta.parent_child.is_alignment_question;
    });
    pipelineLogger.log(`BM25 Filter: Kept ${allDocuments.length} children from ${originalCount} total points (filtered out parents + alignment questions)`);
  }

  pipelineLogger.log(`Rebuilding BM25 cache with ${allDocuments.length} documents from Qdrant`);

  bm25RetrieverCache = new BM25Retriever({
    documents: allDocuments,
    k: SIMILARITY_SEARCH_CONFIG.MAX_RESULTS,
  });

  // Persist to SQLite for future restarts
  try {
    const serialized = allDocuments.map(doc => ({
      filename: (doc.metadata as any).filename ?? '',
      content: doc.pageContent,
      metadata: doc.metadata as Record<string, unknown>,
    }));
    await bm25Storage.save(serialized);
    pipelineLogger.log(`BM25 index saved to SQLite (${serialized.length} documents)`);
  } catch (err: any) {
    pipelineLogger.warn(`BM25 SQLite save failed: ${err.message}`);
  }
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

  // 3. ✅ UNA SOLA query a SQLite para TODOS los parents
  let parentMap = new Map<string, Document>();

  try {
    parentMap = await parentStorage.getParentsByIds(uniqueParentIds);
    parentLogger.log(`Retrieved ${parentMap.size} unique parents from SQLite (from ${childDocs.length} children)`);
  } catch (error) {
    parentLogger.error('Error retrieving parents from SQLite:', error);
    // parentMap queda vacío y se usará fallback
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
      parentLogger.warn(`Parent not found for ${parentId}, using children as fallback`);
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

    // NUEVO: Agregar metadata útil para debugging y métricas
    (parentDoc as any).childrenCount = children.length;
    (parentDoc as any).childrenScores = children
      .map(c => (c as any).rerankScore)
      .filter(s => s !== undefined)
      .sort((a, b) => b - a); // Ordenar descendente

    // 🔧 HYDRATION LIMPIA: No anexar children al parent si ya están incluidos
    // El parent chunk ya contiene el texto de los children.
    // Solo mantenemos el parentDoc tal cual para evitar redundancia masiva en el contexto.

    parentDocs.push(parentDoc);
  }

  parentLogger.log(`Resolved ${childDocs.length} children to ${parentDocs.length} parents`);

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

    // Guardar parents en SQLite (acceso por ID, sin necesidad de vectores en Qdrant)
    const parentEntries = parents.map(parent => ({
      id: (parent.metadata as any).parent_child?.parent_doc_id ?? randomUUID(),
      filename,
      document: parent,
    }));
    await parentStorage.saveParents(parentEntries);

    pipelineLogger.log(`Created ${children.length} child chunks + ${parents.length} parent chunks (saved to SQLite)`);

    // Alignment Optimization is triggered manually via /api/documents/optimize-all or /:filename/optimize

    // Rebuild cache asynchronously (don't block the response)
    rebuildBM25Cache().catch((error) => {
      pipelineLogger.error('Error rebuilding BM25 cache:', error);
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

    pipelineLogger.log(`Created ${docs.length} chunks (classic mode)`);
  }

  await QdrantVectorStore.fromDocuments(docs, embeddings, {
    client: qdrantClient,
    collectionName: COLLECTION_NAME,
  });

  // Rebuild cache asynchronously (don't block the response)
  rebuildBM25Cache().catch((error) => {
    pipelineLogger.error('Error rebuilding BM25 cache:', error);
  });

  return { success: true, chunksCount: docs.length };
}

// Convert docs to RAG sources, deduplicating by filename
function docsToSources(docs: Document[]): RAGSource[] {
  const seen = new Set<string>();
  return docs
    .map(doc => ({
      ...(doc.metadata as DocumentMetadata),
      rerankScore: (doc as any).rerankScore
    }))
    .filter(source => {
      if (!source.filename || seen.has(source.filename)) return false;
      seen.add(source.filename);
      return true;
    });
}

// Filter sources by rerank score threshold
function filterSourcesByRelevance(relevantDocs: Document[]): RAGSource[] {
  if (!RERANKER_CONFIG.enabled) {
    rerankerLogger.log(`Reranker disabled, returning all ${relevantDocs.length} sources`);
    return docsToSources(relevantDocs);
  }

  // Check if documents have rerank scores
  const hasRerankScores = relevantDocs.some(doc => (doc as any).rerankScore !== undefined);

  if (!hasRerankScores) {
    rerankerLogger.warn(`No rerank scores found (reranker may have failed), returning all ${relevantDocs.length} sources`);
    return docsToSources(relevantDocs);
  }

  // BGE reranker uses unbounded logits - no threshold filtering needed
  // The reranker already returns Top K most relevant docs sorted by score
  const filtered = relevantDocs.filter(doc => {
    const rerankScore = (doc as any).rerankScore;
    if (rerankScore === undefined) return false;

    // For BGE: Accept all reranked docs (they're already Top K by relevance)
    // Logits can be negative - higher is better, but no absolute threshold applies
    rerankerLogger.log(`Reranked doc: score ${rerankScore.toFixed(3)}`);
    return true;
  });

  rerankerLogger.log(`Returning ${filtered.length}/${relevantDocs.length} reranked sources (no threshold - using relative ranking)`);
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

  let retriever: any;

  // Configure retriever based on BM25 settings
  if (BM25_CONFIG.enabled) {
    pipelineLogger.log(`Using Ensemble Retriever (Vector: ${BM25_CONFIG.vectorWeight}, BM25: ${BM25_CONFIG.weight})`);

    if (!bm25RetrieverCache) {
      pipelineLogger.log('BM25 cache is null, attempting rebuild...');
      await rebuildBM25Cache();
    }

    if (!bm25RetrieverCache) {
      pipelineLogger.error('BM25 cache failed to build after rebuild attempt');
      pipelineLogger.warn('Falling back to vector-only search (performance degraded)');
      retriever = vectorRetriever;
    } else {
      const docCount = (bm25RetrieverCache as any).documents?.length || 'unknown';
      pipelineLogger.log(`BM25 cache active with ${docCount} documents`);
      retriever = new EnsembleRetriever({
        retrievers: [vectorRetriever as any, bm25RetrieverCache as any],
        weights: [BM25_CONFIG.vectorWeight, BM25_CONFIG.weight],
      }) as any;
    }
  } else {
    pipelineLogger.log('Using Vector-only Retriever (BM25 disabled)');
    retriever = vectorRetriever;
  }


  const queries = await generateMultipleQueries(question);
  pipelineLogger.log('Multi-query generated:', queries);

  const allDocs: Document[] = [];
  const seenContent = new Set<string>();

  for (const query of queries) {
    // Use invoke() instead of getRelevantDocuments() for compatibility with newer LangChain versions
    const docs = await retriever.invoke(query);

    for (const doc of docs) {
      const contentHash = `${doc.pageContent}-${(doc.metadata as DocumentMetadata)?.filename}`;
      if (!seenContent.has(contentHash)) {
        seenContent.add(contentHash);
        allDocs.push(doc);
      }
    }
  }

  // AUMENTADO: Permitir más candidatos para el reranker si hay multi-query
  // Si tenemos 4 queries y cada una trae 20, queremos evaluar los mejores de todos, no solo los primeros 20
  const maxCandidates = RERANKER_CONFIG.enabled 
    ? RERANKER_CONFIG.retrievalTopK * 3 // Permitir hasta 60 candidatos para reranking
    : SIMILARITY_SEARCH_CONFIG.MAX_RESULTS * 2;

  let candidateDocs = allDocs.slice(0, maxCandidates);

  if (candidateDocs.length === 0) {
    return null;
  }

  pipelineLogger.log(`Retrieved ${candidateDocs.length} candidate documents`);

  // PASO 1: Resolver children a parents PRIMERO (Hydration)
  if (PARENT_RETRIEVER_CONFIG.enabled) {
    parentLogger.log(`Resolving ${candidateDocs.length} child chunks to parent chunks...`);
    candidateDocs = await resolveParentChunks(candidateDocs);

    const metrics = {
      childrenRetrieved: RERANKER_CONFIG.retrievalTopK,
      uniqueParents: candidateDocs.length,
      deduplicationRatio: (1 - (candidateDocs.length / RERANKER_CONFIG.retrievalTopK)).toFixed(2),
    };

    parentLogger.log(`Resolved to ${candidateDocs.length} unique parent chunks`);
    parentLogger.log(`Hydration metrics:`, JSON.stringify(metrics, null, 2));
  }

  // PASO 2: Rerank los parents (tienen contexto completo de 512 tokens)
  let relevantDocs: Document[];

  if (RERANKER_CONFIG.enabled) {
    rerankerLogger.log(`Reranking ${candidateDocs.length} parent chunks to Top ${RERANKER_CONFIG.finalTopK}...`);

    try {
      relevantDocs = await rerankDocuments(
        question,
        candidateDocs,
        RERANKER_CONFIG.finalTopK
      );

      rerankerLogger.log(`Reranking completed, got ${relevantDocs.length} top parent chunks`);
      rerankerLogger.log(`Top 3 scores: ${relevantDocs.slice(0, 3).map(d => (d as any).rerankScore?.toFixed(3)).join(', ')}`);

      // Calcular tamaño total de contexto para el LLM
      const totalTokens = relevantDocs.reduce((sum, doc) => sum + doc.pageContent.length, 0);
      rerankerLogger.log(`Total context size: ~${totalTokens} chars (~${Math.round(totalTokens / 4)} tokens)`);

    } catch (error) {
      rerankerLogger.error('Reranking failed, falling back to top parents without reranking:', error);
      relevantDocs = candidateDocs.slice(0, RERANKER_CONFIG.finalTopK);
    }

  } else {
    rerankerLogger.log('Reranker disabled, using top parent chunks directly');
    relevantDocs = candidateDocs.slice(0, SIMILARITY_SEARCH_CONFIG.MAX_RESULTS);
  }

  // PASO 3: Contextual Compression (filtrar frases ruidosas de los parents)
  if (CONTEXTUAL_COMPRESSION_CONFIG.enabled) {
    const beforeSize = relevantDocs.reduce((sum, d) => sum + d.pageContent.length, 0);
    relevantDocs = await compressDocuments(question, relevantDocs, embeddings, CONTEXTUAL_COMPRESSION_CONFIG.threshold);
    const afterSize = relevantDocs.reduce((sum, d) => sum + d.pageContent.length, 0);
    pipelineLogger.log(`Contextual compression: ${beforeSize} → ${afterSize} chars (${((1 - afterSize / beforeSize) * 100).toFixed(0)}% reducido)`);
  }

  // DEBUG: Log final documents
  llmLogger.log('Final documents for LLM:');
  relevantDocs.forEach((doc, idx) => {
    const metadata = doc.metadata as DocumentMetadata;
    const rerankScore = (doc as any).rerankScore;
    llmLogger.log(`--- Document ${idx + 1} ---`);
    llmLogger.log(`File: ${metadata.filename}`);
    llmLogger.log(`Chunk: ${metadata.chunk_index}`);
    if (rerankScore !== undefined) {
      llmLogger.log(`Rerank Score: ${rerankScore.toFixed(4)}`);
    }
    llmLogger.log(`Content preview: ${doc.pageContent.substring(0, 200)}...`);
  });

  // Construir contexto con metadata clara para que el LLM distinga fuentes
  const context = relevantDocs
    .map((doc: Document, idx: number) => {
      const metadata = doc.metadata as TechnicalMetadata;
      const rerankScore = (doc as any).rerankScore;

      // Encabezado con metadata enriquecida
      let headerParts = [`DOCUMENTO ${idx + 1}`, `Fuente: ${metadata.filename}`];

      if (metadata.section_path) headerParts.push(`Sección: ${metadata.section_path}`);
      if (metadata.content_type === 'code' || metadata.content_type === 'mixed') headerParts.push(`Tipo: código`);
      
      const header = `[${headerParts.join(' | ')}]`;

      return `${header}\n${doc.pageContent}`;
    })
    .join('\n\n---\n\n');

  llmLogger.log('Full context length:', context.length, 'chars');
  llmLogger.log('Full context being sent to LLM:\n', context);

  const prompt = buildPrompt(context, question, history);
  llmLogger.log('Full prompt being sent:\n', prompt);

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
    const startTime = Date.now();
    const retrieved = await retrieveRelevantDocuments(question, limitedHistory);

    if (!retrieved) {
      return {
        answer: MESSAGES.NO_DOCUMENTS,
        sources: [],
      };
    }

    const { relevantDocs, context, prompt } = retrieved;

    const response = await llm.invoke(prompt);

    // Handle both ChatModel (Claude) and LLM (Ollama) responses
    let answer: string;
    if (typeof response === 'string') {
      answer = response;
    } else if (response && typeof response === 'object' && 'content' in response) {
      const responseContent = (response as any).content;
      answer = typeof responseContent === 'string' ? responseContent : String(responseContent);
    } else {
      answer = String(response);
    }

    llmLogger.log('LLM answer:', answer);

    const sources = filterSourcesByRelevance(relevantDocs);

    // Log query asynchronously (don't block response)
    queryLogger.log({
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      question,
      answer,
      model: ACTIVE_MODEL,
      latency_ms: Date.now() - startTime,
      sources: relevantDocs.map(doc => ({
        filename: (doc.metadata as any).filename ?? '',
        chunk_index: (doc.metadata as any).chunk_index ?? 0,
        rerank_score: (doc as any).rerankScore,
        section_path: (doc.metadata as any).section_path,
      })),
      num_retrieved: relevantDocs.length,
      context_size: context.length,
    }).catch(err => pipelineLogger.warn(`Query log failed: ${err.message}`));

    return { answer, sources };
  } catch (error: any) {
    pipelineLogger.error('Error in queryRAG:', error);
    throw new Error(`${MESSAGES.ERROR_PREFIX}: ${error.message}`);
  }
}

export async function* queryRAGStream(
  question: string,
  history: ConversationMessage[] = []
) {
  try {
    const limitedHistory = limitHistory(history);
    pipelineLogger.log(`Using ${limitedHistory.length} messages from history`);
    const startTime = Date.now();

    const retrieved = await retrieveRelevantDocuments(question, limitedHistory);

    if (!retrieved) {
      yield { event: 'token', data: { chunk: MESSAGES.NO_DOCUMENTS } };
      yield { event: 'done', data: { complete: true } };
      return;
    }

    const { relevantDocs, context, prompt } = retrieved;

    llmLogger.log('Starting streaming response...');

    // Stream the LLM response
    const stream = await llm.stream(prompt);

    for await (const chunk of stream) {
      // Handle different response types from Claude (ChatModel) vs Ollama (LLM)
      let content = '';
      
      if (typeof chunk === 'string') {
        content = chunk;
      } else if (chunk && typeof chunk === 'object') {
        // For Claude AIMessageChunk: extract text from content
        if ('content' in chunk) {
          const chunkContent = (chunk as any).content;
          // Handle array of content blocks (Claude format)
          if (Array.isArray(chunkContent)) {
            content = chunkContent
              .filter(block => block.type === 'text')
              .map(block => block.text)
              .join('');
          } 
          // Handle string content
          else if (typeof chunkContent === 'string') {
            content = chunkContent;
          }
        }
        // Fallback: try to extract text property
        else if ('text' in chunk) {
          content = (chunk as any).text;
        }
      }
      
      if (content) {
        yield { event: 'token', data: { chunk: content } };
      }
    }

    llmLogger.log('Streaming completed');

    // Filter and send sources
    const sources = filterSourcesByRelevance(relevantDocs);

    if (sources.length > 0) {
      yield {
        event: 'sources',
        data: { sources },
      };
    } else {
      pipelineLogger.warn('No sources to show');
    }

    // Log query asynchronously (collect full answer from streamed chunks is not trivial;
    // log with empty answer placeholder — the main value is latency + sources)
    queryLogger.log({
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      question,
      answer: '[streamed]',
      model: ACTIVE_MODEL,
      latency_ms: Date.now() - startTime,
      sources: relevantDocs.map(doc => ({
        filename: (doc.metadata as any).filename ?? '',
        chunk_index: (doc.metadata as any).chunk_index ?? 0,
        rerank_score: (doc as any).rerankScore,
        section_path: (doc.metadata as any).section_path,
      })),
      num_retrieved: relevantDocs.length,
      context_size: context.length,
    }).catch(err => pipelineLogger.warn(`Query log failed: ${err.message}`));

    yield { event: 'done', data: { complete: true } };

  } catch (error: any) {
    pipelineLogger.error('Error in queryRAGStream:', error);
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
      if (metadata?.filename && (metadata as any).type !== ALIGNMENT_STATUS_TYPE && !documentsMap.has(metadata.filename)) {
        documentsMap.set(metadata.filename, metadata);
      }
    }

    // Merge alignment status if feature is enabled
    if (ALIGNMENT_OPTIMIZATION_CONFIG.enabled && documentsMap.size > 0) {
      const statusResult = await qdrantClient.scroll(COLLECTION_NAME, {
        filter: { must: [{ key: 'type', match: { value: ALIGNMENT_STATUS_TYPE } }] },
        limit: 200,
        with_payload: true,
        with_vector: false,
      });

      for (const point of statusResult.points) {
        const meta = (point.payload as any)?.metadata;
        if (meta?.filename && documentsMap.has(meta.filename)) {
          const doc = documentsMap.get(meta.filename)!;
          (doc as any).alignment_status = meta.alignment_status;
          (doc as any).alignment_progress = meta.alignment_progress;
          (doc as any).alignment_total = meta.alignment_total;
        }
      }
    }

    return Array.from(documentsMap.values());
  } catch (error: any) {
    qdrantLogger.error(MESSAGES.ERROR_LISTING, error);
    throw new Error(`${MESSAGES.ERROR_LIST_FAILED}: ${error.message}`);
  }
}

export async function optimizeDocument(filename: string): Promise<{ queued: boolean }> {
  const parents = await parentStorage.getByFilename(filename);

  if (parents.length === 0) return { queued: false };

  setImmediate(() => runAlignmentOptimization(filename, parents));
  return { queued: true };
}

export async function clearAlignmentOptimization(): Promise<void> {
  const collectionExists = await checkCollectionExists();
  if (!collectionExists) return;

  await qdrantClient.delete(COLLECTION_NAME, {
    filter: { must: [{ key: 'metadata.parent_child.is_alignment_question', match: { value: true } }] },
  });
  await qdrantClient.delete(COLLECTION_NAME, {
    filter: { must: [{ key: 'type', match: { value: ALIGNMENT_STATUS_TYPE } }] },
  });

  pipelineLogger.log('Cleared all alignment optimization data');
}

export async function clearDocumentAlignmentOptimization(filename: string): Promise<void> {
  const collectionExists = await checkCollectionExists();
  if (!collectionExists) return;

  await qdrantClient.delete(COLLECTION_NAME, {
    filter: {
      must: [
        { key: 'metadata.parent_child.is_alignment_question', match: { value: true } },
        { key: 'metadata.filename', match: { value: filename } },
      ],
    },
  });
  await qdrantClient.delete(COLLECTION_NAME, {
    filter: {
      must: [
        { key: 'type', match: { value: ALIGNMENT_STATUS_TYPE } },
        { key: 'metadata.filename', match: { value: filename } },
      ],
    },
  });

  pipelineLogger.log(`Cleared alignment optimization for ${filename}`);
}

export async function optimizeExistingDocuments(): Promise<{ queued: number }> {
  const parentsByFilename = await parentStorage.getAllGroupedByFilename();

  for (const [filename, parents] of parentsByFilename.entries()) {
    setImmediate(() => runAlignmentOptimization(filename, parents));
  }

  pipelineLogger.log(`Queued alignment optimization for ${parentsByFilename.size} documents`);
  return { queued: parentsByFilename.size };
}

export async function clearBM25Cache(): Promise<void> {
  bm25RetrieverCache = null;
  pipelineLogger.log('BM25 cache cleared');
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

    qdrantLogger.log(`Deleted ${chunksDeleted} chunks for file: ${filename}`);

    // Delete parents from SQLite
    await parentStorage.deleteByFilename(filename);

    // Clear BM25 SQLite index so it rebuilds fresh from Qdrant on next load
    await bm25Storage.clear();

    // Rebuild BM25 cache after deletion
    await rebuildBM25Cache();

    return { success: true, chunksDeleted: typeof chunksDeleted === 'number' ? chunksDeleted : 0 };
  } catch (error: any) {
    qdrantLogger.error(`Error deleting document from vector store:`, error);
    throw new Error(`Failed to delete document from vector store: ${error.message}`);
  }
}
