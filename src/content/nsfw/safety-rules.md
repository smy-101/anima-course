---
title: 安全等级与核心规则
section: 规则
order: 1
sources:
  - badge: 官方
    url: https://huggingface.co/circlestone-labs/Anima
    note: "模型卡：appropriate safety tags；Limitations 原文"
  - badge: Danbooru
    url: https://danbooru.donmai.us/wiki_pages/howto:rate
    note: 分级定义
  - badge: 社区
    url: https://civitai.com/articles/33857
    note: Volnovik 简明版描述
verified: 2026-11-24
---

## 四级标签 ↔ Danbooru 分级对照

模型卡只列了四个词没解释。Danbooru `howto:rate` 给出了官方分级定义，对应关系如下（推断）：

| Anima 标签 | Danbooru 分级 | 含义（据 Danbooru 官方定义） | 典型画面 |
|---|---|---|---|
| `safe` | **General** | G 级，完全适合工作场合。无任何性化内容；只有卡通级暴力 | 穿着完整、日常场景、风景、Q 版、普通拥抱牵手、抽烟喝酒 |
| `sensitive` | **Sensitive** | Ecchi / 性感 / 暗示。暴露或紧身衣物、泳装、内衣、聚焦胸/臀/脚/腋下/肚脐、走光、透视装、轻度暴力 | 比基尼、高叉紧身衣、内衣、乳沟、裙底走光、湿身透出内衣 |
| `nsfw` | **Questionable** | 软核色情 / 暴力。**简单裸露，但无性行为、无外露生殖器**；近似全裸、极端露出的衣物、轻度性接触、暗示的性行为、捆绑 / 调教等癖好（无可见性行为） | 裸体但双腿并拢、胸贴、`covered nipples`、`presenting own body`、捆绑 |
| `explicit` | **Explicit** | 硬核色情 / 极端血腥。**外露生殖器（无论是否打码）、明示性行为、体液**、guro、scat | 任何插入 / 口交 / 射精 / 露出性器官 |

> 关于 `nsfw`：在 Danbooru 上 `nsfw` 作为标签**已被弃用**（它等价于 `rating:q OR rating:e`）。Anima 把它当作独立的第三级；**推断**它对应 Questionable 档（官方未明说）。
> Volnovik 的简明版：`safe` = 工作场合安全；`sensitive` = 轻度暗示或非色情裸露；`nsfw` = **强烈性暗示但不露器官**；`explicit` = 完全露出的色情、露出生殖器、极端血腥【社区】。

## 选择规则

| 规则 | 说明 | 来源 |
|---|---|---|
| **只写一个等级** | 四个等级是"类别"不是"阶梯"。按画面里**最露骨的那个元素**选 | 社区（符合官方"appropriate safety tags"） |
| **绝不混用** | `safe` + 露骨内容 = 自相矛盾 → 出图发软 / 自动打码 / 器官画不出来 | 社区 |
| **不要高配也不要低配** | 露器官画面用 `nsfw` 同样偏软；只有暗示的画面用 `explicit` 会把它推得更露骨 | 社区 |
| **无法判断就不写等级** | 比如纯风景、抽象图 | 社区 |
| **不想要的等级放负向** | 官方："通过正向和负向中使用合适的安全标签来避免不想要的内容" | 官方 |
| **短提示词 = 危险** | 官方 Limitations 原文："模型可能生成不想要的内容，**尤其是提示词短或缺乏细节时**。用安全标签 + 写足够细的提示词来避免" | 官方 |

**SFW 用户的推荐写法**：正向开头 `masterpiece, best quality, score_7, safe,`；负向在标准基础上加 `nsfw, explicit`（必要时加 `sensitive`）。

**NSFW 用户的推荐写法**：正向按内容选 `sensitive` / `nsfw` / `explicit` 之一；负向放 `censored`（以及 `bar censor`、`mosaic censoring`），再放你不想要的**其它**等级（如做 `sensitive` 内容可在负向放 `explicit, nsfw` 防止越级）。

## 打码相关标签

| 标签 | 含义（Danbooru 官方） | 放哪 | 说明 |
|---|---|---|---|
| `censored` | 画面敏感部位被遮挡（通常为符合日本法律）：马赛克、黑条、模糊、白光、遮挡物等 | **负向** | 正向写了就会出打码。**永远不要放正向** |
| `bar censor` | 黑条打码 | 负向 | `censored` 的子标签，可单列加强 |
| `mosaic censoring` | 马赛克打码 | 负向 | 同上 |
| `blur censor` / `light censor` / `pixel censor` | 模糊 / 白光 / 像素打码 | 负向 | 同上 |
| `convenient censoring` | 用画面内物体（头发、手脚、前景物）"恰好"遮住 | 按需 | 想要这种含蓄效果时正向用 |
| `uncensored` | 画师**没有**打码的图。只针对生殖器、性行为、体液；不针对乳头 | **有争议** | 见下 |
| `decensored` | 第三方去码的图 | 不用 | — |

**`uncensored` 该不该放正向？**

| 立场 | 来源 | 理由 |
|---|---|---|
| **不放** | Volnovik | "想要无码就把 `censored` 放负向；**永远不要在正向写 `uncensored`**"。推测原因：0.6B 语言模型会把 `uncensored` 里的子串 `censored` 激活，反而诱发打码 |
| **可以放** | dskjal | 多个 explicit 示例正向写了 `uncensored`，并配合负向 `censored, bar censor` |

**结论**：主做法是**负向 `censored`**。`uncensored` 正向是否加分取决于版本 / 种子，用固定种子 A/B 测一下再决定。

## "画面发软 / 自动打码"排错

| 现象 | 原因 | 处理 |
|---|---|---|
| 敏感部位被头发 / 前景物 / 白光遮住 | 正向等级是 `safe` / `sensitive`，或没写等级 | 改成 `explicit` |
| 出现黑条 / 马赛克 | 正向误写了 `censored`，或负向没放 `censored` | 检查正向；负向加 `censored, bar censor, mosaic censoring` |
| 画面整体发糊、像隔了一层 | 等级与内容不匹配（自相冲突） | 只保留匹配的那一个等级 |
| 乳头发虚 | 误用了 `covered nipples`，或等级 `nsfw` 不够 | 删 `covered nipples`；改 `explicit` |
| 出现多余人物（"双胞胎"） | 单人提示词里描述了双侧对称特征 | 负向加 `twins`（Volnovik 推荐负向自带）【社区】 |

## 陷阱标签（NSFW 相关重点）

| 词 | 在 Anima 里实际效果 | 常见误写 | 应该这样写 |
|---|---|---|---|
| `censored` | **打码条** | 在正向随手写 "keep it tasteful/censored" | **永远不放正向**；用安全等级标签；放负向去码 |
| `covered nipples` / `covered navel` | 遮住乳头 / 肚脐 | 不小心混入 | 要露就删掉；要含蓄就故意用 |
| `uncensored` | 无码（见上，有争议） | — | 主做法是负向 `censored` |
| `face-to-face` | 会对齐两人头部位置 → 一方被"幼化" | 多人场景 | 用 `eye contact` 或自然语言写位置 |

其余陷阱（`wet`、`lace`、`cosplay`、`1other`、`high contrast`、`lineart`、`monochrome` 等）见[标签字典](/tags/)。

## 收录范围

- 词表收到 `nsfw` 级别为止：[表情、身体与衣物状态](/nsfw/vocab-body-clothing/)、[展示、暗示与事后](/nsfw/vocab-framing/)
- 负向：[成人内容的负向提示词](/nsfw/negative/)
- 模板：[sensitive～nsfw 级模板与露骨模板的写法要点](/nsfw/templates/)
- 性行为、体液、群交、癖好与极端标签不进站。
