import { Document } from 'langchain/document';
import { createLogger } from '../../lib/logger.js';

const logger = createLogger('DROPOFF');

/**
 * Filters documents using similarity drop-off: removes documents whose
 * score drops more than `maxDrop` relative to the best result.
 *
 * Formula: drop = 1 - (shiftedScore / bestShiftedScore)
 * If drop > maxDrop → discard
 *
 * Handles rerank scores (logits, can be negative) by shifting to positive space.
 * Always keeps at least `minDocs` documents.
 *
 * Example with maxDrop=0.20:
 *   Scores: [8.2, 7.9, 3.1, 1.2, -0.5] → shifted: [8.7, 8.4, 3.6, 1.7, 0]
 *   Drops:  [0%, 3.4%, 58.6%, 80.5%, 100%]
 *   Result: keeps first 2 (+ minDocs guarantee)
 */
export function applySimilarityDropoff(
  docs: Document[],
  maxDrop: number,
  minDocs: number = 1,
  scoreField: string = 'rerankScore'
): Document[] {
  if (docs.length <= minDocs) {
    return docs;
  }

  const scores = docs.map(doc => (doc as any)[scoreField] as number | undefined);
  const validScores = scores.filter((s): s is number => s !== undefined);

  if (validScores.length === 0) {
    logger.log('No scores found, skipping drop-off filter');
    return docs;
  }

  const minScore = Math.min(...validScores);
  const maxScore = Math.max(...validScores);

  if (maxScore === minScore) {
    logger.log('All scores identical, keeping all documents');
    return docs;
  }

  // Shift to positive space if there are negative values (logits from reranker)
  const shift = minScore < 0 ? Math.abs(minScore) : 0;
  const bestScore = maxScore + shift;

  const filtered: Document[] = [];

  for (let i = 0; i < docs.length; i++) {
    const score = scores[i];

    if (score === undefined) {
      if (filtered.length < minDocs) filtered.push(docs[i]);
      continue;
    }

    const shiftedScore = score + shift;
    const drop = 1 - (shiftedScore / bestScore);

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
