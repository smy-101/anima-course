import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  expandScan, emptyExperiment, emptyBaseline, emptyLog, inheritRows, nextExpId, parseCSV, parseJSON, parseValues,
  sortRows, toCSV, toJSON, toMarkdown, validateLog, today,
} from '../src/lib/lab-log.ts';

const row = (o) => emptyExperiment({ date: '2026-11-25', expId: 'E001', purpose: '找 cfg 甜点', model: 'base-v1.0', prompt: '樱花少女 A', seed: '12345', resolution: '1024²', steps: '30', cfg: '4', sampler: 'euler / simple', denoise: '1', other: '—', ...o });
const rules = (log) => validateLog(log).map((f) => f.rule);

test('today 是 YYYY-MM-DD', () => {
  assert.match(today(), /^\d{4}-\d{2}-\d{2}$/);
});

test('nextExpId：空表是 E001，忽略非 E 开头的 ID', () => {
  assert.equal(nextExpId(emptyLog()), 'E001');
  const log = emptyLog();
  log.experiments.push(row({ expId: 'E007' }), row({ expId: '试一试' }), row({ expId: 'e12' }));
  assert.equal(nextExpId(log), 'E013');
});

test('parseValues：换行 / 逗号 / 中文逗号 / 分号都算分隔，去重保序', () => {
  assert.deepEqual(parseValues('3, 3.5\n4，4.5;4\n\n'), ['3', '3.5', '4', '4.5']);
});

test('expandScan：只改变量列，文件名默认 Anima/<ID>/<序号>，结论清空', () => {
  const base = row({ cfg: '9', result: '旧结论', file: 'Anima/E001/00001' });
  const rows = expandScan(base, 'cfg', ['3.5', '4', '4.5']);
  assert.equal(rows.length, 3);
  assert.deepEqual(rows.map((r) => r.cfg), ['3.5', '4', '4.5']);
  assert.ok(rows.every((r) => r.steps === '30' && r.seed === '12345' && r.result === ''));
  assert.deepEqual(rows.map((r) => r.file), ['Anima/E001/00001', 'Anima/E001/00002', 'Anima/E001/00003']);
  assert.equal(new Set(rows.map((r) => r.id)).size, 3);
  // 自定义文件名（带变量语法）原样保留
  const custom = expandScan(row({ file: 'Anima/E001/%KSampler.cfg%' }), 'cfg', ['3.5', '4']);
  assert.ok(custom.every((r) => r.file === 'Anima/E001/%KSampler.cfg%'));
});

test('inheritRows：同实验的空白参数继承上一行，不同实验不继承', () => {
  const filled = inheritRows([row({ cfg: '3.5' }), row({ cfg: '4', model: '', expId: 'E001' }), row({ expId: 'E002', model: '' })]);
  assert.equal(filled[1].model, 'base-v1.0');
  assert.equal(filled[2].model, '');
});

test('校验：一个实验 ID 改了两个变量是错误；只改一个是正常；全同是提示', () => {
  const two = emptyLog();
  two.experiments.push(row({ cfg: '3.5', steps: '30' }), row({ cfg: '4', steps: '40' }));
  assert.equal(validateLog(two)[0].rule, 'multi-variable');
  assert.equal(validateLog(two)[0].severity, 'error');
  const one = emptyLog();
  one.experiments.push(row({ cfg: '3.5', result: '偏淡' }), row({ cfg: '4', result: '线条干净' }));
  assert.ok(!rules(one).includes('multi-variable'));
  const same = emptyLog();
  same.experiments.push(row({ result: 'a' }), row({ result: 'b' }));
  assert.ok(rules(same).includes('no-variable'));
});

test('校验：结论缺失 / 只写好坏 / 缺 ID / 缺日期 / ID 跨日复用 / 缺今日基线', () => {
  const log = emptyLog();
  log.experiments.push(
    row({ date: '2026-11-25', expId: 'E001', result: '好' }),
    row({ date: '2026-11-25', expId: 'E002', cfg: '3.5', result: '' }),
    row({ date: '2026-11-26', expId: 'E002', cfg: '3', result: 'x', purpose: 'y' }),
    emptyExperiment({ expId: '', date: '2026-11-26', result: 'zzz why' }),
    row({ expId: 'E003', date: '', result: 'zzz why' }),
  );
  const r = rules(log);
  for (const expected of ['result-why', 'result-missing', 'missing-id', 'missing-date', 'id-reused', 'baseline-missing']) assert.ok(r.includes(expected), expected);
  log.baselines.push(emptyBaseline({ date: '2026-11-25' }), emptyBaseline({ date: '2026-11-26' }));
  assert.ok(!rules(log).includes('baseline-missing'));
  assert.equal(validateLog(log)[0].severity, 'warn', '没有错误时最先的是提醒');
});

test('CSV：带 BOM；空白继承后写全；今日基线作为特殊行；能解析回来', () => {
  const log = emptyLog();
  log.experiments.push(row({ cfg: '3.5', result: '偏淡, 发色丢了' }), row({ cfg: '4', model: '', purpose: '', result: '"最佳" 线条干净' }));
  log.baselines.push(emptyBaseline({ date: '2026-11-25', model: 'base-v1.0', cfg: '4', review: '明天\n试 steps' }));
  const csv = toCSV(log);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes('"偏淡, 发色丢了"'));
  assert.ok(csv.includes('""最佳"" 线条干净'));
  assert.ok(csv.includes('今日基线'));
  const back = parseCSV(csv);
  assert.equal(back.experiments.length, 2);
  assert.equal(back.experiments[1].model, 'base-v1.0', '解析时按继承补全');
  assert.equal(back.experiments[1].result, '"最佳" 线条干净');
  assert.equal(back.baselines.length, 1);
  assert.equal(back.baselines[0].cfg, '4');
  assert.equal(back.baselines[0].review, '明天 ⏎ 试 steps');
});

test('Markdown：同实验内相同的值留空，与模板页一致；基线单独一张表', () => {
  const log = emptyLog();
  log.experiments.push(row({ cfg: '3.5', result: '偏淡' }), row({ cfg: '4', result: '最佳' }));
  log.baselines.push(emptyBaseline({ date: '2026-11-25', cfg: '4' }));
  const md = toMarkdown(log);
  const lines = md.trim().split('\n');
  assert.ok(lines[0].startsWith('| 日期 | 实验 ID |'));
  assert.ok(lines[2].includes('找 cfg 甜点'));
  assert.ok(lines[3].includes('|  |  |  |  |  |  |  |  | 4 |'), lines[3]);
  assert.ok(md.includes('## 今日基线'));
});

test('sortRows：日期 → 实验 ID（数字序）→ 原顺序', () => {
  const sorted = sortRows([row({ expId: 'E10' }), row({ expId: 'E2' }), row({ expId: 'E2', date: '2026-11-24' }), row({ expId: 'E2', cfg: '5' })]);
  assert.deepEqual(sorted.map((r) => `${r.date}/${r.expId}/${r.cfg}`), ['2026-11-24/E2/4', '2026-11-25/E2/4', '2026-11-25/E2/5', '2026-11-25/E10/4']);
});

test('JSON 往返：字段完整；坏输入返回 null', () => {
  const log = emptyLog();
  log.experiments.push(row({ cfg: '3.5', result: 'x' }));
  log.baselines.push(emptyBaseline({ date: '2026-11-25', cfg: '4', review: 'r' }));
  const back = parseJSON(toJSON(log));
  assert.equal(back.experiments[0].cfg, '3.5');
  assert.equal(back.experiments[0].purpose, '找 cfg 甜点');
  assert.equal(back.baselines[0].date, '2026-11-25');
  assert.equal(back.baselines[0].review, 'r');
  assert.equal(parseJSON('not json'), null);
  assert.deepEqual(parseJSON('{"experiments": "x"}').experiments, []);
});
