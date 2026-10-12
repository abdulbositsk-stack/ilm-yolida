import { getStore as getNetlifyStore } from '@netlify/blobs';
import { BlobPreconditionFailedError, del, get, list, put } from '@vercel/blob';

function vercelBlobStore(name) {
  const prefix = `ilm-yolida/${name}/`;
  const pathname = key => `${prefix}${key}.json`;

  return {
    async get(key) {
      const result = await get(pathname(key), { access: 'private', useCache: false });
      if (!result?.stream) return null;
      const saved = await new Response(result.stream).json();
      return saved && Object.hasOwn(saved, 'value') ? saved.value : saved;
    },
    async setJSON(key, value, options = {}) {
      try {
        await put(pathname(key), JSON.stringify({ value, metadata: options.metadata || null }), {
          access: 'private',
          addRandomSuffix: false,
          allowOverwrite: !options.onlyIfNew,
          cacheControlMaxAge: 60,
          contentType: 'application/json',
        });
        return { modified: true };
      } catch (error) {
        if (options.onlyIfNew && error instanceof BlobPreconditionFailedError) return { modified: false };
        throw error;
      }
    },
    async delete(key) {
      await del(pathname(key), { access: 'private' });
    },
    async *list() {
      let cursor;
      do {
        const page = await list({ prefix, cursor, limit: 1000 });
        const blobs = await Promise.all(page.blobs.map(async blob => {
          const result = await get(blob.pathname, { access: 'private', useCache: false });
          let saved = null;
          if (result?.stream) {
            try { saved = await new Response(result.stream).json(); } catch { saved = null; }
          }
          return {
            key: blob.pathname.slice(prefix.length).replace(/\.json$/, ''),
            metadata: saved?.metadata || {},
          };
        }));
        yield { blobs };
        cursor = page.hasMore ? page.cursor : undefined;
      } while (cursor);
    },
  };
}

export function persistentStore(name) {
  return process.env.VERCEL === '1'
    ? vercelBlobStore(name)
    : getNetlifyStore({ name, consistency: 'strong' });
}
