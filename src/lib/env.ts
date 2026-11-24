/** 带 base 的站内路径。传入以 / 开头（或不含 /）的路径，如 url('nodes/KSampler/') */
const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
export const url = (path: string) => `${BASE}/${path.replace(/^\//, '')}`;

/** 站内路径 → 绝对 URL（给 sitemap、og 标签用） */
export const absUrl = (path: string) => new URL(url(path), import.meta.env.SITE).href;

/** NSFW 附录构建开关：NSFW=false 时 /nsfw/* 不生成、导航不出现。见 astro.config.mjs */
export const NSFW_ENABLED = (process.env.NSFW ?? 'true').toLowerCase() !== 'false';
