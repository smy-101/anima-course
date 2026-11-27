---
title: "写 Anima 提示词"
stage: 1
order: 3
summary: "学完你能按 Anima 的机制写出标签版、自然语言版和混合版提示词，并用 Tagger 把参考图反推成标签。"
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
deliverable: "同一画面（建议“雨天电车站台的少女”）的标签版、自然语言版、混合版各一张；2–3 个喜欢的画师组合。"
acceptance:
  - 能说出“权重只有一半生效”和“逗号后必须有空格”各自的原因
  - 给一条提示词，能对照提示词规则逐条检查
  - 同一画面三种写法各出一张，能说出哪种写法更顺
  - 做过 3 个画师的对照，记下 2–3 个喜欢的组合
  - 用 Tagger 跑了一张参考图，按三步改写成 Anima 提示词并出图
  - 写提示词前和排错时，都对照陷阱标签表检查过自己的提示词
  - 三种写法、画师对照和 Tagger 改写都记进了实验记录本
figures:
  - id: pb-styles
    src: ../../assets/figures/pb-styles.webp
    caption: "同一画面：纯标签 / 纯自然语言 / 混合（模板 A / B / C）"
    group: 三种写法
  - id: pb-artists
    src: ../../assets/figures/pb-artists.webp
    caption: "同一提示词挂 3 个不同 @画师（@nnn yryr / @huke / @wlop）的风格差异，最左一格不挂画师"
    group: 画师
  - id: pb-tagger
    caption: "Tagger 节点输出、筛选改写、成图的三步对照"
    group: 反推标签
  - id: pb-trap
    src: ../../assets/figures/pb-trap.webp
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

## 机制

Anima 真懂句子，在拆分模型里少见，但规则和 SDXL / Illustrious 不同。下划线要换成空格，画师名前要加 `@`，权重 1.2 约等于没加。这些规则背后都有原理，知道了就不用死记。

### 权重只有一半生效

ComfyUI 的 Anima 文本编码器里有两个分词器，同一段提示词会分别交给它们处理：

```
提示词 ─┬─ Qwen3-0.6B 分词器 ─→ Qwen3-0.6B 模型编码 ─→ 权重被强制归 1.0
        └─ T5XXL 分词器     ─→ 保留 (tag:N) 的权重 ─→ 以 token id + 权重形式送入 DiT
```

`(tag:1.2)` 这种权重只在 T5 这一路生效，Qwen 那一路完全无视它。所以 SDXL 时代 1.2～1.3 的“轻微加强”，在 Anima 上约等于没加。模型卡给的例子是 `(chibi:2)`；社区的经验是 1.5 起步，2.0 是甜点。权重只用在“某个元素死活不出”的排错上，不要预防性地堆。

### 逗号后的空格

用 Qwen3 分词器验证一下就明白了。写 `masterpiece, best quality`，它切出 `['master', 'piece', ',', ' best', ' quality']`，没问题。写成 `masterpiece,best quality`，它切出 `['master', 'piece', ',b', 'est', ' quality']`，多出 `,b` 这种怪 token。

**逗号后面必须有空格，原因是分词，不是排版习惯。** 逗号加空格是训练数据里标签的标准分隔形式。所以“标签 + 逗号 + 空格”这个组合本身就在告诉模型这是一个独立标签。这也是“标签传染”的根源：逗号隔开的标签影响力更强，更容易扩散到全图。

### 一个 0.6B 的语言模型

Anima 真的懂句子，位置、动作、互动、画面内文字都能写。但它“小而直”：代词经常指错对象，Markdown 不认识（`#` 会被画出来），两层嵌套基本失败。

写提示词用简单词、简单句，一个分句写一个看得见的事实，细节和角色名放在同一句里。

### 注意力预算

两路分词器都设了 `max_length=99999999`，提示词不会被截断。“写长了不听话”，是 token 变多后每个 token 分到的注意力被稀释。实践上的结论是标签版 15～30 个、自然语言 2～5 句，要加东西先删东西。

## 写法的取舍

三种写法各有取舍，先并排看一遍。

| 写法 | 优点 | 缺点 | 适合 |
|---|---|---|---|
| 纯标签 | 精确、可查 wiki、发型 / 姿势 / 表情覆盖极深 | 没有方位词（“在左边”）、数据集偏见会漏进来 | 单人、明确属性 |
| 纯自然语言 | 能写位置关系、互动、场景逻辑 | 没有标准写法可查，难排错 | 场景、多人物互动、带文字的画面 |
| 混合（推荐） | 兼得两者 | — | 大多数情况 |

Volnovik 的指南把混合写法叫“boorified language”。具体写法是用句子搭骨架，在 booru 有精确标签的地方嵌标签。**外观属性交给标签，空间位置与互动关系交给句子。**

现成的模板在[提示词模板](/resources/prompt-templates/)：A 单人标签版、B 自然语言版、C 混合版、D 带画师。

## 提示词规则

先看书写规则，每条后面跟的是它的原因。

- 标签全部小写，用空格代替下划线：`long hair` 对，`long_hair` 错。训练标签就是这样写的。
- 唯一的例外是 `score_9` 到 `score_1`：这几个保留下划线，因为来自 Pony V7 的美学评分模型。
- Danbooru 和 Gelbooru 拼写不同时用 Gelbooru。主数据集是 Gelbooru。
- 画师名前必须加 `@`，比如 `@nnn yryr`。不加 `@` 的效果“非常弱”。
- 角色名、作品名保留正常的英文大小写，比如 `Fern from Sousou no Frieren`。0.6B 的语言模型对大小写敏感。
- 权重从 1.5 起步，2.0 是甜点。双分词器里只有 T5 那一路认权重。
- 逗号后面只放一个空格，不要拼错。分词器不做模糊匹配。

前五条来自官方模型卡。第六条有官方说法和 ComfyUI 源码两方面的依据。第七条来自社区。

另有几条补充。

带括号的标签要转义括号，比如 `card \(medium\)`、`amatsukaze \(kancolle\)`。不转义的括号会被当成权重语法。

不要用 Markdown 或 JSON 包裹提示词。`# girl` 这类标题“能用”，但 `#` 偶尔会被画进图里，用空行分段更安全。

不要写看不见的东西，比如嘴里的棒棒糖是什么颜色、面罩后面的眼睛、衣服下面的结构。你写了，它就会画出来。

社区还发现 `"best quality"` 和 `" best quality"`（逗号后有无空格）会带来不同的风格倾向。保持格式一致，别混用。

## 提示词结构

```
[质量 / 元数据 / 年代 / 安全] → [人数 1girl/1boy/1other] → [角色] → [作品] → [@画师] → [通用标签] → [自然语言描述]
```

段内顺序随意，因为训练时全部混在一起，这只是软规则。但按训练顺序写最稳，也最便于自查。

### 质量和安全标签

第一段放质量、年代、元数据和安全标签。

| 类别 | 标签 | 说明 |
|---|---|---|
| 质量（人工评分） | `masterpiece`, `best quality`, `good quality`, `normal quality`, `low quality`, `worst quality` | 可用一组、两组都用、或都不用 |
| 质量（美学评分） | `score_9` … `score_1` | 源自 PonyV7 美学模型；最多选一个；Aesthetic 版禁用 |
| 年代 | `year 2025`, `year 2024`…；`newest`, `recent`, `mid`, `early`, `old` | 引导画风年代 |
| 元数据 | `highres`, `absurdres`, `anime screenshot`, `official art`, `twitter username`… | |
| 安全 | `safe`, `sensitive`, `nsfw`, `explicit` | 正向里要写安全等级，四选一，不想要的等级放负向 |

安全等级这几条，所有用户都要知道。四个等级是“类别”不是“阶梯”，按画面里最露骨的那个元素选一个写进正向。绝不混用：`safe` 配露骨内容是自相矛盾，出图会发软，或者被自动打码。短提示词也危险，官方 Limitations 的原文是：“模型可能生成不想要的内容，尤其是提示词短或缺乏细节时。用安全标签 + 写足够细的提示词来避免。” SFW 用户的推荐写法：正向开头 `masterpiece, best quality, score_7, safe,`。负向在标准基础上加 `nsfw, explicit`，必要时加 `sensitive`。纯风景、抽象图可以不写等级。

与成人内容相关的规则、词表与模板在站内的成人附录里，需要确认后查看，主线不展开。

### 人数、角色、作品和画师

第二段放人数、角色、作品和画师。

| 标签 | 含义 |
|---|---|
| `1girl` `2girls` `3girls` … | 画面里有 N 个女性角色 |
| `1boy` `2boys` … | N 个男性角色 |
| `1other` `2others` … | N 个非人类角色（动物、怪物、拟人化物体），不是“一个人”的意思 |
| `solo` | 只有一个角色 |
| `no humans` | 画面里没有人（风景、静物） |
| 角色标签 | 如 `frieren`、`artoria pendragon \(fate\)`。长尾角色用标签不可靠，改在句子里写 “X from Series” |
| 作品标签 | 如 `sousou no frieren`、`blue archive`，能把该作品的美术方向带进来 |
| `@画师名` | 最强的画风杠杆；多个画师可用 `\|` 或空格分隔混合（不用逗号） |

官方推荐前缀与负面：

```
正向前缀：masterpiece, best quality, score_7, safe,
负面：    worst quality, low quality, score_1, score_2, score_3, artist name, blurry, jpeg artifacts, chromatic aberration
```

> 负面里的 `artist name` 是 Danbooru 的元标签，意思是画面上出现了画师署名。放它是为了不让画面里冒出签名或水印。它和正向使用 `@画师` 不冲突，照官方推荐保留即可。

### 按版本调整

换版本时，质量标签和 score 标签的用法要跟着变：

| 版本 | 质量标签 | score_* | 备注 |
|---|---|---|---|
| Base | 建议加 `masterpiece, best quality` | 可用（`score_7`） | 想要扁平 / 复古 / 绘画感时去掉质量标签和 highres |
| Aesthetic | 可留 `masterpiece, best quality`，不加也行 | 正负向都不要用 | 已在高质量图上精调，score 会把画面推成“AI 味” |
| Turbo | 同 Base 即可 | 可用 | CFG 1 时负面无效，把想要的东西写进正向；种子间变化比 Base 小 |

### 通用标签

第三段是提示词的主体：Anima 语料里常见的 SFW 标签，按用途分组。完整释义有 300 多个，在[标签字典](/tags/)里，点组名跳到对应分类。

| 组 | 常用标签 | 用途 |
|---|---|---|
| [构图 / 取景](/tags/#cat-构图) | `portrait`、[cowboy shot](/tags/cowboy-shot/)、`full body`、`from below`、`dutch angle`、[looking at viewer](/tags/looking-at-viewer/) | 镜头离人物多远、从哪个方向拍。想要“电影感”用这一组，别写 cinematic |
| [动作](/tags/#cat-动作) | `standing`、`sitting`、`crossed arms`、[own hands together](/tags/own-hands-together/)、`hand on own hip`、[a-pose](/tags/a-pose/) | 姿势与手。补手部细节标签能减少手崩 |
| [表情](/tags/#cat-表情) | `smile`、`grin`、[blush](/tags/blush/)、`crying`、`angry`、`expressionless`、`fang` | 表情。每个词是精确的一张脸，不是形容词 |
| [外观](/tags/#cat-外观) | `long hair`、[twintails](/tags/twintails/)、`ahoge`、`blue hair`、`gradient hair`、[blue eyes](/tags/blue-eyes/)、`heterochromia` | 发型 / 发色 / 瞳色，Anima 的强项；多人时每个角色都写，否则特征会“串” |
| [服饰](/tags/#cat-服饰) | `hair ribbon`、`hair ornament`、`hairclip`、`kanzashi` | 服装与发饰；`cosplay` 是“扮演别的角色”，不是“穿衣服” |
| [背景](/tags/#cat-背景) | `scenery`、`detailed background`、`indoors`、[outdoors](/tags/outdoors/)、`blurry background`、`gradient background` | 治白底的药：纯色背景在语料里占比极高 |
| [光线 / 效果](/tags/#cat-光线) | [backlighting](/tags/backlighting/)、`rim lighting`、`light rays`、`bloom`、[depth of field](/tags/depth-of-field/)、`speed lines` | 光线与镜头效果；`depth of field`、`shaded face` 都有精确含义 |
| [画风 / 媒介](/tags/#cat-画风) | `flat color`、`painterly`、`sketch`、[watercolor (medium)](/tags/watercolor-medium/)、[pixel art](/tags/pixel-art/)、`retro artstyle` | 画风。内置风格标签的括号要转义成 `\(medium\)` |
| [画面格式](/tags/#cat-格式) | [4koma](/tags/4koma/)、`manga`、[character design sheet](/tags/character-design-sheet/)、`tachi-e`、`border` | 漫画分格、设定图、立绘 |

这一段只有一条规则：**每个词都是一个精确的标签，不是形容词**。把 `lineart`、`monochrome`、`wet` 当普通英文写进句子，整张图会被它定义。陷阱标签一节专门讲这件事。

## 自然语言写法

至少写两句，越具体越好，极短的句子结果不可预测。写看得见的事实，不写形容词。

多个角色时，每个角色都要报名字、说长相。只列一串角色名，模型会混淆：

```
Digital artwork of Fern from Sousou no Frieren, with long purple hair and purple eyes,
wearing a black coat over a white dress with puffy sleeves...
```

**每个细节都和角色名写在同一句里，重复名字没关系。** 位置关系用自然语言写，因为标签没有方位。按阅读顺序描述，先左到右，再上到下。画面内文字用引号写出内容即可，单词和短句可靠，长句不行。嵌套一层可以，两层基本失败，4 格漫画是例外。

LLM 帮你写的长句未必适合这个模型。写完回头读一遍，问自己：“人类标注员会这么描述这张图？”

## 混合写法示例

两个例子，先看单人，再看多人和场景。

```
masterpiece, best quality, @big chungus. An anime girl with medium-length blonde hair is...
```

```
2girls, train compartment, sunset.
The girl by the window reads a book while her friend leans over the seat
and points toward a distant town outside.
```

## 陷阱标签

booru 里的很多标签就是日常英文单词。**你当普通形容词写进句子的英文词，可能正好是一个标签**。模型会悄悄套用它的标签含义，所以写提示词前和排错时都要对照一遍。下面这张表来自 Volnovik 指南的蒸馏版，不是模型作者写的；[标签字典](/tags/)里的陷阱标签也带着标记，可以一起翻。

| 词 | 在 Anima 里实际的效果 | 常见误写 | 应该这样写 |
|---|---|---|---|
| `high contrast` | 一种极端、色阶化的高反差风格 | 想要“色彩鲜明” | 直接写颜色（`crimson and teal palette`）或 `red theme` |
| `anime` | 锚定动画截图风 | 句子里写 “anime style” | 不写；画风用 `@画师` 或具体风格标签 |
| `anime coloring`, `cel shading \(2d\)` | 特定的平涂赛璐璐填色 | “clean cel shading” | 想要这个风格就有意用标签 |
| `lineart` | 只有黑线、没有上色的线稿 | 想表达“线条干净”写了 “line art” | 不写；想要线稿才用 `lineart`（一个词） |
| `lace` | 整件衣服都是蕾丝 | 想要“领口一点蕾丝边” | 小面积用 `lace trim` |
| `wet` | 皮肤 / 衣物湿透反光、满是水珠 | 想表达“淋了雨” | 写 `rain` |
| `colorful` | 一个特定的高饱和配色标签 | “colorful background” | 写出具体颜色 |
| `anime screenshot` | 截图式构图 | 想要“电影感”写了 “cinematic” | 用构图标签：`wide shot`, `from below`, `dutch angle`… |
| `monochrome` | 黑白图 | 想表达“低饱和” | `muted color`, `pastel colors` |
| `blurry`, `depth of field` | 特定的虚化 / 景深效果 | “soft focus” | 用句子说明哪里清晰、哪里虚化 |
| `censored` | 打码条 | 正向里随手写 “keep it tasteful” | 永远不要放进正向 |
| `cosplay` | 角色扮演另一个作品的角色 | 当作“穿服装” | 穿服装用 `costume` 或具体服装标签 |
| `1other` | 一个非人类角色 | 当成“一个人” | 人用 `1girl` / `1boy` |
| `score_N` | 每个数字都是不同的质量 + 风格锚点 | “保险起见多写几个” | Base 上最多一个；Aesthetic 上一个都不要 |

出图不满意，先查[排错速查](/troubleshooting/)的“提示词”区。

## 提示词练习

阶段 1–2 的每张图都是练习。挑一个想法贯穿下去，比如“雨天电车站台的少女”，每天换一种写法，seed 固定。

先用纯标签写已知角色：官方前缀，再加 `1girl, 角色名, 作品名, ...`，写 5 条提示词。角色和画师标签去 ANIMADEX（`animadex.net`）查。目标是熟悉标签顺序，体会每个标签的作用。

再换自然语言：同样的画面，写成 2～3 句英文描述，不含标签，和标签版对比。目标是感受位置关系、动作、互动用句子写更顺。

最后用混合写法加画师：“标签写外貌，句子写场景”，再加 `@画师`，试 3 个不同的画师。目标是找到 2～3 个喜欢的画风组合。

写完先过一遍[提示词检查器](/tools/prompt-lint/)。下划线、逗号空格、画师缺 `@`、陷阱标签、等级冲突，它一次查出来，能自动修的一键修。每条提示都链回本课讲的原理。

另外两条技巧现在就能用上。背景总是空白，是因为语料里 `simple background` 占比很高，这是最常见的翻车点。具体描述背景的内容、光线和纵深，或者加标签 `scenery`、`detailed background`。想要角色设定图，写 `character design sheet, front and side views, expression sheet, multiple views of the same character, ...`。

## 反推标签

标签表几百条，背不下来，也不必背。看到参考图，你说得出它“看着像”什么，缺的是它“叫什么”。拿参考图跑一遍 **WD14 Tagger** 节点，下面简称 tagger。跑完你能看到每个视觉特征对应哪个标签，再回 Danbooru wiki 看图确认。它也是校验工具：把自己的成图丢进去，看模型“觉得”图里多了什么。

节点包是 `pythongosssss/ComfyUI-WD14-Tagger`，在 Manager 里搜 `comfyui-wd14-tagger`，依赖 `onnxruntime` 会自动装上。模型选 SmilingWolf 的 WD Tagger v3 系列，比如 `wd-eva02-large-tagger-v3`。连线只要一根：`加载图像.IMAGE ──▶ WD14 Tagger.image`，`tags` 直接显示在节点上。关键参数有 `threshold`（默认 0.35）、`character_threshold`（默认 0.85，免得乱认角色）和 `exclude_tags`。

把 tagger 的输出改成 Anima 提示词分三步。第一步跑：加载参考图，读出 `tags`。第二步筛：删掉 `highres`、`absurdres` 这类元数据标签，按需删人数和视线类，留 15～30 个。第三步改写并排序。下划线换成空格，画师名前加 `@`（tagger 不会帮你加），带括号的转义。然后按前面讲的段落顺序排好，最前面补质量、年代和安全标签。改完贴进[提示词检查器](/tools/prompt-lint/)，前两步漏掉的它会指出来。

```
tagger 原始输出（节选）：
1girl, solo, long_hair, brown_hair, blue_eyes, sailor_collar, serafuku, pleated_skirt,
looking_at_viewer, smile, standing, outdoors, cherry_blossoms, depth_of_field, highres, absurdres

改写后：
masterpiece, best quality, safe, 1girl, solo, long hair, brown hair, blue eyes, sailor collar, serafuku,
pleated skirt, smile, standing, looking at viewer, outdoors, cherry blossoms, depth of field
```

想再进一步，可以收集 10～20 张喜欢的参考图各跑一次。把出现频率高的标签合并起来，就是你的“审美词表”。不想装节点的话，Hugging Face 上有 Space `SmilingWolf/wd-v1-4-tags`，浏览器上传即可。
