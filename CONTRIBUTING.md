# Contributing to Homecraft

See the [public directory](docs/worlds.md) for the [Request listing](https://github.com/terryHu7/homecraft/issues/new/choose) process.

## Submitting Project Changes

- Open an issue describing the problem and proposed changes. For changes to `engine/`, explain the effect on existing websites.
- Keep the [portal protocol](docs/protocol.md) backward compatible. New fields may be added; existing fields must not be renamed, removed, or given a different meaning. After changing `engine/door-*.js`, run `node tools/sync-protocol.mjs` to sync updates to `plugin/`.
- Follow the development conventions in [AGENTS.md](AGENTS.md). Check interface changes in both Chinese and English, on desktop and mobile.
- Run `npm run check:site` before submitting. After installing dependencies, run `npm run check` and `npm run check:portal`.
- When releasing a new engine version, the maintainer runs `node tools/engine-manifest.mjs <version>` to update `engine/manifest.json`.
