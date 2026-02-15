import { Worker } from 'bullmq';
import { getQueueConfig, type QueueName } from './queues.js';
import { getConnectionOptions } from './connection.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('workers');

// Worker configuration
export interface WorkerConfig {
  queueName: QueueName;
  processor: (job: {
    id: string;
    data: unknown;
    updateProgress: (progress: number) => Promise<void>;
    log: (message: string) => void;
  }) => Promise<unknown>;
}

const workerCache = new Map<QueueName, Worker>();

export function createWorker(config: WorkerConfig): Worker {
  const queueConfig = getQueueConfig(config.queueName);

  const worker = new Worker(config.queueName, async (job) => {
    logger.info({ jobId: job.id, queue: config.queueName }, 'Processing job');

    try {
      const result = await config.processor({
        id: job.id ?? 'unknown',
        data: job.data,
        updateProgress: async (progress: number) => {
          await job.updateProgress(progress);
        },
        log: (message: string) => {
          logger.info({ jobId: job.id }, message);
        },
      });

      logger.info({ jobId: job.id, queue: config.queueName }, 'Job completed');
      return result;
    } catch (error) {
      logger.error({ jobId: job.id, queue: config.queueName, error }, 'Job failed');
      throw error;
    }
  }, {
    connection: getConnectionOptions() as any, // Type cast due to ioredis version mismatch in lockfile
    concurrency: queueConfig.concurrency,
  });

  worker.on('completed', (job) => {
    logger.debug({ jobId: job.id, queue: config.queueName }, 'Job completed event');
  });

  worker.on('failed', (job, error) => {
    logger.error({ jobId: job?.id, queue: config.queueName, error }, 'Job failed event');
  });

  worker.on('error', (error) => {
    logger.error({ queue: config.queueName, error }, 'Worker error');
  });

  workerCache.set(config.queueName, worker);
  return worker;
}

export function getWorker(queueName: QueueName): Worker | undefined {
  return workerCache.get(queueName);
}

export async function closeWorker(queueName: QueueName): Promise<void> {
  const worker = workerCache.get(queueName);
  if (worker) {
    await worker.close();
    workerCache.delete(queueName);
  }
}

export async function closeAllWorkers(): Promise<void> {
  await Promise.all(
    Array.from(workerCache.values()).map(worker => worker.close())
  );
  workerCache.clear();
}

// Utility to get queue stats
export async function getQueueStats(queueName: QueueName): Promise<{
  waiting: number;
  active: number;
  completed: number;
  failed: number;
}> {
  const { getQueue } = await import('./queues.js');
  const queue = getQueue(queueName);
  const counts = await queue.getJobCounts('waiting', 'active', 'completed', 'failed');
  return {
    waiting: counts.waiting ?? 0,
    active: counts.active ?? 0,
    completed: counts.completed ?? 0,
    failed: counts.failed ?? 0,
  };
}
