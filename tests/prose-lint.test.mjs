import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from 'yaml';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { lintProse } from '../src/lib/prose-lint.ts';

const lint = (collection, frontmatter, body) => lintProse({ collection, frontmatter, body });
const lesson = (frontmatter, body) => lint('lessons', frontmatter, body);
/** lintProse 返回 findings 列表本身 */
const byRule = (findings, rule) => findings.filter((f) => f.rule === rule);
const rulesOf = (findings) => [...new Set(findings.map((f) => f.rule))].sort();

test('H1：课程正文有「## 目标」小节就报，带冒号副题也算，并给出行号', () => {
  const body = '## 机制\n\n先讲原理。\n\n## 目标\n\n学会写提示词。\n\n## 目标: 学会排错\n\n再讲排错。\n';
  const h1 = byRule(lesson({}, body), 'H1');
  assert.deepEqual(h1.map((f) => f.line), [5, 9]);
  assert.equal(h1[0].severity, 'error');
  assert.match(h1[0].message, /## 目标/);
});

test('H1 豁免：三级标题、「学习目标」、代码块里的示例、非课程集合都不报', () => {
  const body = '### 目标\n\n## 学习目标\n\n```md\n## 目标\n```\n';
  assert.equal(byRule(lesson({}, body), 'H1').length, 0);
  assert.equal(byRule(lint('resources', {}, '## 目标\n\n学会写提示词。\n'), 'H1').length, 0);
});

test('H2：加粗超过 4 处 / 千字就报，说明里给出处数与字数', () => {
  const body = '字'.repeat(1000) + '\n\n**a** **b** **c** **d** **e**\n';
  const h2 = byRule(lesson({}, body), 'H2');
  assert.equal(h2.length, 1);
  assert.equal(h2[0].severity, 'error');
  assert.match(h2[0].message, /加粗 5 处 \/ 1000 字/);
  assert.match(h2[0].message, /5 处每千字/);
  assert.match(h2[0].message, /上限 4/);
  assert.deepEqual(h2[0].numbers, { bold: 5, chars: 1000, perKilo: 5 });
  // 恰好 4 处 / 千字不报
  assert.equal(byRule(lesson({}, '字'.repeat(1000) + '\n\n**a** **b** **c** **d**'), 'H2').length, 0);
  // 《文风》里的反例：01-03 全课 70 处 / 3093 字 ≈ 22.6 / 千字
  const doc = byRule(lesson({}, '字'.repeat(3093) + '\n\n' + '**a** '.repeat(70)), 'H2')[0];
  assert.match(doc.message, /加粗 70 处 \/ 3093 字 ≈ 22\.6 处每千字/);
  assert.equal(doc.numbers.perKilo, 22.6);
});

test('H2 豁免：代码块与行内代码里的加粗不计', () => {
  const body = [
    '```md',
    '**代码块一** **代码块二** **代码块三** **代码块四** **代码块五** **代码块六**',
    '```',
    '',
    '点 **运行**，行内代码 `**不算加粗**` 也不计。再加 **问题** 一处。',
    '',
    '字'.repeat(1000),
  ].join('\n');
  assert.equal(byRule(lesson({}, body), 'H2').length, 0);
});

test('H2 字数：代码块里的汉字不计入千字的分母', () => {
  // 代码块外 3 处加粗 / 603 字 ≈ 5 / 千字，超标；若把代码块里的 400 个汉字算进去就只有 3 / 千字
  const body = '```txt\n' + '码'.repeat(400) + '\n```\n\n**甲** **乙** **丙**\n\n' + '字'.repeat(600);
  const h2 = byRule(lesson({}, body), 'H2');
  assert.equal(h2.length, 1);
  assert.match(h2[0].message, /加粗 3 处 \/ 603 字/);
});

test('H3：标题去掉路径前缀后超过 20 字就报；恰好 20 字不报，前缀本身不计入', () => {
  const h3 = byRule(lesson({ title: 'L1 · ' + '甲'.repeat(21) }, ''), 'H3');
  assert.equal(h3.length, 1);
  assert.equal(h3[0].field, 'title');
  assert.match(h3[0].message, /21 字（上限 20）/);
  assert.deepEqual(h3[0].numbers, { length: 21 });
  assert.equal(h3[0].excerpt, 'L1 · ' + '甲'.repeat(21));
  assert.equal(byRule(lesson({ title: 'L1 · ' + '甲'.repeat(20) }, ''), 'H3').length, 0);
  assert.equal(byRule(lesson({ title: '甲'.repeat(21) }, ''), 'H3').length, 1);
  assert.equal(byRule(lesson({ title: '放大三路线' }, ''), 'H3').length, 0);
  // 《文风》里的反例：01-03 的标题 29 字
  assert.match(byRule(lesson({ title: '提示词基础：Anima 怎么读你的话、三种写法、七条硬规则' }, ''), 'H3')[0].message, /29 字/);
});

test('H4：导语超过 70 字就报；恰好 70 字、没有 summary 字段都不报', () => {
  const h4 = byRule(lesson({ summary: '字'.repeat(71) }, ''), 'H4');
  assert.equal(h4.length, 1);
  assert.equal(h4[0].field, 'summary');
  assert.match(h4[0].message, /71 字（上限 70）/);
  assert.equal(byRule(lesson({ summary: '字'.repeat(70) }, ''), 'H4').length, 0);
  assert.equal(byRule(lesson({}, ''), 'H4').length, 0);
  // 《文风》里的反例：01-03 的导语 83 字
  const doc = lesson({ summary: '先懂机制（双分词器、逗号后空格、0.6B 的"大脑"），再学三种写法与七条硬规则、四段式结构、按版本调整、陷阱标签；最后用 Tagger 把"看着像"变成"叫什么"。' }, '');
  assert.match(byRule(doc, 'H4')[0].message, /83 字/);
});

test('H5：课程正文小节与固定区块重名就报，给出行号与小节名；带后缀的不算重名', () => {
  const body = '## 验收\n\n都记进实验记录本。\n\n## 本课涉及\n\n## 翻页器\n\n## 验收清单怎么用\n';
  const h5 = byRule(lesson({}, body), 'H5');
  assert.deepEqual(h5.map((f) => f.line), [1, 5, 7]);
  assert.match(h5[0].message, /「验收」/);
  assert.equal(h5[0].severity, 'error');
});

test('H5 豁免：非课程集合不查固定区块重名', () => {
  assert.equal(byRule(lint('troubleshooting', {}, '## 验收\n\n## 对照图\n'), 'H5').length, 0);
  assert.equal(byRule(lint('resources', {}, '## 验收\n'), 'H5').length, 0);
});

test('H6：正文与 frontmatter 字符串值（含嵌套的数组、对象）里的 ASCII 直引号就报，正文给出行列', () => {
  const body = '这是"大脑"。\n\n换行后的 "看着像"。\n';
  const frontmatter = {
    title: '写 Anima 提示词',
    deliverable: '同一画面（建议"雨天电车站台的少女"）各一张',
    acceptance: ['能说出"权重只有一半生效"的原因'],
    figures: [{ caption: '同一画面："纯标签" / 自然语言' }],
    tags: ['wet', 'lace'],
  };
  const h6 = byRule(lesson(frontmatter, body), 'H6');
  assert.deepEqual(h6.filter((f) => f.field).map((f) => f.field), ['deliverable', 'acceptance[0]', 'figures[0].caption']);
  assert.match(h6[0].message, /deliverable/);
  assert.match(h6[0].message, /2 个/);
  assert.deepEqual(h6.filter((f) => f.line).map((f) => [f.line, f.column]), [[1, 3], [1, 6], [3, 6], [3, 10]]);
  // 命中片段取直引号前后各约 12 个字，到了行首 / 行尾就截断处不加省略号
  assert.equal(h6.find((f) => f.line === 3 && f.column === 10).excerpt, '换行后的 "看着像"。');
  const long = byRule(lesson({}, '字'.repeat(20) + '"x"' + '字'.repeat(20)), 'H6')[0];
  assert.equal(long.excerpt, '…' + '字'.repeat(12) + '"x"' + '字'.repeat(10) + '…');
  assert.ok(h6.every((f) => f.severity === 'error'));
});

test('H6 豁免：代码跨度与代码块里的直引号、frontmatter 外层 YAML 引号都不报', () => {
  const body = '提示词里写 `"best quality"`，JSON 示例：\n\n```json\n{"1": {"class_type": "KSampler"}}\n```\n';
  assert.equal(byRule(lesson({}, body), 'H6').length, 0);
  // 解析后的值里没有直引号：外层引号是 YAML 语法，不算；值里面的才算
  const frontmatter = parse(['title: "装好 ComfyUI，出第一张图"', 'summary: 0.6B 的"大脑"', 'sources:', '  - { badge: 官方, note: "模型卡：书写规则" }'].join('\n'));
  assert.deepEqual(byRule(lesson(frontmatter, ''), 'H6').map((f) => f.field), ['summary']);
  // YAML 转义的 \" 解析后就是直引号，要报
  const escaped = parse('note: "模型卡里写 \\"规则\\""');
  assert.equal(byRule(lesson(escaped, ''), 'H6').length, 1);
});

test('集合规则集：troubleshooting / resources 查 H2 H3 H4 H6，字段不存在就跳过；nodes / tags 只查 H2 H6', () => {
  const frontmatter = { title: '甲'.repeat(30), summary: '字'.repeat(80), meaning: '闭眼。没有"open eyes"反义标签' };
  const body = '## 目标\n\n## 验收\n\n' + '字'.repeat(200) + '\n\n**甲** **乙**\n';
  assert.deepEqual(rulesOf(lint('lessons', frontmatter, body)), ['H1', 'H2', 'H3', 'H4', 'H5', 'H6']);
  assert.deepEqual(rulesOf(lint('troubleshooting', frontmatter, body)), ['H2', 'H3', 'H4', 'H6']);
  assert.deepEqual(rulesOf(lint('resources', frontmatter, body)), ['H2', 'H3', 'H4', 'H6']);
  assert.deepEqual(rulesOf(lint('nodes', frontmatter, body)), ['H2', 'H6']);
  assert.deepEqual(rulesOf(lint('tags', frontmatter, body)), ['H2', 'H6']);
  // 排错卡没有 title / summary：H3 / H4 跳过
  assert.deepEqual(lint('troubleshooting', { symptom: '画面过饱和', first: 'steps 加 5' }, 'T4 参数只在调好后碰。'), []);
  // 字典卡的加粗按短正文算密度：1 处 / 9 字也超标；没有汉字的空正文不报也不崩
  assert.deepEqual(lint('nodes', { name_zh: '加载VAE' }, '读取 `ComfyUI/models/vae/`。**VAE** 必须和模型配套。').map((f) => f.rule), ['H2']);
  assert.deepEqual(lint('tags', { tag: 'wet' }, ''), []);
  // 规范外的集合（如 nsfw）不在规则集里：报错，而不是悄悄放过
  assert.throws(() => lint('nsfw', {}, '## 目标'), /nsfw/);
});

test('棘轮（集成）：名单为空退出码 0；名单里有违规文件退出码 1；名单里有不存在的条目也退出码 1', () => {
  const dir = mkdtempSync(join(tmpdir(), 'prose-lint-'));
  const run = (rewritten) => {
    const config = join(dir, 'config.mjs');
    const report = join(dir, 'report.json');
    writeFileSync(config, `export const rewritten = ${JSON.stringify(rewritten)};\n`);
    const r = spawnSync(process.execPath, ['scripts/prose-lint.mjs', '--config', config, '--report', report], { encoding: 'utf8' });
    return { status: r.status, report: JSON.parse(readFileSync(report, 'utf8')) };
  };
  const empty = run([]);
  assert.equal(empty.status, 0, '名单为空只报告');
  assert.equal(empty.report.byCollection.lessons.files, 20, '报告按集合给出文件数');
  assert.ok(empty.report.files.length > 0, '现状有违规，报告里列出来');

  // 试点课 01-03 改写后已全绿，所以拿还没改写的 00-01 当“名单内有违规”的样本
  const gated = run(['00-01-setup']);
  assert.equal(gated.status, 1, '名单里的文件有违规就拦截');
  assert.deepEqual(gated.report.gate.failing, ['src/content/lessons/00-01-setup.md']);

  const unknown = run(['no-such-lesson']);
  assert.equal(unknown.status, 1, '名单里写了不存在的条目也拦截');
  assert.deepEqual(unknown.report.gate.unknownEntries, ['no-such-lesson']);
});
