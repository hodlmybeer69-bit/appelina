#!/usr/bin/env node
// SEO head check for every public HTML page in the repo (the site is served as-is, no build step).
// Fails when a page lacks parseable JSON-LD with @context/@type, an absolute canonical, or og:image.
// Usage: node scripts/check-seo.mjs [file.html ...]
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const SKIP = new Set(['.git', 'node_modules', 'scripts']);

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

function checkPage(file) {
  const errors = [];
  const html = readFileSync(file, 'utf8');
  const head = (html.match(/<head[^>]*>([\s\S]*?)<\/head>/i) || [])[1];
  if (!head) return ['no <head> element'];

  const ld = [...head.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  if (ld.length === 0) errors.push('no JSON-LD <script type="application/ld+json"> in <head>');
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
  });

  const links = head.match(/<link\b[^>]*>/gi) || [];
  const canon = links.filter((t) => (attr(t, 'rel') || '').toLowerCase() === 'canonical');
  if (canon.length !== 1) errors.push(`expected exactly 1 <link rel="canonical">, found ${canon.length}`);
  else if (!/^https:\/\/[^/]+\//.test(attr(canon[0], 'href') || '')) errors.push('canonical href is not an absolute https URL');

  const metas = head.match(/<meta\b[^>]*>/gi) || [];
  const ogImage = metas.find((t) => attr(t, 'property') === 'og:image');
  if (!ogImage) errors.push('no <meta property="og:image">');
  else if (!/^https:\/\//.test(attr(ogImage, 'content') || '')) errors.push('og:image is not an absolute https URL');

  return errors;
}

const files = process.argv.length > 2 ? process.argv.slice(2) : findHtml(ROOT);
let failed = 0;
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
console.log(`${files.length - failed}/${files.length} pages passed SEO head check`);
process.exit(failed ? 1 : 0);
