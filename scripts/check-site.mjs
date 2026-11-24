#!/usr/bin/env node
/**
 * 构建后检查：
 *   1. 汇总所有"待补图"占位块 → reports/figures-todo.json
 *   2. 检查站内链接是否都能落到 dist 里的文件 → 死链则退出码 1
 * 用法：node scripts/check-site.mjs [dist] [basePath]
 */
import { readdir, readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { join, relative, extname } from 'node:path';

const DIST = process.argv[2] ?? 'dist';
const BASE = (process.argv[3] ?? process.env.BASE_PATH ?? '/anima-course').replace(/\/$/, '');
const REPORT_DIR = 'reports';

async function walk(dir) {
  const out = [];
  for (const name of await readdir(dir)) {
    const p = join(dir, name);
    const s = await stat(p);
    if (s.isDirectory()) out.push(...(await walk(p)));
    else out.push(p);
  }
  return out;
}

function decode(s) {
  try { return decodeURIComponent(s); } catch { return s; }
}

/** 站内路径 → dist 里的候选文件（相对 dist） */
function candidates(pathname) {
  let p = decode(pathname);
  if (BASE && p.startsWith(BASE)) p = p.slice(BASE.length);
  if (!p.startsWith('/')) p = `/${p}`;
  const rel = p.replace(/^\//, '').replace(/\/$/, '');
  const list = [];
  if (extname(p)) list.push(rel);
  else {
    list.push(rel ? `${rel}/index.html` : 'index.html');
    if (rel) list.push(rel);
  }
  return list;
}

const files = await walk(DIST);
const html = files.filter((f) => f.endsWith('.html'));
const fileSet = new Set(files.map((f) => relative(DIST, f)));

const figures = [];
const broken = [];
const pageByUrl = new Map();
const anchors = new Map();

for (const f of html) {
  const rel = relative(DIST, f);
  const page = `${BASE}/${rel.replace(/index\.html$/, '').replace(/\\/g, '/')}`;
  pageByUrl.set(page.replace(/\/$/, '') || BASE || '/', rel);
  const src = await readFile(f, 'utf8');
  anchors.set(rel, new Set([...src.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1])));

  for (const m of src.matchAll(/<figure[^>]*data-figure-group="([^"]*)"[^>]*>[\s\S]*?data-figure-todo="([^"]*)"/g)) {
    figures.push({ page, group: m[1], caption: decode(m[2]) });
  }

  for (const m of src.matchAll(/\shref="([^"]+)"/g)) {
    const href = decode(m[1]);
    if (!href.startsWith('/')) continue;
    if (href.startsWith('//')) continue;
    const [path, hash] = href.split('#');
    if (path.endsWith('/pagefind/') || path.includes('/pagefind/')) continue;
    const ok = candidates(path).some((c) => fileSet.has(c));
    if (!ok) { broken.push({ from: rel, href }); continue; }
    if (hash) {
      const target = candidates(path).find((c) => fileSet.has(c));
      if (target && target.endsWith('.html')) {
        const ids = anchors.get(target);
        if (ids && !ids.has(hash)) broken.push({ from: rel, href, reason: '锚点不存在' });
      }
    }
  }
}

await mkdir(REPORT_DIR, { recursive: true });
await writeFile(
  join(REPORT_DIR, 'figures-todo.json'),
  JSON.stringify({ generatedAt: new Date().toISOString(), total: figures.length, items: figures }, null, 2),
);
await writeFile(
  join(REPORT_DIR, 'links-broken.json'),
  JSON.stringify({ total: broken.length, items: broken }, null, 2),
);

const out = [];
out.push(`## 站点检查`);
out.push(`- 页面数：${html.length}`);
out.push(`- 待补图：${figures.length} 张（明细见 reports/figures-todo.json）`);
if (figures.length) {
  out.push('');
  out.push('| 页面 | 对照组 | 要补的图 |');
  out.push('|---|---|---|');
  for (const f of figures) out.push(`| ${f.page} | ${f.group || '—'} | ${f.caption} |`);
}
out.push(`- 死链：${broken.length}`);
if (broken.length) {
  out.push('');
  out.push('| 来源页 | 链接 |');
  out.push('|---|---|');
  for (const b of broken.slice(0, 200)) out.push(`| ${b.from} | ${b.href}${b.reason ? `（${b.reason}）` : ''} |`);
  if (broken.length > 200) out.push(`| … | 还有 ${broken.length - 200} 条 |`);
}
console.log(out.join('\n'));
process.exit(broken.length ? 1 : 0);
