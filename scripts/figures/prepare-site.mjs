#!/usr/bin/env node
/**
 * 把 figures-out/ 里 ComfyUI 直出的 PNG 转成站内用的 WebP，并把 src 写进课程 frontmatter。
 *
 *   node scripts/figures/prepare-site.mjs            # 转换 + 写 frontmatter
 *   node scripts/figures/prepare-site.mjs --convert  # 只转换
 *   node scripts/figures/prepare-site.mjs --check    # 只列出缺哪些源文件
 *   node scripts/figures/prepare-site.mjs --dump-map  # 以 JSON 打印 MAP（embed_all.py 用）
 *
 * 原图（内嵌工作流的 PNG）不进仓库，按 docs/学习网站方案.md §7 放 GitHub Releases。
 * 图的生成见 scripts/figures/figures.py；对照关系见下面的 MAP。
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, 'figures-out');
const DEST = join(ROOT, 'src', 'assets', 'figures');
const LESSONS = join(ROOT, 'src', 'content', 'lessons');

/** 图 id → { dir, pattern, lesson } 。pattern 匹配 figures-out/<dir>/ 下的文件名（取第一个）。 */
const MAP = {
  'setup-first': { lesson: '00-01-setup', dir: 'setup-first', pattern: /^setup-first_.*\.png$/ },

  'l0-seed-a': { lesson: '01-01-l0-minimal', dir: 'l0-seed-a', pattern: /^l0-seed-a_.*\.png$/ },
  'l0-seed-b': { lesson: '01-01-l0-minimal', dir: 'l0-seed-b', pattern: /^l0-seed-b_.*\.png$/ },
  'l0-seed-c': { lesson: '01-01-l0-minimal', dir: 'l0-seed-c', pattern: /^l0-seed-c_.*\.png$/ },
  'l0-prompt-tags': { lesson: '01-01-l0-minimal', dir: 'l0-prompt-tags', pattern: /^l0-prompt-tags_.*\.png$/ },
  'l0-prompt-prose': { lesson: '01-01-l0-minimal', dir: 'l0-prompt-prose', pattern: /^l0-prompt-prose_.*\.png$/ },

  'pb-styles': { lesson: '01-03-prompt-basics', dir: 'pb-styles', pattern: /^pb-styles_.*\.png$/ },
  'pb-artists': { lesson: '01-03-prompt-basics', dir: 'pb-artists', pattern: /^pb-artists_.*\.png$/ },
  'pb-trap': { lesson: '01-03-prompt-basics', dir: 'pb-trap', pattern: /^pb-trap_.*\.png$/ },

  'l2-cfg-seeds': { lesson: '02-01-l2-sweeps', dir: 'l2-cfg-seeds', pattern: /^l2-cfg-seeds_.*\.png$/ },
  'l2-cfg-sweep': { lesson: '02-01-l2-sweeps', dir: 'l2-cfg-sweep', pattern: /^l2-cfg-sweep_.*\.png$/ },
  'l2-steps-sweep': { lesson: '02-01-l2-sweeps', dir: 'l2-steps-sweep', pattern: /^l2-steps-sweep_.*\.png$/ },
  'l2-samplers': { lesson: '02-01-l2-sweeps', dir: 'l2-samplers', pattern: /^l2-samplers_.*\.png$/ },
  'l2-labeled': { lesson: '02-01-l2-sweeps', dir: 'l2-labeled', pattern: /^l2-labeled_.*\.png$/ },

  'pm-order': { lesson: '02-02-prompt-multi', dir: 'pm-order', pattern: /^pm-order_.*\.png$/ },
  'pm-background': { lesson: '02-02-prompt-multi', dir: 'pm-background', pattern: /^pm-background_.*\.png$/ },
  'pm-sheet': { lesson: '02-02-prompt-multi', dir: 'pm-sheet', pattern: /^pm-sheet_.*\.png$/ },

  'l3-denoise-020': { lesson: '03-01-l3-img2img', dir: 'l3-denoise', pattern: /^d020_.*\.png$/ },
  'l3-denoise-035': { lesson: '03-01-l3-img2img', dir: 'l3-denoise', pattern: /^d035_.*\.png$/ },
  'l3-denoise-050': { lesson: '03-01-l3-img2img', dir: 'l3-denoise', pattern: /^d050_.*\.png$/ },
  'l3-denoise-070': { lesson: '03-01-l3-img2img', dir: 'l3-denoise', pattern: /^d070_.*\.png$/ },
  'l3-denoise-100': { lesson: '03-01-l3-img2img', dir: 'l3-denoise', pattern: /^d100_.*\.png$/ },

  'l4-route-b': { lesson: '03-04-l4-upscale', dir: 'l4-hires', pattern: /^d040_.*\.png$/ },
  'l4-denoise-030': { lesson: '03-04-l4-upscale', dir: 'l4-hires', pattern: /^d030_.*\.png$/ },
  'l4-denoise-040': { lesson: '03-04-l4-upscale', dir: 'l4-hires', pattern: /^d040_.*\.png$/ },
  'l4-denoise-050': { lesson: '03-04-l4-upscale', dir: 'l4-hires', pattern: /^d050_.*\.png$/ },
  'l4-sharpen': { lesson: '03-05-l4-large', dir: 'l4-sharpen', pattern: /^l4-sharpen_.*\.png$/ },
  'l4-two-stage': { lesson: '03-05-l4-large', dir: 'l4b', pattern: /^l4b-two-stage_.*\.png$/ },

  'l6-b-before': { lesson: '04-02-l6-inpaint', dir: 'l6-inpaint-before', pattern: /^before_.*\.png$/ },
  'l6-b-after': { lesson: '04-02-l6-inpaint', dir: 'l6b-b-after', pattern: /^l6b-b-after_.*\.png$/ },
  'l6-outpaint-before': { lesson: '04-03-l6-outpaint', dir: 'l6-outpaint', pattern: /^before_.*\.png$/ },
  'l6-outpaint-after': { lesson: '04-03-l6-outpaint', dir: 'l6-outpaint', pattern: /^after_.*\.png$/ },
  'l6-crop-hand': { lesson: '04-03-l6-outpaint', dir: 'l6-crop-hand', pattern: /^l6-crop-hand_.*\.png$/ },

  'l7-basic-guider': { lesson: '05-01-l7-custom-sampler', dir: 'l7-basic-guider', pattern: /^l7-basic-guider_.*\.png$/ },
  'l7-shift-3': { lesson: '05-02-l7-shift-guidance', dir: 'l7-shift-3', pattern: /^s3_.*\.png$/ },
  'l7-shift-5': { lesson: '05-02-l7-shift-guidance', dir: 'l7-shift-5', pattern: /^s5_.*\.png$/ },
  'l7-shift-7': { lesson: '05-02-l7-shift-guidance', dir: 'l7-shift-7', pattern: /^s7_.*\.png$/ },
  'l7-apg': { lesson: '05-02-l7-shift-guidance', dir: 'l7-apg', pattern: /^l7-apg_.*\.png$/ },

  'l8-loop': { lesson: '05-03-l8-compare-loop', dir: 'l8-loop', pattern: /^grid_.*\.png$/ },
  // ---- B 类：需要额外模型（figures.py 的 l1 / l3b / l4b / l5 / l6b / l7b / l8b 组）
  'l1-turbo-vs-full': { lesson: '01-02-l1-controllable', dir: 'l1-turbo-vs-full', pattern: /^l1-turbo-vs-full_.*\.png$/ },
  'l1-lora-strength': { lesson: '01-02-l1-controllable', dir: 'l1-lora-strength', pattern: /^l1-lora-strength_.*\.png$/ },
  'l3-turbo-draft': { lesson: '03-01-l3-img2img', dir: 'l3b-two-stage', pattern: /^l3b-turbo-draft_.*\.png$/ },
  'l3-aesthetic-final': { lesson: '03-01-l3-img2img', dir: 'l3b-two-stage', pattern: /^l3b-aesthetic-final_.*\.png$/ },
  'l3-latent-refine': { lesson: '03-01-l3-img2img', dir: 'l3b-two-stage', pattern: /^l3b-latent-refine_.*\.png$/ },
  'l3-lora-strength': { lesson: '03-02-l3-lora', dir: 'l3b-lora-strength', pattern: /^l3b-lora-strength_.*\.png$/ },
  'l4-route-a': { lesson: '03-04-l4-upscale', dir: 'l4b', pattern: /^l4b-route-a_.*\.png$/ },
  'l4-route-c': { lesson: '03-04-l4-upscale', dir: 'l4b', pattern: /^l4b-route-c_.*\.png$/ },
  'l4-highres-lora': { lesson: '03-05-l4-large', dir: 'l4b-highres-lora', pattern: /^l4b-highres-lora_.*\.png$/ },
  'l5-canny-control': { lesson: '04-01-l5-lllite', dir: 'l5b', pattern: /^l5b-canny-control_.*\.png$/ },
  'l5-canny-result': { lesson: '04-01-l5-lllite', dir: 'l5b', pattern: /^l5b-canny-compare_.*\.png$/ },
  'l5-strength': { lesson: '04-01-l5-lllite', dir: 'l5b', pattern: /^l5b-strength_.*\.png$/ },
  'l7-two-stage': { lesson: '05-01-l7-custom-sampler', dir: 'l7b', pattern: /^l7b-two-stage_.*\.png$/ },
  'l7-vs-oneshot': { lesson: '05-01-l7-custom-sampler', dir: 'l7b', pattern: /^l7b-vs-oneshot_.*\.png$/ },
  'l8-grid': { lesson: '05-03-l8-compare-loop', dir: 'l8b-grid', pattern: /^l8b-grid_.*\.png$/ },
};

/** 站内副本的最大长边与质量；原图另存 Releases */
const MAX_EDGE = 1600;
const QUALITY = 82;

function findSource(id) {
  const { dir, pattern } = MAP[id];
  const d = join(OUT, dir);
  if (!existsSync(d)) return null;
  const f = readdirSync(d).filter((n) => pattern.test(n)).sort()[0];
  return f ? join(d, f) : null;
}

async function convert(id, src) {
  mkdirSync(DEST, { recursive: true });
  const dst = join(DEST, `${id}.webp`);
  await sharp(src).rotate().resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: QUALITY, effort: 6 }).toFile(dst);
  const meta = await sharp(dst).metadata();
  return { dst, width: meta.width, height: meta.height };
}

function lessonFile(name) {
  const f = readdirSync(LESSONS).find((n) => n.startsWith(name) && n.endsWith('.md'));
  if (!f) throw new Error(`lesson not found: ${name}`);
  return join(LESSONS, f);
}

/** 在 frontmatter 的 `  - id: <id>` 后面（caption 之前）插入 src 行；已有 src 则按新值覆盖 */
function writeSrc(id, relSrc) {
  const file = lessonFile(MAP[id].lesson);
  const text = readFileSync(file, 'utf8');
  const lines = text.split('\n');
  const at = lines.findIndex((l) => l === `    id: ${id}` || l === `  - id: ${id}`);
  if (at < 0) throw new Error(`${id}: no "id: ${id}" line in ${file}`);
  const indent = lines[at].startsWith('  - id') ? '    ' : '    ';
  const next = lines[at + 1] ?? '';
  const srcLine = `${indent}src: ${relSrc}`;
  if (/^\s+src:/.test(next)) lines[at + 1] = srcLine;
  else lines.splice(at + 1, 0, srcLine);
  writeFileSync(file, lines.join('\n'));
}

const args = process.argv.slice(2);
if (args.includes('--dump-map')) {
  // 给 embed_all.py 用：图 id → 源 PNG 路径
  const out = {};
  for (const id of Object.keys(MAP)) {
    const src = findSource(id);
    if (src) out[id] = src;
  }
  console.log(JSON.stringify(out, null, 1));
  process.exit(0);
}
const only = new Set(args.filter((a) => !a.startsWith('--')));
const ids = Object.keys(MAP).filter((id) => only.size === 0 || only.has(id));

let missing = [];
const rows = [];
for (const id of ids) {
  const src = findSource(id);
  if (!src) { missing.push(id); continue; }
  let info = null;
  if (!args.includes('--check')) info = await convert(id, src);
  if (!args.includes('--convert') && !args.includes('--check')) writeSrc(id, `../../assets/figures/${id}.webp`);
  rows.push({ id, src: src.replace(OUT + '/', ''), ...info });
}
for (const r of rows) console.log(`${r.id.padEnd(18)} ${String(r.src).padEnd(40)} ${r.dst ? `→ ${r.width}×${r.height}` : ''}`);
if (missing.length) {
  console.log(`\n缺源文件（${missing.length}）：${missing.join(', ')}`);
  process.exitCode = 1;
}
