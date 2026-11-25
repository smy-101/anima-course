/**
 * 提示词检查器（纯函数）。
 *
 * 规则全部来自站内课程：《提示词报告》§1–§2 的七条硬规则、§4 安全等级、§6.3 负向原则、§8 连带规则，
 * 以及标签字典里的陷阱标签。这里只做"能用字符串规则判断"的那一部分；每条 finding 的 href 指向讲原理的页面。
 * 只用可擦除的 TS 语法（无 enum / namespace），以便 tests/ 用 node --test 直接加载。
 */

export type Severity = 'error' | 'warn' | 'info';
export type Version = 'base' | 'aesthetic' | 'turbo';
export type Field = 'positive' | 'negative';

export interface Mark {
  start: number;
  end: number;
  severity: Severity;
  rule: string;
}

export interface Finding {
  rule: string;
  severity: Severity;
  field: Field;
  title: string;
  detail: string;
  snippets: string[];
  /** 站内根路径（不含 base），组件负责加前缀 */
  href?: string;
  /** 一键修正能改 */
  fixable?: boolean;
}

export interface TrapInfo {
  tag: string;
  meaning: string;
  slug: string;
}

export interface LintOptions {
  version: Version;
  traps: TrapInfo[];
  /** 标签字典里的全部标签（小写），用来识别大小写错误与统计 */
  tags: string[];
}

export interface LintResult {
  findings: Finding[];
  marks: Record<Field, Mark[]>;
  counts: Record<Severity, number>;
  stats: { items: number; knownTags: number; negativeItems: number };
}

const RATINGS = ['safe', 'sensitive', 'nsfw', 'explicit'];
/** 主线里讲过的"露骨内容"标签——与 safe 同现即自相矛盾 */
const EXPLICIT_MARKERS = ['nude', 'naked', 'topless', 'bottomless', 'nipples', 'sex', 'cum', 'penis', 'pussy'];
const CENSOR_TAGS = ['censored', 'bar censor', 'mosaic censoring', 'blur censor', 'light censor', 'pixel censor'];
const HAIR_COLORS = ['black', 'brown', 'blonde', 'red', 'orange', 'pink', 'light pink', 'blue', 'purple', 'lavender', 'green', 'teal', 'aqua', 'white', 'grey', 'gray', 'silver'];
const EYE_COLORS = ['blue', 'red', 'green', 'brown', 'purple', 'yellow', 'amber', 'aqua', 'grey', 'gray', 'black'];
/** `(tag:1.2)` 权重语法；sticky，用前设 lastIndex */
const WEIGHT_RE = /\(\s*[^()]*?:\s*(\d+(?:\.\d+)?)\s*\)/y;
const ARTIST_RE = /\b(?:in the style of|art by|artist:|drawn by|illustrated by)\s+([A-Za-z][\w .'-]*?)(?=\s*[,.\n]|$)/gi;

const L = '/lessons/01-03-prompt-basics/';
const T = '/resources/prompt-templates/';

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}|[\]\\]/g, '\\$&');
}

/** 标签 → 匹配该标签的正则（允许括号前带转义反斜杠）；前后不能紧贴字母数字或连字符 */
function tagRegExp(tag: string): RegExp {
  const src = escapeRegExp(tag).replace(/\\\(/g, '\\\\?\\(').replace(/\\\)/g, '\\\\?\\)');
  return new RegExp(`(?<![\\w-])(?:${src})(?![\\w-])`, 'gi');
}

interface Item {
  value: string;
  start: number;
  end: number;
}

/** 按逗号 / 分号 / 换行切成条目，保留位置（自然语言句子也会被逗号切开，只用于按条目判断的规则） */
export function splitItems(text: string): Item[] {
  const out: Item[] = [];
  const re = /[^,，;；\n]+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const raw = m[0];
    const lead = raw.length - raw.trimStart().length;
    const trimmed = raw.trim();
    if (!trimmed) continue;
    out.push({ value: trimmed, start: m.index + lead, end: m.index + lead + trimmed.length });
  }
  return out;
}

interface Hit {
  start: number;
  end: number;
  match: string;
  groups?: string[];
}

function findAll(text: string, re: RegExp): Hit[] {
  const out: Hit[] = [];
  const r = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
  let m: RegExpExecArray | null;
  while ((m = r.exec(text)) !== null) {
    if (m[0].length === 0) {
      r.lastIndex++;
      continue;
    }
    out.push({ start: m.index, end: m.index + m[0].length, match: m[0], groups: m.slice(1) });
  }
  return out;
}

function hasTag(text: string, tag: string): boolean {
  return tagRegExp(tag).test(text);
}

/** 未转义、且不是 (tag:1.2) 权重语法一部分的括号 */
function unescapedParens(text: string): Array<{ start: number; end: number }> {
  const out: Array<{ start: number; end: number }> = [];
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === '\\' && text[i + 1] === '(') {
      const close = text.indexOf('\\)', i + 2);
      i = close === -1 ? text.length : close + 2;
      continue;
    }
    if (ch === '(') {
      WEIGHT_RE.lastIndex = i;
      const w = WEIGHT_RE.exec(text);
      if (w) {
        i += w[0].length;
        continue;
      }
      out.push({ start: i, end: i + 1 });
      const close = text.indexOf(')', i + 1);
      if (close !== -1 && text[close - 1] !== '\\') out.push({ start: close, end: close + 1 });
      i = close === -1 ? i + 1 : close + 1;
      continue;
    }
    if (ch === ')') out.push({ start: i, end: i + 1 });
    i++;
  }
  return out;
}

function isJson(text: string): boolean {
  const s = text.trim();
  if (!/^[[{]/.test(s)) return false;
  try {
    JSON.parse(s);
    return true;
  } catch {
    return false;
  }
}

/** 人数：按人数标签估计，至少 1 */
function countPeople(items: Item[]): number {
  let n = 1;
  const kinds = new Set<string>();
  for (const it of items) {
    const low = it.value.toLowerCase();
    const m = low.match(/^(\d+)\+?(girls|boys|others)$/);
    if (m) n = Math.max(n, Number(m[1]));
    if (/^multiple (girls|boys|others)$/.test(low)) n = Math.max(n, 2);
    if (/^1(girl|boy|other)$/.test(low)) kinds.add(low);
  }
  if (kinds.size >= 2) n = Math.max(n, kinds.size);
  return n;
}

// ───────── 修正器（每个返回新文本） ─────────

export interface FixContext {
  /** 标签字典（小写）：大小写修正只动字典里有的标签，角色名 / 作品名保持原样 */
  tags: Set<string>;
}

type Fixer = (text: string, ctx?: FixContext) => string;

export const fixers: Record<string, Fixer> = {
  'fullwidth-punct': (t) =>
    t.replace(/，/g, ', ').replace(/：/g, ':').replace(/（/g, '(').replace(/）/g, ')').replace(/；/g, ', '),
  underscore: (t) => t.replace(/[\w]+_[\w_]+/g, (m) => (/^score_\d+$/i.test(m) ? m : m.replace(/_/g, ' '))),
  'comma-space': (t) => t.replace(/,(?=[^\s,，])/g, ', ').replace(/,[ \t]{2,}/g, ', '),
  'paren-escape': (t) => {
    const parens = unescapedParens(t).sort((a, b) => a.start - b.start);
    let out = t;
    for (let k = parens.length - 1; k >= 0; k--) out = `${out.slice(0, parens[k].start)}\\${out.slice(parens[k].start)}`;
    return out;
  },
  'artist-at': (t) => t.replace(ARTIST_RE, (_m, name: string) => `@${name.trim().toLowerCase()}`),
  'empty-tag': (t) =>
    t
      .split('\n')
      .map((line) => line.trim())
      .map((line) => {
        if (!line) return '';
        const trailing = line.endsWith(',') ? ',' : '';
        return line.split(',').map((s) => s.trim()).filter(Boolean).join(', ') + trailing;
      })
      .join('\n'),
  'uppercase-tag': (t, ctx) => {
    if (!ctx) return t;
    return t
      .split('\n')
      .map((line) =>
        line
          .split(',')
          .map((s) => {
            const v = s.trim();
            if (!v || v.startsWith('@')) return s;
            const lv = v.toLowerCase();
            return v !== lv && ctx.tags.has(lv) ? s.replace(v, lv) : s;
          })
          .join(','),
      )
      .join('\n');
  },
  spacing: (t) =>
    t
      .split('\n')
      .map((line) => line.replace(/[ \t]+,/g, ',').replace(/[ \t]{2,}/g, ' ').trimEnd())
      .join('\n')
      .replace(/^\n+|\n+$/g, ''),
};

const FIX_ORDER = ['fullwidth-punct', 'underscore', 'comma-space', 'paren-escape', 'artist-at', 'empty-tag', 'uppercase-tag', 'spacing'];

/** 一键修正：按顺序套用全部修正器；only 限定只套用哪些规则 */
export function autoFix(text: string, only?: string[], ctx?: FixContext): string {
  let out = text;
  for (const id of FIX_ORDER) {
    if (!only || only.includes(id)) out = fixers[id](out, ctx);
  }
  return out;
}

// ───────── 主入口 ─────────

export function lintPrompt(positive: string, negative: string, opts: LintOptions): LintResult {
  const findings: Finding[] = [];
  const marks: Record<Field, Mark[]> = { positive: [], negative: [] };
  const tagSet = new Set(opts.tags.map((t) => t.toLowerCase()));
  const low = (s: string) => s.toLowerCase();
  const posItems = splitItems(positive);
  const negItems = splitItems(negative);

  for (const field of ['positive', 'negative'] as Field[]) {
    const text = field === 'positive' ? positive : negative;
    if (!text.trim()) continue;

    // 全角标点：分词器不做模糊匹配
    const full = findAll(text, /[，：；（）]/g);
    if (full.length) {
      findings.push({
        rule: 'fullwidth-punct', severity: 'error', field, title: '全角标点', fixable: true,
        detail: '中文输入法打出的全角逗号 / 括号不会被当成英文标点，分词器不做模糊匹配——标签的边界就没了。换成半角。',
        snippets: [...new Set(full.map((f) => f.match))], href: `${L}#逗号后必须有空格这是分词问题`,
      });
      for (const f of full) marks[field].push({ start: f.start, end: f.end, severity: 'error', rule: 'fullwidth-punct' });
    }

    // 下划线
    const under = findAll(text, /[\w]+_[\w_]+/g).filter((f) => !/^score_\d+$/i.test(f.match));
    if (under.length) {
      findings.push({
        rule: 'underscore', severity: 'error', field, title: '下划线标签', fixable: true,
        detail: 'Anima 的训练标签用空格：`long hair` ✔，`long_hair` ✘。唯一例外是 `score_9` … `score_1`（它们本来带下划线）。',
        snippets: [...new Set(under.map((f) => f.match))], href: `${L}#七条硬规则`,
      });
      for (const f of under) marks[field].push({ start: f.start, end: f.end, severity: 'error', rule: 'underscore' });
    }

    // 逗号后空格
    const comma = findAll(text, /,(?=[^\s,，])/g);
    if (comma.length) {
      findings.push({
        rule: 'comma-space', severity: 'error', field, title: '逗号后没有空格', fixable: true,
        detail: '`masterpiece,best quality` 会被切成 `,b`、`est` 这种怪 token；"逗号 + 空格"本身就在告诉模型"这是一个独立标签"。',
        snippets: [...new Set(comma.map((f) => text.slice(f.start, f.start + 2)))], href: `${L}#逗号后必须有空格这是分词问题`,
      });
      for (const f of comma) marks[field].push({ start: f.start, end: f.start + 2, severity: 'error', rule: 'comma-space' });
    }

    // Markdown / JSON
    const json = isJson(text);
    const md = findAll(text, /#{1,6}\s|\*\*|__|~~|`|[\[\]{}]/g);
    if (json || md.length) {
      const hard = md.some((f) => /^[#*~`]/.test(f.match));
      findings.push({
        rule: 'markdown', severity: hard || json ? 'error' : 'warn', field, title: json ? '不要用 JSON 包裹' : 'Markdown / JSON 字符',
        detail: '模型不认识 Markdown：`#`、`*`、方括号、花括号会被当成画面内容（`#` 偶尔会直接画进图里）。分段用空行。',
        snippets: json ? [text.trim().slice(0, 24) + '…'] : [...new Set(md.map((f) => f.match.trim()))], href: `${L}#七条硬规则`,
      });
      for (const f of md) marks[field].push({ start: f.start, end: f.end, severity: hard || json ? 'error' : 'warn', rule: 'markdown' });
    }

    // 括号转义
    const parens = unescapedParens(text);
    if (parens.length) {
      findings.push({
        rule: 'paren-escape', severity: 'warn', field, title: '未转义的括号', fixable: true,
        detail: '括号会被当成权重语法并被吃掉：`toon (style)` 要写成 `toon \\(style\\)`。只有 `(tag:1.2)` 这种带数字的才是权重。',
        snippets: [...new Set(parens.map((f) => text.slice(Math.max(0, f.start - 10), f.start + 1)))], href: `${L}#七条硬规则`,
      });
      for (const f of parens) marks[field].push({ start: f.start, end: f.end, severity: 'warn', rule: 'paren-escape' });
    }

    // 权重过低
    const weights = findAll(text, /\(\s*([^()]*?)\s*:\s*(\d+(?:\.\d+)?)\s*\)/g).filter((f) => {
      const v = Number(f.groups?.[1]);
      return v >= 1 && v < 1.5;
    });
    if (weights.length) {
      findings.push({
        rule: 'weight-low', severity: 'info', field, title: '权重低于 1.5 基本无效',
        detail: '双分词器，Qwen 路的权重被强制归 1，只有 T5 路认 `(tag:N)`。SDXL 时代 1.2～1.3 的"轻微加强"在 Anima 上约等于没加；1.5 起、2.0 甜点。',
        snippets: weights.map((f) => f.match), href: `${L}#双分词器--权重只有一半生效`,
      });
      for (const f of weights) marks[field].push({ start: f.start, end: f.end, severity: 'info', rule: 'weight-low' });
    }

    // 画师缺 @
    const artists = findAll(text, ARTIST_RE);
    if (artists.length) {
      findings.push({
        rule: 'artist-at', severity: 'warn', field, title: '画师名没加 @', fixable: true,
        detail: '画师名必须写成 `@画师名`——不加 `@` 效果"非常弱"。"in the style of X" 这类 SD 时代的写法在这里几乎不起作用。',
        snippets: artists.map((f) => f.match), href: `${L}#七条硬规则`,
      });
      for (const f of artists) marks[field].push({ start: f.start, end: f.end, severity: 'warn', rule: 'artist-at' });
    }

    // 空格 / 空条目
    const spacing = findAll(text, /[ \t]{2,}|\s+,/g);
    if (spacing.length) {
      findings.push({
        rule: 'spacing', severity: 'info', field, title: '多余空格', fixable: true,
        detail: '逗号前不留空格，连续空格合成一个；逗号后只要一个空格。',
        snippets: [...new Set(spacing.map((f) => JSON.stringify(f.match)))].slice(0, 5), href: `${L}#七条硬规则`,
      });
      for (const f of spacing) marks[field].push({ start: f.start, end: f.end, severity: 'info', rule: 'spacing' });
    }
    const empty = findAll(text, /,[ \t]*(?=,)|^[ \t]*,/gm);
    if (empty.length) {
      findings.push({
        rule: 'empty-tag', severity: 'warn', field, title: '空条目', fixable: true,
        detail: '连续的逗号、开头的逗号会切出空标签。行尾的逗号不算——模板里常用它表示"下面还有"。',
        snippets: [...new Set(empty.map((f) => JSON.stringify(text.slice(f.start, Math.min(text.length, f.end + 1)))))], href: `${L}#七条硬规则`,
      });
      for (const f of empty) marks[field].push({ start: f.start, end: f.end, severity: 'warn', rule: 'empty-tag' });
    }
  }

  // Aesthetic 上的 score_*（正负向都查）
  if (opts.version === 'aesthetic') {
    for (const field of ['positive', 'negative'] as Field[]) {
      const text = field === 'positive' ? positive : negative;
      const hits = [...new Set(text.match(/score_\d+/gi) ?? [])];
      if (!hits.length) continue;
      findings.push({
        rule: 'score-aesthetic', severity: 'error', field, title: 'Aesthetic 版不要用 score_*',
        detail: 'Aesthetic 在高质量图上精调过，训练时去掉了所有质量标签；score 会把画面推成"AI 味"。正负向都不要用——模板默认负向里的 score_1 / 2 / 3 也要去掉。',
        snippets: hits, href: '/resources/param-baseline/',
      });
      for (const h of findAll(text, /score_\d+/gi)) marks[field].push({ start: h.start, end: h.end, severity: 'error', rule: 'score-aesthetic' });
    }
  }

  if (positive.trim()) {
    // 陷阱标签（只在正向查；放负向是正常用法）
    for (const trap of opts.traps) {
      const hits = findAll(positive, tagRegExp(trap.tag));
      if (!hits.length) continue;
      findings.push({
        rule: 'trap-tag', severity: 'warn', field: 'positive', title: `陷阱标签：${trap.tag}`,
        detail: `这个普通英文词在 booru 里有精确含义——${trap.meaning} 想要这个效果就有意用，否则别当形容词写。`,
        snippets: hits.map((h) => h.match), href: `/tags/${trap.slug}/`,
      });
      for (const h of hits) marks.positive.push({ start: h.start, end: h.end, severity: 'warn', rule: 'trap-tag' });
    }

    // 安全等级
    const ratingTags = RATINGS.filter((r) => hasTag(positive, r));
    if (ratingTags.length === 0) {
      findings.push({
        rule: 'rating-missing', severity: 'info', field: 'positive', title: '没写安全等级',
        detail: '正向里写一个等级（safe / sensitive / nsfw / explicit 四选一），不想要的等级放负向。纯风景、抽象图可以不写。',
        snippets: [], href: `${L}#四段式结构`,
      });
    } else if (ratingTags.length > 1) {
      findings.push({
        rule: 'rating-conflict', severity: 'error', field: 'positive', title: '写了多个安全等级',
        detail: '四个等级是"类别"不是"阶梯"，只写一个：按画面里最露骨的那个元素选。混用会自相矛盾——出图发软 / 自动打码。',
        snippets: ratingTags, href: `${L}#四段式结构`,
      });
    }
    if (ratingTags.includes('safe') && ratingTags.length === 1) {
      const explicitHits = EXPLICIT_MARKERS.filter((t) => hasTag(positive, t));
      if (explicitHits.length) {
        findings.push({
          rule: 'rating-conflict', severity: 'error', field: 'positive', title: 'safe 与露骨标签同现',
          detail: '`safe` 配露骨内容 = 自相矛盾，结果是发软或自动打码。要露骨就改成对应等级。',
          snippets: explicitHits, href: `${L}#四段式结构`,
        });
      }
    }
    const censoredHits = CENSOR_TAGS.filter((t) => hasTag(positive, t));
    if (censoredHits.length) {
      findings.push({
        rule: 'censored-positive', severity: 'error', field: 'positive', title: '打码标签放进了正向',
        detail: '`censored` 一族永远不放正向——正向写了就会出打码；去码是放负向。',
        snippets: censoredHits, href: '/tags/censored/',
      });
      for (const t of censoredHits) for (const h of findAll(positive, tagRegExp(t))) marks.positive.push({ start: h.start, end: h.end, severity: 'error', rule: 'censored-positive' });
    }

    // 多人连带规则
    const people = countPeople(posItems);
    const hairs = posItems.filter((it) => HAIR_COLORS.some((c) => low(it.value) === `${c} hair`)).length;
    const eyes = posItems.filter((it) => EYE_COLORS.some((c) => low(it.value) === `${c} eyes`) || low(it.value) === 'heterochromia').length;
    if (people >= 2 && (hairs > 0 || eyes > 0) && (hairs < people || eyes < people)) {
      findings.push({
        rule: 'multi-char-features', severity: 'warn', field: 'positive', title: `多人场景：特征不够 ${people} 份`,
        detail: '连带规则：给一个角色写了发色 / 瞳色，就要给场上所有角色都写，否则特征会"串"。更稳的做法是每个角色一句、特征写全（and 法）。',
        snippets: [`发色 ${hairs} 份、瞳色 ${eyes} 份；人数 ${people}`], href: '/lessons/02-02-prompt-multi/',
      });
    }

    // 长度 / 重复 / 大小写
    if (posItems.length > 30) {
      findings.push({
        rule: 'prompt-long', severity: 'info', field: 'positive', title: `标签偏多（${posItems.length} 个）`,
        detail: '提示词不会被截断，但 token 越多每个分到的注意力越稀、标签之间"传染"的面也越大。标签版 15～30 个，要加东西先删东西。',
        snippets: [], href: `${L}#没有硬上限只有注意力预算`,
      });
    }
    const seen = new Map<string, number>();
    for (const it of posItems) {
      const v = low(it.value);
      if (RATINGS.includes(v) || v.startsWith('@')) continue;
      seen.set(v, (seen.get(v) ?? 0) + 1);
    }
    const dups = [...seen.entries()].filter(([, n]) => n > 1).map(([t]) => t);
    if (dups.length) {
      findings.push({
        rule: 'duplicate', severity: 'info', field: 'positive', title: '重复的标签', detail: '同一个标签写两遍不会加强，只会占注意力预算。', snippets: dups, href: `${L}#没有硬上限只有注意力预算`,
      });
    }
    const upper = posItems.filter((it) => !it.value.startsWith('@') && it.value !== low(it.value) && tagSet.has(low(it.value)));
    if (upper.length) {
      findings.push({
        rule: 'uppercase-tag', severity: 'info', field: 'positive', title: '标签没有全小写', fixable: true,
        detail: '标签全小写；只有角色名、作品名按正常英文大小写（如 `Fern from Sousou no Frieren`）。',
        snippets: upper.map((it) => it.value), href: `${L}#七条硬规则`,
      });
      for (const it of upper) marks.positive.push({ start: it.start, end: it.end, severity: 'info', rule: 'uppercase-tag' });
    }
  }

  if (negative.trim()) {
    if (opts.version === 'turbo') {
      findings.push({
        rule: 'negative-turbo', severity: 'info', field: 'negative', title: 'Turbo 下负向无效',
        detail: 'Turbo 是 CFG 1，负向不起作用。要用负向就 NegPip（`(worst quality:-1)` 语法）或 NAGuidance（需 CFG > 1）。',
        snippets: [], href: T,
      });
    }
    if (negItems.length > 40) {
      findings.push({
        rule: 'negative-too-long', severity: 'info', field: 'negative', title: `负向偏长（${negItems.length} 项）`,
        detail: '不要堆 SDXL 时代那套一两百词的负向——Anima 对负向敏感，过大的负向会抹掉细节或引入意外偏移。第一轮不填，看裸提示词出什么问题再加。',
        snippets: [], href: T,
      });
    }
    const posSet = new Set(posItems.map((it) => low(it.value)));
    const conflicts = negItems.map((it) => low(it.value)).filter((v) => posSet.has(v) && !RATINGS.includes(v) && !/^score_\d+$/.test(v));
    if (conflicts.length) {
      findings.push({
        rule: 'negative-conflict', severity: 'warn', field: 'negative', title: '负向里有正向想要的东西',
        detail: '先检查标准负向会不会破坏你的场景——追黑白风却负向里有 `monochrome`，就是这样翻的车。',
        snippets: [...new Set(conflicts)], href: T,
      });
      for (const it of negItems) {
        if (conflicts.includes(low(it.value))) marks.negative.push({ start: it.start, end: it.end, severity: 'warn', rule: 'negative-conflict' });
      }
    }
  }

  const order: Record<Severity, number> = { error: 0, warn: 1, info: 2 };
  const firstMark = (f: Finding) => {
    const ms = marks[f.field].filter((m) => m.rule === f.rule).map((m) => m.start);
    return ms.length ? Math.min(...ms) : Number.MAX_SAFE_INTEGER;
  };
  findings.sort(
    (a, b) => (a.field === b.field ? 0 : a.field === 'positive' ? -1 : 1) || order[a.severity] - order[b.severity] || firstMark(a) - firstMark(b),
  );

  const counts: Record<Severity, number> = { error: 0, warn: 0, info: 0 };
  for (const f of findings) counts[f.severity]++;

  let known = 0;
  for (const tag of tagSet) if (hasTag(positive, tag)) known++;

  return {
    findings,
    marks,
    counts,
    stats: { items: posItems.length, knownTags: known, negativeItems: negItems.length },
  };
}
