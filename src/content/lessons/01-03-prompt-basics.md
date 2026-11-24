---
title: "提示词基础：Anima 怎么读你的话、三种写法、七条硬规则"
stage: 1
order: 3
summary: 先懂机制（双分词器、逗号后空格、0.6B 的"大脑"），再学三种写法与七条硬规则、四段式结构、按版本调整、陷阱标签；最后用 Tagger 把"看着像"变成"叫什么"。
levels: []
days: [1, 2, 3, 4]
promptTrack: true
prerequisites:
  - 00-01-setup
  - 01-01-l0-minimal
nodes:
  - CLIPTextEncode
tags:
  - masterpiece
  - best-quality
  - score-9
  - safe
  - sensitive
  - nsfw
  - explicit
  - newest
  - highres
  - 1girl
  - solo
  - no-humans
  - 1other
  - scenery
  - simple-background
  - artist-name
  - anime-coloring
  - lineart
  - monochrome
  - wet
  - lace
  - colorful
  - anime-screenshot
  - cosplay
  - censored
  - high-contrast
  - blurry
  - good-quality
  - normal-quality
  - recent
  - early
  - old
  - cowboy-shot
  - looking-at-viewer
  - twintails
  - blue-eyes
  - outdoors
  - backlighting
  - depth-of-field
  - pixel-art
  - 4koma
  - character-design-sheet
deliverable: 同一画面（建议"雨天电车站台的少女"）的标签版、自然语言版、混合版各一张；2–3 个喜欢的画师组合。
acceptance:
  - 能说出"权重只有一半生效"和"逗号后必须有空格"各自的原因
  - 给一条提示词，能对照七条硬规则逐条检查
  - 同一画面三种写法各出一张，能说出哪种写法更顺
  - 做过 3 个画师的对照，记下 2–3 个喜欢的组合
  - 用 Tagger 跑了一张参考图，按三步改写成 Anima 提示词并出图
  - 对照陷阱标签表检查过自己的提示词
figures:
  - id: pb-styles
    caption: "同一画面：纯标签 / 纯自然语言 / 混合（模板 A / B / C）"
    group: 三种写法
  - id: pb-artists
    caption: "同一提示词挂 3 个不同 @画师 的风格差异"
    group: 画师
  - id: pb-tagger
    caption: "Tagger 节点输出 → 筛选改写 → 成图 的三步对照"
    group: 反推标签
  - id: pb-trap
    caption: "陷阱标签对照：句子里写 line art / monochrome / wet 出的图"
    group: 陷阱标签
transfers: false
sources:
  - badge: 官方
    url: https://huggingface.co/circlestone-labs/Anima
    note: 模型卡：书写规则、推荐前缀、按版本调整
  - badge: 源码
    url: https://github.com/comfyanonymous/ComfyUI/blob/master/comfy/text_encoders/anima.py
    note: 双分词器、Qwen 路权重归 1、max_length 无截断
  - badge: 社区
    url: https://civitai.com/articles/33857
    note: "Volnovik《Anima Generation Guide – Part 4: Prompting》（非模型作者）"
  - badge: 社区
    url: https://github.com/pythongosssss/ComfyUI-WD14-Tagger
    note: WD14 Tagger 节点
  - badge: Danbooru
    url: https://danbooru.donmai.us/wiki_pages
    note: 标签释义
verified: 2026-11-24
---

## 目标

Anima 是拆分模型里少见的"真懂句子"的模型，但它的规则和 SDXL / Illustrious 不一样：下划线要换成空格、画师名要加 `@`、权重 1.2 约等于没加。这一课先讲**为什么**（机制），再讲**怎么写**（三种写法、七条硬规则、四段式），最后讲**怎么查**（Tagger 反推）。阶段 1–2 的每张图都是练习。

## 机制：Anima 怎么读你的提示词

知道原理，下面的规则就不用死记。

### 双分词器 → 权重只有一半生效

ComfyUI 的 Anima 文本编码器把同一段提示词**分别**用两个分词器处理：

```
提示词 ─┬─ Qwen3-0.6B 分词器 ─→ Qwen3-0.6B 模型编码 ─→ 权重被强制归 1.0
        └─ T5XXL 分词器     ─→ 保留 (tag:N) 的权重 ─→ 以 token id + 权重形式送入 DiT
```

- `(tag:1.2)` 这种权重**只在 T5 这一路生效**，Qwen 路完全无视。所以 SDXL 时代 1.2～1.3 的"轻微加强"在 Anima 上约等于没加。
- 模型卡给的例子是 `(chibi:2)`；社区经验 1.5 起步、**2.0 是甜点**。
- 权重只用于"某个元素死活不出"的排错，不要预防性堆。

### 逗号后必须有空格——这是分词问题

| 写法 | Qwen3 分词结果 |
|---|---|
| `masterpiece, best quality` | `['master', 'piece', ',', ' best', ' quality']` ✔ |
| `masterpiece,best quality` | `['master', 'piece', ',b', 'est', ' quality']` ✘ 出现了 `,b` 这种怪 token |

逗号 + 空格是训练数据里标签的标准分隔形式，**"标签 + 逗号 + 空格"这个组合本身就在告诉模型"这是一个独立标签"**。这也是"标签传染"的根源：逗号隔开的标签影响力更强、更容易扩散到全图。

### 它是真·语言模型，但只有 0.6B

- 真懂句子：位置、动作、互动、画面内文字都能写。
- 但"小而直"：代词经常指错对象；Markdown 不认识（`#` 会被画出来）；两层嵌套基本失败。
- 口诀：**像给一个只会看图说话的人写图注**——简单词、简单句、一个分句一个看得见的事实、每个细节和角色名写在同一句里。

### 没有硬上限，只有"注意力预算"

两路分词器都设了 `max_length=99999999`——**提示词不会被截断**。"写长了不听话"是 token 变多后每个 token 分到的注意力被稀释。实践结论：标签版 15～30 个、自然语言 2～5 句，要加东西先删东西。

## 三种写法

| 写法 | 优点 | 缺点 | 适合 |
|---|---|---|---|
| **纯标签** | 精确、可查 wiki、发型 / 姿势 / 表情覆盖极深 | 没有方位词（"在左边"）、数据集偏见会漏进来 | 单人、明确属性 |
| **纯自然语言** | 能写位置关系、互动、场景逻辑 | 没有标准写法可查，难排错 | 场景、多人物互动、带文字的画面 |
| **混合（推荐）** | 兼得两者 | — | 大多数情况 |

Volnovik 指南把混合写法叫 **"boorified language"**：用句子搭骨架，在 booru 有精确标签的地方嵌标签。分工原则：**外观属性交给标签，空间位置与互动关系交给句子**。

三个现成模板见[提示词模板](/resources/prompt-templates/)（A 单人标签版、B 自然语言版、C 混合版、D 带画师）。

## 七条硬规则

| # | 规则 | 含义 / 原理 | 来源 |
|---|---|---|---|
| 1 | 标签**全小写、空格代替下划线**：`long hair` ✔ `long_hair` ✘ | 训练标签就是这样写的 | 官方 |
| 2 | **唯一例外是 `score_9`…`score_1`**，保留下划线 | 来自 Pony V7 美学评分模型 | 官方 |
| 3 | Danbooru 与 Gelbooru 拼写不同时**用 Gelbooru** | 主数据集是 Gelbooru | 官方 |
| 4 | 画师名**必须加 `@`**：`@nnn yryr` | 不加 `@` 效果"非常弱" | 官方 |
| 5 | 角色名、作品名**按正常英文大小写**：`Fern from Sousou no Frieren` | 0.6B 语言模型对大小写敏感 | 官方 |
| 6 | 权重 1.5 起、2.0 甜点 | 双分词器，只有 T5 路认权重 | 官方 + 源码 |
| 7 | 逗号后**单个空格**，不要拼错 | 分词器不做模糊匹配 | 社区 |

补充：

- **带括号的标签要转义括号**：`card \(medium\)`、`amatsukaze \(kancolle\)`。不转义的括号会被当成权重语法。
- **不要用 Markdown / JSON 包裹**。`# girl` 这类标题"能用"，但 `#` 偶尔会被画进图里；用空行分段更安全。
- **不要写看不见的东西**（嘴里的棒棒糖什么颜色、面罩后面的眼睛、衣服下面的结构）——你写了它就会画出来。
- 社区还发现 `"best quality"` 和 `" best quality"`（逗号后有无空格）会带来不同的风格倾向——**保持格式一致**，别混用。

## 四段式结构

```
[质量 / 元数据 / 年代 / 安全] → [人数 1girl/1boy/1other] → [角色] → [作品] → [@画师] → [通用标签] → [自然语言描述]
```

段内顺序随意；这是"软规则"（训练时全部混在一起），但按训练顺序写最稳、最便于自查。

**第一段：质量 / 年代 / 元数据 / 安全**

| 类别 | 标签 | 说明 |
|---|---|---|
| 质量（人工评分） | `masterpiece`, `best quality`, `good quality`, `normal quality`, `low quality`, `worst quality` | 可用一组、两组都用、或都不用 |
| 质量（美学评分） | `score_9` … `score_1` | 源自 PonyV7 美学模型；最多选一个；**Aesthetic 版禁用** |
| 年代 | `year 2025`, `year 2024`…；`newest`, `recent`, `mid`, `early`, `old` | 引导画风年代 |
| 元数据 | `highres`, `absurdres`, `anime screenshot`, `official art`, `twitter username`… | |
| 安全 | `safe`, `sensitive`, `nsfw`, `explicit` | **正向里要写安全等级**，四选一，不想要的等级放负向 |

**安全等级四选一**（所有用户都需要知道的几条）：

- 四个等级是"类别"不是"阶梯"，按画面里**最露骨的那个元素**选一个写进正向。
- **绝不混用**：`safe` 配露骨内容 = 自相矛盾 → 出图发软 / 自动打码。
- **短提示词 = 危险**：官方 Limitations 原文——"模型可能生成不想要的内容，尤其是提示词短或缺乏细节时。用安全标签 + 写足够细的提示词来避免。"
- **SFW 用户的推荐写法**：正向开头 `masterpiece, best quality, score_7, safe,`；负向在标准基础上加 `nsfw, explicit`（必要时加 `sensitive`）。
- 纯风景、抽象图可以不写等级。

与成人内容相关的规则、词表与模板在站内的**成人附录**里（需确认后查看），主线不展开。

**第二段：人数 / 角色 / 作品 / 画师**

| 标签 | 含义 |
|---|---|
| `1girl` `2girls` `3girls` … | 画面里有 N 个女性角色 |
| `1boy` `2boys` … | N 个男性角色 |
| `1other` `2others` … | N 个**非人类**角色（动物、怪物、拟人化物体）。**不是"一个人"的意思** |
| `solo` | 只有一个角色 |
| `no humans` | 画面里没有人（风景、静物） |
| 角色标签 | 如 `frieren`、`artoria pendragon \(fate\)`——**长尾角色用标签不可靠，改在句子里写 "X from Series"** |
| 作品标签 | 如 `sousou no frieren`、`blue archive`——能把该作品的美术方向带进来 |
| `@画师名` | 最强的画风杠杆；多个画师可用 `\|` 或空格分隔混合（不用逗号） |

官方推荐前缀与负面：

```
正向前缀：masterpiece, best quality, score_7, safe,
负面：    worst quality, low quality, score_1, score_2, score_3, artist name, blurry, jpeg artifacts, chromatic aberration
```

> 负面里的 `artist name` 是 Danbooru 的元标签，意思是**"画面上出现了画师署名"**，用来避免画面里冒出签名 / 水印。它**和正向使用 `@画师` 不冲突**，照官方推荐保留即可。

### 按版本调整

| 版本 | 质量标签 | score_* | 备注 |
|---|---|---|---|
| **Base** | 建议加 `masterpiece, best quality` | 可用（`score_7`） | 想要扁平 / 复古 / 绘画感时**去掉质量标签和 highres** |
| **Aesthetic** | 可留 `masterpiece, best quality`，不加也行 | **正负向都不要用** | 已在高质量图上精调，score 会把画面推成"AI 味" |
| **Turbo** | 同 Base 即可 | 可用 | CFG 1 时负面无效，把想要的东西写进正向；种子间变化比 Base 小 |

### 第三段：通用标签（主体）

这一段是提示词的主体：Anima 语料里常见的 SFW 标签，按用途分组。完整释义（300 多个）在[标签字典](/tags/)，点组名跳到对应分类。

| 组 | 常用标签 | 用途 |
|---|---|---|
| [构图 / 取景](/tags/#cat-构图) | `portrait`、[cowboy shot](/tags/cowboy-shot/)、`full body`、`from below`、`dutch angle`、[looking at viewer](/tags/looking-at-viewer/) | 镜头离人物多远、从哪个方向拍。想要"电影感"用这一组，别写 cinematic |
| [动作](/tags/#cat-动作) | `standing`、`sitting`、`crossed arms`、[own hands together](/tags/own-hands-together/)、`hand on own hip`、[a-pose](/tags/a-pose/) | 姿势与手。补手部细节标签能减少手崩 |
| [表情](/tags/#cat-表情) | `smile`、`grin`、[blush](/tags/blush/)、`crying`、`angry`、`expressionless`、`fang` | 表情。每个词是精确的一张脸，不是形容词 |
| [外观](/tags/#cat-外观) | `long hair`、[twintails](/tags/twintails/)、`ahoge`、`blue hair`、`gradient hair`、[blue eyes](/tags/blue-eyes/)、`heterochromia` | 发型 / 发色 / 瞳色，Anima 的强项；多人时**每个角色都写**，否则特征会"串" |
| [服饰](/tags/#cat-服饰) | `hair ribbon`、`hair ornament`、`hairclip`、`kanzashi` | 服装与发饰；`cosplay` 是"扮演别的角色"，不是"穿衣服" |
| [背景](/tags/#cat-背景) | `scenery`、`detailed background`、`indoors`、[outdoors](/tags/outdoors/)、`blurry background`、`gradient background` | 治白底的药：纯色背景在语料里占比极高 |
| [光线 / 效果](/tags/#cat-光线) | [backlighting](/tags/backlighting/)、`rim lighting`、`light rays`、`bloom`、[depth of field](/tags/depth-of-field/)、`speed lines` | 光线与镜头效果；`depth of field`、`shaded face` 都有精确含义 |
| [画风 / 媒介](/tags/#cat-画风) | `flat color`、`painterly`、`sketch`、[watercolor (medium)](/tags/watercolor-medium/)、[pixel art](/tags/pixel-art/)、`retro artstyle` | 画风。内置风格标签的括号要转义成 `\(medium\)` |
| [画面格式](/tags/#cat-格式) | [4koma](/tags/4koma/)、`manga`、[character design sheet](/tags/character-design-sheet/)、`tachi-e`、`border` | 漫画分格、设定图、立绘 |

规则只有一条：**这一段里每个词都是一个精确的标签，不是形容词**。把 `lineart`、`monochrome`、`wet` 当普通英文写进句子，整张图会被它定义——下面"陷阱标签"一节专门讲这件事。

## 自然语言要点

- **至少写两句**，越具体越好；极短的句子结果不可预测。
- **写"看得见的事实"，不是写形容词**。
- **多角色必须"报名字 + 说长相"**。只列一串角色名模型会混淆：

  ```
  Digital artwork of Fern from Sousou no Frieren, with long purple hair and purple eyes,
  wearing a black coat over a white dress with puffy sleeves...
  ```

- **每个细节都要和角色绑在同一句里**，重复名字没问题。
- **位置关系用自然语言写**（标签没有方位），按阅读顺序（先左到右、再上到下）描述。
- **画面内文字**：用引号写出内容即可，单词和短句可靠，长句不行。
- LLM 帮你写的长句未必适合这个模型——回头读一遍："人类标注员会这么描述这张图？"
- 嵌套：一层可以，**两层基本失败**（4 格漫画是例外）。

## 混合写法示例

```
masterpiece, best quality, @big chungus. An anime girl with medium-length blonde hair is...
```

```
2girls, train compartment, sunset.
The girl by the window reads a book while her friend leans over the seat
and points toward a distant town outside.
```

## 陷阱标签：这些"普通英文词"其实会定义整张图

booru 里的很多标签就是日常英文单词。你把它们当普通形容词写进句子时，模型会**悄悄套用标签含义**。写提示词前和排错时都对照一遍（来源：Volnovik 指南的蒸馏版，**不是模型作者**）：

| 词 | 在 Anima 里实际的效果 | 常见误写 | 应该这样写 |
|---|---|---|---|
| `high contrast` | 一种极端、色阶化的高反差风格 | 想要"色彩鲜明" | 直接写颜色（`crimson and teal palette`）或 `red theme` |
| `anime` | 锚定动画截图风 | 句子里写 "anime style" | 不写；画风用 `@画师` 或具体风格标签 |
| `anime coloring`, `cel shading \(2d\)` | 特定的平涂赛璐璐填色 | "clean cel shading" | 想要这个风格就**有意**用标签 |
| `lineart` | **只有黑线、没有上色**的线稿 | 想表达"线条干净"写了 "line art" | 不写；想要线稿才用 `lineart`（一个词） |
| `lace` | 整件衣服都是蕾丝 | 想要"领口一点蕾丝边" | 小面积用 `lace trim` |
| `wet` | 皮肤 / 衣物湿透反光、满是水珠 | 想表达"淋了雨" | 写 `rain` |
| `colorful` | 一个特定的高饱和配色标签 | "colorful background" | 写出具体颜色 |
| `anime screenshot` | 截图式构图 | 想要"电影感"写了 "cinematic" | 用构图标签：`wide shot`, `from below`, `dutch angle`… |
| `monochrome` | **黑白图** | 想表达"低饱和" | `muted color`, `pastel colors` |
| `blurry`, `depth of field` | 特定的虚化 / 景深效果 | "soft focus" | 用句子说明哪里清晰、哪里虚化 |
| `censored` | 打码条 | 正向里随手写 "keep it tasteful" | **永远不要放进正向** |
| `cosplay` | 角色**扮演另一个作品的角色** | 当作"穿服装" | 穿服装用 `costume` 或具体服装标签 |
| `1other` | 一个非人类角色 | 当成"一个人" | 人用 `1girl` / `1boy` |
| `score_N` | 每个数字都是不同的质量 + 风格锚点 | "保险起见多写几个" | Base 上最多一个；Aesthetic 上一个都不要 |

## 今天的提示词练习

贯穿一个想法（例如"雨天电车站台的少女"），每天换一种写法，seed 固定：

- **纯标签 + 已知角色**：用官方前缀 + `1girl, 角色名, 作品名, ...` 写 5 条提示词。角色 / 画师标签去 ANIMADEX（`animadex.net`）查。目标：熟悉标签顺序，体会每个标签的作用。
- **自然语言**：同样的画面，改写成 2–3 句英文描述（不含标签）。对比标签版。目标：感受"位置关系、动作、互动"用句子写更顺。
- **混合写法 + 画师**："标签写外貌 + 句子写场景"；加 `@画师`，试 3 个不同画师。目标：找到 2–3 个喜欢的画风组合。

进阶技巧里现在就能用的两条：

- **背景总是空白？** 语料里 `simple background` 占比很高，这是最常见的翻车点。具体描述背景（内容、光线、纵深），或加标签 `scenery`, `detailed background`。
- **角色设定图**：`character design sheet, front and side views, expression sheet, multiple views of the same character, ...`

## 反推标签：把"看着像"变成"叫什么"

标签表几百条背不下来，也不必背。拿参考图跑 **tagger**，看"这个视觉特征对应哪个标签"，再回 Danbooru wiki 看图确认。它也是校验工具：把自己的成图丢进去，看模型"觉得"图里多了什么。

- 节点包：`pythongosssss/ComfyUI-WD14-Tagger`（Manager 搜 `comfyui-wd14-tagger`，依赖 `onnxruntime` 自动装）。模型选 SmilingWolf 的 WD Tagger v3 系列（如 `wd-eva02-large-tagger-v3`）。
- 连线只要一根：`加载图像.IMAGE ──▶ WD14 Tagger.image`，`tags` 直接显示在节点上。
- 关键参数：`threshold`（默认 0.35）、`character_threshold`（默认 0.85，免得乱认角色）、`exclude_tags`。

**三步把 tagger 输出变成 Anima 提示词**：

1. **跑**：加载参考图 → 读 `tags`。
2. **筛**：删掉元数据类（`highres` `absurdres` 等）、按需删人数 / 视线类，留 15～30 个。
3. **改写并排序**：下划线 → 空格；画师名前加 `@`（tagger 不会帮你加）；带括号的转义；按四段式排好；最前面补质量 / 年代 / 安全标签。

```
tagger 原始输出（节选）：
1girl, solo, long_hair, brown_hair, blue_eyes, sailor_collar, serafuku, pleated_skirt,
looking_at_viewer, smile, standing, outdoors, cherry_blossoms, depth_of_field, highres, absurdres

改写后：
masterpiece, best quality, safe, 1girl, solo, long hair, brown hair, blue eyes, sailor collar, serafuku,
pleated skirt, smile, standing, looking at viewer, outdoors, cherry blossoms, depth of field
```

进阶：收集 10～20 张喜欢的参考图各跑一次，合并出现频率高的标签，就是你的"审美词表"。不装节点的替代：Hugging Face Space `SmilingWolf/wd-v1-4-tags`，浏览器上传即可。

## 验收

- 三种写法各一张、3 个画师对照、一次 Tagger 改写，都记进实验记录本。
- 写提示词前，对照[标签字典](/tags/)里的"陷阱标签"过一遍。
- 出图不满意先查[排错速查](/troubleshooting/)的"提示词"区。下一课：[L2 · 批量与参数扫描](/lessons/02-01-l2-sweeps/)。
