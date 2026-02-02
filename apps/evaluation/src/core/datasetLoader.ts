import type { EvaluationDataset } from './types';
import { readFile } from 'fs/promises';

export async function loadDataset(datasetPath: string): Promise<EvaluationDataset> {
  try {
    const content = await readFile(datasetPath, 'utf-8');
    const dataset = JSON.parse(content) as EvaluationDataset;

    console.log(`📂 Loaded dataset: ${dataset.test_cases.length} test cases (version ${dataset.version})`);

    return dataset;
  } catch (error: any) {
    throw new Error(`Failed to load dataset from ${datasetPath}: ${error.message}`);
  }
}

export function validateDataset(dataset: EvaluationDataset): void {
  if (!dataset.version || !dataset.test_cases || !Array.isArray(dataset.test_cases)) {
    throw new Error('Invalid dataset format: missing version or test_cases');
  }

  for (const testCase of dataset.test_cases) {
    if (!testCase.id || !testCase.question || !testCase.expected_contexts) {
      throw new Error(`Invalid test case: ${JSON.stringify(testCase)}`);
    }
  }
}
