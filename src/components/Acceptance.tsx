import { useEffect, useRef, useState } from 'react';

const KEY = 'anima:acceptance';
const NSFW_KEY = 'anima:nsfw-ok';

type Store = Record<string, boolean[]>;

function load(): Store {
  if (typeof localStorage === 'undefined') return {};
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    return v && typeof v === 'object' ? (v as Store) : {};
  } catch {
    return {};
  }
}

function save(s: Store) {
  localStorage.setItem(KEY, JSON.stringify(s));
}

interface Props {
  lessonId: string;
  items: string[];
}

/** 验收清单：勾选写入 localStorage（anima:acceptance），可导出 / 导入 JSON。 */
export default function Acceptance({ lessonId, items }: Props) {
  const [state, setState] = useState<boolean[]>(() => items.map(() => false));
  const [hydrated, setHydrated] = useState(false);
  const [status, setStatus] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // 挂载后读进度
  useEffect(() => {
    const saved = load()[lessonId] ?? [];
    setState(items.map((_, i) => Boolean(saved[i])));
    setHydrated(true);
  }, [lessonId, items]);

  // 读到进度之后才写回，避免用初始空值覆盖
  useEffect(() => {
    if (!hydrated) return;
    const all = load();
    all[lessonId] = state;
    save(all);
    window.dispatchEvent(new CustomEvent('anima:progress'));
  }, [state, hydrated, lessonId]);

  const done = state.filter(Boolean).length;
  const toggle = (i: number) => setState((s) => s.map((v, j) => (j === i ? !v : v)));
  const reset = () => setState(items.map(() => false));

  const exportAll = () => {
    const blob = new Blob([JSON.stringify(load(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'anima-progress.json';
    a.click();
    URL.revokeObjectURL(a.href);
    setStatus('已导出全部课程的进度');
  };

  const importAll = async (file: File | undefined) => {
    if (!file) return;
    try {
      const next = { ...load(), ...(JSON.parse(await file.text()) as Store) };
      save(next);
      const saved = next[lessonId] ?? [];
      setState(items.map((_, i) => Boolean(saved[i])));
      setStatus('已导入进度');
    } catch {
      setStatus('导入失败：文件不是有效的进度 JSON');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const resetNsfw = () => {
    localStorage.removeItem(NSFW_KEY);
    setStatus('已重置成人附录的确认状态');
  };

  return (
    <section className="acceptance" aria-labelledby="acceptance-h">
      <h2 id="acceptance-h">验收</h2>
      <p className="progress">
        {done} / {items.length} 已完成{done === items.length && items.length > 0 ? ' — 本课验收通过。' : ''}
      </p>
      <ul>
        {items.map((text, i) => (
          <li key={i} className={state[i] ? 'done' : ''} onClick={() => toggle(i)}>
            <input
              type="checkbox"
              checked={state[i]}
              onChange={() => toggle(i)}
              onClick={(e) => e.stopPropagation()}
              aria-label={text}
            />
            <span>{text}</span>
          </li>
        ))}
      </ul>
      <div className="actions">
        <button type="button" onClick={reset}>重置本课</button>
        <button type="button" onClick={exportAll}>导出全部进度</button>
        <button type="button" onClick={() => fileRef.current?.click()}>导入进度</button>
        <button type="button" onClick={resetNsfw}>重置成人附录确认</button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          style={{ display: 'none' }}
          onChange={(e) => importAll(e.target.files?.[0])}
        />
        {status && <span aria-live="polite">{status}</span>}
      </div>
    </section>
  );
}
