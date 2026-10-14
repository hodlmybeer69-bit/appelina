#!/usr/bin/env node
// SEO head check for every public HTML page in the repo (the site is served as-is, no build step,
// so the repo root is the build output).
// Fails when a page:
//   - lacks parseable JSON-LD with @context/@type, a canonical, or og:image
//   - has a canonical / og:url / og:image / twitter:image / JSON-LD url, @id or logo on a host other than SITE
//   - has a canonical that is not its own URL
//   - references an og:image / twitter:image / JSON-LD logo file that does not exist in the build output
//   - contains noindex (meta robots/googlebot), or duplicate canonical / og:url / og:image / twitter:image / JSON-LD blocks
// Usage: node scripts/check-seo.mjs [file.html ...]
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const SITE = 'https://www.appelina.xyz';
const ROOT = new URL('..', import.meta.url).pathname;
const SKIP = new Set(['.git', '.github', 'node_modules', 'scripts']);
const JSONLD_URL_KEYS = new Set(['url', '@id', 'logo', 'image']);

function findHtml(dir) {
  return readdirSync(dir).flatMap((name) => {
    if (SKIP.has(name)) return [];
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return findHtml(p);
    return name.endsWith('.html') ? [p] : [];
  });
}

function attr(tag, name) {
  const m = tag.match(new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i'));
  return m ? (m[2] ?? m[3]) : null;
}

// Self URL as served by Vercel with cleanUrls: index.html -> /, about.html -> /about, blog/index.html -> /blog
function selfUrl(file) {
  const rel = relative(ROOT, file).split('\\').join('/');
  const path = rel.replace(/(^|\/)index\.html$/, '$1').replace(/\.html$/, '');
  return `${SITE}/${path}`;
}

function onSite(url) {
  try {
    return new URL(url).origin === SITE;
  } catch {
    return false;
  }
}

function checkAsset(url, label, errors) {
  if (!onSite(url)) return;
  const file = join(ROOT, decodeURIComponent(new URL(url).pathname));
  if (!existsSync(file)) errors.push(`${label} file ${new URL(url).pathname} does not exist in the build output`);
}

function walkJsonLd(node, path, visit) {
  if (Array.isArray(node)) node.forEach((n, i) => walkJsonLd(n, `${path}[${i}]`, visit));
  else if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) {
      if (typeof v === 'string') visit(k, v, `${path}.${k}`);
      else walkJsonLd(v, `${path}.${k}`, visit);
    }
  }
}

function checkPage(file) {
  const errors = [];
  const html = readFileSync(file, 'utf8');
  const head = (html.match(/<head[^>]*>([\s\S]*?)<\/head>/i) || [])[1];
  if (!head) return ['no <head> element'];

  const metas = html.match(/<meta\b[^>]*>/gi) || [];
  for (const t of metas) {
    const name = (attr(t, 'name') || '').toLowerCase();
    if ((name === 'robots' || name === 'googlebot') && /noindex/i.test(attr(t, 'content') || '')) {
      errors.push(`<meta name="${name}"> contains noindex`);
    }
  }

  const ld = [...head.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  if (ld.length === 0) errors.push('no JSON-LD <script type="application/ld+json"> in <head>');
  if (ld.length > 1) errors.push(`expected 1 JSON-LD block, found ${ld.length} (duplicate)`);
  ld.forEach(([, body], i) => {
    let data;
    try {
      data = JSON.parse(body);
    } catch (e) {
      errors.push(`JSON-LD block ${i + 1} is not valid JSON: ${e.message}`);
      return;
    }
    for (const item of Array.isArray(data) ? data : [data]) {
      if (!item || typeof item !== 'object') { errors.push(`JSON-LD block ${i + 1} is not an object`); continue; }
      if (!item['@context']) errors.push(`JSON-LD block ${i + 1} has no @context`);
      const nodes = Array.isArray(item['@graph']) ? item['@graph'] : [item];
      if (nodes.length === 0) errors.push(`JSON-LD block ${i + 1} has an empty @graph`);
      nodes.forEach((n, j) => {
        if (!n || !n['@type']) errors.push(`JSON-LD block ${i + 1} node ${j + 1} has no @type`);
      });
    }
    walkJsonLd(data, '$', (key, value, path) => {
      if (!JSONLD_URL_KEYS.has(key)) return;
      if (!onSite(value)) errors.push(`JSON-LD block ${i + 1} ${path} = ${value} is not on ${SITE}`);
      if (key === 'logo' || key === 'image') checkAsset(value, `JSON-LD ${path}`, errors);
    });
  });

  const links = head.match(/<link\b[^>]*>/gi) || [];
  const canon = links.filter((t) => (attr(t, 'rel') || '').toLowerCase() === 'canonical');
  if (canon.length !== 1) errors.push(`expected exactly 1 <link rel="canonical">, found ${canon.length}`);
  else {
    const href = attr(canon[0], 'href') || '';
    if (!onSite(href)) errors.push(`canonical ${href} is not on ${SITE}`);
    else if (href !== selfUrl(file)) errors.push(`canonical ${href} is not the page's own URL ${selfUrl(file)}`);
  }

  const headMetas = head.match(/<meta\b[^>]*>/gi) || [];
  const metaValues = (key) =>
    headMetas.filter((t) => attr(t, 'property') === key || attr(t, 'name') === key).map((t) => attr(t, 'content') || '');

  const ogImage = metaValues('og:image');
  if (ogImage.length === 0) errors.push('no <meta property="og:image">');
  for (const key of ['og:image', 'og:url', 'twitter:image']) {
    const values = metaValues(key);
    if (values.length > 1) errors.push(`${key} appears ${values.length} times (duplicate)`);
    for (const v of values) {
      if (!onSite(v)) errors.push(`${key} ${v} is not on ${SITE}`);
      if (key !== 'og:url') checkAsset(v, key, errors);
    }
  }
  return errors;
}

function checkVercelHeaders() {
  const p = join(ROOT, 'vercel.json');
  if (!existsSync(p)) return [];
  const cfg = JSON.parse(readFileSync(p, 'utf8'));
  return (cfg.headers || []).flatMap((h) => h.headers || [])
    .filter((h) => /^x-robots-tag$/i.test(h.key) && /noindex/i.test(h.value))
    .map((h) => `vercel.json sets ${h.key}: ${h.value}`);
}

const files = process.argv.length > 2 ? process.argv.slice(2) : findHtml(ROOT);
let failed = 0;
const globalErrors = checkVercelHeaders();
if (globalErrors.length) {
  failed++;
  console.error('FAIL vercel.json');
  globalErrors.forEach((e) => console.error(`  - ${e}`));
}
for (const f of files) {
  const errors = checkPage(f);
  const name = relative(ROOT, f) || f;
  if (errors.length) {
    failed++;
    console.error(`FAIL ${name}`);
    errors.forEach((e) => console.error(`  - ${e}`));
  } else {
    console.log(`ok   ${name}`);
  }
}
if (files.length === 0) { console.error('FAIL no HTML pages found'); process.exit(1); }
console.log(`${files.length - Math.min(failed, files.length)}/${files.length} pages passed SEO head check`);
process.exit(failed ? 1 : 0);
