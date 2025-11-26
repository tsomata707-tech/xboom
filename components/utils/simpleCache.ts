
const cache = new Map<string, any>();

export const getCached = (key: string) => cache.get(key);

export const setCached = (key: string, data: any, ttl = 60000) => {
  cache.set(key, data);
  setTimeout(() => {
    cache.delete(key);
  }, ttl);
};
