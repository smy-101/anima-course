#!/usr/bin/env node
/**
 * 生成分享卡片图 public/og-cover.png：把页面链接贴到 X / Discord / 微信 / QQ 时显示的那张缩略图
 * （Open Graph，1200 × 630）。src/layouts/Base.astro 用 og:image 指向它。
 *
 *   node scripts/og-cover.mjs
 *
 * 首页 hero 的文案或 global.css 顶部的令牌改了就重跑一次。图下方的管线示意与首页底部那六段一致
 * （src/pages/index.astro 的 flow），改那边时这里也要改。
 *
 * 文字用系统字体渲染。本机 WSL 里一个字体都没有，脚本默认把 Windows 的微软雅黑与 Consolas 链进一个临时目录，
 * 再给 sharp（librsvg）一份指向它的 fontconfig 配置；字体在别处时设 OG_FONT_DIR。
 */
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const WIDTH = 1200;
const HEIGHT = 630;
const OUT = 'public/og-cover.png';

const FONT_DIR = process.env.OG_FONT_DIR ?? '/mnt/c/Windows/Fonts';
const FONTS = ['msyh.ttc', 'msyhbd.ttc', 'consola.ttf'];

// 与 src/styles/global.css 的 :root 同名令牌保持一致
const C = {
  bg: '#ffffff',
  fg: '#1f2328',
  fgMuted: '#57606a',
  border: '#d8dee6',
  borderStrong: '#808a94',
  accent: '#3b5bdb',
  prompt: '#be185d',
  port: { MODEL: '#b39fdb', CONDITIONING: '#ffa931', LATENT: '#ff9cf9', IMAGE: '#64b5f6' },
};

const SANS = 'Microsoft YaHei';
const MONO = 'Consolas';

const PAD = 72;
const CONTENT = WIDTH - PAD * 2;

/** 与首页底部的管线示意一致：L0 从零搭出的六段 */
const FLOW = [
  { title: '加载模型', node: 'UNETLoader', out: 'MODEL' },
  { title: '编码提示词', node: 'CLIPTextEncode', out: 'CONDITIONING' },
  { title: '起始画布', node: 'EmptyLatentImage', out: 'LATENT' },
  { title: '采样', node: 'KSampler', out: 'LATENT' },
  { title: '解码', node: 'VAEDecode', out: 'IMAGE' },
  { title: '保存', node: 'SaveImage', out: '' },
];

/** 品牌标记（Base.astro 里那块"图"：山 + 日），24 单位见方，按 size 放大 */
function brandMark(x, y, size) {
  return `<g transform="translate(${x} ${y}) scale(${size / 24})">
  <defs><linearGradient id="brand-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${C.accent}"/><stop offset="1" stop-color="${C.prompt}"/></linearGradient></defs>
  <rect width="24" height="24" rx="6" fill="url(#brand-g)"/>
  <path d="M6.4 16.8 10 12.2l2.6 2.9 1.9-2.1 3.1 3.8z" fill="#fff"/>
  <circle cx="15.7" cy="8.5" r="1.7" fill="#fff"/>
</g>`;
}

/** 底部的管线示意：六个节点横排，节点间用曲线相连，端口圆点用 ComfyUI 的类型色 */
function pipeline(top) {
  const H = 92;
  // 节点宽到能放下最长的一个类名（EmptyLatentImage，等宽 14px 约 123px），文字两端各留出端口圆点的位置
  const W = 148;
  const TEXT_X = 12;
  const gap = (CONTENT - W * FLOW.length) / (FLOW.length - 1);
  const mid = top + H / 2;
  const R = 6.5;

  const links = FLOW.slice(1)
    .map((_, i) => {
      const x0 = PAD + (W + gap) * i + W + R;
      const x1 = PAD + (W + gap) * (i + 1) - R;
      const bend = Math.min(18, (x1 - x0) / 2);
      return `<path d="M ${x0} ${mid} C ${x0 + bend} ${mid}, ${x1 - bend} ${mid}, ${x1} ${mid}" fill="none" stroke="${C.borderStrong}" stroke-width="2"/>`;
    })
    .join('\n');

  const nodes = FLOW.map((f, i) => {
    const x = PAD + (W + gap) * i;
    const dots = [
      i > 0 ? `<circle cx="${x}" cy="${mid}" r="${R}" fill="${C.port[FLOW[i - 1].out]}" stroke="${C.bg}" stroke-width="2"/>` : '',
      f.out ? `<circle cx="${x + W}" cy="${mid}" r="${R}" fill="${C.port[f.out]}" stroke="${C.bg}" stroke-width="2"/>` : '',
    ].join('');
    return `<g>
  <rect x="${x}" y="${top}" width="${W}" height="${H}" rx="10" fill="${C.bg}" stroke="${C.border}" stroke-width="1.5"/>
  <text x="${x + TEXT_X}" y="${top + 40}" font-family="${SANS}" font-weight="bold" font-size="21" fill="${C.fg}">${f.title}</text>
  <text x="${x + TEXT_X}" y="${top + 68}" font-family="${MONO}" font-size="14" fill="${C.fgMuted}">${f.node}</text>
  ${dots}
</g>`;
  }).join('\n');

  return `${links}\n${nodes}`;
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
<rect width="${WIDTH}" height="${HEIGHT}" fill="${C.bg}"/>
${brandMark(PAD, 62, 56)}
<text x="${PAD + 56 + 20}" y="101" font-family="${SANS}" font-size="30" fill="${C.fgMuted}">Anima × ComfyUI 学习课程</text>
<text x="${PAD}" y="238" font-family="${SANS}" font-weight="bold" font-size="80" fill="${C.fg}">以 Anima 为载体，</text>
<text x="${PAD}" y="342" font-family="${SANS}" font-weight="bold" font-size="80" fill="${C.fg}">学会 AI 生图的一般方法</text>
<text x="${PAD}" y="414" font-family="${SANS}" font-size="36" fill="${C.fgMuted}"><tspan font-weight="bold" fill="${C.accent}">教方法，不教参数</tspan>　14 天 · 六个阶段 · 一条双轨路径</text>
${pipeline(474)}
</svg>
`;

// —— 字体：把用到的字体文件链进临时目录，给 fontconfig 一份只认这个目录的配置 ——
const tmp = await mkdtemp(join(tmpdir(), 'anima-og-fonts-'));
try {
  for (const f of FONTS) {
    try {
      await symlink(join(FONT_DIR, f), join(tmp, f));
    } catch (err) {
      throw new Error(`找不到字体 ${join(FONT_DIR, f)}（可用 OG_FONT_DIR 指到别的字体目录）：${err.message}`);
    }
  }
  await mkdir(join(tmp, 'cache'));
  const conf = join(tmp, 'fonts.conf');
  await writeFile(conf, `<?xml version="1.0"?>\n<!DOCTYPE fontconfig SYSTEM "fonts.dtd">\n<fontconfig>\n  <dir>${tmp}</dir>\n  <cachedir>${join(tmp, 'cache')}</cachedir>\n</fontconfig>\n`);
  process.env.FONTCONFIG_FILE = conf;

  // 环境变量要在 sharp 加载（librsvg 初始化 fontconfig）之前设好，所以这里才动态导入
  const { default: sharp } = await import('sharp');
  const info = await sharp(Buffer.from(svg), { density: 72 }).png({ compressionLevel: 9 }).toFile(OUT);
  console.log(`${OUT}：${info.width} × ${info.height}，${Math.round(info.size / 1024)} KB`);
  if (info.width !== WIDTH || info.height !== HEIGHT) throw new Error(`尺寸应为 ${WIDTH} × ${HEIGHT}`);
} finally {
  await rm(tmp, { recursive: true, force: true });
}
