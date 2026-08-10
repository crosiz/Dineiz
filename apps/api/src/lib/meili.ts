import type { MeiliSearch } from 'meilisearch';
import { MeiliSearch as MeiliClient } from 'meilisearch';

let client: MeiliSearch | null = null;

export function getMeili() {
  if (client) return client;
  const host = process.env.MEILI_HOST || 'http://localhost:7700';
  const apiKey = process.env.MEILI_MASTER_KEY || process.env.MEILI_API_KEY || 'masterKeyForDevelopmentOnly123';
  client = new MeiliClient({ host, apiKey });
  return client;
}

