import { Redis } from 'ioredis';

let _connection: Redis | undefined;

function getRedisUrl(): string {
  return process.env.REDIS_URL ?? 'redis://localhost:6379';
}

export function getRedisConnection(): Redis {
  if (!_connection) {
    const url = getRedisUrl();
    _connection = new Redis(url, { maxRetriesPerRequest: null });
  }
  return _connection;
}

export async function closeRedisConnection(): Promise<void> {
  if (_connection) {
    await _connection.quit();
    _connection = undefined;
  }
}

// BullMQ requires an ioredis instance for its connection option
export function getConnectionOptions(): Redis {
  return getRedisConnection();
}
