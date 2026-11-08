export function createDirectory(sources, { maxAge = 60000, timeout = 3500 } = {}) {
  const urls = [...new Set((Array.isArray(sources) ? sources : []).filter(url => typeof url === 'string' && url))];
  let snapshot = null, checkedAt = null, pending = null;
  return {
    peek: () => snapshot,
    read(force = false) {
      if (pending) return pending;
      if (!urls.length || (!force && checkedAt !== null && Date.now() - checkedAt < maxAge)) return Promise.resolve(snapshot);
      pending = fetchFirst(urls, timeout).then(data => {
        if (data) {
          const previous = Date.parse(snapshot?.updated), next = Date.parse(data.updated);
          if (!(previous > next)) snapshot = data;
        }
        if (snapshot) checkedAt = Date.now();
        return snapshot;
      }).finally(() => { pending = null; });
      return pending;
    },
  };
}

async function fetchFirst(urls, ms) {
  const abort = new AbortController(), timer = setTimeout(() => abort.abort(), ms);
  try {
    return await Promise.any(urls.map(async url => {
      const response = await fetch(url, { signal: abort.signal, credentials: 'omit' });
      if (!response.ok) throw new Error('Directory unavailable');
      const data = await response.json();
      if (!Array.isArray(data) && !Array.isArray(data?.worlds)) throw new Error('Invalid directory');
      return data;
    }));
  } catch { return null; }
  finally { clearTimeout(timer); abort.abort(); }
}
