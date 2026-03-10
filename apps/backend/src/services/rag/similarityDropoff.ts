import { Document } from 'langchain/document';
import { createLogger } from '../../lib/logger.js';

const logger = createLogger('DROPOFF');

/**
 * Filters documents using similarity drop-off with normalized real scores.
 *
 * If docs have vectorScore and/or bm25Score (real relevance scores),
 * normalizes them to 0-1 via min-max and combines with weights.
 * Falls back to scoreField (e.g. ensembleScore) if no real scores available.
 *
 * Formula: drop = 1 - (normalizedScore / bestNormalizedScore)
 * If drop > maxDrop → discard
 *
 * Always keeps at least `minDocs` documents.
 */
export function applySimilarityDropoff(
  docs: Document[],
  maxDrop: number,
  minDocs: number = 1,
  scoreField: string = 'ensembleScore',
  weights: { vector: number; bm25: number } = { vector: 0.6, bm25: 0.4 }
): Document[] {
  if (docs.length <= minDocs) {
    return docs;
  }

  // Try to use real scores (vectorScore + bm25Score)
  const hasVectorScores = docs.some(d => (d as any).vectorScore !== undefined);
  const hasBm25Scores = docs.some(d => (d as any).bm25Score !== undefined);
  const hasRealScores = hasVectorScores || hasBm25Scores;

  let normalizedScores: number[];

  if (hasRealScores) {
    logger.log(`Using real scores: vector=${hasVectorScores}, bm25=${hasBm25Scores}`);
    normalizedScores = computeNormalizedScores(docs, hasVectorScores, hasBm25Scores, weights);
  } else {
    // Fallback to positional score (ensembleScore, rerankScore, etc.)
    logger.log(`No real scores found, falling back to ${scoreField}`);
    const rawScores = docs.map(d => (d as any)[scoreField] as number ?? 0);
    normalizedScores = minMaxNormalize(rawScores);
  }

  const bestScore = Math.max(...normalizedScores);

  if (bestScore === 0) {
    logger.log('All scores are zero, keeping all documents');
    return docs;
  }

  const filtered: Document[] = [];

  for (let i = 0; i < docs.length; i++) {
    const score = normalizedScores[i];
    const drop = 1 - (score / bestScore);

    if (drop <= maxDrop || filtered.length < minDocs) {
      filtered.push(docs[i]);
      logger.log(`Doc ${i}: score=${score.toFixed(3)}, drop=${(drop * 100).toFixed(1)}% → KEEP`);
    } else {
      logger.log(`Doc ${i}: score=${score.toFixed(3)}, drop=${(drop * 100).toFixed(1)}% → DROP (>${(maxDrop * 100).toFixed(0)}%)`);
    }
  }

  logger.log(`Similarity drop-off: ${docs.length} → ${filtered.length} docs (maxDrop=${(maxDrop * 100).toFixed(0)}%, minDocs=${minDocs})`);
  return filtered;
}

function computeNormalizedScores(
  docs: Document[],
  hasVector: boolean,
  hasBm25: boolean,
  weights: { vector: number; bm25: number }
): number[] {
  const vectorScores = docs.map(d => (d as any).vectorScore as number ?? 0);
  const bm25Scores = docs.map(d => (d as any).bm25Score as number ?? 0);

  const normVector = hasVector ? minMaxNormalize(vectorScores) : vectorScores.map(() => 0);
  const normBm25 = hasBm25 ? minMaxNormalize(bm25Scores) : bm25Scores.map(() => 0);

  // Adjust weights if only one score type is available
  let vWeight = weights.vector;
  let bWeight = weights.bm25;
  if (!hasVector) { vWeight = 0; bWeight = 1; }
  if (!hasBm25) { vWeight = 1; bWeight = 0; }

  return docs.map((_, i) => normVector[i] * vWeight + normBm25[i] * bWeight);
}

function minMaxNormalize(scores: number[]): number[] {
  const min = Math.min(...scores);
  const max = Math.max(...scores);

  if (max === min) return scores.map(() => 1);

  return scores.map(s => (s - min) / (max - min));
}
