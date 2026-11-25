import { useEffect, useMemo, useState } from 'react';
import { autoFix, lintPrompt, type Field, type Finding, type LintResult, type Mark, type Severity, type TrapInfo, type Version } from '../lib/prompt-lint';

const KEY = 'anima:lint';

interface Saved {
  positive: string;
  negative: string;
  version: Version;
}

interface Props {
  /** 站点 base，如 /anima-course（无尾斜杠） */
  basePath: string;
  traps: TrapInfo[];
  tags: string[];
}

const SEV_LABEL: Record<Severity, string> = { error: '错误', warn: '提醒', info: '提示' };
const RANK: Record<Severity, number> = { error: 0, warn: 1, info: 2 };
const VERSION_LABEL: Record<Version, string> = { base: 'Base', aesthetic: 'Aesthetic', turbo: 'Turbo' };

const EXAMPLE: Saved = {
  version: 'base',
  positive:
    'masterpiece,best quality,score_7, 1girl, Long Hair, blue eyes, school uniform, in the style of huke, wet, standing, looking at viewer,,',
  negative: 'worst quality, low quality, score_1,score_2, monochrome, blurry',
};

function load(): Partial<Saved> {
  if (typeof localStorage === 'undefined') return {};
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    return v && typeof v === 'object' ? (v as Saved) : {};
  } catch {
    return {};
  }
}

interface Seg {
  start: number;
  end: number;
  sev?: Severity;
  rules: string[];
}

/** 把标记合并成不重叠的区段（重叠处取最高级别） */
function segments(text: string, marks: Mark[]): Seg[] {
  const out: Seg[] = [];
  let pos = 0;
  let last: Seg | null = null;
  for (const m of [...marks].sort((a, b) => a.start - b.start)) {
    if (m.start > pos) {
      out.push({ start: pos, end: m.start, rules: [] });
      last = null;
    }
    if (last && m.start < last.end) {
      last.end = Math.max(last.end, m.end);
      if (!last.sev || RANK[m.severity] < RANK[last.sev]) last.sev = m.severity;
      last.rules.push(m.rule);
    } else {
      last = { start: m.start, end: m.end, sev: m.severity, rules: [m.rule] };
      out.push(last);
    }
    pos = Math.max(pos, m.end);
  }
  if (pos < text.length) out.push({ start: pos, end: text.length, rules: [] });
  return out;
}

/** detail 里的 `code` 渲染成 <code> */
function prose(text: string) {
  return text.split(/(`[^`]+`)/).map((part, i) => (i % 2 === 1 ? <code key={i}>{part.slice(1, -1)}</code> : <span key={i}>{part}</span>));
}

async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** 提示词检查器：正负向 + 版本 → 问题列表、高亮、一键修正。纯前端。 */
export default function PromptLint({ basePath, traps, tags }: Props) {
  const [positive, setPositive] = useState('');
  const [negative, setNegative] = useState('');
  const [version, setVersion] = useState<Version>('base');
  const [hydrated, setHydrated] = useState(false);
  const [flash, setFlash] = useState('');

  useEffect(() => {
    const s = load();
    if (typeof s.positive === 'string') setPositive(s.positive);
    if (typeof s.negative === 'string') setNegative(s.negative);
    if (s.version) setVersion(s.version);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(KEY, JSON.stringify({ positive, negative, version }));
    } catch {
      /* 存不下就算了 */
    }
  }, [positive, negative, version, hydrated]);

  const result: LintResult = useMemo(() => lintPrompt(positive, negative, { version, traps, tags }), [positive, negative, version, traps, tags]);
  const fixCtx = useMemo(() => ({ tags: new Set(tags.map((t) => t.toLowerCase())) }), [tags]);
  const titles = useMemo(() => {
    const m = new Map<string, string>();
    for (const f of result.findings) if (!m.has(f.rule)) m.set(f.rule, f.title);
    return m;
  }, [result.findings]);

  const text = (f: Field) => (f === 'positive' ? positive : negative);
  const setText = (f: Field, v: string) => (f === 'positive' ? setPositive(v) : setNegative(v));

  const fixable = result.findings.filter((f) => f.fixable);
  const fixAll = () => {
    setPositive((p) => autoFix(p, undefined, fixCtx));
    setNegative((n) => autoFix(n, undefined, fixCtx));
    setFlash(`已修正 ${fixable.length} 类可自动修正的问题；剩下的要你自己判断`);
  };
  const fixOne = (f: Finding) => {
    setText(f.field, autoFix(text(f.field), [f.rule], fixCtx));
    setFlash(`已修正「${f.title}」`);
  };
  const fixableRules = new Set(fixable.map((f) => f.rule));

  const grouped: Array<[Field, Finding[]]> = (['positive', 'negative'] as Field[])
    .map((f) => [f, result.findings.filter((x) => x.field === f)] as [Field, Finding[]])
    .filter(([, list]) => list.length > 0);

  return (
    <div className="lint" data-flash={flash}>
      <div className="lint-toolbar">
        <label>
          版本{' '}
          <select value={version} onChange={(e) => setVersion(e.target.value as Version)}>
            {(Object.keys(VERSION_LABEL) as Version[]).map((v) => (
              <option key={v} value={v}>
                {VERSION_LABEL[v]}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="primary" onClick={fixAll} disabled={fixable.length === 0}>
          一键修正（{fixable.length} 类）
        </button>
        <button type="button" onClick={() => { setPositive(EXAMPLE.positive); setNegative(EXAMPLE.negative); setVersion(EXAMPLE.version); }}>
          载入示例
        </button>
        <button type="button" onClick={() => { setPositive(''); setNegative(''); }}>
          清空
        </button>
        <span className="muted" aria-live="polite">{flash}</span>
      </div>

      <div className="lint-cols">
        {(['positive', 'negative'] as Field[]).map((f) => {
          const t = text(f);
          const segs = t ? segments(t, result.marks[f]) : [];
          return (
            <div key={f}>
              <label className="lint-label">
                <strong>{f === 'positive' ? '正向提示词' : '负向提示词'}</strong>
                <textarea
                  value={t}
                  spellCheck={false}
                  placeholder={f === 'positive' ? 'masterpiece, best quality, score_7, safe, 1girl, …' : 'worst quality, low quality, …'}
                  onChange={(e) => setText(f, e.target.value)}
                />
              </label>
              {t && (
                <pre className="lint-view" aria-label="高亮预览">
                  {segs.map((s, i) =>
                    s.sev ? (
                      <mark key={i} className={`lint-mark lint-${s.sev}`} title={s.rules.map((r) => titles.get(r) ?? r).join('；')}>
                        {t.slice(s.start, s.end)}
                      </mark>
                    ) : (
                      <span key={i}>{t.slice(s.start, s.end)}</span>
                    ),
                  )}
                </pre>
              )}
            </div>
          );
        })}
      </div>

      <div className="lint-summary" role="status">
        <span className="lint-count lint-error-pill">错误 <b>{result.counts.error}</b></span>
        <span className="lint-count lint-warn-pill">提醒 <b>{result.counts.warn}</b></span>
        <span className="lint-count lint-info-pill">提示 <b>{result.counts.info}</b></span>
        <span className="muted">
          {result.counts.error + result.counts.warn + result.counts.info === 0
            ? positive.trim()
              ? '没有发现问题。'
              : '把提示词贴上来。'
            : ''}
          {positive.trim() && ` 正向 ${result.stats.items} 条，其中 ${result.stats.knownTags} 条是字典里的标签`}
        </span>
      </div>

      <div className="lint-toolbar">
        <button type="button" onClick={() => copy(positive).then((ok) => setFlash(ok ? '正向已复制' : '复制失败'))}>复制正向</button>
        <button type="button" onClick={() => copy(negative).then((ok) => setFlash(ok ? '负向已复制' : '复制失败'))}>复制负向</button>
      </div>

      {grouped.map(([field, list]) => (
        <section key={field}>
          <h2 className="lint-h">{field === 'positive' ? '正向' : '负向'}</h2>
          <ol className="lint-findings">
            {list.map((f, i) => (
              <li key={`${f.rule}-${i}`} className={`lint-finding ${f.severity}`}>
                <div className="head">
                  <span className={`pill lint-pill-${f.severity}`}>{SEV_LABEL[f.severity]}</span>
                  <b>{f.title}</b>
                  {f.fixable && <span className="muted">可自动修正</span>}
                </div>
                <p>{prose(f.detail)}</p>
                {f.snippets.length > 0 && (
                  <div className="snips">
                    {f.snippets.slice(0, 12).map((s, j) => (
                      <span key={j} className="snip">
                        {s}
                      </span>
                    ))}
                  </div>
                )}
                <div className="actions">
                  {f.href && (
                    <a href={`${basePath}${f.href}`} target="_blank" rel="noopener">
                      原理 ↗
                    </a>
                  )}
                  {f.fixable && (
                    <button type="button" onClick={() => fixOne(f)} disabled={!fixableRules.has(f.rule)}>
                      修正此项
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
