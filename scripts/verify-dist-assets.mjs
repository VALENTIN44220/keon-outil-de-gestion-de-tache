/**
 * Fail CI/deploy if the build output references assets missing from dist/.
 * Missing chunks often surface as Firefox NS_ERROR_CORRUPTED_CONTENT (SPA fallback HTML served as JS).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
const indexPath = path.join(dist, 'index.html');

function addAssetUrls(set, rel) {
  if (!rel || typeof rel !== 'string') return;
  const n = rel.replace(/^\//, '');
  if (n.startsWith('assets/')) set.add('/' + n);
}

function collectFromViteManifest(manifest) {
  const urls = new Set();
  const visited = new Set();

  function walk(entryKey) {
    if (!entryKey || visited.has(entryKey)) return;
    visited.add(entryKey);
    const e = manifest[entryKey];
    if (!e) return;

    addAssetUrls(urls, e.file);
    for (const c of e.css || []) addAssetUrls(urls, c);
    for (const a of e.assets || []) addAssetUrls(urls, a);

    for (const i of e.imports || []) walk(i);
    for (const d of e.dynamicImports || []) walk(d);
  }

  if (manifest['index.html']) {
    walk('index.html');
  } else {
    const htmlKeys = Object.keys(manifest).filter((k) => k.endsWith('index.html') || k === 'index.html');
    if (htmlKeys.length > 0) walk(htmlKeys[0]);
    else for (const k of Object.keys(manifest)) walk(k);
  }

  return urls;
}

if (!fs.existsSync(indexPath)) {
  console.error('verify-dist-assets: dist/index.html not found — run vite build first');
  process.exit(1);
}

const manifestPathCandidates = [
  path.join(dist, '.vite', 'manifest.json'),
  path.join(dist, 'manifest.json'),
];

let refs = new Set();
let source = 'index.html';

const manifestPath = manifestPathCandidates.find((p) => fs.existsSync(p));
if (manifestPath) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  refs = collectFromViteManifest(manifest);
  source = manifestPath.replace(root + path.sep, '');
} else {
  const html = fs.readFileSync(indexPath, 'utf8');
  for (const attr of ['src', 'href']) {
    const re = new RegExp(`${attr}="(/assets/[^"]+)"`, 'g');
    let m;
    while ((m = re.exec(html))) refs.add(m[1]);
  }
}

const missing = [...refs].filter((url) => {
  const rel = url.replace(/^\//, '');
  return !fs.existsSync(path.join(dist, rel));
});

if (missing.length) {
  console.error('verify-dist-assets: missing files referenced by build output:');
  for (const m of missing) console.error('  -', m);
  process.exit(1);
}

console.log(`verify-dist-assets: OK (${refs.size} asset paths from ${source})`);
