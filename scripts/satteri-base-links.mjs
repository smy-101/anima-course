/**
 * Sätteri（Astro 7 默认 Markdown 处理器）的 hast 插件：
 * 给 Markdown / MDX 正文里的站内绝对路径（/lessons/...、/nodes/...）加上 base 前缀。
 * Astro 不会自动给 Markdown 正文里的链接加 base；.astro 模板里请用 src/lib/env.ts 的 url()。
 * 幂等：已经带 base 的路径不会重复加。
 *
 * Sätteri 的节点是只读视图，就地改 properties 不会生效，必须返回新节点。
 * 用法：markdown.processor = satteri({ hastPlugins: [satteriBaseLinks()] })
 */
const BASE = (process.env.BASE_PATH ?? '/anima-course').replace(/\/$/, '');

function prefix(value) {
  if (typeof value !== 'string') return value;
  if (!value.startsWith('/') || value.startsWith('//')) return value;
  if (value === BASE || value.startsWith(`${BASE}/`)) return value;
  return BASE + value;
}

export function satteriBaseLinks() {
  return {
    name: 'satteri-base-links',
    element: {
      filter: ['a', 'img'],
      visit(node) {
        const props = node.properties;
        if (!props) return;
        const next = { ...props };
        let changed = false;
        for (const attr of ['href', 'src']) {
          if (attr in next) {
            const v = prefix(next[attr]);
            if (v !== next[attr]) {
              next[attr] = v;
              changed = true;
            }
          }
        }
        return changed ? { ...node, properties: next } : undefined;
      },
    },
  };
}
