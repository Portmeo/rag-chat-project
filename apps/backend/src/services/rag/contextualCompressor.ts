import { Document } from 'langchain/document';
import { createLogger } from '../../lib/logger.js';

const logger = createLogger('COMPRESS');

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

function splitIntoSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map(s => s.trim())
    .filter(s => s.length > 25); // Ignorar fragmentos muy cortos (headers, etc.)
}

export async function compressDocuments(
  query: string,
  docs: Document[],
  embeddingsModel: { embedQuery: (text: string) => Promise<number[]>; embedDocuments: (texts: string[]) => Promise<number[][]> },
  threshold: number = 0.30
): Promise<Document[]> {
  if (docs.length === 0) return docs;

  const queryEmbedding = await embeddingsModel.embedQuery(query);
  const compressed: Document[] = [];

  for (const doc of docs) {
    const sentences = splitIntoSentences(doc.pageContent);

    if (sentences.length <= 2) {
      compressed.push(doc);
      continue;
    }

    const sentenceEmbeddings = await embeddingsModel.embedDocuments(sentences);

    const relevantSentences = sentences.filter((_, i) => {
      const sim = cosineSimilarity(queryEmbedding, sentenceEmbeddings[i]);
      return sim >= threshold;
    });

    // Si nada pasa el threshold, conservar las 2 primeras frases
    const finalSentences = relevantSentences.length > 0
      ? relevantSentences
      : sentences.slice(0, 2);

    const ratio = (finalSentences.length / sentences.length * 100).toFixed(0);
    logger.log(`${(doc.metadata as any).filename}: ${sentences.length} → ${finalSentences.length} frases (${ratio}% kept)`);

    const compressedDoc = new Document({
      pageContent: finalSentences.join(' '),
      metadata: doc.metadata,
    });

    if ((doc as any).rerankScore !== undefined) {
      (compressedDoc as any).rerankScore = (doc as any).rerankScore;
    }

    compressed.push(compressedDoc);
  }

  return compressed;
}
