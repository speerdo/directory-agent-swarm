import { Queue, QueueEvents } from 'bullmq';
import { getConnectionOptions } from './connection.js';

export const QUEUE_NAMES = {
  NICHE_RESEARCH: 'niche-research',
  DISCOVERY: 'discovery',
  VERIFICATION: 'verification',
  ENRICHMENT: 'enrichment',
  CONTENT: 'content',
  QA: 'qa',
  SUPERVISOR: 'supervisor',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

// Queue configurations
export interface QueueConfig {
  name: QueueName;
  defaultJobOptions?: {
    attempts?: number;
    backoff?: { type: 'exponential' | 'fixed'; delay: number };
    removeOnComplete?: boolean | number;
    removeOnFail?: boolean | number;
  };
  concurrency?: number;
}

const QUEUE_CONFIGS: Record<QueueName, QueueConfig> = {
  [QUEUE_NAMES.NICHE_RESEARCH]: {
    name: QUEUE_NAMES.NICHE_RESEARCH,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: 100,
      removeOnFail: 100,
    },
    concurrency: 1,
  },
  [QUEUE_NAMES.DISCOVERY]: {
    name: QUEUE_NAMES.DISCOVERY,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: 100,
      removeOnFail: 100,
    },
    concurrency: 5,
  },
  [QUEUE_NAMES.VERIFICATION]: {
    name: QUEUE_NAMES.VERIFICATION,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: 100,
      removeOnFail: 100,
    },
    concurrency: 3,
  },
  [QUEUE_NAMES.ENRICHMENT]: {
    name: QUEUE_NAMES.ENRICHMENT,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: 100,
      removeOnFail: 100,
    },
    concurrency: 5,
  },
  [QUEUE_NAMES.CONTENT]: {
    name: QUEUE_NAMES.CONTENT,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: 100,
      removeOnFail: 100,
    },
    concurrency: 3,
  },
  [QUEUE_NAMES.QA]: {
    name: QUEUE_NAMES.QA,
    defaultJobOptions: {
      attempts: 2,
      backoff: { type: 'fixed', delay: 5000 },
      removeOnComplete: 50,
      removeOnFail: 50,
    },
    concurrency: 2,
  },
  [QUEUE_NAMES.SUPERVISOR]: {
    name: QUEUE_NAMES.SUPERVISOR,
    defaultJobOptions: {
      attempts: 5,
      backoff: { type: 'exponential', delay: 10000 },
      removeOnComplete: 10,
      removeOnFail: 10,
    },
    concurrency: 1,
  },
};

// Create a queue
export function createQueue(queueName: QueueName): Queue {
  const config = QUEUE_CONFIGS[queueName];
  return new Queue(queueName, {
    connection: getConnectionOptions(),
    defaultJobOptions: config.defaultJobOptions,
  });
}

// Get or create a queue (singleton)
const queueCache = new Map<QueueName, Queue>();
const queueEventsCache = new Map<QueueName, QueueEvents>();

export function getQueue(queueName: QueueName): Queue {
  if (!queueCache.has(queueName)) {
    queueCache.set(queueName, createQueue(queueName));
  }
  return queueCache.get(queueName)!;
}

export function getQueueEvents(queueName: QueueName): QueueEvents {
  if (!queueEventsCache.has(queueName)) {
    queueEventsCache.set(queueName, new QueueEvents(queueName, {
      connection: getConnectionOptions(),
    }));
  }
  return queueEventsCache.get(queueName)!;
}

// Get all queues
export function getAllQueues(): Queue[] {
  return Object.values(QUEUE_NAMES).map(name => getQueue(name));
}

// Get queue config
export function getQueueConfig(queueName: QueueName): QueueConfig {
  return QUEUE_CONFIGS[queueName];
}

// Close all queues
export async function closeAllQueues(): Promise<void> {
  await Promise.all(
    Array.from(queueCache.values()).map(queue => queue.close())
  );
  queueCache.clear();

  await Promise.all(
    Array.from(queueEventsCache.values()).map(events => events.close())
  );
  queueEventsCache.clear();
}
