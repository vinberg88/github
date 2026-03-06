export function getRedisUrl(): string | null {
  return process.env.REDIS_URL ?? null;
}
