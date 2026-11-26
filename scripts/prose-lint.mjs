#!/usr/bin/env node
/**
 * 文风检查（prose-lint）：对 src/content 跑《站点文风》（docs/文风.md）的硬规则，规则本身在 src/lib/prose-lint.ts。
 *   - lessons / troubleshooting / resources 查 H1–H6（字段不存在的规则自然跳过）；nodes / tags 只查加粗（H2）与引号（H6）
 *   - 报告按文件分组写到 reports/prose-lint.json，每条违规带位置与说明；终端打汇总表和每个有违规的文件一行
 *   - 任何一处违规都退出码 1
 * 用法：node scripts/prose-lint.mjs [--content <目录>] [--report <路径>]
 *   两个可选参数给测试用：换一份内容目录、把报告写到别处；默认读 src/content、写 reports/prose-lint.json
 */
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { parse } from 'yaml';
import { lintProse, LIMITS, RULE_SETS, RULE_TITLE } from '../src/lib/prose-lint.ts';

/** 命令行：--content / --report 后面跟路径；其余参数不认 */
function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i === -1 ? fallback : process.argv[i + 1] ?? fallback;
}
/** 内容目录：默认仓库里的 src/content；--content 指向别处时，src/lib/prose-lint.ts 的 RULE_SETS 里每个集合都要有一个子目录（可以是空的） */
const CONTENT_DIR = arg('--content', 'src/content');
const RULES = Object.keys(RULE_TITLE);

const REPORT = arg('--report', 'reports/prose-lint.json');

/** frontmatter：首行 --- 到下一行 ---，与 Astro 的划分一致 */
const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;

async function lintFile(collection, name) {
  const file = `${CONTENT_DIR}/${collection}/${name.replace(/\\/g, '/')}`;
  const src = await readFile(file, 'utf8');
  const m = FRONTMATTER.exec(src);
  let frontmatter = null;
  if (m) {
    try {
      frontmatter = parse(m[1]);
    } catch (err) {
      throw new Error(`${file} 的 frontmatter 不是合法 YAML：${err.message}`);
    }
  }
  // 规则报的行号相对正文；加上 frontmatter 占的行数就是文件里的行号
  const offset = m ? m[0].split('\n').length - 1 : 0;
  const findings = lintProse({ collection, frontmatter, body: m ? src.slice(m[0].length) : src }).map((f) =>
    f.line === undefined ? f : { ...f, line: f.line + offset },
  );
  return { file, collection, findings };
}

const results = [];
for (const collection of Object.keys(RULE_SETS)) {
  const names = (await readdir(join(CONTENT_DIR, collection), { recursive: true })).filter((n) => n.endsWith('.md')).sort();
  for (const name of names) results.push(await lintFile(collection, name));
}

/** 每个集合：文件数、有违规的文件数、每条规则有违规的文件数（该集合不查的规则为 null） */
const byCollection = Object.fromEntries(
  Object.keys(RULE_SETS).map((collection) => {
    const rows = results.filter((r) => r.collection === collection);
    return [
      collection,
      {
        files: rows.length,
        filesWithFindings: rows.filter((r) => r.findings.length).length,
        filesByRule: Object.fromEntries(
          RULES.map((rule) => [
            rule,
            RULE_SETS[collection].includes(rule) ? rows.filter((r) => r.findings.some((f) => f.rule === rule)).length : null,
          ]),
        ),
      },
    ];
  }),
);

/** 有违规的文件：它们让脚本退出码 1 */
const failing = results.filter((r) => r.findings.length);

/** 一个文件一行：每条有违规的规则 + 处数或数字 */
function describe(findings) {
  return RULES.filter((rule) => findings.some((f) => f.rule === rule))
    .map((rule) => {
      const hits = findings.filter((f) => f.rule === rule);
      const n = hits[0].numbers;
      if (rule === 'H2') return `H2 ${n.bold} 处/${n.chars} 字≈${n.perKilo}/千字`;
      if (n) return `${rule} ${n.length} 字`;
      return `${rule}×${hits.length}`;
    })
    .join('  ');
}
const where = (f) => f.field ?? (f.line === undefined ? '正文' : `L${f.line}${f.column ? `:${f.column}` : ''}`);

const out = [];
out.push('## 文风检查（prose-lint）');
out.push('');
out.push(`- 规则：docs/文风.md 的硬规则（H2 加粗 ≤ ${LIMITS.boldPerKilo} 处/千字，H3 标题 ≤ ${LIMITS.titleChars} 字，H4 导语 ≤ ${LIMITS.summaryChars} 字）；每条违规的位置与说明见 ${REPORT}`);
out.push('- 下表是「有该违规的文件数」；— 表示这个集合不查这条规则');
out.push('');
out.push(`| 集合 | 文件 | ${RULES.map((r) => `${r} ${RULE_TITLE[r]}`).join(' | ')} |`);
out.push(`|---|---|${RULES.map(() => '---').join('|')}|`);
for (const [collection, s] of Object.entries(byCollection)) {
  out.push(`| ${collection} | ${s.files} | ${RULES.map((r) => s.filesByRule[r] ?? '—').join(' | ')} |`);
}
out.push('');
if (failing.length) {
  out.push(`- 有违规的文件 ${failing.length} / ${results.length}，退出码 1：`);
  for (const r of failing) {
    out.push(`  - ${r.file} — ${describe(r.findings)}`);
    for (const f of r.findings) out.push(`      ${f.rule} ${where(f)}  ${f.message}`);
  }
} else {
  out.push(`- 全部通过：${results.length} 个文件没有硬规则违规`);
}
console.log(out.join('\n'));

await mkdir(dirname(REPORT), { recursive: true });
await writeFile(
  REPORT,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      limits: LIMITS,
      rules: RULE_TITLE,
      byCollection,
      files: failing,
    },
    null,
    2,
  ),
);

process.exit(failing.length ? 1 : 0);
