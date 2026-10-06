// Loads server/data/config.json — every tunable lives here, no magic numbers in code.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_DIR = path.join(__dirname, '..', 'data');

let cached = null;
let cachedDir = null;

/** Load (and cache) config from dir. Pass a different dir in tests. */
export function loadConfig(dir = DEFAULT_DIR) {
  if (cached && cachedDir === dir) return cached;
  const raw = fs.readFileSync(path.join(dir, 'config.json'), 'utf8');
  cached = JSON.parse(raw);
  cachedDir = dir;
  return cached;
}

/** Test hook: bypass the cache with an explicit config object. */
export function setConfigForTest(cfg) {
  cached = cfg;
  cachedDir = '__test__';
  return cfg;
}

export function resetConfigCache() {
  cached = null;
  cachedDir = null;
}
