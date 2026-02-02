import { promises as fs } from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export type OptimizationConfig =
  | 'baseline'
  | 'bm25'
  | 'rerank'
  | 'parent'
  | 'bm25-rerank'
  | 'bm25-parent'
  | 'rerank-parent'
  | 'full';

export interface ConfigSettings {
  USE_BM25_RETRIEVER: boolean;
  BM25_WEIGHT?: number;
  VECTOR_WEIGHT?: number;
  USE_RERANKER: boolean;
  RERANKER_RETRIEVAL_TOP_K?: number;
  RERANKER_FINAL_TOP_K?: number;
  USE_PARENT_RETRIEVER: boolean;
  PARENT_CHUNK_SIZE?: number;
  CHILD_CHUNK_SIZE?: number;
  CHILD_CHUNK_OVERLAP?: number;
  PARENT_CHUNK_OVERLAP?: number;
}

const CONFIG_MAP: Record<OptimizationConfig, ConfigSettings> = {
  baseline: {
    USE_BM25_RETRIEVER: false,
    USE_RERANKER: false,
    USE_PARENT_RETRIEVER: false,
  },
  bm25: {
    USE_BM25_RETRIEVER: true,
    BM25_WEIGHT: 0.7,
    VECTOR_WEIGHT: 0.3,
    USE_RERANKER: false,
    USE_PARENT_RETRIEVER: false,
  },
  rerank: {
    USE_BM25_RETRIEVER: false,
    USE_RERANKER: true,
    RERANKER_RETRIEVAL_TOP_K: 20,
    RERANKER_FINAL_TOP_K: 5,
    USE_PARENT_RETRIEVER: false,
  },
  parent: {
    USE_BM25_RETRIEVER: false,
    USE_RERANKER: false,
    USE_PARENT_RETRIEVER: true,
    PARENT_CHUNK_SIZE: 1000,
    CHILD_CHUNK_SIZE: 200,
    CHILD_CHUNK_OVERLAP: 50,
    PARENT_CHUNK_OVERLAP: 200,
  },
  'bm25-rerank': {
    USE_BM25_RETRIEVER: true,
    BM25_WEIGHT: 0.7,
    VECTOR_WEIGHT: 0.3,
    USE_RERANKER: true,
    RERANKER_RETRIEVAL_TOP_K: 20,
    RERANKER_FINAL_TOP_K: 5,
    USE_PARENT_RETRIEVER: false,
  },
  'bm25-parent': {
    USE_BM25_RETRIEVER: true,
    BM25_WEIGHT: 0.7,
    VECTOR_WEIGHT: 0.3,
    USE_RERANKER: false,
    USE_PARENT_RETRIEVER: true,
    PARENT_CHUNK_SIZE: 1000,
    CHILD_CHUNK_SIZE: 200,
    CHILD_CHUNK_OVERLAP: 50,
    PARENT_CHUNK_OVERLAP: 200,
  },
  'rerank-parent': {
    USE_BM25_RETRIEVER: false,
    USE_RERANKER: true,
    RERANKER_RETRIEVAL_TOP_K: 20,
    RERANKER_FINAL_TOP_K: 5,
    USE_PARENT_RETRIEVER: true,
    PARENT_CHUNK_SIZE: 1000,
    CHILD_CHUNK_SIZE: 200,
    CHILD_CHUNK_OVERLAP: 50,
    PARENT_CHUNK_OVERLAP: 200,
  },
  full: {
    USE_BM25_RETRIEVER: true,
    BM25_WEIGHT: 0.7,
    VECTOR_WEIGHT: 0.3,
    USE_RERANKER: true,
    RERANKER_RETRIEVAL_TOP_K: 20,
    RERANKER_FINAL_TOP_K: 5,
    USE_PARENT_RETRIEVER: true,
    PARENT_CHUNK_SIZE: 1000,
    CHILD_CHUNK_SIZE: 200,
    CHILD_CHUNK_OVERLAP: 50,
    PARENT_CHUNK_OVERLAP: 200,
  },
};

export function getConfigSettings(config: OptimizationConfig): ConfigSettings {
  return CONFIG_MAP[config];
}

function updateEnvVariables(envContent: string, settings: ConfigSettings): string {
  let updatedEnv = envContent;

  // Update each setting
  for (const [key, value] of Object.entries(settings)) {
    const regex = new RegExp(`^${key}=.*$`, 'm');
    const newLine = `${key}=${value}`;

    if (regex.test(updatedEnv)) {
      // Update existing variable
      updatedEnv = updatedEnv.replace(regex, newLine);
    } else {
      // Add new variable at the end
      updatedEnv += `\n${newLine}`;
    }
  }

  return updatedEnv;
}

export async function waitForBackend(maxRetries = 30, retryDelay = 2000): Promise<void> {
  const healthUrl = 'http://localhost:3001/health';

  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(healthUrl);
      if (response.ok) {
        const data = await response.json();
        if (data.status === 'ok') {
          console.log(`✅ Backend health check passed (attempt ${i + 1}/${maxRetries})`);
          return;
        }
      }
    } catch (error) {
      // Connection refused or other error - backend not ready yet
    }

    if (i < maxRetries - 1) {
      console.log(`⏳ Waiting for backend... (attempt ${i + 1}/${maxRetries})`);
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
    }
  }

  throw new Error(`Backend health check failed after ${maxRetries} attempts`);
}

export async function applyConfig(config: OptimizationConfig): Promise<void> {
  console.log(`\n🔧 Applying configuration: ${config}`);

  // 1. Get settings for this config
  const settings = getConfigSettings(config);

  // 2. Read current .env file
  const envPath = path.join(process.cwd(), 'apps/backend/.env');
  const currentEnv = await fs.readFile(envPath, 'utf-8');

  // 3. Update environment variables
  const updatedEnv = updateEnvVariables(currentEnv, settings);

  // 4. Write updated .env
  await fs.writeFile(envPath, updatedEnv, 'utf-8');
  console.log('✅ Updated .env file');

  // Log the applied settings
  console.log('📋 Configuration settings:');
  for (const [key, value] of Object.entries(settings)) {
    console.log(`   ${key}=${value}`);
  }

  // 5. Restart backend
  console.log('\n🔄 Restarting backend...');

  try {
    // Kill ALL npm dev processes and node processes (more aggressive)
    await execAsync('pkill -9 -f "npm run dev:backend" || true');
    await execAsync('pkill -9 -f "npm run dev" || true');
    await execAsync('lsof -ti :3001 | xargs kill -9 || true');

    console.log('✅ Killed all existing backend processes');
  } catch (error) {
    console.log('⚠️  Error stopping backend (may not be running)');
  }

  // Wait longer for all processes to fully terminate and port to be released
  await new Promise((resolve) => setTimeout(resolve, 5000));

  // Start backend using the project's npm script
  const projectRoot = process.cwd();
  const logFile = path.join(projectRoot, 'benchmark/evaluation/results/backend.log');

  // Ensure results directory exists
  await fs.mkdir(path.join(projectRoot, 'benchmark/evaluation/results'), { recursive: true });

  // Clear the log file to make debugging easier
  await fs.writeFile(logFile, '', 'utf-8');

  // Start backend using the workspace script (this properly loads .env)
  // Using exec (non-async) to start in background without waiting for completion
  exec(
    `cd ${projectRoot} && nohup npm run dev:backend > ${logFile} 2>&1 &`,
    { shell: '/bin/bash', detached: true },
    (error) => {
      if (error) console.error('⚠️  Warning during backend start:', error.message);
    }
  );
  console.log('✅ Started backend process');

  console.log(`📝 Backend logs: ${logFile}`);

  // Give the process time to actually start and initialize
  await new Promise((resolve) => setTimeout(resolve, 3000));

  // 6. Wait for backend to be ready
  console.log('\n⏳ Waiting for backend to be ready...');
  await waitForBackend();
  console.log('✅ Backend is ready!\n');
}

export function getConfigDescription(config: OptimizationConfig): string {
  const descriptions: Record<OptimizationConfig, string> = {
    baseline: 'Vector search only (no optimizations)',
    bm25: 'BM25 ensemble (70/30) - keyword matching',
    rerank: 'Cross-encoder reranking - precision boost',
    parent: 'Parent document retriever - more context',
    'bm25-rerank': 'BM25 + Reranking - keywords + precision',
    'bm25-parent': 'BM25 + Parent - keywords + context',
    'rerank-parent': 'Reranking + Parent - precision + context',
    full: 'All optimizations enabled',
  };

  return descriptions[config];
}

export const ALL_CONFIGS: OptimizationConfig[] = [
  'baseline',
  'bm25',
  'rerank',
  'parent',
  'bm25-rerank',
  'bm25-parent',
  'rerank-parent',
  'full',
];
