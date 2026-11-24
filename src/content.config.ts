import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';

/**
 * 来源徽章：沿用笔记的来源可信度分级。
 * 官方 = 模型卡 / 官方模板 / 官方文档；源码 = ComfyUI 代码；作者 = 模型作者在讨论区的说明；
 * 平台 = Civitai / mage.space 等平台文档；社区 = 第三方实测；Danbooru = 标签 wiki 释义。
 */
export const badges = ['官方', '源码', '作者', '平台', '社区', 'Danbooru'] as const;
export type Badge = (typeof badges)[number];

export const LEVELS = ['L0', 'L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7', 'L8'] as const;
export const TAG_CATEGORIES = ['质量', '年代', '元数据', '安全', '人数', '角色', '构图', '外观', '服饰', '动作', '背景', '其它'] as const;
export const AREAS = ['提示词', '参数', '工作流', '放大', '重绘', '环境'] as const;
export const NSFW_SECTIONS = ['规则', '词表', '负向', '陷阱', '模板', '合规'] as const;
export const RESOURCE_KINDS = ['模型文件', '工具', '链接', '模板', '误区', '基线'] as const;

const source = z.object({
  badge: z.enum(badges),
  url: z.url().optional(),
  note: z.string().optional(),
});

/** 所有集合共有：来源与核实日期 */
const common = {
  sources: z.array(source).default([]),
  verified: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '核实日期必须是 YYYY-MM-DD'),
};

const lessons = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/lessons' }),
  schema: ({ image }) =>
    z.object({
      ...common,
      title: z.string(),
      stage: z.number().int().min(0).max(5),
      order: z.number(),
      summary: z.string().default(''),
      /** 对应《递进报告》的工作流阶梯 */
      levels: z.array(z.enum(LEVELS)).default([]),
      /** 对应 14 天路径 */
      days: z.array(z.number().int().min(1).max(14)).default([]),
      /** 本课是否含"今天的提示词练习" */
      promptTrack: z.boolean().default(false),
      /** 前置课程 id */
      prerequisites: z.array(z.string()).default([]),
      /** 涉及的节点类名（→ nodes 集合） */
      nodes: z.array(z.string()).default([]),
      /** 涉及的标签 slug（→ tags 集合） */
      tags: z.array(z.string()).default([]),
      /** 产出 */
      deliverable: z.string().default(''),
      /** 验收清单（可勾选） */
      acceptance: z.array(z.string()).default([]),
      /** 对照图。省略 src = 待补图，渲染占位块并进入构建清单 */
      figures: z
        .array(
          z.object({
            id: z.string(),
            src: image().optional(),
            caption: z.string(),
            /** 对照组名，如 cfg-sweep；同组并排显示 */
            group: z.string().optional(),
          }),
        )
        .default([]),
      /** 是否显示"概念可迁移"提示 */
      transfers: z.boolean().default(false),
    }),
});

const ioField = z.object({
  name: z.string(),
  type: z.string(),
  required: z.boolean().default(true),
  desc: z.string().default(''),
});

const paramField = z.object({
  name: z.string(),
  type: z.string().default(''),
  default: z.string().optional(),
  range: z.string().optional(),
  desc: z.string().default(''),
});

/** 节点卡：文件名 = 英文类名 */
const nodes = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/nodes' }),
  schema: z.object({
    ...common,
    name_zh: z.string(),
    category: z.string(),
    /** 首次出现的级别；节点 × 级别矩阵由此自动生成 */
    first_level: z.enum(LEVELS),
    experimental: z.boolean().default(false),
    inputs: z.array(ioField).default([]),
    outputs: z.array(z.object({ name: z.string(), type: z.string(), desc: z.string().default('') })).default([]),
    params: z.array(paramField).default([]),
  }),
});

/** 标签卡：文件名 = slug（空格换连字符） */
const tags = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/tags' }),
  schema: z.object({
    ...common,
    tag: z.string(),
    meaning: z.string(),
    category: z.enum(TAG_CATEGORIES),
    polarity: z.enum(['正', '负', '皆可']),
    /** 陷阱标签：看起来是普通英文词，实际会定义整张图 */
    trap: z.boolean().default(false),
    versions: z.object({ base: z.string(), aesthetic: z.string(), turbo: z.string() }).partial().optional(),
    wiki: z.url().optional(),
  }),
});

/** 排错条目：现象 → 先调 → 再调 → 不要 */
const troubleshooting = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/troubleshooting' }),
  schema: z.object({
    ...common,
    symptom: z.string(),
    area: z.enum(AREAS),
    first: z.string(),
    then: z.string().default(''),
    dont: z.string().default(''),
  }),
});

/** 成人附录。只在 NSFW=true 时生成；noindex、不进搜索索引 */
const nsfw = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/nsfw' }),
  schema: z.object({
    ...common,
    title: z.string(),
    section: z.enum(NSFW_SECTIONS),
    order: z.number(),
  }),
});

/** 资源：模型清单、工具链接、提示词模板、误区、参数基线 */
const resources = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/resources' }),
  schema: z.object({
    ...common,
    title: z.string(),
    kind: z.enum(RESOURCE_KINDS),
    order: z.number().default(0),
  }),
});

export const collections = { lessons, nodes, tags, troubleshooting, nsfw, resources };
