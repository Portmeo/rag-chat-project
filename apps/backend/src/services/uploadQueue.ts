/**
 * Simple upload queue implementation without external dependencies
 * Limits concurrent uploads to prevent server overload
 */
export class UploadQueue {
  private concurrency: number;
  private activeUploads = 0;
  private queue: Array<() => Promise<any>> = [];

  constructor(concurrency: number = 3) {
    this.concurrency = concurrency;
  }

  /**
   * Add an upload task to the queue
   * If there's available capacity, it executes immediately
   * Otherwise, it waits in the queue
   */
  async addUpload<T>(filename: string, processFn: () => Promise<T>): Promise<T> {
    // If there's capacity, execute immediately
    if (this.activeUploads < this.concurrency) {
      return this.executeUpload(processFn);
    }

    // Otherwise, add to queue and wait
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await this.executeUpload(processFn);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  /**
   * Execute an upload task and manage the queue
   */
  private async executeUpload<T>(processFn: () => Promise<T>): Promise<T> {
    this.activeUploads++;
    console.log(`[UploadQueue] Active uploads: ${this.activeUploads}/${this.concurrency}, Queue: ${this.queue.length}`);

    try {
      return await processFn();
    } finally {
      this.activeUploads--;
      this.processNext();
    }
  }

  /**
   * Process the next item in the queue if there's capacity
   */
  private processNext() {
    if (this.queue.length > 0 && this.activeUploads < this.concurrency) {
      const next = this.queue.shift();
      if (next) next();
    }
  }

  /**
   * Get current queue status
   */
  getStatus() {
    return {
      activeUploads: this.activeUploads,
      queuedUploads: this.queue.length,
      concurrency: this.concurrency,
    };
  }
}

// Global upload queue instance with max 3 concurrent uploads
export const uploadQueue = new UploadQueue(3);
