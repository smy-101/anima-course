/** 带 base 的站内路径。传入以 / 开头（或不含 /）的路径，如 url('nodes/KSampler/') */
const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
export const url = (path: string) => `${BASE}/${path.replace(/^\//, '')}`;

/** 站内路径 → 绝对 URL（给 sitemap、og 标签用） */
export const absUrl = (path: string) => new URL(url(path), import.meta.env.SITE).href;

/**
 * 把 frontmatter 字符串字段里的站内 Markdown 链接 `[文字](/path/)` 转成 <a>（自动加 base），
 * 其余文字先做 HTML 转义再原样输出。给排错条目的 first / then / dont 这类不经 Markdown 渲染的字段用。
 */
export const inlineLinks = (s: string): string =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\[([^\]]+)\]\((\/[^)\s]+)\)/g, (_m, text: string, path: string) => `<a href="${url(path)}">${text}</a>`);

/** NSFW 附录构建开关：NSFW=false 时 /nsfw/* 不生成、导航不出现。见 astro.config.mjs */
export const NSFW_ENABLED = (process.env.NSFW ?? 'true').toLowerCase() !== 'false';
