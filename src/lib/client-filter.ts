/**
 * 列表页的即时筛选（标签字典、节点字典、排错速查共用）。
 *
 * 条目上写 data-xxx-search="可搜索文本"，分组容器上写 data-xxx-group。
 * 输入时做子串匹配：隐藏不匹配的条目，整组都不匹配时隐藏分组，更新"可见 / 总数"计数，
 * 一个都不剩时显示空状态（带"清除筛选"按钮），不留一片空白。
 *
 * 在 .astro 的 <script> 里调用：setupFilter({ input: 'tag-filter', attr: 'tagSearch', item: '[data-tag-search]', group: '[data-tag-group]', noun: '个标签' })
 */
export interface FilterOptions {
  /** 搜索框的 id */
  input: string;
  /** 条目上保存搜索文本的 dataset 键，如 tagSearch → data-tag-search */
  attr: string;
  /** 条目选择器 */
  item: string;
  /** 分组选择器（可选；没有分组就不传） */
  group?: string;
  /** 计数里的量词短语，如"个标签" */
  noun: string;
  /** 计数元素的 id（可选） */
  count?: string;
  /** 空状态元素的 id（可选）；其中可放 [data-filter-query] 回显关键词、button 清除 */
  empty?: string;
}

export function setupFilter(opts: FilterOptions): void {
  const input = document.getElementById(opts.input);
  if (!(input instanceof HTMLInputElement)) return;

  const items = Array.from(document.querySelectorAll<HTMLElement>(opts.item));
  const groups = opts.group ? Array.from(document.querySelectorAll<HTMLElement>(opts.group)) : [];
  const count = opts.count ? document.getElementById(opts.count) : null;
  const empty = opts.empty ? document.getElementById(opts.empty) : null;

  // 同一个条目可能在页面上出现多次（如陷阱标签单独成区）：计数按它链到的页面去重
  const keyOf = (el: HTMLElement) => el.closest('a')?.getAttribute('href') ?? '';
  const unique = (els: HTMLElement[]) => new Set(els.map(keyOf)).size;
  const total = unique(items);

  const filter = () => {
    const raw = input.value.trim();
    const q = raw.toLowerCase();
    const shown: HTMLElement[] = [];
    for (const el of items) {
      const hit = !q || (el.dataset[opts.attr] ?? '').toLowerCase().includes(q);
      el.hidden = !hit;
      if (hit) shown.push(el);
    }
    for (const g of groups) g.hidden = !g.querySelector(`${opts.item}:not([hidden])`);
    if (count) count.textContent = `${unique(shown)} / ${total} ${opts.noun}`;
    if (empty) {
      empty.hidden = shown.length > 0;
      const echo = empty.querySelector('[data-filter-query]');
      if (echo) echo.textContent = raw;
    }
  };

  input.addEventListener('input', filter);
  empty?.querySelector('button')?.addEventListener('click', () => {
    input.value = '';
    filter();
    input.focus();
  });
  filter();
}
