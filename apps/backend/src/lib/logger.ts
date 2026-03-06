const LOGS_ENABLED = process.env.RAG_LOGS === 'true';

export function createLogger(layer: string) {
  return {
    log: (...args: unknown[]) => {
      if (LOGS_ENABLED) console.log(`[${layer}]`, ...args);
    },
    error: (...args: unknown[]) => {
      console.error(`[${layer}]`, ...args);
    },
    warn: (...args: unknown[]) => {
      console.warn(`[${layer}]`, ...args);
    },
  };
}
