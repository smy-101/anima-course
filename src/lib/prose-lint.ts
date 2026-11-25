/**
 * 站点文风检查（纯函数）：`docs/文风.md` 的六条硬规则 H1–H6。
 * 软规则（S 开头）要通读整篇才能判断，不在这里 lint。
 * 形制同 prompt-lint：只用可擦除的 TS 语法（无 enum / namespace），tests/ 用 node --test 直接加载。
 */
import type { Severity } from './prompt-lint.ts';

/** 内容集合。成人附录（nsfw）规范暂不覆盖，传进来会报错而不是悄悄放过 */
export type Collection = 'lessons' | 'troubleshooting' | 'resources' | 'nodes' | 'tags';
export type RuleId = 'H1' | 'H2' | 'H3' | 'H4' | 'H5' | 'H6';

/** 每个集合查哪些规则：字典卡（nodes / tags）只查加粗与引号 */
export const RULE_SETS: Record<Collection, readonly RuleId[]> = {
  lessons: ['H1', 'H2', 'H3', 'H4', 'H5', 'H6'],
  troubleshooting: ['H2', 'H3', 'H4', 'H6'],
  resources: ['H2', 'H3', 'H4', 'H6'],
  nodes: ['H2', 'H6'],
  tags: ['H2', 'H6'],
};

export const RULE_TITLE: Record<RuleId, string> = {
  H1: '无三连目录',
  H2: '加粗密度',
  H3: '标题长度',
  H4: '导语长度',
  H5: '固定区块重名',
  H6: '直引号',
};

/** 硬规则的暂行数值（docs/文风.md）；试点课校准后在这里改终值 */
export const LIMITS = { boldPerKilo: 4, titleChars: 20, summaryChars: 70 };

/** H5：页面上已有的固定区块，课程正文的小节不得与之重名 */
const FIXED_SECTIONS = ['验收', '验收清单', '对照图', '本课涉及'];
/** H3：标题开头的路径前缀，如「L4 · 」，不计入长度 */
const PATH_PREFIX = /^[A-Z]\d+\s*·\s*/;
const CJK_CHAR = /[\u4e00-\u9fff]/g;
/** ATX 二级标题；缩进不超过 3 格，后面不再跟 #（### 不是二级） */
const H2_HEADING = /^ {0,3}##(?!#)[ \t]*(.*)$/;
/** 围栏代码块的开闭行（``` 或 ~~~，可带语言名） */
const FENCE = /^ {0,3}(`{3,}|~{3,})(.*)$/;

export interface LintInput {
  collection: Collection;
  /** YAML 解析后的 frontmatter 对象；没有 frontmatter 就是 null */
  frontmatter: unknown;
  /** 去掉 frontmatter 的 markdown 正文；行号相对这段文本 */
  body: string;
}

export interface Finding {
  rule: RuleId;
  severity: Severity;
  /** frontmatter 字段路径（`title`、`acceptance[2]`、`sources[0].note`）；正文上的违规没有 */
  field?: string;
  /** 正文行号（相对 body，从 1 起）；frontmatter 上的违规没有 */
  line?: number;
  /** 正文列号（按码点，从 1 起）；只有逐处报的 H6 有 */
  column?: number;
  /** 说明：哪里、多少、上限多少 */
  message: string;
  /** 数字（报告里排序、汇总用）：H2 是 bold / chars / perKilo，H3、H4 是 length；上限见 LIMITS */
  numbers?: Record<string, number>;
  /** 命中的原文：标题、导语、含直引号的值，或直引号前后的片段 */
  excerpt?: string;
}

/** 把围栏代码块整块、行内代码跨度整个换成等长的空格（换行保留）：代码里的内容不参与任何规则，行号与列号不变 */
function maskCode(body: string): string {
  let fence: { char: string; length: number } | null = null;
  const lines = body.split('\n').map((line) => {
    const m = FENCE.exec(line);
    if (fence) {
      // 闭围栏：同一种字符、不短于开围栏、后面不带语言名
      if (m && m[1][0] === fence.char && m[1].length >= fence.length && m[2].trim() === '') fence = null;
      return '';
    }
    if (m) fence = { char: m[1][0], length: m[1].length };
    return m ? '' : line;
  });
  return lines
    .join('\n')
    .replace(/(`+)(?:(?!\1)[\s\S])*\1/g, (span) => span.replace(/[^\n]/g, ' '));
}

/** 成对的 `**…**`，一对算一处：空行隔开的块内从左到右配对，内容非空（`****` 分隔线不算） */
function countBold(text: string): number {
  let n = 0;
  for (const block of text.split(/\n[ \t]*\n/)) {
    for (let i = 0; (i = block.indexOf('**', i)) !== -1; ) {
      const close = block.indexOf('**', i + 3);
      if (close === -1) break;
      n++;
      i = close + 2;
    }
  }
  return n;
}

function countCjk(text: string): number {
  return (text.match(CJK_CHAR) ?? []).length;
}

/** 正文里的二级标题：行号与去掉收尾 # 的标题文本 */
function h2Headings(masked: string): Array<{ line: number; text: string }> {
  const out: Array<{ line: number; text: string }> = [];
  masked.split('\n').forEach((line, i) => {
    const m = H2_HEADING.exec(line);
    if (m) out.push({ line: i + 1, text: m[1].replace(/[ \t]+#+[ \t]*$/, '').trim() });
  });
  return out;
}

/** frontmatter 里所有字符串值及其字段路径（递归；数组和对象都下钻） */
function* stringValues(value: unknown, path = ''): Generator<{ path: string; value: string }> {
  if (typeof value === 'string') {
    yield { path, value };
  } else if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) yield* stringValues(value[i], `${path}[${i}]`);
  } else if (value && typeof value === 'object') {
    for (const [key, v] of Object.entries(value)) yield* stringValues(v, path ? `${path}.${key}` : key);
  }
}

function codePoints(s: string): number {
  return [...s].length;
}

function clip(s: string, max: number): string {
  const cps = [...s];
  return cps.length > max ? `${cps.slice(0, max).join('')}…` : s;
}

/** 「处每千字」保留一位小数：5 → 5，22.63 → 22.6 */
function perKilo(bold: number, chars: number): number {
  return Math.round((bold * 1000 / chars) * 10) / 10;
}

export function lintProse(input: LintInput): Finding[] {
  const rules = RULE_SETS[input.collection];
  if (!rules) {
    throw new Error(`prose-lint 没有集合 ${String(input.collection)} 的规则集（只有 ${Object.keys(RULE_SETS).join(' / ')}）`);
  }
  const findings: Finding[] = [];
  const frontmatter = (input.frontmatter ?? {}) as Record<string, unknown>;
  const masked = maskCode(input.body);
  const headings = rules.includes('H1') || rules.includes('H5') ? h2Headings(masked) : [];

  // H1 无三连目录：「## 目标」或带冒号副题的「## 目标：…」
  if (rules.includes('H1')) {
    for (const { line, text } of headings) {
      if (!/^目标(?:\s*[：:].*)?$/.test(text)) continue;
      findings.push({
        rule: 'H1', severity: 'error', line,
        message: `正文有「## 目标」小节，和标题、导语把讲什么说了三遍：删掉这一节，要留的内容并入第一个小节`,
        excerpt: `## ${text}`,
      });
    }
  }

  // H2 加粗 ≤ 4 处 / 千字（字数按汉字数；没有汉字就谈不上每千字）
  if (rules.includes('H2')) {
    const bold = countBold(masked);
    const chars = countCjk(masked);
    if (chars > 0 && bold * 1000 > LIMITS.boldPerKilo * chars) {
      const density = perKilo(bold, chars);
      findings.push({
        rule: 'H2', severity: 'error', numbers: { bold, chars, perKilo: density },
        message: `加粗 ${bold} 处 / ${chars} 字 ≈ ${density} 处每千字（上限 ${LIMITS.boldPerKilo}）：只给界面上的控件 / 节点名和每节那一句不能漏的话加粗`,
      });
    }
  }

  // H3 标题 ≤ 20 字：去掉路径前缀后按码点计
  if (rules.includes('H3') && typeof frontmatter.title === 'string') {
    const length = codePoints(frontmatter.title.replace(PATH_PREFIX, ''));
    if (length > LIMITS.titleChars) {
      findings.push({
        rule: 'H3', severity: 'error', field: 'title', numbers: { length },
        message: `标题 ${length} 字（上限 ${LIMITS.titleChars}）：去掉「L4 · 」类路径前缀后计；动词开头，说这一课做什么`,
        excerpt: frontmatter.title,
      });
    }
  }

  // H4 导语 ≤ 70 字
  if (rules.includes('H4') && typeof frontmatter.summary === 'string') {
    const length = codePoints(frontmatter.summary);
    if (length > LIMITS.summaryChars) {
      findings.push({
        rule: 'H4', severity: 'error', field: 'summary', numbers: { length },
        message: `导语 ${length} 字（上限 ${LIMITS.summaryChars}）：一句话，主语「你」，说学完你能做什么`,
        excerpt: frontmatter.summary,
      });
    }
  }

  // H5 正文小节不与固定区块重名
  if (rules.includes('H5')) {
    for (const { line, text } of headings) {
      if (!FIXED_SECTIONS.includes(text)) continue;
      findings.push({
        rule: 'H5', severity: 'error', line,
        message: `正文小节「${text}」与页面的固定区块重名：删掉这一节，独有的提示并入验收清单或对应小节`,
        excerpt: `## ${text}`,
      });
    }
  }

  // H6 引号：frontmatter 所有字符串值（递归）里不得有 ASCII 直引号
  if (rules.includes('H6')) {
    for (const { path, value } of stringValues(frontmatter)) {
      const n = value.split('"').length - 1;
      if (!n) continue;
      findings.push({
        rule: 'H6', severity: 'error', field: path,
        message: `frontmatter 的 ${path} 里有 ${n} 个 ASCII 直引号：换成 “ ”`,
        excerpt: clip(value, 80),
      });
    }

    // H6 引号：代码跨度之外的正文，逐处报行列
    const lines = input.body.split('\n');
    let line = 0;
    let lineStart = 0;
    for (let i = 0; i < masked.length; i++) {
      if (masked[i] === '\n') {
        line++;
        lineStart = i + 1;
        continue;
      }
      if (masked[i] !== '"') continue;
      // 非围栏行的遮罩与原行等长，所以遮罩里的列就是原文里的列
      const at = codePoints(masked.slice(lineStart, i));
      const cps = [...(lines[line] ?? '')];
      const from = Math.max(0, at - 12);
      const to = Math.min(cps.length, at + 13);
      findings.push({
        rule: 'H6', severity: 'error', line: line + 1, column: at + 1,
        message: 'ASCII 直引号：换成 “ ”',
        excerpt: `${from > 0 ? '…' : ''}${cps.slice(from, to).join('')}${to < cps.length ? '…' : ''}`,
      });
    }
  }

  return findings;
}
