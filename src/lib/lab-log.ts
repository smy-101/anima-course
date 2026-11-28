/**
 * 实验记录本（纯函数）。
 *
 * 模板与规则来自《补充A》§2（站内 resources/experiment-log.md）：
 * 一个实验 ID = 一次扫描 = 一个变量；结论必须写"为什么"；文件名带实验 ID；每天一行今日基线；失败也记。
 * 只用可擦除的 TS 语法，tests/ 用 node --test 直接加载。
 */

export type Severity = 'error' | 'warn' | 'info';

export interface Experiment {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  /** E001 */
  expId: string;
  purpose: string;
  model: string;
  prompt: string;
  seed: string;
  resolution: string;
  steps: string;
  cfg: string;
  sampler: string;
  denoise: string;
  other: string;
  result: string;
  file: string;
}

/** 今日基线：当前认定的最佳组合 + 当天复盘 */
export interface Baseline {
  id: string;
  date: string;
  model: string;
  sampler: string;
  cfg: string;
  steps: string;
  denoise: string;
  review: string;
}

export interface LabLog {
  experiments: Experiment[];
  baselines: Baseline[];
}

export interface Column {
  key: keyof Experiment;
  label: string;
  /** 可以作为扫描变量的参数列 */
  variable: boolean;
  hint?: string;
}

export type VariableKey = 'model' | 'prompt' | 'seed' | 'resolution' | 'steps' | 'cfg' | 'sampler' | 'denoise' | 'other';

export interface LabFinding {
  rule: string;
  severity: Severity;
  title: string;
  detail: string;
  rowIds: string[];
}

export const COLUMNS: Column[] = [
  { key: 'date', label: '日期', variable: false, hint: 'YYYY-MM-DD' },
  { key: 'expId', label: '实验 ID', variable: false, hint: 'E001；一个 ID = 一次扫描 = 一个变量' },
  { key: 'purpose', label: '目的', variable: false, hint: '你在对比什么（必须手写）' },
  { key: 'model', label: '模型 / LoRA（强度）', variable: true },
  { key: 'prompt', label: '提示词（摘要）', variable: true, hint: '可写“见 PNG”' },
  { key: 'seed', label: 'seed', variable: true, hint: '参数对比时固定' },
  { key: 'resolution', label: '分辨率', variable: true, hint: '参数对比时固定' },
  { key: 'steps', label: 'steps', variable: true },
  { key: 'cfg', label: 'cfg', variable: true },
  { key: 'sampler', label: '采样器 / 调度器', variable: true },
  { key: 'denoise', label: 'denoise', variable: true },
  { key: 'other', label: '其它变量', variable: true },
  { key: 'result', label: '结论（好 / 坏 / 为什么）', variable: false, hint: '必须写为什么' },
  { key: 'file', label: '文件名或目录', variable: false, hint: '保存图像的前缀带实验 ID，如 Anima/E001' },
];

export const VARIABLE_KEYS: VariableKey[] = COLUMNS.filter((c): c is Column & { key: VariableKey } => c.variable).map((c) => c.key);

export const BASELINE_FIELDS: Array<{ key: keyof Baseline; label: string }> = [
  { key: 'model', label: '模型 / LoRA' },
  { key: 'sampler', label: '采样器 / 调度器' },
  { key: 'cfg', label: 'cfg' },
  { key: 'steps', label: 'steps' },
  { key: 'denoise', label: 'denoise' },
  { key: 'review', label: '复盘' },
];

const BASELINE_LABEL = '今日基线';

export function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function emptyExperiment(partial: Partial<Experiment> = {}): Experiment {
  return {
    id: newId(),
    date: '',
    expId: '',
    purpose: '',
    model: '',
    prompt: '',
    seed: '',
    resolution: '',
    steps: '',
    cfg: '',
    sampler: '',
    denoise: '',
    other: '',
    result: '',
    file: '',
    ...partial,
  };
}

export function emptyBaseline(partial: Partial<Baseline> = {}): Baseline {
  return { id: newId(), date: '', model: '', sampler: '', cfg: '', steps: '', denoise: '', review: '', ...partial };
}

export function emptyLog(): LabLog {
  return { experiments: [], baselines: [] };
}

/** 本地日期 YYYY-MM-DD */
export function today(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 下一个实验 ID：E001、E002… */
export function nextExpId(log: LabLog): string {
  let max = 0;
  for (const e of log.experiments) {
    const m = e.expId.trim().match(/^e(\d+)$/i);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `E${String(max + 1).padStart(3, '0')}`;
}

/** 取值列表：按换行 / 逗号 / 分号切，去重保序 */
export function parseValues(text: string): string[] {
  const out: string[] = [];
  for (const v of text.split(/[\n,，;；]+/)) {
    const t = v.trim();
    if (t && !out.includes(t)) out.push(t);
  }
  return out;
}

/**
 * 一次扫描：以 base 为模板复制 N 行，只改变量列；文件名默认 Anima/<实验 ID>/<序号>。
 * base 里已有的变量值不参与——行数与顺序完全由 values 决定。
 */
export function expandScan(base: Experiment, variable: VariableKey, values: string[]): Experiment[] {
  return values.map((v, i) => {
    const row = emptyExperiment({ ...base, id: newId(), [variable]: v });
    if (!row.file.trim() || /^Anima\/[^/]+\/?\d*$/.test(row.file.trim())) {
      row.file = `Anima/${row.expId.trim()}/${String(i + 1).padStart(5, '0')}`;
    }
    row.result = '';
    return row;
  });
}

/** 同一实验内，空白的参数列继承上一行（模板的写法） */
export function inheritRows(rows: Experiment[]): Experiment[] {
  const out: Experiment[] = [];
  const last = new Map<string, Experiment>();
  for (const r of rows) {
    const key = `${r.date}|${r.expId.trim().toLowerCase()}`;
    const prev = last.get(key);
    const row = { ...r };
    if (prev) for (const k of VARIABLE_KEYS) if (!row[k].trim()) row[k] = prev[k];
    out.push(row);
    last.set(key, row);
  }
  return out;
}

/** 按日期 → 实验 ID → 原顺序排列（导出用） */
export function sortRows(rows: Experiment[]): Experiment[] {
  return rows
    .map((r, i) => ({ r, i }))
    .sort((a, b) => a.r.date.localeCompare(b.r.date) || a.r.expId.localeCompare(b.r.expId, undefined, { numeric: true }) || a.i - b.i)
    .map((x) => x.r);
}

const RESULT_BARE = /^(?:好|坏|很好|不错|更好|更差|最佳|最差|差|行|可以|较好|较差|ok|good|bad|best|worse|fine)[。.!！]?$/i;

export function validateLog(log: LabLog): LabFinding[] {
  const out: LabFinding[] = [];
  const rows = log.experiments;
  const push = (f: Omit<LabFinding, 'rowIds'> & { rowIds?: string[] }) => out.push({ rowIds: [], ...f });

  const noId = rows.filter((r) => !r.expId.trim());
  if (noId.length) push({ rule: 'missing-id', severity: 'warn', title: '有行没填实验 ID', detail: '实验 ID 把“一次扫描”的几行绑在一起，也是文件名的目录名。', rowIds: noId.map((r) => r.id) });
  const noDate = rows.filter((r) => !r.date.trim());
  if (noDate.length) push({ rule: 'missing-date', severity: 'warn', title: '有行没填日期', detail: '今日基线按日期对；复盘也按日期回看。', rowIds: noDate.map((r) => r.id) });

  // 同一实验 ID 跨日期重复
  const datesById = new Map<string, Set<string>>();
  for (const r of rows) {
    const k = r.expId.trim().toLowerCase();
    if (!k) continue;
    if (!datesById.has(k)) datesById.set(k, new Set());
    datesById.get(k)!.add(r.date.trim());
  }
  for (const [k, dates] of datesById) {
    if (dates.size > 1) push({ rule: 'id-reused', severity: 'warn', title: `${k.toUpperCase()} 在 ${[...dates].join('、')} 两天都用了`, detail: '一个实验 ID 只代表一次扫描；第二天换 ID，让“今日基线”能说清是从哪次实验来的。', rowIds: rows.filter((r) => r.expId.trim().toLowerCase() === k).map((r) => r.id) });
  }

  // 一个实验 ID 只改一个变量
  const filled = inheritRows(rows);
  const groups = new Map<string, Experiment[]>();
  for (const r of filled) {
    if (!r.expId.trim()) continue;
    const k = `${r.date}|${r.expId.trim().toLowerCase()}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(r);
  }
  for (const [, list] of groups) {
    if (list.length < 2) continue;
    const varying = VARIABLE_KEYS.filter((k) => new Set(list.map((r) => r[k].trim().toLowerCase())).size > 1);
    const label = (k: VariableKey) => COLUMNS.find((c) => c.key === k)!.label;
    if (varying.length > 1) {
      push({ rule: 'multi-variable', severity: 'error', title: `${list[0].expId} 同时改了 ${varying.map(label).join('、')}`, detail: '一个实验 ID = 一次扫描 = 一个变量。改了两个就没法归因：拆成两次扫描，或把另一个固定回基线。', rowIds: list.map((r) => r.id) });
    } else if (varying.length === 0) {
      push({ rule: 'no-variable', severity: 'info', title: `${list[0].expId} 的几行参数完全一样`, detail: '同一 ID 下的几行应该只差一个变量；参数全同就只是重复出图。', rowIds: list.map((r) => r.id) });
    }
  }

  const noResult = rows.filter((r) => !r.result.trim());
  if (noResult.length) push({ rule: 'result-missing', severity: 'warn', title: `${noResult.length} 行没写结论`, detail: '失败也记——“3.5 发色丢失”是信息，否则会重复踩。', rowIds: noResult.map((r) => r.id) });
  const bare = rows.filter((r) => RESULT_BARE.test(r.result.trim()));
  if (bare.length) push({ rule: 'result-why', severity: 'warn', title: '结论只写了“好 / 坏”', detail: '结论列必须写“为什么”：线条、颜色、构图哪里变了，不然明天回看等于没记。', rowIds: bare.map((r) => r.id) });

  const dates = new Set(rows.map((r) => r.date.trim()).filter(Boolean));
  const baselineDates = new Set(log.baselines.map((b) => b.date.trim()));
  const missing = [...dates].filter((d) => !baselineDates.has(d)).sort();
  if (missing.length) push({ rule: 'baseline-missing', severity: 'info', title: `${missing.join('、')} 还没写今日基线`, detail: '每天最后一行写当前认定的最佳组合（模型 / 采样器 / cfg / steps / denoise），第二天的实验从它出发。' });

  const order: Record<Severity, number> = { error: 0, warn: 1, info: 2 };
  return out.sort((a, b) => order[a.severity] - order[b.severity]);
}

// ───────── 导入 / 导出 ─────────

function csvCell(s: string): string {
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function csvEscapeText(s: string): string {
  return s.replace(/\r?\n/g, ' ⏎ ');
}

/** CSV（带 BOM，Excel 直接开）：参数列空白处已按"继承上一行"填好，今日基线作为特殊行附在后面 */
export function toCSV(log: LabLog): string {
  const head = COLUMNS.map((c) => c.label);
  const lines = [head.map(csvCell).join(',')];
  for (const r of inheritRows(sortRows(log.experiments))) {
    lines.push(COLUMNS.map((c) => csvCell(csvEscapeText(String(r[c.key])))).join(','));
  }
  const bl = [...log.baselines].sort((a, b) => a.date.localeCompare(b.date));
  for (const b of bl) {
    const row: Record<string, string> = {
      date: b.date, expId: BASELINE_LABEL, purpose: '', model: b.model, prompt: '', seed: '', resolution: '', steps: b.steps, cfg: b.cfg,
      sampler: b.sampler, denoise: b.denoise, other: '', result: b.review, file: '',
    };
    lines.push(COLUMNS.map((c) => csvCell(csvEscapeText(row[c.key] ?? ''))).join(','));
  }
  return `\uFEFF${lines.join('\n')}\n`;
}

/** 解析 CSV（支持引号与 BOM），按表头文字找列 */
export function parseCSV(text: string): LabLog {
  const rows = parseCsvRows(text.replace(/^\uFEFF/, ''));
  if (!rows.length) return emptyLog();
  const head = rows[0].map((h) => h.trim());
  const idx = (label: string) => head.indexOf(label);
  const col = (c: Column) => idx(c.label);
  const log = emptyLog();
  const lastByExp = new Map<string, Experiment>();
  for (const cells of rows.slice(1)) {
    if (!cells.some((c) => c.trim())) continue;
    const get = (c: Column) => (cells[col(c)] ?? '').trim();
    if (get(COLUMNS[1]) === BASELINE_LABEL) {
      log.baselines.push(emptyBaseline({ date: get(COLUMNS[0]), model: get(COLUMNS[3]), steps: get(COLUMNS[7]), cfg: get(COLUMNS[8]), sampler: get(COLUMNS[9]), denoise: get(COLUMNS[10]), review: get(COLUMNS[12]) }));
      continue;
    }
    const row = emptyExperiment();
    COLUMNS.forEach((c, i) => {
      (row as unknown as Record<string, string>)[c.key] = cells[i] ?? '';
    });
    // 空白继承同实验的上一行
    const prev = lastByExp.get(`${row.date}|${row.expId.trim().toLowerCase()}`);
    if (prev) for (const k of VARIABLE_KEYS) if (!(row[k] ?? '').trim()) row[k] = prev[k];
    lastByExp.set(`${row.date}|${row.expId.trim().toLowerCase()}`, row);
    log.experiments.push(row);
  }
  return log;
}

function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else q = false;
      } else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

function mdCell(s: string): string {
  return s.replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>');
}

/** Markdown：与模板页同一张表；同实验内与上一行相同的值留空，今日基线单独一张表 */
export function toMarkdown(log: LabLog): string {
  const lines: string[] = [];
  lines.push(`| ${COLUMNS.map((c) => c.label).join(' | ')} |`);
  lines.push(`|${COLUMNS.map(() => '---').join('|')}|`);
  const sorted = sortRows(log.experiments);
  let prev: Experiment | null = null;
  for (const r of sorted) {
    const p = prev;
    const same = p !== null && p.date === r.date && p.expId.trim().toLowerCase() === r.expId.trim().toLowerCase();
    const hideKeys: Array<string> = ['date', 'expId', 'purpose', ...VARIABLE_KEYS];
    const cells = COLUMNS.map((c) => {
      const v = String(r[c.key]).trim();
      if (same && hideKeys.includes(c.key) && v === String(p[c.key]).trim()) return '';
      return mdCell(v);
    });
    lines.push(`| ${cells.join(' | ')} |`);
    prev = r;
  }
  if (!sorted.length) lines.splice(0, 0, '（还没有记录）', '');
  const bl = [...log.baselines].sort((a, b) => a.date.localeCompare(b.date));
  if (bl.length) {
    lines.push('', '## 今日基线', '', `| 日期 | ${BASELINE_FIELDS.map((f) => f.label).join(' | ')} |`, `|---|${BASELINE_FIELDS.map(() => '---').join('|')}|`);
    for (const b of bl) lines.push(`| ${b.date} | ${BASELINE_FIELDS.map((f) => mdCell(String(b[f.key]).trim())).join(' | ')} |`);
  }
  return `${lines.join('\n')}\n`;
}

export function toJSON(log: LabLog): string {
  return JSON.stringify(log, null, 2);
}

/** 解析本工具导出的 JSON；形状不对返回 null */
export function parseJSON(text: string): LabLog | null {
  try {
    const v = JSON.parse(text) as unknown;
    if (!v || typeof v !== 'object') return null;
    const exp = Array.isArray((v as LabLog).experiments) ? (v as LabLog).experiments : [];
    const bl = Array.isArray((v as LabLog).baselines) ? (v as LabLog).baselines : [];
    const str = (x: unknown) => (typeof x === 'string' ? x : '');
    const rec = (o: unknown) => (o && typeof o === 'object' ? (o as Record<string, unknown>) : {});
    return {
      experiments: exp.map((e) =>
        emptyExperiment(Object.fromEntries(COLUMNS.map((c) => [c.key, str(rec(e)[c.key])])) as Partial<Experiment>),
      ),
      baselines: bl.map((b) =>
        emptyBaseline({
          date: str(rec(b).date),
          ...(Object.fromEntries(BASELINE_FIELDS.map((f) => [f.key, str(rec(b)[f.key])])) as Partial<Baseline>),
        }),
      ),
    };
  } catch {
    return null;
  }
}
