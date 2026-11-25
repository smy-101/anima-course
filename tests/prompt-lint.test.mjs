import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lintPrompt, autoFix, splitItems } from '../src/lib/prompt-lint.ts';

const OPTS = {
  version: 'base',
  traps: [
    { tag: 'wet', meaning: '皮肤 / 衣物湿透反光、满是水珠。', slug: 'wet' },
    { tag: 'monochrome', meaning: '黑白图。', slug: 'monochrome' },
  ],
  tags: ['long hair', 'monochrome', '1girl', 'solo', 'blue eyes', 'black hair', 'safe'],
};

function rules(res, field) {
  return res.findings.filter((f) => !field || f.field === field).map((f) => f.rule);
}
function finding(res, rule) {
  return res.findings.find((f) => f.rule === rule);
}

test('下划线：long_hair 报错，score_9 例外；修正后只剩 score_9 带下划线', () => {
  const res = lintPrompt('masterpiece, long_hair, score_9, safe', '', OPTS);
  const f = finding(res, 'underscore');
  assert.ok(f);
  assert.equal(f.severity, 'error');
  assert.deepEqual(f.snippets, ['long_hair']);
  assert.equal(autoFix('masterpiece, long_hair, score_9'), 'masterpiece, long hair, score_9');
});

test('逗号后没有空格：报错并标出位置；修正加空格', () => {
  const text = 'masterpiece,best quality';
  const res = lintPrompt(text, '', OPTS);
  assert.ok(rules(res).includes('comma-space'));
  const m = res.marks.positive.find((x) => x.rule === 'comma-space');
  assert.equal(m.start, text.indexOf(','));
  assert.equal(autoFix(text), 'masterpiece, best quality');
});

test('修正不会把段落合并：逗号后面是空行时保持不变', () => {
  const text = '@huke, highres, beach, sand,\n\nA girl with brown hair is standing on the right.';
  assert.equal(autoFix(text), text);
});

test('陷阱标签只在正向报；放负向不报', () => {
  const pos = lintPrompt('1girl, solo, safe, wet shirt', '', OPTS);
  const f = finding(pos, 'trap-tag');
  assert.ok(f);
  assert.equal(f.href, '/tags/wet/');
  assert.equal(f.snippets[0], 'wet');
  const neg = lintPrompt('1girl, solo, safe', 'monochrome, blurry', OPTS);
  assert.equal(finding(neg, 'trap-tag'), undefined);
});

test('安全等级：缺失是提示；写两个是错误；safe 与露骨标签同现是错误', () => {
  assert.equal(finding(lintPrompt('1girl, solo', '', OPTS), 'rating-missing')?.severity, 'info');
  assert.equal(finding(lintPrompt('safe, sensitive, 1girl', '', OPTS), 'rating-conflict')?.title, '写了多个安全等级');
  assert.equal(finding(lintPrompt('safe, 1girl, nude', '', OPTS), 'rating-conflict')?.title, 'safe 与露骨标签同现');
  assert.equal(finding(lintPrompt('sensitive, 1girl, bikini', '', OPTS), 'rating-conflict'), undefined);
});

test('打码标签：正向报错，负向不报；uncensored 不会被当成 censored', () => {
  assert.ok(finding(lintPrompt('explicit, uncensored, 1girl', 'censored', OPTS), 'censored-positive') === undefined);
  assert.ok(finding(lintPrompt('explicit, censored, 1girl', '', OPTS), 'censored-positive'));
  assert.ok(finding(lintPrompt('explicit, 1girl', 'censored, bar censor', OPTS), 'censored-positive') === undefined);
});

test('Aesthetic 版正负向出现 score_* 都是错误；Base 不报', () => {
  const pos = lintPrompt('masterpiece, score_7, safe', 'worst quality', { ...OPTS, version: 'aesthetic' });
  assert.equal(finding(pos, 'score-aesthetic')?.field, 'positive');
  const neg = lintPrompt('masterpiece, safe', 'score_1, score_2', { ...OPTS, version: 'aesthetic' });
  assert.equal(finding(neg, 'score-aesthetic')?.field, 'negative');
  assert.equal(finding(lintPrompt('masterpiece, score_7, safe', '', OPTS), 'score-aesthetic'), undefined);
});

test('Turbo 下负向无效是提示；负向里有正向的标签是提醒', () => {
  const turbo = lintPrompt('safe, 1girl, monochrome', 'blurry', { ...OPTS, version: 'turbo' });
  assert.equal(finding(turbo, 'negative-turbo')?.severity, 'info');
  const conflict = lintPrompt('safe, 1girl, monochrome', 'monochrome, blurry, nsfw', OPTS);
  assert.deepEqual(finding(conflict, 'negative-conflict')?.snippets, ['monochrome']);
});

test('多人连带规则：2 个角色只有 1 份发色时提醒；写够份数不报', () => {
  assert.ok(finding(lintPrompt('sensitive, 2girls, black hair, blue eyes', '', OPTS), 'multi-char-features'));
  assert.equal(finding(lintPrompt('sensitive, 2girls, black hair, brown hair, blue eyes, red eyes', '', OPTS), 'multi-char-features'), undefined);
  assert.equal(finding(lintPrompt('sensitive, 1girl, black hair', '', OPTS), 'multi-char-features'), undefined);
});

test('括号：未转义提醒并修正；权重语法不动', () => {
  const res = lintPrompt('safe, toon (style), (chibi:2)', '', OPTS);
  const f = finding(res, 'paren-escape');
  assert.equal(f.snippets.length, 2);
  assert.equal(autoFix('toon (style), (chibi:2), amatsukaze (kancolle)'), 'toon \\(style\\), (chibi:2), amatsukaze \\(kancolle\\)');
  assert.equal(finding(lintPrompt('safe, (chibi:2)', '', OPTS), 'paren-escape'), undefined);
});

test('权重：1 ≤ w < 1.5 提示无效；w ≥ 1.5 与 w < 1 不报', () => {
  assert.ok(finding(lintPrompt('safe, (chibi:1.2)', '', OPTS), 'weight-low'));
  assert.equal(finding(lintPrompt('safe, (chibi:2), (realistic:0.4)', '', OPTS), 'weight-low'), undefined);
});

test('画师：in the style of X 提醒并改成 @x', () => {
  const text = 'safe, in the style of huke, 1girl';
  assert.ok(finding(lintPrompt(text, '', OPTS), 'artist-at'));
  assert.equal(autoFix(text), 'safe, @huke, 1girl');
});

test('全角标点报错并换成半角', () => {
  const text = 'masterpiece，1girl（solo）；safe';
  assert.ok(rules(lintPrompt(text, '', OPTS)).includes('fullwidth-punct'));
  assert.equal(autoFix(text), 'masterpiece, 1girl\\(solo\\), safe');
});

test('大小写：字典里的标签大写是提示；角色名不报', () => {
  const res = lintPrompt('safe, Long Hair, Frieren', '', OPTS);
  assert.deepEqual(finding(res, 'uppercase-tag')?.snippets, ['Long Hair']);
});

test('大小写修正只动字典里的标签，角色名保持原样', () => {
  const ctx = { tags: new Set(['long hair', '1girl']) };
  assert.equal(autoFix('safe, Long Hair, Frieren, 1GIRL', undefined, ctx), 'safe, long hair, Frieren, 1girl');
  assert.equal(autoFix('safe, Long Hair, Frieren'), 'safe, Long Hair, Frieren');
});

test('Markdown / JSON 报错', () => {
  assert.equal(finding(lintPrompt('# girl\n1girl, safe', '', OPTS), 'markdown')?.severity, 'error');
  assert.equal(finding(lintPrompt('{"3": {"class_type": "KSampler"}}', '', OPTS), 'markdown')?.title, '不要用 JSON 包裹');
});

test('统计：条目数与识别到的字典标签数', () => {
  const res = lintPrompt('safe, 1girl, long hair, blue eyes, fern', '', OPTS);
  assert.equal(res.stats.items, 5);
  assert.equal(res.stats.knownTags, 4);
});

test('空条目与多余空格会被修正，修正幂等', () => {
  const dirty = '  safe, , 1girl ,long hair ,, \n';
  const once = autoFix(dirty);
  assert.equal(once, 'safe, 1girl, long hair,'); // 行尾逗号保留：模板里用它表示"下面还有"
  assert.equal(autoFix(once), once);
});

test('splitItems 保留位置', () => {
  const items = splitItems('safe,  1girl\nlong hair');
  assert.deepEqual(items.map((i) => i.value), ['safe', '1girl', 'long hair']);
  assert.equal('safe,  1girl\nlong hair'.slice(items[1].start, items[1].end), '1girl');
});
