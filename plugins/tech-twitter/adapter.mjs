import { collectTechTwitter, testTechTwitter } from './collector.mjs';
import { ok } from '../x-search/result.mjs';

export function createAdapter({ fetchImpl = fetch, onProgress = () => {} } = {}) {
  return {
    test: (source) => testTechTwitter(source, { fetchImpl }),
    collect: async (source) => {
      onProgress('正在读取 TechTwitter Trending、Streams、Articles 和 Threads');
      const items = await collectTechTwitter(source, { fetchImpl, onProgress });
      return ok(items, { provider: 'TechTwitter', fetchMethod: 'public-trending-streams-articles-threads', failedSurfaces: items.collectionInfo?.failedSurfaces || [] });
    },
  };
}
