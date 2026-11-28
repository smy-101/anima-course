import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BASELINE_FIELDS,
  COLUMNS,
  VARIABLE_KEYS,
  emptyBaseline,
  emptyExperiment,
  emptyLog,
  expandScan,
  inheritRows,
  nextExpId,
  parseCSV,
  parseJSON,
  parseValues,
  sortRows,
  toCSV,
  toJSON,
  toMarkdown,
  today,
  validateLog,
  type Baseline,
  type Experiment,
  type LabLog,
  type Severity,
  type VariableKey,
} from '../lib/lab-log';

const KEY = 'anima:lab-log';

interface Props {
  /** 站点 base，如 /anima-course（无尾斜杠） */
  basePath: string;
}

const SEV_LABEL: Record<Severity, string> = { error: '错误', warn: '提醒', info: '提示' };
const RANK: Record<Severity, number> = { error: 0, warn: 1, info: 2 };

/** 每条规则链回讲原理的地方 */
const RULE_HREF: Record<string, string> = {
  'multi-variable': '/lessons/02-01-l2-sweeps/',
  'baseline-missing': '/resources/experiment-log/#记录规则',
};
const RULE_FALLBACK = '/resources/experiment-log/#记录规则';

/** 这些列给宽一点；日期 / 采样器 / 文件名按内容给足宽度 */
const WIDE = new Set<string>(['purpose', 'prompt', 'result']);
const MID = new Set<string>(['date', 'sampler']);
const FILE = new Set<string>(['file']);

function colClass(key: string): string | undefined {
  if (WIDE.has(key)) return 'wide';
  if (MID.has(key)) return 'mid';
  if (FILE.has(key)) return 'file';
  return undefined;
}

function labelOf(key: keyof Experiment): string {
  return COLUMNS.find((c) => c.key === key)!.label;
}

/** 模板页（resources/experiment-log.md）里那张示例表 */
function exampleLog(): LabLog {
  const common = { date: '2026-11-25', model: 'base-v1.0', prompt: '樱花少女 A', seed: '12345', resolution: '1024²', steps: '30', sampler: 'euler / simple', denoise: '1', other: '—' };
  const e1 = { ...common, purpose: '找 cfg 甜点', expId: 'E001' };
  const e2 = { ...common, purpose: '采样器风格', expId: 'E002', cfg: '4.0', sampler: 'er_sde / simple' };
  return {
    experiments: [
      emptyExperiment({ ...e1, cfg: '3.5', result: '3.5 偏淡，发色特征丢失', file: 'Anima/E001/00003' }),
      emptyExperiment({ ...e1, cfg: '4.0', result: '4.0 最佳，线条干净、颜色到位', file: 'Anima/E001/00004' }),
      emptyExperiment({ ...e1, cfg: '4.5', result: '4.5 开始线条发硬', file: 'Anima/E001/00005' }),
      emptyExperiment({ ...e2, result: '比 euler 更平涂；细节略少', file: 'Anima/E002/00001' }),
    ],
    baselines: [
      emptyBaseline({ date: '2026-11-25', model: 'base-v1.0', sampler: 'euler / simple', cfg: '4.0', steps: '30', denoise: '1', review: '4.0 最佳；明天 E003 验证 er_sde 在 cfg 4.0 下细节是否更少' }),
    ],
  };
}

function load(): LabLog | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    return parseJSON(localStorage.getItem(KEY) ?? 'null');
  } catch {
    return null;
  }
}

function latestBaseline(log: LabLog): Baseline | undefined {
  return [...log.baselines].sort((a, b) => b.date.localeCompare(a.date))[0];
}

/** 新行 / 扫描的模板：日期今天、ID 取下一个；参数取今日基线（或上一行），指定 from 时取该行 */
function scanTemplate(log: LabLog, from?: Experiment): Experiment {
  const last = from ?? log.experiments[log.experiments.length - 1];
  const bl = from ? undefined : latestBaseline(log);
  return emptyExperiment({
    date: today(),
    expId: nextExpId(log),
    purpose: last?.purpose ?? '',
    model: bl?.model || last?.model || '',
    prompt: last?.prompt ?? '',
    seed: last?.seed ?? '',
    resolution: last?.resolution ?? '',
    steps: bl?.steps || last?.steps || '',
    cfg: bl?.cfg || last?.cfg || '',
    sampler: bl?.sampler || last?.sampler || '',
    denoise: bl?.denoise || last?.denoise || '',
    other: last?.other ?? '',
  });
}

/** 只认本工具导出的 CSV / JSON；Markdown 表不给导入（解析不了就报错，不猜） */
function parseAny(text: string): LabLog | 'markdown' | null {
  const t = text.replace(/^\uFEFF/, '').trim();
  if (!t) return null;
  if (t.startsWith('{')) return parseJSON(t);
  const head = t.split(/\r?\n/)[0];
  if (head.trim().startsWith('|')) return 'markdown';
  if (COLUMNS.every((c) => head.includes(c.label))) return parseCSV(t);
  return null;
}

function download(name: string, text: string, type: string) {
  const blob = new Blob([text], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

/** detail 里的 `code` 渲染成 <code> */
function prose(text: string) {
  return text.split(/(`[^`]+`)/).map((part, i) => (i % 2 === 1 ? <code key={i}>{part.slice(1, -1)}</code> : <span key={i}>{part}</span>));
}

/** 实验记录本：按《补充A》模板记实验，一个 ID 一个变量，结论必写为什么，每天一行今日基线。纯前端。 */
export default function LabLog({ basePath }: Props) {
  const [log, setLog] = useState<LabLog>(() => emptyLog());
  const [hydrated, setHydrated] = useState(false);
  const [flash, setFlash] = useState('');
  const [scanVar, setScanVar] = useState<VariableKey>('cfg');
  const [scanValues, setScanValues] = useState('');
  /** 「由此扫描」选中的模板行；null 表示用今日基线 / 上一行 */
  const [scanBaseId, setScanBaseId] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);

  useEffect(() => {
    const saved = load();
    if (saved) setLog(saved);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(KEY, toJSON(log));
    } catch {
      /* 存不下就算了 */
    }
  }, [log, hydrated]);

  const findings = useMemo(() => validateLog(log), [log]);
  const inherited = useMemo(() => inheritRows(log.experiments), [log.experiments]);
  const rowSev = useMemo(() => {
    const m = new Map<string, Severity>();
    for (const f of findings) {
      for (const id of f.rowIds) {
        const cur = m.get(id);
        if (!cur || RANK[f.severity] < RANK[cur]) m.set(id, f.severity);
      }
    }
    return m;
  }, [findings]);
  const counts = useMemo(
    () => ({
      error: findings.filter((f) => f.severity === 'error').length,
      warn: findings.filter((f) => f.severity === 'warn').length,
      info: findings.filter((f) => f.severity === 'info').length,
    }),
    [findings],
  );
  const scanBase = scanBaseId ? inherited.find((r) => r.id === scanBaseId) ?? null : null;

  const patchRow = (id: string, key: keyof Experiment, value: string) =>
    setLog((l) => ({ ...l, experiments: l.experiments.map((r) => (r.id === id ? Object.assign({}, r, { [key]: value }) : r)) }));
  const patchBaseline = (id: string, key: keyof Baseline, value: string) =>
    setLog((l) => ({ ...l, baselines: l.baselines.map((b) => (b.id === id ? Object.assign({}, b, { [key]: value }) : b)) }));
  const removeRow = (id: string) => {
    setLog((l) => ({ ...l, experiments: l.experiments.filter((r) => r.id !== id) }));
    setScanBaseId((cur) => (cur === id ? null : cur));
  };
  const removeBaseline = (id: string) => setLog((l) => ({ ...l, baselines: l.baselines.filter((b) => b.id !== id) }));

  /** sameExperiment：续在最后一个实验后面（同日期同 ID，参数留空 = 同上）；否则开新 ID */
  const appendRow = (sameExperiment: boolean) =>
    setLog((l) => {
      const last = l.experiments[l.experiments.length - 1];
      const row = sameExperiment && last ? emptyExperiment({ date: last.date, expId: last.expId, purpose: last.purpose }) : scanTemplate(l);
      return { ...l, experiments: [...l.experiments, row] };
    });

  const addBaseline = () =>
    setLog((l) => {
      const bl = latestBaseline(l);
      const last = inheritRows(l.experiments).at(-1);
      return {
        ...l,
        baselines: [
          ...l.baselines,
          emptyBaseline({
            date: today(),
            model: last?.model || bl?.model || '',
            sampler: last?.sampler || bl?.sampler || '',
            cfg: last?.cfg || bl?.cfg || '',
            steps: last?.steps || bl?.steps || '',
            denoise: last?.denoise || bl?.denoise || '',
          }),
        ],
      };
    });

  const runScan = () => {
    const values = parseValues(scanValues);
    if (!values.length) {
      setFlash('先填要扫描的取值，换行或逗号分隔，如 3.5 / 4 / 4.5');
      return;
    }
    const from = scanBase ?? undefined;
    const base = scanTemplate(log, from);
    const rows = expandScan(base, scanVar, values);
    setLog((l) => ({ ...l, experiments: [...l.experiments, ...rows] }));
    setScanBaseId(null);
    setFlash(`已生成 ${rows.length} 行（${base.expId}）：只改「${labelOf(scanVar)}」，其它取自${from ? '模板行' : '今日基线 / 上一行'}。填好目的与结论再导出。`);
    tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const sortLog = () => {
    setLog((l) => ({ ...l, experiments: sortRows(l.experiments) }));
    setFlash('已按日期 → 实验 ID 排好；导出时也会这样排');
  };

  const clearAll = () => {
    if ((log.experiments.length || log.baselines.length) && !window.confirm('清空全部记录？已导出的文件不受影响。')) return;
    setLog(emptyLog());
    setScanBaseId(null);
    setScanValues('');
    setFlash('已清空');
  };

  const exportAs = (kind: 'csv' | 'md' | 'json') => {
    if (kind === 'csv') download('anima-lab-log.csv', toCSV(log), 'text/csv;charset=utf-8');
    else if (kind === 'md') download('anima-lab-log.md', toMarkdown(log), 'text/markdown;charset=utf-8');
    else download('anima-lab-log.json', toJSON(log), 'application/json');
    setFlash(`已导出 ${kind === 'md' ? 'Markdown' : kind.toUpperCase()}：${log.experiments.length} 行实验、${log.baselines.length} 条基线`);
  };

  const copyMd = async () => {
    try {
      await navigator.clipboard.writeText(toMarkdown(log));
      setFlash('Markdown 已复制，可直接贴进笔记');
    } catch {
      setFlash('复制失败，用「导出 Markdown」');
    }
  };

  const importFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const parsed = parseAny(await file.text());
      if (parsed === 'markdown') {
        setFlash('导入失败：Markdown 表不往回读，请用本工具导出的 CSV 或 JSON');
        return;
      }
      if (!parsed) {
        setFlash('导入失败：只认本工具导出的 CSV / JSON（表头要与模板一致）');
        return;
      }
      if ((log.experiments.length || log.baselines.length) && !window.confirm(`导入会替换当前的 ${log.experiments.length} 行实验、${log.baselines.length} 条基线。继续？`)) return;
      setLog(parsed);
      setScanBaseId(null);
      setFlash(`已导入 ${parsed.experiments.length} 行实验、${parsed.baselines.length} 条基线`);
    } catch {
      setFlash('导入失败：文件读不出来');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const focusRow = (id: string) => {
    setFocusId(id);
    document.getElementById(`lab-row-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    window.setTimeout(() => setFocusId((cur) => (cur === id ? null : cur)), 1600);
  };

  const total = counts.error + counts.warn + counts.info;

  return (
    <div className="lint lab" data-flash={flash}>
      <div className="lint-toolbar">
        <button type="button" onClick={() => appendRow(false)}>+ 新实验</button>
        <button type="button" onClick={() => appendRow(true)} disabled={log.experiments.length === 0}>+ 续一行（同 ID）</button>
        <button type="button" onClick={addBaseline}>+ 今日基线</button>
        <button type="button" onClick={sortLog} disabled={log.experiments.length < 2}>按日期 / ID 排序</button>
        <button type="button" onClick={() => { setLog(exampleLog()); setScanBaseId(null); setFlash('已载入模板页的示例（两个实验、一条基线）'); }}>载入示例</button>
        <button type="button" onClick={clearAll} disabled={log.experiments.length === 0 && log.baselines.length === 0}>清空</button>
        <span className="muted" aria-live="polite">{flash}</span>
      </div>

      <section className="lab-scan" aria-label="生成一次扫描">
        <label>
          变量{' '}
          <select value={scanVar} onChange={(e) => setScanVar(e.target.value as VariableKey)}>
            {VARIABLE_KEYS.map((k) => (
              <option key={k} value={k}>
                {labelOf(k)}
              </option>
            ))}
          </select>
        </label>
        <label>
          取值（换行 / 逗号分隔）
          <textarea value={scanValues} onChange={(e) => setScanValues(e.target.value)} placeholder={'3.5\n4\n4.5'} rows={3} spellCheck={false} />
        </label>
        <div>
          <button type="button" className="primary" onClick={runScan} disabled={!parseValues(scanValues).length}>
            生成扫描（{parseValues(scanValues).length} 行）
          </button>
          <div className="muted">
            {scanBase
              ? <>模板：<b>{scanBase.expId}</b> 那一行（{labelOf(scanVar)}：{scanBase[scanVar] || '空'}），只改变量列{' '}
                  <button type="button" onClick={() => setScanBaseId(null)}>改用基线</button></>
              : '模板：今日基线 / 最后一行；日期取今天，ID 取下一个，文件名 Anima/<ID>/序号'}
          </div>
        </div>
      </section>

      <div className="lint-summary" role="status">
        <span className="lint-count lint-error-pill">错误 <b>{counts.error}</b></span>
        <span className="lint-count lint-warn-pill">提醒 <b>{counts.warn}</b></span>
        <span className="lint-count lint-info-pill">提示 <b>{counts.info}</b></span>
        <span className="muted">
          {log.experiments.length === 0 && log.baselines.length === 0
            ? '还没有记录。先「生成扫描」或「载入示例」。'
            : `${log.experiments.length} 行实验、${log.baselines.length} 条基线${total === 0 ? '，记录合格。' : ''}`}
        </span>
      </div>

      {log.experiments.length > 0 ? (
        <div className="table-wrap">
          <table ref={tableRef} className="lab-table">
            <thead>
              <tr>
                {COLUMNS.map((c) => (
                  <th key={c.key} title={c.hint}>{c.label}</th>
                ))}
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {log.experiments.map((r, i) => {
                const sev = rowSev.get(r.id);
                const cls = [sev ? `has-${sev}` : '', focusId === r.id ? 'row-flash' : ''].filter(Boolean).join(' ');
                return (
                  <tr key={r.id} id={`lab-row-${r.id}`} className={cls || undefined}>
                    {COLUMNS.map((c) => {
                      const v = r[c.key];
                      const inh = c.variable && !v.trim() ? inherited[i][c.key].trim() : '';
                      const placeholder = inh ? `〃 ${inh}` : (c.hint ?? '');
                      return (
                        <td key={c.key} className={colClass(c.key)}>
                          <input
                            value={v}
                            placeholder={placeholder}
                            title={c.hint}
                            spellCheck={false}
                            aria-label={c.label}
                            onChange={(e) => patchRow(r.id, c.key, e.target.value)}
                          />
                        </td>
                      );
                    })}
                    <td className="rowtools">
                      <button type="button" onClick={() => { setScanBaseId(r.id); setFlash(`以 ${r.expId} 这行为模板：填好取值后点「生成扫描」`); }} aria-pressed={scanBaseId === r.id} title="以这一行为模板，只改一个变量生成新实验">
                        由此扫描
                      </button>
                      <button type="button" onClick={() => removeRow(r.id)} title="删除这一行">删</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="lab-empty">表还是空的。「生成扫描」会按今日基线 / 上一行复制出 N 行，只改变量列；同一 ID 内留空的参数格表示“同上”（占位里会写出继承到的值）。</p>
      )}

      <section aria-labelledby="lab-baseline-h">
        <h2 className="lint-h" id="lab-baseline-h">今日基线</h2>
        {log.baselines.length > 0 ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>日期</th>
                  {BASELINE_FIELDS.map((f) => (
                    <th key={f.key}>{f.label}</th>
                  ))}
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {[...log.baselines].sort((a, b) => a.date.localeCompare(b.date)).map((b) => (
                  <tr key={b.id} id={`lab-bl-${b.id}`}>
                    <td className={focusId === b.id ? 'row-flash' : undefined}>
                      <input value={b.date} placeholder="YYYY-MM-DD" spellCheck={false} aria-label="日期" onChange={(e) => patchBaseline(b.id, 'date', e.target.value)} />
                    </td>
                    {BASELINE_FIELDS.map((f) => (
                      <td key={f.key} className={f.key === 'review' ? 'wide' : undefined}>
                        <input value={b[f.key]} placeholder={f.key === 'review' ? '今天最佳是哪张、为什么；明天验证什么' : ''} spellCheck={false} aria-label={f.label} onChange={(e) => patchBaseline(b.id, f.key, e.target.value)} />
                      </td>
                    ))}
                    <td className="rowtools">
                      <button type="button" onClick={() => removeBaseline(b.id)} title="删除这条基线">删</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">还没有基线。每天最后一行写当前认定的最佳组合，第二天的实验从它出发——「+ 今日基线」会从最后一行预填。</p>
        )}
      </section>

      {findings.length > 0 && (
        <section aria-labelledby="lab-findings-h">
          <h2 className="lint-h" id="lab-findings-h">检查结果</h2>
          <ol className="lint-findings">
            {findings.map((f, i) => (
              <li key={`${f.rule}-${i}`} className={`lint-finding ${f.severity}`}>
                <div className="head">
                  <span className={`pill lint-pill-${f.severity}`}>{SEV_LABEL[f.severity]}</span>
                  <b>{f.title}</b>
                </div>
                <p>{prose(f.detail)}</p>
                <div className="actions">
                  {f.rule === 'baseline-missing' && <button type="button" onClick={addBaseline}>补今日基线</button>}
                  {f.rowIds.length > 0 && (
                    <button type="button" onClick={() => focusRow(f.rowIds[0])}>定位（{f.rowIds.length} 行）</button>
                  )}
                  <a href={`${basePath}${RULE_HREF[f.rule] ?? RULE_FALLBACK}`} target="_blank" rel="noopener">原理 ↗</a>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      <div className="lint-toolbar">
        <button type="button" onClick={() => exportAs('csv')} disabled={log.experiments.length === 0}>导出 CSV</button>
        <button type="button" onClick={() => exportAs('md')} disabled={log.experiments.length === 0}>导出 Markdown</button>
        <button type="button" onClick={copyMd} disabled={log.experiments.length === 0}>复制 Markdown</button>
        <button type="button" onClick={() => exportAs('json')}>导出 JSON</button>
        <button type="button" onClick={() => fileRef.current?.click()}>导入 CSV / JSON</button>
        <input ref={fileRef} type="file" accept=".csv,.json,text/csv,application/json" style={{ display: 'none' }} onChange={(e) => importFile(e.target.files?.[0])} />
        <span className="muted">CSV 带 BOM，Excel 直接开；空白格按“同上”填好；今日基线附在表尾。</span>
      </div>
    </div>
  );
}
