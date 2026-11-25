/**
 * Sätteri（Astro 7 默认 Markdown 处理器）的 hast 插件：
 * 给 Markdown 正文里的 <table> 包一层 <div class="table-wrap">。
 * 模板里手写的表格本来就有这层容器（窄屏横向滚动）；Markdown 渲染出来的没有，
 * 宽表会把整页撑出横向滚动（375px 下实测 scrollWidth 576 > 视口）。
 *
 * 用法：markdown.processor = satteri({ hastPlugins: [satteriBaseLinks(), satteriTableWrap()] })
 */
export function satteriTableWrap() {
  return {
    name: 'satteri-table-wrap',
    element: {
      filter: ['table'],
      visit(node, ctx) {
        ctx.wrapNode(node, {
          type: 'element',
          tagName: 'div',
          properties: { className: ['table-wrap'] },
          children: [],
        });
      },
    },
  };
}
