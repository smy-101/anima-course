#!/usr/bin/env node
/**
 * 构建后检查：
 *   1. 汇总所有"待补图"占位块 → reports/figures-todo.json
 *   2. 检查站内链接是否都能落到 dist 里的文件 → 死链则退出码 1
 *   3. 检查站点地图里没有成人附录的地址（docs/学习网站方案.md §5.2）→ 有，或 sitemap 文件缺失，退出码 1
 *   4. 检查渲染后的可见文字里没有残留的 **（加粗没闭合，页面上原样显示星号）→ 有则退出码 1
 *   5. 检查分享标签：canonical 恰好一个，指向页面自己的地址（base 不多不少，目录页以 / 结尾）；og:image / twitter:image
 *      落到 dist 里的文件，声明的宽高与 PNG 一致 → 否则退出码 1。成人附录（noindex）与搜索页、404 不带这些标签，不查。
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
const unrendered = [];
const share = [];
let shareable = 0;
const pageByUrl = new Map();
const anchors = new Map();

/** 不是合法绝对地址就返回 null */
const toUrl = (s) => {
  try {
    return new URL(s);
  } catch {
    return null;
  }
};

for (const f of html) {
  const rel = relative(DIST, f);
  const page = `${BASE}/${rel.replace(/index\.html$/, '').replace(/\\/g, '/')}`;
  pageByUrl.set(page.replace(/\/$/, '') || BASE || '/', rel);
  const src = await readFile(f, 'utf8');
  anchors.set(rel, new Set([...src.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1])));

  // 加粗没闭合时页面上原样显示星号。CommonMark 的规则是：闭合 ** 前面是标点（如「。」）、后面紧跟汉字时不算闭合符。
  // prose-lint 按文本数 **…**，查不出这种；所以在这里查产物。只看可见文字，代码块、行内代码、脚本、组件的序列化数据都不算。
  const visible = src
    .replace(/<(astro-island|pre|code|script|style)\b[^>]*>[\s\S]*?<\/\1>/g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]*>/g, '');
  for (const m of visible.matchAll(/\*\*/g)) {
    unrendered.push({ from: rel, excerpt: visible.slice(Math.max(0, m.index - 24), m.index + 30).replace(/\s+/g, ' ') });
  }

  for (const m of src.matchAll(/<figure[^>]*data-figure-group="([^"]*)"[^>]*>[\s\S]*?data-figure-todo="([^"]*)"/g)) {
    figures.push({ page, group: m[1], caption: decode(m[2]) });
  }

  // 分享标签。canonical 的路径要和这页在站内的地址一模一样：base 重复或漏掉、结尾少一个 /，搜索引擎都会当成另一个地址
  const robots = src.match(/<meta\s+name="robots"\s+content="([^"]*)"/)?.[1] ?? '';
  if (!/noindex/.test(robots) && !/(^|\/)(search|404)(\/index)?\.html$/.test(rel)) {
    shareable++;
    const canon = [...src.matchAll(/<link\s+rel="canonical"\s+href="([^"]+)"/g)].map((m) => m[1]);
    if (canon.length !== 1) {
      share.push({ from: rel, reason: `canonical ${canon.length} 个，应为 1` });
    } else if (!toUrl(canon[0])) {
      share.push({ from: rel, reason: `canonical 不是绝对地址：${canon[0]}` });
    } else {
      const own = toUrl(canon[0]);
      const expect = `${BASE}/${rel.replace(/index\.html$/, '')}`;
      if (decode(own.pathname) !== expect) share.push({ from: rel, reason: `canonical 指向 ${own.pathname}，应为 ${expect}` });
      for (const m of src.matchAll(/<meta\s+(?:property|name)="(?:og:image|twitter:image)"\s+content="([^"]+)"/g)) {
        const img = toUrl(m[1]);
        // 只查站内的图；放在站外（图床、CDN）的这里够不着
        if (!img || img.origin !== own.origin) continue;
        const file = candidates(decode(img.pathname)).find((c) => fileSet.has(c));
        if (!file) {
          share.push({ from: rel, reason: `分享图不存在：${m[1]}` });
          continue;
        }
        if (!file.endsWith('.png')) continue;
        const png = await readFile(join(DIST, file));
        const size = [png.readUInt32BE(16), png.readUInt32BE(20)]; // PNG 的 IHDR：宽、高
        const declared = [
          src.match(/property="og:image:width"\s+content="(\d+)"/)?.[1],
          src.match(/property="og:image:height"\s+content="(\d+)"/)?.[1],
        ];
        if (declared[0] !== String(size[0]) || declared[1] !== String(size[1])) {
          share.push({ from: rel, reason: `og:image 声明 ${declared.join(' × ')}，文件是 ${size.join(' × ')}` });
        }
      }
    }
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

const nsfwInSitemap = [];
const sitemaps = files.filter((f) => /^sitemap-\d+\.xml$/.test(relative(DIST, f)));
for (const f of sitemaps) {
  const xml = await readFile(f, 'utf8');
  for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
    let pathname = m[1];
    try { pathname = decodeURIComponent(new URL(m[1]).pathname); } catch { /* 不是合法 URL，原样比较 */ }
    // 按完整前缀匹配：主线里有一张讲安全等级的标签卡 /tags/nsfw/，它应该留在 sitemap 里
    if (pathname.startsWith(`${BASE}/nsfw/`)) nsfwInSitemap.push(m[1]);
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
// 成人附录不进 sitemap。注意只看 base 下的 /nsfw/ 前缀，不看 /tags/nsfw/ 那张标签卡
if (!sitemaps.length) {
  out.push(`- 站点地图：缺失（dist 里没有 sitemap-*.xml，检查 astro.config.mjs 的 sitemap 集成）`);
} else {
  out.push(`- 站点地图：${sitemaps.length} 份文件；成人附录地址 ${nsfwInSitemap.length} 条（应为 0）`);
  for (const u of nsfwInSitemap.slice(0, 50)) out.push(`  - ${u}`);
}
out.push(`- 未渲染的加粗（可见文字里的 **）：${unrendered.length}`);
for (const u of unrendered.slice(0, 100)) out.push(`  - ${u.from}：…${u.excerpt}…`);
out.push(`- 分享标签：${shareable} 页带 canonical，问题 ${share.length} 处`);
for (const s of share.slice(0, 100)) out.push(`  - ${s.from}：${s.reason}`);
console.log(out.join('\n'));
process.exit(broken.length || !sitemaps.length || nsfwInSitemap.length || unrendered.length || share.length ? 1 : 0);
