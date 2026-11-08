import assert from 'node:assert/strict';
import test from 'node:test';
import { createDirectory } from '../engine/door-directory.js';

const response = data => ({ ok: true, json: async () => data });
const snapshot = { updated: '2026-11-08T00:00:00Z', worlds: [{ url: 'https://example.com/' }], blocked: ['https://blocked.example/'] };

test('empty sources do not fetch; duplicate and invalid sources are removed', async context => {
  const fetcher = context.mock.method(globalThis, 'fetch', async () => response(snapshot));
  const empty = createDirectory(null);
  assert.equal(empty.peek(), null);
  assert.equal(await empty.read(), null);
  assert.equal(fetcher.mock.callCount(), 0);
  assert.deepEqual(await createDirectory(['https://example.com/list', '', null, 42, 'https://example.com/list']).read(), snapshot);
  assert.equal(fetcher.mock.callCount(), 1);
});

test('the fastest valid mirror wins and the stalled request is aborted', async context => {
  let stalledSignal;
  context.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(options.credentials, 'omit');
    if (url === 'https://slow.example/') {
      stalledSignal = options.signal;
      return new Promise((resolve, reject) => options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true }));
    }
    if (url === 'https://invalid.example/') return response({ message: 'Not a directory' });
    return response(snapshot);
  });
  const directory = createDirectory(['https://slow.example/', 'https://invalid.example/', 'https://fast.example/']);
  assert.deepEqual(await directory.read(), snapshot);
  assert.equal(stalledSignal.aborted, true);
});

test('concurrent and forced reads share the pending request', async context => {
  let finish;
  const fetcher = context.mock.method(globalThis, 'fetch', () => new Promise(resolve => { finish = resolve; }));
  const directory = createDirectory(['https://example.com/list']);
  const pending = directory.read();
  assert.equal(directory.read(), pending);
  assert.equal(directory.read(true), pending);
  assert.equal(directory.peek(), null);
  assert.equal(fetcher.mock.callCount(), 1);
  finish(response(snapshot));
  assert.equal(await pending, snapshot);
  assert.equal(directory.peek(), snapshot);
});

test('the cache lasts one minute and explicit refresh bypasses it', async context => {
  let clock = 100000;
  context.mock.method(Date, 'now', () => clock);
  const fetcher = context.mock.method(globalThis, 'fetch', async () => response(snapshot));
  const directory = createDirectory(['https://example.com/list']);
  await directory.read();
  clock += 59999;
  assert.equal(await directory.read(), snapshot);
  assert.equal(fetcher.mock.callCount(), 1);
  clock++;
  await directory.read();
  assert.equal(fetcher.mock.callCount(), 2);
  await directory.read(true);
  assert.equal(fetcher.mock.callCount(), 3);
});

test('an initial failure remains retryable; a failed refresh preserves the cached block list', async context => {
  let unavailable = true;
  const fetcher = context.mock.method(globalThis, 'fetch', async () => unavailable ? { ok: false } : response(snapshot));
  const directory = createDirectory(['https://example.com/list']);
  assert.equal(await directory.read(), null);
  assert.equal(await directory.read(), null);
  assert.equal(fetcher.mock.callCount(), 2);
  unavailable = false;
  assert.equal(await directory.read(), snapshot);
  unavailable = true;
  assert.equal(await directory.read(true), snapshot);
  assert.deepEqual(directory.peek().blocked, snapshot.blocked);
  assert.equal(await directory.read(), snapshot);
  assert.equal(fetcher.mock.callCount(), 4);
});

test('an older mirror cannot replace a newer snapshot', async context => {
  let incoming = snapshot;
  context.mock.method(globalThis, 'fetch', async () => response(incoming));
  const directory = createDirectory(['https://example.com/list']);
  await directory.read();
  incoming = { updated: '2026-11-07T00:00:00Z', worlds: [], blocked: [] };
  assert.equal(await directory.read(true), snapshot);
  incoming = { updated: '2026-11-09T00:00:00Z', worlds: [], blocked: [] };
  assert.equal(await directory.read(true), incoming);
});

test('timeouts abort requests and allow a later retry', async context => {
  let requestSignal;
  const fetcher = context.mock.method(globalThis, 'fetch', (url, { signal }) => {
    requestSignal = signal;
    return new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }));
  });
  const directory = createDirectory(['https://example.com/list'], { timeout: 10 });
  assert.equal(await directory.read(), null);
  assert.equal(requestSignal.aborted, true);
  fetcher.mock.mockImplementation(async () => response([]));
  assert.deepEqual(await directory.read(), []);
});
