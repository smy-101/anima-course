# Anima 提示词总结报告（含 NSFW 标注版）

> 调研时间：2026 年 11 月
> 范围：Anima（`circlestone-labs/Anima`）的提示词体系——书写规则、标签分类、**安全等级与 NSFW 标签**、负向提示词、陷阱标签、按版本调整
> **每个标签都标注了含义**。释义依据优先级：Danbooru wiki 官方释义 → 模型卡 → 社区实测
> 配套笔记：`Anima生图学习报告.md`（模型/安装/参数基础）、`ComfyUI节点与参数详解.md`（节点）

---

## 0. 一页速览

| 项目 | 结论 |
|---|---|
| 安全等级标签 | `safe` / `sensitive` / `nsfw` / `explicit` **四选一**写在正向；不想要的等级放负向 |
| 与 Danbooru 分级的对应（推断） | general→`safe`，sensitive→`sensitive`，questionable→`nsfw`，explicit→`explicit`。官方未明说，按四级映射 + Volnovik 的描述推得 |
| 最重要的一条规则 | **等级必须与画面里最露骨的内容匹配**。`safe` 配露骨画面 → 出图发软/自动打码；`nsfw` 配露器官画面 → 同样偏软，该用 `explicit` |
| 去码 | `censored` 放负向（可加 `bar censor`、`mosaic censoring`）。`uncensored` 是否放正向**社区有分歧**（见 §4.3） |
| 短提示词风险 | 官方明确：提示词太短/太笼统会"生成不想要的内容"。SFW 用户务必写 `safe` 并把画面写具体 |
| Turbo 上负向无效 | Turbo / Turbo LoRA / DMD2 都跑 CFG 1，负向提示词基本不起作用（NegPip、NAG 可绕过） |
| 权重要给大 | `(tag:2)` 才明显。原理：双分词器，Qwen 路的权重被归 1（§1.1） |
| 逗号后必须空格 | 分词器层面就是不同的 token：`a,b` ≠ `a, b`（§1.2） |
| 多人场景必"传染" | 一个角色的属性会串到其他人身上。解法：每个属性写给所有人 + 用 `and` 代替逗号（§8） |
| 内容边界 | `loli` / `shota` 等标签存在于词表，但**不应使用**（多数司法辖区违法 + 违反各平台规则）；极端标签本报告仅列出供识别，不给用法 |

### 来源可信度分级（本报告所有结论按此标注）

| 级别 | 来源 | 下文简称 |
|---|---|---|
| ★★★ 官方 | Hugging Face 模型卡（CircleStone Labs / tdrussell）；Comfy Org 文档与 ComfyUI 官方模板；ComfyUI 源码 `comfy/text_encoders/anima.py` | 【官方】 |
| ★★ 平台 | Civitai 开发者文档、mage.space 指南、MooshieUI Wiki、SimpliGen | 【平台】 |
| ★ 社区实测 | Volnovik《ANIMA generation guide》系列（Civitai 33274 / 33315 / 33857 / 34963）及其 `anima-prompting` 技能；Rainmaker666 指南（35368）；dskjal.com 日文 NSFW 笔记；F4nta5IA（31399）等 | 【社区】 |
| 词典 | Danbooru wiki 标签释义；`howto:rate` 分级定义 | 【Danbooru】 |

> ⚠️ **对现有《Anima生图学习报告》的勘误**：该报告把 Civitai 文章 33857 标为"作者提示词指南"。经核实，该系列是**社区作者 Volnovik** 写的，**不是模型作者 tdrussell**。两者推荐值有差异（例如 Volnovik 的负向多了 `censored, signature, twins`），引用时必须区分。

---

## 1. 机制：Anima 怎么读你的提示词

知道原理，下面的规则就不用死记。

### 1.1 双分词器 → 权重只有一半生效【官方源码】

ComfyUI 的 Anima 文本编码器（`comfy/text_encoders/anima.py`）把同一段提示词**分别**用两个分词器处理：

```
提示词 ─┬─ Qwen3-0.6B 分词器 ─→ Qwen3-0.6B 模型编码 ─→ 权重被强制归 1.0
        └─ T5XXL 分词器     ─→ 保留 (tag:N) 的权重 ─→ 以 token id + 权重形式送入 DiT
```

- `(tag:1.2)` 这种权重**只在 T5 这一路生效**，Qwen 路完全无视。所以 SDXL 时代 1.2～1.3 的"轻微加强"在 Anima 上约等于没加。
- 模型卡给的例子是 `(chibi:2)`；社区经验 1.5 起步、**2.0 是甜点**，dskjal 甚至用到 3～5【社区】。
- 权重只用于"某个元素死活不出"的排错，不要预防性堆。

### 1.2 逗号后必须有空格——这是分词问题【社区，有代码验证】

用 Qwen3 分词器验证：

| 写法 | 分词结果 |
|---|---|
| `masterpiece, best quality` | `['master', 'piece', ',', ' best', ' quality']` ✔ |
| `masterpiece,best quality` | `['master', 'piece', ',b', 'est', ' quality']` ✘ 出现了 `,b` 这种怪 token |
| `masterpiece. best quality` | 句号被当成另一个 token |

逗号+空格是训练数据里标签的标准分隔形式，**"标签 + 逗号 + 空格"这个组合本身就在告诉模型"这是一个独立标签"**。这也是 §8 "标签传染"的根源：逗号隔开的标签影响力更强、更容易扩散到全图。

### 1.3 它是真·语言模型，但只有 0.6B【官方】

- 真懂句子：位置、动作、互动、画面内文字都能写。
- 但"小而直"：代词（he / she / the girl with white hair）经常指错对象；Markdown 不认识（`#` 会被画出来）；两层嵌套基本失败（4 格漫画是唯一例外）。
- 写法口诀：**像给一个只会看图说话的人写图注**——简单词、简单句、一个分句一个看得见的事实、每个细节和角色名写在同一句里。

### 1.4 主要数据集是 Gelbooru【社区】

dskjal 指出 Anima 的主数据集是 **Gelbooru**（仅 `1girl` 就比 Danbooru 多百万张以上），Gelbooru 与 Danbooru 已大量统一标签但仍有拼写差异——这就是模型卡"**Danbooru 与 Gelbooru 拼写不同时用 Gelbooru 的**"的由来。Gelbooru 的内容尺度也比 Danbooru 宽（Danbooru 禁止 loli 和部分极端题材，Gelbooru 较松），这解释了 Anima 的 NSFW 覆盖面。

### 1.5 提示词长度：没有硬上限，只有"注意力预算"【官方源码】

ComfyUI 的 Anima 文本编码器对两路分词器都设了 `max_length=99999999`、`pad_to_max_length=False`——**提示词不会被截断**。所以"写长了不听话"不是尾部被切掉，而是 token 变多后每个 token 分到的注意力被稀释、标签之间"传染"的面也更大（§8）。实践结论不变：标签版控制在 15~30 个、自然语言 2~5 句，要加东西先删东西。

另外两点源码事实：① Qwen3 与 T5 两套分词器**内置在 ComfyUI 仓库里**（`comfy/text_encoders/qwen25_tokenizer`、`t5_tokenizer`），不用另外下载，`qwen_3_06b_base.safetensors` 只含 LM 权重；② §1.1 说的"Qwen 路权重被强制归 1"对应源码里的注释 `# Set weights to 1.0`，T5 路则原样保留 `(tag:N)` 的权重。

---

## 2. 书写硬规则（7 条）

| # | 规则 | 含义 / 原理 | 来源 |
|---|---|---|---|
| 1 | 标签**全小写、空格代替下划线**：`long hair` ✔ `long_hair` ✘ | 训练标签就是这样写的 | 官方 |
| 2 | **唯一例外是 `score_9`…`score_1`**，保留下划线 | 它们来自 Pony V7 美学评分模型，原本就带下划线 | 官方 |
| 3 | Danbooru 与 Gelbooru 拼写不同时**用 Gelbooru** | 主数据集是 Gelbooru | 官方 |
| 4 | 画师名**必须加 `@`**：`@nnn yryr` | 不加 `@` 效果"非常弱"。`@` 是训练时画师标签的标记符 | 官方 |
| 5 | 角色名、作品名**按正常英文大小写**：`Fern from Sousou no Frieren` | 0.6B 语言模型对大小写敏感 | 官方 |
| 6 | 权重 1.5 起、2.0 甜点 | 双分词器，只有 T5 路认权重（§1.1） | 官方 + 源码 |
| 7 | 逗号后**单个空格**，不要拼错 | 分词器不做模糊匹配（§1.2） | 社区 |

补充【社区】：
- **带括号的标签要转义括号**：`card \(medium\)`、`amatsukaze \(kancolle\)`、`>:(` 要写成 `>:\(`。不转义的括号会被当成权重语法。
- **不要用 Markdown / JSON 包裹**。dskjal 用 `# girl` 这类标题做分段虽然"能用"，但 `#` 偶尔会被画进图里；**用空行分段更安全**。
- **不要写看不见的东西**（嘴里的棒棒糖什么颜色、面罩后面的眼睛、衣服下面的结构）——你写了它就会画出来。

---

## 3. 提示词结构（四段式）与各段标签含义

```
[质量 / 元数据 / 年代 / 安全] → [人数 1girl/1boy/1other] → [角色] → [作品] → [@画师] → [通用标签] → [自然语言描述]
```

段内顺序随意；这是"软规则"（训练时全部混在一起），但按训练顺序写最稳、最便于自查。

### 3.1 第一段：质量 / 年代 / 元数据 / 安全

#### 质量标签（两套体系，可单用、混用或都不用）

| 标签 | 含义 | 备注 |
|---|---|---|
| `masterpiece` | 人工评分最高档（Illustrious 系：约前 8%） | 偏"现代高清插画"画风 |
| `best quality` | 人工评分次高档（约前 20%） | 注意：`"best quality"` 与 `" best quality"`（逗号后有无空格）风格倾向不同【官方 HF 讨论区】 |
| `good quality` | 良好（约前 40%） | |
| `normal quality` | 普通（基准档） | 官方完整示例用的是这一档 |
| `low quality` | 低质量 | 通常放负向 |
| `worst quality` | 最差质量 | 通常放负向 |
| `score_9` … `score_1` | Pony V7 **美学模型**打分，按收藏/投票数分 10 档 | 每个 N 都是"质量 + 画风"双重锚点；`score_9/8/7` 容易偏"海外画师风"【社区】。**Aesthetic 版禁用** |

#### 年代标签

| 标签 | 含义 |
|---|---|
| `year 2025` / `year 2024` / … | 画作发布年份，用来引导画风年代 |
| `newest` | 最新（约近 1～2 年） |
| `recent` | 较新 |
| `mid` | 中期 |
| `early` | 早期 |
| `old` | 早期旧作画风 |

> Mage 平台在负向里放 `early, old`，强制现代画风【平台】。反过来，追复古感就在正向写 `old` / `retro artstyle` / `1990s \(style\)`。

#### 元数据标签

| 标签 | 含义 | 正/负向 |
|---|---|---|
| `highres` | 高分辨率图 | 正向 |
| `absurdres` | 超高分辨率 | 正向 |
| `lowres` | 低分辨率 | 负向 |
| `anime screenshot` | TV 动画截图风（锚定构图和画风） | 想要动画感时正向；否则别写 |
| `official art` | 官方插画 | 正向 |
| `game cg` | 游戏立绘/CG 风格 | 正向 |
| `jpeg artifacts` | JPEG 压缩伪影 | **负向** |
| `twitter username` / `signature` / `watermark` / `logo` / `text` | 画面上出现署名、水印、文字 | 负向 |
| `artist name` | Danbooru 元标签：**画面某处出现了画师署名** | 负向（和正向用 `@画师` 不冲突） |
| `very aesthetic` | 高美学价值（部分平台预置） | 正向 |

#### 安全标签 → 见 §4（核心章节）

### 3.2 第二段：人数 / 角色 / 作品 / 画师

| 标签 | 含义 |
|---|---|
| `1girl` `2girls` `3girls` … `6+girls` | 画面里有 N 个女性角色 |
| `1boy` `2boys` … `6+boys` | N 个男性角色 |
| `1other` `2others` … | N 个**非人类**角色（动物、怪物、拟人化物体）。**不是"一个人"的意思** |
| `solo` | 只有一个角色（强调单人，常与 `1girl` 连用） |
| `solo focus` / `male focus` / `other focus` | 焦点在某人身上 |
| `multiple girls` / `multiple boys` / `multiple others` | 多个（不计数） |
| `people` / `crowd` | 有人 / 人群 |
| `no humans` | 画面里没有人（风景、静物） |
| `original` | 原创角色（mage 平台用法） |
| 角色标签 | 如 `oomuro sakurako`、`frieren`、`artoria pendragon \(fate\)`——**长尾角色（帖子数几百以下）用标签不可靠，改在句子里写 "X from Series"**【社区】 |
| 作品标签 | 如 `yuru yuri`、`sousou no frieren`、`blue archive`——能把该作品的美术方向带进来 |
| `@画师名` | 最强的画风杠杆。多个画师可用 `\|` 或空格分隔混合（不用逗号）【社区】 |

### 3.3 第三段：通用标签（SFW 常用，含义标注）

**构图 / 取景**

| 标签 | 含义 |
|---|---|
| `portrait` | 头像/胸像 |
| `close-up` | 特写 |
| `upper body` | 上半身 |
| `cowboy shot` | 从头到大腿中段（七分身） |
| `full body` | 全身 |
| `lower body` | 下半身 |
| `wide shot` / `very wide shot` | 远景 / 极远景 |
| `from above` / `from below` / `from side` / `from behind` | 俯视 / 仰视 / 侧面 / 背面 |
| `dutch angle` | 倾斜镜头（荷兰角） |
| `straight-on` | 正面平视 |
| `profile` | 侧脸 |
| `pov` | 第一人称视角 |
| `fisheye` | 鱼眼 |
| `foreshortening` | 透视缩短（肢体朝向镜头） |
| `looking at viewer` / `looking away` / `looking afar` / `looking back` | 看镜头 / 看别处 / 看远方 / 回头看 |
| `eye contact` | 两角色对视——**用它能 100% 让两人面对面**，比自然语言写左右可靠得多【社区】 |

**姿势**

| 标签 | 含义 |
|---|---|
| `standing` / `sitting` / `lying` / `kneeling` / `squatting` / `crawling` / `all fours` | 站 / 坐 / 躺 / 跪 / 蹲 / 爬 / 四肢着地 |
| `on back` / `on stomach` / `on side` | 仰卧 / 俯卧 / 侧卧 |
| `seiza` / `wariza` / `yokozuwari` | 正座（W 坐）/ 鸭子坐（腿向两侧弯）/ 横坐 |
| `indian style` | 盘腿坐 |
| `straddling` | 跨坐 |
| `arched back` / `bent over` / `leaning forward` / `leaning back` | 弓背 / 弯腰 / 前倾 / 后仰 |
| `contrapposto` | 对立式平衡（重心在一腿） |
| `crossed arms` / `arms up` / `arm behind back` / `outstretched arm` | 抱臂 / 举手 / 手放背后 / 伸出手臂 |
| `own hands together` / `own hands clasped` / `interlocked fingers` | 双手合十 / 十指交扣 |
| `hand on own hip` / `hand in pocket` / `adjusting hair` | 叉腰 / 手插兜 / 拨头发 |
| `v` / `victory pose` / `double v` / `heart hands` / `finger frame` | 剪刀手 / 胜利姿势 / 双 V（ahegao 常见手势）/ 比心 / 比取景框 |
| `head tilt` / `head down` / `head back` | 歪头 / 低头 / 仰头 |
| `spread legs` / `knees together feet apart` / `pigeon-toed` / `tiptoes` | 张腿 / 膝并脚分 / 内八字 / 踮脚 |
| `spread arms` / `arms at sides` / `a-pose` / `t-pose` | 展臂 / 手臂自然下垂 / A 姿 / T 姿 |

**表情**

| 标签 | 含义 |
|---|---|
| `smile` / `light smile` / `grin` / `smirk` / `seductive smile` | 微笑 / 浅笑 / 露齿笑 / 坏笑 / 媚笑 |
| `open mouth` / `closed mouth` / `parted lips` | 张嘴 / 闭嘴 / 微启唇 |
| `closed eyes` / `one eye closed` / `half-closed eyes` | 闭眼 / 单眼闭（眨眼）/ 半闭眼 |
| `blush` / `full-face blush` / `embarrassed` / `shy` | 脸红 / 满脸通红 / 尴尬 / 害羞 |
| `tears` / `crying` / `sobbing` | 流泪 / 哭 / 抽泣 |
| `angry` / `scowl` / `glaring` / `annoyed` | 生气 / 皱眉怒视 / 瞪眼 / 不耐烦 |
| `surprised` / `shocked` / `confused` / `expressionless` | 惊讶 / 震惊 / 困惑 / 面无表情 |
| `fang` / `skin fang` | 虎牙 / 皮肤虎牙（嘴边的小尖角） |
| `:d` `;d` `xd` `;p` `:3` `>:\(` `o o` `^ ^` | 颜文字表情标签（**括号要转义**） |
| `tareme` | 垂眼（温柔下垂的眼型） |
| `constricted pupils` / `wide-eyed` / `rolling eyes` | 瞳孔收缩 / 瞪大眼 / 翻白眼 |

**发型 / 发色**（Anima 的强项）

| 标签 | 含义 |
|---|---|
| `long hair` / `medium hair` / `short hair` / `very long hair` / `absurdly long hair` | 长 / 中 / 短 / 很长 / 超长 |
| `twintails` / `low twintails` / `short twintails` / `braided twintails` | 双马尾 / 低双马尾 / 短双马尾 / 编发双马尾 |
| `ponytail` / `side ponytail` / `hair bun` / `single hair bun` / `double bun` | 马尾 / 侧马尾 / 丸子头 / 单丸子 / 双丸子 |
| `braid` / `single braid` / `twin braids` / `braided ponytail` | 编发 / 单辫 / 双辫 / 编发马尾 |
| `hime cut` / `blunt bangs` / `curtained hair` / `parted bangs` | 姬发式 / 齐刘海 / 中分帘发 / 分缝刘海 |
| `ahoge` / `hair antenna` / `loose hair strand` | 呆毛 / 呆毛（天线型）/ 散落发丝 |
| `black hair` `brown hair` `blonde hair` `red hair` `orange hair` `pink hair` `light pink hair` `blue hair` `purple hair` `lavender hair` `green hair` `teal hair` `aqua hair` `white hair` `grey hair` | 各色发色 |
| `multicolored hair` / `gradient hair` / `colored inner hair` / `colored tips` / `two-tone hair` / `split-color hair` / `streaked hair` | 多色 / 渐变 / 内层挑染 / 发梢染色 / 双色 / 左右分色 / 挑染 |
| `hair ribbon` / `hair bow` / `hair ornament` / `hairclip` / `hair flower` / `hair stick` / `kanzashi` / `headband` / `hairband` | 发饰各类 |

**瞳色**：`blue eyes` `red eyes` `green eyes` `brown eyes` `purple eyes` `yellow eyes` `amber eyes` `aqua eyes` `grey eyes` `black eyes` `heterochromia`（异色瞳）

**背景**

| 标签 | 含义 |
|---|---|
| `simple background` / `white background` / `black background` / `grey background` | 纯色背景——**语料占比极高，这是"背景总是一片白"的根源** |
| `scenery` / `detailed background` / `complex interior` / `complex exterior` / `absurdly detailed composition` | 风景 / 细节丰富的背景 / 复杂室内 / 复杂室外 / 极致细节构图——**治白底的药** |
| `indoors` / `outdoors` | 室内 / 室外 |
| `gradient background` / `patterned background` / `floral background` / `starry background` | 渐变 / 图案 / 花纹 / 星空背景 |
| `blurry background` / `blurry foreground` | 背景虚化 / 前景虚化 |
| `photo background` | 照片级写实背景（不是人物写实） |

**光线 / 效果**

| 标签 | 含义 |
|---|---|
| `backlighting` / `rim lighting` / `sidelighting` / `underlighting` | 逆光 / 轮廓光 / 侧光 / 底光 |
| `light rays` / `sunlight` / `dappled sunlight` / `spot lighting` | 光束 / 阳光 / 斑驳光影 / 聚光灯 |
| `shadow` / `window shadow` / `shaded face` | 阴影 / 窗影 / 脸部阴影（**脸部发黑常放负向**） |
| `bloom` / `bokeh` / `lens flare` / `chromatic aberration` / `film grain` / `vignetting` | 辉光 / 焦外 / 眩光 / 色差 / 胶片颗粒 / 暗角 |
| `depth of field` / `blurry` | 景深 / 模糊 |
| `high contrast` | **特定的高反差海报化风格**，不是"色彩鲜明"（陷阱，§7） |
| `motion lines` / `speed lines` / `emphasis lines` / `sound effects` / `speech bubble` | 动作线 / 速度线 / 强调线 / 拟声词 / 对话框 |

**画风 / 媒介**

| 标签 | 含义 |
|---|---|
| `anime coloring` | 赛璐璐平涂上色（动画风） |
| `flat color` | 无阴影平涂 |
| `painterly` | 厚涂 |
| `sketch` / `oekaki` / `lineart` / `thick lineart` / `no lineart` | 草图 / 涂鸦板风 / 线稿 / 粗线 / 无线 |
| `monochrome` / `greyscale` / `spot color` / `sepia` | 黑白 / 灰度 / 单色点缀 / 棕褐 |
| `pastel colors` / `muted color` / `pale color` / `vibrant colors` | 粉彩 / 低饱和 / 淡色 / 高饱和 |
| `realistic` / `3d` / `(realistic:0.4)` | 偏写实 / 3D 渲染 / 低权重写实（增加体积感但不跑偏） |
| `toon \(style\)` `western comics \(style\)` `1980s \(style\)` `oil painting \(medium\)` `watercolor \(medium\)` `pencil \(medium\)` | 内置风格标签（"模型里烤进去的小 LoRA"） |
| `retro artstyle` | 复古画风 |
| `pixel art` / `chibi` / `sd` | 像素 / Q 版 / super deformed |

**画面格式**

| 标签 | 含义 |
|---|---|
| `4koma` / `3koma` / `2koma` / `1koma` / `comic` / `manga` / `doujinshi` / `multiple views` | N 格漫画 / 漫画 / 同人本 / 多视角 |
| `character design sheet` / `reference sheet` / `expression chart` | 角色设定图 / 参考表 / 表情表 |
| `tachi-e` | 全身立绘（游戏用） |
| `border` / `letterboxed` / `pillarboxed` / `text focus` | 边框 / 上下黑边 / 左右黑边 / 文字为主 |

---

## 4. 安全等级与 NSFW 核心规则 ★

### 4.1 四级标签 ↔ Danbooru 分级对照

模型卡只列了四个词没解释。Danbooru `howto:rate` 给出了官方分级定义，对应关系如下：

| Anima 标签 | Danbooru 分级 | 含义（据 Danbooru 官方定义） | 典型画面 |
|---|---|---|---|
| `safe` | **General** | G 级，完全适合工作场合。无任何性化内容；只有卡通级暴力 | 穿着完整、日常场景、风景、Q 版、普通拥抱牵手、抽烟喝酒 |
| `sensitive` | **Sensitive** | Ecchi / 性感 / 暗示。暴露或紧身衣物、泳装、内衣、聚焦胸/臀/脚/腋下/肚脐、走光、透视装、隐晦的骆驼趾或遮盖乳头、暗示性的性玩具、轻度暴力 | 比基尼、高叉紧身衣、内衣、乳沟、裙底走光、湿身透出内衣 |
| `nsfw` | **Questionable** | 软核色情 / 暴力。**简单裸露（露乳头、露臀），但无性行为、无外露生殖器**；近似全裸、极端露出的衣物、透过衣物清晰可见的乳头/生殖器轮廓、轻度性接触（摸胸、咬耳）、暗示的性行为、未被使用的性玩具、捆绑 / 调教 / BDSM 等癖好（无可见性行为） | 裸体但双腿并拢、胸贴、`covered nipples`、`presenting own body`、捆绑 |
| `explicit` | **Explicit** | 硬核色情 / 极端血腥。**外露生殖器（无论是否打码）、明示性行为（口交、自慰、手交、指交、玩具）、体液（精液、爱液）、guro、scat** | 任何插入 / 口交 / 射精 / 露出性器官 |

> 关于 `nsfw`：在 Danbooru 上 `nsfw` 作为标签**已被弃用**（它等价于 `rating:q OR rating:e`）。Anima 把它当作独立的第三级；**推断**它对应 Questionable 档（官方未明说，依据是四级映射 + 下方 Volnovik 的描述）。
> Volnovik 技能给的简明版：`safe` = 工作场合安全；`sensitive` = 轻度暗示或非色情裸露；`nsfw` = **强烈性暗示但不露器官**；`explicit` = 完全露出的色情、露出生殖器、极端血腥【社区】。

### 4.2 选择规则

| 规则 | 说明 | 来源 |
|---|---|---|
| **只写一个等级** | 四个等级是"类别"不是"阶梯"。按画面里**最露骨的那个元素**选 | 社区（符合官方"appropriate safety tags"） |
| **绝不混用** | `safe` + 露骨内容 = 自相矛盾 → 出图发软 / 自动打码 / 器官画不出来 | 社区 |
| **不要高配也不要低配** | 露器官画面用 `nsfw` 同样偏软；只有暗示的画面用 `explicit` 会把它推得更露骨 | 社区 |
| **无法判断就不写等级** | 比如纯风景、抽象图 | 社区 |
| **不想要的等级放负向** | 官方："通过正向和负向中使用合适的安全标签来避免不想要的内容" | **官方** |
| **短提示词 = 危险** | 官方 Limitations 原文："模型可能生成不想要的内容，**尤其是提示词短或缺乏细节时**。用安全标签 + 写足够细的提示词来避免" | **官方** |

**SFW 用户的推荐写法**：正向开头 `masterpiece, best quality, score_7, safe,`；负向在标准基础上加 `nsfw, explicit`（必要时加 `sensitive`）。
**NSFW 用户的推荐写法**：正向按内容选 `sensitive` / `nsfw` / `explicit` 之一；负向放 `censored`（以及 `bar censor`、`mosaic censoring`），再放你不想要的**其它**等级（如做 `sensitive` 内容可在负向放 `explicit, nsfw` 防止越级）。

### 4.3 打码相关标签（NSFW 实战核心）

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
| **不放** | Volnovik 技能 | "想要无码就把 `censored` 放负向；**永远不要在正向写 `uncensored`**"。推测原因：0.6B 语言模型会把 `uncensored` 里的子串 `censored` 部分激活，反而诱发打码 |
| **可以放** | dskjal | 多个 explicit 示例正向写了 `uncensored`，并配合负向 `censored, bar censor` |

**结论**：主做法是**负向 `censored`**。`uncensored` 正向是否加分取决于版本/种子，用固定种子 A/B 测一下再决定。

### 4.4 "画面发软 / 自动打码"排错

| 现象 | 原因 | 处理 |
|---|---|---|
| 器官被头发/前景物/白光遮住 | 正向等级是 `safe`/`sensitive`，或没写等级 | 改成 `explicit` |
| 出现黑条/马赛克 | 正向误写了 `censored`，或负向没放 `censored` | 检查正向；负向加 `censored, bar censor, mosaic censoring` |
| 画面整体发糊、像隔了一层 | 等级与内容不匹配（自相冲突） | 只保留匹配的那一个等级 |
| 乳头发虚 | 误用了 `covered nipples`，或等级 `nsfw` 不够 | 删 `covered nipples`；改 `explicit` |
| 出现多余人物（"双胞胎"） | 单人提示词里描述了双侧对称特征 | 负向加 `twins`（Volnovik 推荐负向自带）【社区】 |

---

## 5. NSFW 标签词表（逐条含义标注）

> 来源：Danbooru tag group（经 anima-prompting 的 starter-tags 整理，帖子数 ≥300）+ dskjal 实战示例。全部按 Anima 规则写成小写空格形式。
> 用法提醒：**每个标签都是一个小 LoRA**，帖子数越多含义越刻板、越容易被画出来；罕用标签可能几乎无效。

### 5.1 表情（性相关）

| 标签 | 含义（Danbooru 官方释义） |
|---|---|
| `aroused` | 性唤起表情：脸红、呼吸急促、眼神迷离 |
| `seductive smile` | 媚笑、挑逗的笑 |
| `naughty face` | 淫荡/下流的表情（常伴吐舌、眯眼） |
| `ahegao` | アヘ顔。**夸张的高潮表情**：翻白眼 + 张嘴 + 吐舌，常伴脸红、流口水、出汗、双手比 V。也可表示疯狂/药物/窒息 |
| `torogao` | とろ顔。**陶醉、失神般的表情**：脸颊泛红、眉毛外侧下垂、眼睛半睁湿润、目光涣散、下巴放松、口水。比 ahegao 更"安静"。不一定是性（吃到美食也会） |
| `ohogao` | おほ顔。ahegao 的张嘴吐舌变体，更"失控" |
| `fucked silly` | 做到神志不清：体力耗尽、极度高潮后的恍惚或虚脱表情。**只用于比 hentai 标准还极端的场面**，一般 ahegao 够用就别用它 |
| `afterglow` | 事后余韵：满足、放松、慵懒的表情 |
| `rolling eyes` | 翻白眼 |
| `constricted pupils` | 瞳孔收缩（冲击、失神） |
| `heavy breathing` | 呼吸急促 |
| `drooling` | 流口水 |
| `nosebleed` | 鼻血（动漫式兴奋） |
| `mind break` | 精神崩溃（极端） |
| `doyagao` | どうが顔。自信/得意/坏笑的"大叔脸"，常与 `smug` 连用 |
| `double v` | 双手都比 V（ahegao 常见搭配） |
| `oral invitation` | 口交邀请（张嘴吐舌看向对方） |
| `condom in mouth` | 嘴里叼着避孕套 |
| `cum in mouth` | 嘴里有精液 |

### 5.2 身体 / 部位

| 标签 | 含义 |
|---|---|
| `nude` | 全裸 |
| `naked shirt` | 只穿衬衫不穿下装 |
| `naked apron` | 只穿围裙 |
| `topless` / `bottomless` | 上裸 / 下裸 |
| `breasts` | 胸部（通用） |
| `large breasts` / `medium breasts` / `small breasts` / `flat chest` / `huge breasts` / `gigantic breasts` | 大 / 中 / 小 / 平 / 巨 / 超巨 |
| `perky breasts` | **挺翘的胸**：自然向上翘（非聚拢内衣衬托），即 45:55 比例 |
| `breasts apart` | 两胸分开（不挤压） |
| `pressed breasts` / `squished breasts` / `hanging breasts` / `bouncing breasts` | 挤压 / 压扁 / 下垂 / 弹跳 |
| `pointy breasts` | 尖胸 |
| `nipples` | 乳头（可见） |
| `puffy nipples` | **肿胀凸起的乳晕/乳头** |
| `large areolae` / `small areolae` | 大 / 小乳晕 |
| `inverted nipples` | 内陷乳头 |
| `covered nipples` | **乳头被遮住**（头发、手、衣物、道具）——注意会连带"发虚" |
| `no nipples` | 不画乳头 |
| `partial nipple slip` / `nipple slip` | 乳头部分滑出 / 全部滑出 |
| `one breast out` | 单侧乳房露出 |
| `underboob` / `sideboob` / `cleavage` | 乳下 / 侧乳 / 乳沟 |
| `cleavage cutout` / `navel cutout` / `side cutout` / `hip cutout` | 露乳沟开窗 / 露肚脐开窗 / 露腰侧开窗 / 露胯开窗（衣物设计） |
| `ass` / `big ass` / `grabbing another's ass` | 臀 / 大臀 / 摸别人臀 |
| `anus` / `puckered anus` | 肛门 / 皱缩的肛门 |
| `pussy` / `spread pussy` / `cleft of venus` | 阴部 / 张开的阴部 / 只有一条缝的阴部（无细节） |
| `clitoris` | 阴蒂 |
| `pubic hair` / `trimming` / `landing strip` / `hair braid` | 阴毛 / 修剪过 / 一条线型 / 编成型 |
| `no pussy` | 不画阴部（遮挡） |
| `penis` / `erection` / `flaccid` | 阴茎 / 勃起 / 疲软 |
| `foreskin` / `phimosis` | 包皮 / 包茎 |
| `huge penis` / `gigantic penis` / `small penis` / `veiny penis` | 大 / 巨 / 小 / 青筋暴起 |
| `testicles` / `big testicles` | 睾丸 / 大睾丸 |
| `bulge` | 裤裆凸起 |
| `covered penis` / `erection under clothes` | 隔物可见的阴茎 / 衣物下的勃起 |
| `wide hips` / `thick thighs` / `thigh gap` / `dimples of venus` / `hip dips` | 宽胯 / 粗腿 / 腿缝 / 腰窝 / 胯部凹陷 |
| `navel` / `covered navel` | 肚脐 / 遮住肚脐（dskjal 常放负向以免肚脐总被遮） |
| `abs` / `linea alba` / `obliques` / `median furrow` | 腹肌 / 腹白线 / 腹斜肌 / 乳沟中线 |
| `armpits` / `licking armpit` / `armpit sex` | 腋下 / 舔腋 / 腋交 |
| `feet` / `soles` / `barefoot` / `toes` | 脚 / 脚底 / 赤脚 / 脚趾 |
| `skindentation` | **勒肉**：衣物太紧陷进皮肤、周围肉鼓出来（如过膝袜上方大腿溢出） |
| `sweat` / `wet` / `wet skin` / `oiled body` | 汗 / 湿 / 湿润皮肤 / 涂油身体——`wet` 是陷阱词（§7） |
| `tanlines` / `tan` / `one-piece tan` / `tattoo` / `body writing` | 晒痕 / 古铜 / 连体式晒痕 / 纹身 / 身体上写字 |
| `collar` / `choker` / `neck ribbon` / `leash` / `collarbone` | 项圈 / 颈环 / 颈丝带 / 牵引绳 / 锁骨 |
| `lactation` / `breastfeeding` / `milking machine` / `breast pump` | 泌乳 / 哺乳 / 挤奶机 / 吸奶器 |
| `pregnant` / `impregnation` / `giving birth` | 怀孕 / 受孕（含示意）/ 分娩 |
| `cervix` / `uterus` / `x-ray` / `cross-section` / `internal cumshot` | 子宫颈 / 子宫 / 透视 / 断面图 / 内射断面示意——用于"剖面可见"的画法 |
| `stomach bulge` / `cum inflation` / `big belly` | 插入导致的腹部凸起 / 精液灌胀 / 大肚子 |
| `extra breasts` / `extra penises` / `extra arms` | 多胸 / 多阴茎 / 多臂 |
| `conjoined` | 连体 |
| `amputee` / `guro` | 截肢 / 血腥猎奇（极端，不建议） |

### 5.3 衣物状态

| 标签 | 含义 |
|---|---|
| `clothed sex` | 穿着衣服做爱（最常见形态之一） |
| `clothed female nude male` / `clothed male nude female` | 女穿男裸 / 男穿女裸。前者常暗示 femdom（别名 `cfnm`） |
| `clothed female nude female` | 一女穿衣一女裸（dskjal 示例用法） |
| `under clothes` / `over clothes` | 衣服里面 / 外面（如 `paizuri under clothes`） |
| `open clothes` / `open shirt` / `clothes lift` / `lifted by oneself` | 敞开衣物 / 敞开衬衫 / 掀起衣物 / 自己掀起 |
| `pull` / `pants pull` | 把（裤子等）往下拉一点。**`downpants` 是"从裤腰往里看"，别混** |
| `panties aside` | 内裤拨到一边 |
| `panties pulled down` | 内裤脱到下面 |
| `内衣` 系列：`panties` `bow panties` `thong` `g-string` `side-tie panties` `lace-trimmed panties` `string panties` `lowleg panties` `bike shorts` `boy shorts` `safety shorts` | 各种内裤——dskjal 把 `thong, lowleg, g-string` 放负向避免跑偏 |
| `bra` `bra pull` `bra through` `unhooked bra` `side-tie bra` `braless` | 胸罩各类 / 无胸罩 |
| `lingerie` `babydoll` `negligee` `garter belt` `fishnet` `bodystocking` `bodysuit` `corset` `bustier` | 情趣内衣 / 吊带睡裙 / 吊袜带 / 渔网 / 连体渔网袜 / 连体紧身衣 / 束腰 / 紧身胸衣 |
| `highleg` | **高叉**：泳衣/紧身衣/内裤胯部裁剪很高的款式 |
| `highleg bikini` / `highleg leotard` / `slingshot swimsuit` / `micro bikini` / `string bikini` / `sling bikini` | 高叉比基尼 / 高叉紧身衣 / 弹弓泳衣（只有两条带子）/ 微型比基尼 / 细绳比基尼 |
| `leotard` / `bunny girl` / `playboy bunny` / `school swimsuit` / `competition swimsuit` / `race queen` / `nurse` / `maid` / `sailor collar` / `serafuku` | 紧身衣 / 兔女郎 / 花花公子兔女郎 / 学校泳衣 / 竞技泳衣 / 赛车女郎 / 护士 / 女仆 / 水手领 / 水手服 |
| `see-through` / `wet clothes` / `see-through clothes` | 透视 / 湿衣 |
| `impossible clothes` / `impossible underwear` | 物理上不可能穿得住的衣服——**常放负向** |
| `wardrobe malfunction` | 走光（衣物意外滑落露出） |
| `strap slip` | 肩带滑落（Volnovik 示例用法） |
| `skindentation` | 勒肉（同 5.2） |
| `detached sleeves` / `detached collar` / `gloves` / `elbow gloves` / `thighhighs` / `pantyhose` / `knee socks` / `lace-trimmed legwear` | 分离袖 / 分离领 / 手套 / 长过肘手套 / 过膝袜 / 连裤袜 / 及膝袜 / 蕾丝边袜 |
| `apron` / `maid apron` / `frilled apron` | 围裙 |
| `necktie` / `collared shirt` / `dress shirt` / `sweater` / `cardigan` / `blazer` / `vest` / `turtleneck` / `sailor dress` / `school uniform` / `suit` / `id card` | 常规服装 |
| `cosplay` | **陷阱**：角色扮演成**另一作品的角色**，不是"穿件衣服"（§7） |

### 5.4 性行为（按类型）

> 全部属于 `explicit` 等级（除标注外）。

| 标签 | 含义 |
|---|---|
| `sex` | 性行为（通用） |
| `vaginal` | 阴道交 |
| `anal` | 肛交 |
| `sex from behind` | 后入（背后位） |
| `doggie style` | 后入跪姿（dskjal 用法；Danbooru 规范拼写以 Gelbooru 为准） |
| `missionary` | 传教士位 |
| `cowgirl position` / `reverse cowgirl position` | 骑乘位 / 反向骑乘位 |
| `standing split` / `standing sex` | 站立抬腿 / 站立性交 |
| `suspended congress` | 抱悬式 |
| `leg lock` / `leg up` / `legs up` / `knees to chest` | 锁腿 / 抬腿 / 双腿举起 / 膝盖贴胸 |
| `held up` | 被抱起 |
| `clothed sex` | 穿衣做爱 |
| `rough sex` | 激烈性爱 |
| `happy sex` | 双方愉快的性爱 |
| `consensual` | 双方自愿（Tag 组） |
| `fellatio` | 口交（吮吸） |
| `irrumatio` | 插入对方口腔（男方主动） |
| `deepthroat` | 深喉 |
| `autofellatio` | 自吮 |
| `cunnilingus` | 舔阴 |
| `anilingus` | 舔肛 |
| `69` / `upright 69` | 六九 / 站立六九 |
| `handjob` | 手交 |
| `double handjob` / `cooperative handjob` / `two-handed handjob` / `reach-around` / `nursing handjob` | 双手交两人 / 合作手交 / 双手手交 / 从背后绕过去 / 边哺乳边手交 |
| `fingering` / `anal fingering` / `vaginal object insertion` / `anal object insertion` | 指交 / 肛门指交 / 阴道异物 / 肛门异物 |
| `fisting` / `anal fisting` | 拳交 / 肛门拳交 |
| `masturbation` / `female masturbation` / `male masturbation` / `mutual masturbation` | 自慰 / 女自慰 / 男自慰 / 相互自慰 |
| `masturbation through clothes` / `under clothes` | 隔衣自慰 / 衣内自慰 |
| `dildo` / `vibrator` / `sex toy` / `public vibrator` / `sybian` | 假阳具 / 振动棒 / 情趣玩具 / 公共场合用振动棒 / 骑乘式机器 |
| `paizuri` | 乳交 |
| `cooperative paizuri` / `handsfree paizuri` / `paizuri under clothes` / `naizuri` | 对方配合乳交 / 不用手乳交 / 衣内乳交 / 贫乳乳交 |
| `pecjob` | 胸肌乳交（男同） |
| `footjob` / `footjob with footwear` / `reverse footjob` | 足交 / 穿鞋足交 / 反向足交 |
| `thigh sex` / `legjob` / `kneepit sex` | 腿交 / 腿部摩擦 / 膝窝性交 |
| `armpit sex` / `armpit job` | 腋交 |
| `hairjob` / `hair on penis` | 发交 |
| `tailjob` / `tail insertion` / `wingjob` | 尾巴 / 翅膀 |
| `pussyjob` / `buttjob` / `backjob` | 阴部摩擦 / 臀部摩擦 / 背部摩擦 |
| `glansjob` | 龟头摩擦 |
| `frottage` | 身体摩擦（无插入） |
| `dry humping` | 隔衣摩擦 |
| `groping` / `grabbing another's breast` / `grabbing another's ass` / `crotch grab` / `grabbing own breast` | 乱摸 / 摸胸 / 摸臀 / 抓裆 / 自摸 |
| `nipple tweak` / `nipple pull` / `nipple torture` / `nipple clamps` | 捻乳头 / 拉乳头 / 虐乳 / 乳头夹 |
| `breast sucking` / `nipple sucking` | 吸胸 / 吸乳头 |
| `kiss` / `deep kiss` / `licking` / `biting` | 吻 / 湿吻 / 舔 / 咬 |
| `tribadism` | 磨镜（女女阴部摩擦） |
| `penises touching` | 阴茎相触（男男） |
| `sumata` | 膝枕腿交（用膝盖窝夹住） |

### 5.5 前 / 后 / 暗示（sensitive～nsfw 级别的常用项）

| 标签 | 含义 |
|---|---|
| `presenting own body` | **展示自己身体**：以性暗示方式露出或强调身体某部位，常是邀请或挑逗 |
| `presenting own pussy` / `presenting own ass` / `presenting own anus` / `presenting own breasts` / `presenting own arm` / `presenting own armpit` / `presenting own foot` | 展示各部位 |
| `presenting another's body` | 展示别人（第三方视角） |
| `take your pick` | 多个角色一起展示供挑选 |
| `imminent penetration` | **即将插入**：还没插入但马上就要。只用于裸体；穿衣用 `dry humping` / `bulge to ass` |
| `imminent vaginal` / `imminent anal` | 即将阴道插入 / 肛门插入 |
| `guided penetration` | 用手引导插入 |
| `just the tip` | 只进去一点 |
| `implied sex` | 暗示发生了性行为（画面本身可能不露骨） |
| `after sex` | 事后 |
| `after vaginal` / `after anal` / `after fellatio` / `after paizuri` | 各类事后 |
| `clothed after sex` | 穿衣事后 |
| `afterglow` | 事后余韵表情 |
| `simulated fellatio` / `simulated footjob` | 模拟口交 / 足交（道具或手势） |
| `fellatio gesture` / `oral invitation` / `penetration gesture` | 口交手势 / 口交邀请 / 插入手势 |
| `stealth sex` / `stealth masturbation` / `public indecency` / `public nudity` / `zenra` | 偷偷做 / 偷偷自慰 / 公然猥亵 / 公然裸露 / 全裸（日语借词） |
| `caught` / `peeking` / `walk-in` | 被撞见 / 偷窥 / 推门撞见 |
| `voyeurism` / `exhibitionism` | 偷窥癖 / 暴露癖 |
| `chikan` | 痴汉（电车等场合） |
| `molestation` / `sleep molestation` | 猥亵 / 睡眠猥亵 |
| `implied rape` / `imminent rape` / `rape` | 强奸相关（**非自愿内容**，多数平台禁止或限制） |
| `incest` / `twincest` / `inseki` | 乱伦 / 双胞胎乱伦 / 继亲乱伦 |
| `netorare` / `reverse netorare` / `cheating` | NTR / 逆 NTR / 出轨 |
| `prostitution` | 卖淫 |
| `defloration` / `deflower` | 破处 |
| `smell` / `smelling` / `smelling clothes` | 气味相关 |
| `dirty talk` / `requesting internal cumshot` | 脏话 / 请求内射 |
| `condom` / `used condom` / `used condom on penis` / `condom left inside` | 避孕套 / 用过的 / 戴着用过的 / 留在体内 |
| `ahegao` 等 | 见 5.1 |

### 5.6 体液

| 标签 | 含义 |
|---|---|
| `cum` | 精液（通用） |
| `cum in pussy` | 阴道内射精（常与 `creampie` / `nakadashi` 同义） |
| `cum in ass` | 肛内射精 |
| `cum in mouth` / `cum in throat` | 口内 / 喉内 |
| `cum on face` / `facial` | 颜射 |
| `cum on body` / `cum on breasts` / `cum on stomach` / `cum on ass` / `cum on back` / `cum on armpits` / `cum on feet` / `cum on hair` / `cum on clothes` / `cum on eyewear` / `cum on tongue` | 射在各部位 |
| `cum in navel` | 肚脐里 |
| `cum in urethra` | 尿道内 |
| `cum in cup` / `cum on food` / `gokkun` | 杯里 / 食物上 / 饮精 |
| `bukkake` | 多人颜射/体射 |
| `cumdump` | 精液容器（极端） |
| `cumdrip` / `cum puddle` | 精液滴落 / 精液水洼 |
| `ejaculation` | 射精（动作） |
| `ejaculating while penetrated` | 被插入时射精 |
| `pull out` | 拔出 |
| `internal cumshot` | 内射（含断面示意） |
| `female ejaculation` / `pussy juice` / `squirt` | 潮吹 / 爱液 |
| `suggestive fluid` | 暗示性体液（不明液体） |
| `sweat` / `saliva` / `tears` / `blood` | 汗 / 唾液 / 泪 / 血 |
| `peeing` / `golden shower` / `drinking pee` | 排尿类（极端） |
| `scat` | 排泄（极端，不建议） |

### 5.7 多人 / 群交

| 标签 | 含义 |
|---|---|
| `threesome` | 3P |
| `mmf threesome` / `ffm threesome` / `mmm threesome` / `fff threesome` / `fdd threesome` / `ffd threesome` | 男男女 / 女女男 / 男男男 / 女女女 / 扶他组合 |
| `foursome` / `fivesome` | 4P / 5P |
| `group sex` / `orgy` | 群体性交 / 群交 |
| `gangbang` | 轮奸（多人对一人） |
| `double penetration` / `triple penetration` | 双插 / 三插 |
| `double vaginal` / `double anal` | 双根入阴 / 双根入肛 |
| `spitroast` / `reverse spitroast` | 前后同时（一前一后）/ 反向前后 |
| `daisy chain` | 菊花链（首尾相接） |
| `oral sandwich` | 口交三明治 |
| `teamwork \(sexual\)` | 合作口交/手交 |
| `multiple penises` / `multiple boys` | 多根 / 多男 |
| `faceless` | **无面男**：男性角色不画面部（常见于 "ugly bastard" 题材） |
| `ugly bastard` | **丑男**：年龄大/肥胖/秃顶的男性，通常与可爱女性配对（hentai 题材标签） |
| `multiple views` | 多视角（同一画面展示多个角度） |
| `cross-section` / `x-ray` | 断面图 / 透视 |

### 5.8 同性 / 扶他 / 性别相关

| 标签 | 含义 |
|---|---|
| `yuri` | 百合（女女） |
| `implied yuri` | 暗示百合 |
| `tribadism` | 磨镜 |
| `yaoi` | 男男 |
| `implied yaoi` / `penises touching` / `bara` | 暗示男男 / 阴茎相触 / 蔷薇（肌肉男同） |
| `futanari` | 扶他（有胸有阴茎，可能有阴道） |
| `implied futanari` | 暗示扶他 |
| `full-package futanari` | 全套扶他（阴茎+睾丸+阴道） |
| `futa without pussy` / `newhalf with female` / `newhalf with male` | 无阴道扶他 / 人妖与女 / 人妖与男 |
| `futa with female` / `futa with futa` / `futa on male` / `male on futa` / `futa with male` | 扶他与女 / 扶他与扶他 / 扶他上男 / 男上扶他 / 扶他与男 |
| `cuntboy` / `cuntboy with male` | 男形女体（有阴道无阴茎的男性体） |
| `crossdressing` / `crossdressing \(mtf\)` / `crossdressing \(ftm\)` | 异装 / 男扮女 / 女扮男 |
| `trap` / `reverse trap` | 伪娘 / 伪男 |
| `josou seme` | 女装攻 |
| `power bottom` / `futasub` | 强势受 / 扶他受 |
| `assertive female` / `dominatrix` / `femdom` | 主动女 / 女王 / 女性支配 |

### 5.9 杂项癖好 / 情境

| 标签 | 含义 |
|---|---|
| `bdsm` | BDSM |
| `bondage` / `rope` / `shibari` / `bound together` / `self bondage` / `breast bondage` / `predicament bondage` / `spreader bar` / `suspension` | 捆绑 / 绳 / 日式绳缚 / 捆在一起 / 自缚 / 胸部绑缚 / 强制姿势绑缚 / 张腿杆 / 悬吊 |
| `pillory` / `stationary restraints` / `hanging breasts` / `collar` / `leash` / `leash pull` | 枷 / 固定拘束具 / 悬垂乳 / 项圈 / 牵引绳 / 拉绳 |
| `gag` / `ball gag` / `bit gag` / `ring gag` / `tentacle gagged` | 口塞各类 |
| `blindfold` | 眼罩 |
| `asphyxiation` / `strangling` / `strangling with hair` | 窒息 / 勒 / 用头发勒 |
| `humiliation` / `body writing` / `public use` / `tally` | 羞辱 / 身体写字 / 公共使用 / 正字计数 |
| `masochism` / `sadism` / `slave` / `pet play` / `human dog` / `pony play` | 受虐 / 施虐 / 奴隶 / 宠物扮演 / 人犬 / 人马 |
| `spanked` / `torture` / `ball busting` / `tickle torture` | 打屁股 / 折磨 / 踢裆 / 挠痒 |
| `diaper` / `adult baby` | 尿布 / 成人婴儿 |
| `exhibitionism` / `public use` / `human furniture` / `human toilet` | 暴露 / 公共使用 / 人体家具 / 人体厕所（极端） |
| `glory hole` | 寻欢洞 |
| `nyotaimori` / `wakamezake` / `bust cup` | 女体盛 / 人体酒 / 胸杯 |
| `smother` | 窒息压制（用身体部位压住脸） |
| `vore` | 吞噬（极端） |
| `bestiality` / `animal penis` / `knotting` | 人兽（极端，多数平台禁止） |
| `necrophilia` | 恋尸（极端，多数平台禁止） |
| `loli` / `shota` | **萝莉 / 正太——存在于此词表，但不应使用：** 多数司法辖区将性化未成年人的内容视为违法，各平台（Civitai、TensorArt、mage 等）均禁止。本报告不提供用法 |
| `mature female` / `mature male` | 成熟女性 / 成熟男性（与 loli/shota 相对，**用来明确成年**） |
| `muscular` / `muscular female` / `muscular male` / `plump` / `curvy` / `fat` / `obese` / `skinny` / `giantess` / `minigirl` | 肌肉 / 肌肉女 / 肌肉男 / 丰满 / 曲线 / 肥 / 肥胖 / 瘦 / 巨女 / 迷你女 |
| `tentacles` / `tentacle sex` / `consensual tentacles` / `mechanical tentacles` / `penis tentacle` / `too many tentacles` | 触手 / 触手性交 / 自愿触手 / 机械触手 / 阴茎触手 / 过多触手 |
| `breast expansion` / `breast smother` | 乳房膨胀 / 乳间窒息 |
| `selfcest` | 自交（与自己的复制品） |
| `versatile slime penetration` | 史莱姆入侵（罕用） |

### 5.10 极端标签（仅列出供识别，不提供用法）

`guro`（血腥猎奇）、`scat`、`peeing`、`vore`（吞噬）、`bestiality`、`necrophilia`、`amputee`、`snuff`、`ryona`（凌虐）等。这些标签在 Danbooru/Gelbooru 词表中存在，模型"认识"，但：

- 各平台（Civitai、TensorArt、mage、KusArt 等）均禁止或严格限制；
- 涉及未成年人的性化内容在绝大多数司法辖区违法；
- 即便本地生成，也建议只在法律允许范围内使用。

---

## 6. 负向提示词（各版本对照 + 逐词含义）

### 6.1 各来源推荐负向

| 来源 | 负向 | 适用 |
|---|---|---|
| **官方模型卡**【官方】 | `worst quality, low quality, score_1, score_2, score_3, artist name, blurry, jpeg artifacts, chromatic aberration` | Base（CFG 4–5） |
| **ComfyUI 官方模板**【官方】 | `worst quality, low quality, score_1, score_2, score_3, blurry, jpeg artifacts, sepia` | Base + Turbo LoRA（注意：开 Turbo 后 CFG 1，负向无效） |
| Volnovik（社区） | `worst quality, low quality, score_1, score_2, score_3, artist name, jpeg artifacts, censored, signature, twins, chromatic aberration` | Base；Aesthetic 版去掉 score 项 |
| dskjal NSFW 向（社区） | `@画师, censored, upper teeth only, 3d, sketch, flat color, bar censor, worst quality, low quality, score_1, score_2, score_3, score_4, blurry, jpeg artifacts, sepia, watermark, logo, text, shaded face, blacklighting, english text, engrish text, chinese text, korean text` + `bad anatomy, bad hands, missing fingers, extra digits, fewer digits, artistic error` | Base，explicit 内容 |
| Mage 平台预置 | `worst quality, low quality, 低 score 标签, early, old, blurry, jpeg artifacts, artist name, text bubble, speech bubble, + 手部/解剖错误` | mage.space（用户只需补 `chromatic aberration` 等） |

> 注意：官方两套负向**都没有** `censored`——做 NSFW 时需要自己加。Volnovik 和 dskjal 的版本都带了 `censored`。

### 6.2 逐词含义

| 负向词 | 含义 | 为什么放负向 |
|---|---|---|
| `worst quality` / `low quality` | 人工评分最低两档 | 压低质量 |
| `score_1` `score_2` `score_3` `score_4` | Pony 美学评分最低档 | 压低美学分；Aesthetic 版**不用** |
| `artist name` | 画面上出现画师署名 | 避免签名/水印。与正向 `@画师` 不冲突 |
| `signature` / `watermark` / `logo` / `text` | 签名 / 水印 / 商标 / 文字 | 同上 |
| `blurry` | 模糊 | 避免糊图 |
| `jpeg artifacts` | JPEG 压缩伪影 | 避免压缩感 |
| `chromatic aberration` | 色差（红蓝边） | 避免镜头色差；做“后处理堆料”效果时才正向用 |
| `sepia` | 棕褐色调 | 避免整体泛黄 |
| `censored` / `bar censor` / `mosaic censoring` | 打码 / 黑条 / 马赛克 | **去码核心** |
| `twins` | 双胞胎 | 避免"一个人画成两个"（Volnovik） |
| `3d` | 3D 渲染风 | 避免跑成 3D |
| `sketch` / `oekaki` | 草图 / 涂鸦板风 | 避免线稿化 |
| `flat color` | 无阴影平涂 | 避免过于扁平（追扁平风时**不要**放） |
| `monochrome` / `greyscale` | 黑白 / 灰度 | 避免灰度图（追黑白风时**不要**放） |
| `shaded face` | 脸部阴影 | 避免脸发黑 |
| `blacklighting` | 逆光下的黑色阴影处理 | 避免脸发黑 |
| `upper teeth only` | 张嘴时只画上排牙 | 避免特定的“呆板张嘴” |
| `english text` / `engrish text` / `chinese text` / `korean text` | 画面文字为英 / 中式英语 / 中 / 韩文 | 放负向后拟声词会默认变成**日文**（dskjal） |
| `text bubble` / `speech bubble` | 文字框 / 对话框 | mage 预置；画漫画时**不要**放 |
| `early` / `old` | 早期年代画风 | mage 预置，强制现代画风；追复古时**不要**放 |
| `bad anatomy` / `bad hands` / `missing fingers` / `extra digits` / `fewer digits` / `artistic error` | 解剖错误 / 手崩 / 缺指 / 多指 / 少指 / 绘画错误 | 手崩时加 |
| `impossible clothes` / `impossible underwear` | 物理上不可能的衣物 | 避免衣物穿模 |
| `thong` / `lowleg` / `g-string` / `bow panties` | 丁字裤 / 低腰 / G 弦 / 蝴蝶结内裤 | dskjal 不想要的内裤款式，按喜好 |
| `covered navel` / `navel` | 遮住肚脐 / 肚脐 | dskjal 避免肚脐总被遮；按需 |
| `pov hand` | 第一人称手 | 避免多出一只手 |
| `motion lines` | 动作线 | 避免乱加效果线 |
| `white background` | 白底 | 避免白底 |
| `nsfw` / `explicit` / `sensitive` | 其它安全等级 | **SFW 用户防越级**；做 sensitive 内容时负向放 `explicit, nsfw` |
| `simple background` | 纯色背景 | **治白底**：背景总是一片白时加 |
| `painterly` | 厚涂 | 想要动画风时避免厚涂（dskjal 画风控制） |
| `anime coloring` / `anime screenshot` | 赛璐璐 / 动画截图风 | 想要插画风/2.5D 时避免动画化 |
| `@画师` 或作品名（如 `the simpsons`, `overwatch`, `apex legends`） | 不想要的画风 | **用负向对抗画风**：指定低画力画师或不喜欢的工作室风格，dskjal 称“非常稳定” |
| `backlighting` | 逆光 | 避免脸部过暗（dskjal 示例） |

### 6.3 负向使用原则

1. **第一轮不要填负向**，先看裸提示词出什么问题，再针对性加（Volnovik）。
2. 但**先检查标准负向会不会破坏你的场景**（比如追黑白风却负向里有 `monochrome`）。
3. 不要堆 SDXL 时代那套一两百词的负向——Anima 对负向敏感，过大的负向会抹掉细节或引入意外偏移（Rainmaker666）。
4. **Turbo / CFG 1 下负向无效**；要用负向就 NegPip（`(worst quality:-1)` 语法，ComfyUI-ppm）或 NAG（ComfyUI-Anima-NAG）。
5. 负向里也可以写自然语言。

---

## 7. 陷阱标签（NSFW 相关重点）

| 词 | 在 Anima 里实际效果 | 常见误写 | 应该这样写 |
|---|---|---|---|
| `censored` | **打码条** | 在正向随手写 "keep it tasteful/censored" | **永远不放正向**；用安全等级标签；放负向去码 |
| `wet` | 皮肤/衣物**湿透反光、满是水珠** | 想表达"淋了雨" | 写 `rain`；只有确实要湿身效果才用 `wet` |
| `lace` | **整件衣服都是蕾丝** | 想要"领口一点蕾丝边" | 小面积用 `lace trim` |
| `cosplay` | 角色**扮演另一作品的角色** | 当作"穿服装" | 穿服装用 `costume` 或具体服装标签 |
| `1other` | **一个非人类角色** | 当成"一个人" | 人用 `1girl` / `1boy` |
| `high contrast` | 极端、色阶化的高反差风格，整张图被它定义 | 想要"色彩鲜明" | 写具体颜色或 `red theme` 等颜色主题标签 |
| `anime` | 锚定动画截图风 | 句子里写 "anime style" | 不写；画风用 `@画师` 或风格标签 |
| `lineart` / `line art` | **只有黑线、没有上色** | 想表达"线条干净" | 想要线稿才用 `lineart`（一个词） |
| `monochrome` | **黑白图** | 想表达"低饱和" | `muted color` / `pastel colors` |
| `blurry` / `depth of field` | 特定的虚化/景深效果 | "soft focus" | 用句子说明哪里清晰、哪里虚化 |
| `colorful` | 一个特定的高饱和配色标签 | "colorful background" | 写出具体颜色 |
| `anime screenshot` | 截图式构图 | 想要"电影感" | 用构图标签 `wide shot` / `from below` / `dutch angle` |
| `simple background` | 纯色背景 | 以为是“简洁背景” | 想要丰富背景就写具体内容 + `scenery` / `detailed background` |
| `covered nipples` / `covered navel` | 遮住乳头 / 肚脐 | 不小心混入 | 要露就删掉；要含蓄就故意用 |
| `uncensored` | 无码（见 §4.3 争议） | — | 主做法是负向 `censored` |
| 画师名没加 `@` | 效果非常弱 | "in the style of huke" | `@huke` |
| `face-to-face` | 会对齐两人头部位置 → 一方被“幼化” | 多人场景 | 用 `eye contact` 或自然语言写位置 |

---

## 8. 标签传染与多人场景

### 8.1 传染是什么【社区】

**逗号隔开的标签影响力大，会扩散到画面里所有人。** 例：写 `A girl with red eyes,` → 另一个角色的眼睛也变红。dskjal 实测：`faceless fat bald ugly bastard` 这个描述完全不传染（好处），但 `v sign` 会传染，`looking to the left side` 不生效。

### 8.2 对策

| 方法 | 做法 | 效果 |
|---|---|---|
| **连带规则** | 给一个角色写了某属性（发色/瞳色/表情/姿势/衣服），就给**所有人**都写 | 必须。Volnovik 与官方模型卡都强调 |
| **`and` 法** | 自然语言里**用 `and` 代替逗号**：`A girl with red hair and blue eyes wearing beige sweater` | 明显缓解传染（dskjal） |
| **按阅读顺序写位置** | 先左到右、再上到下，一个角色一句 | 减少身份互换 |
| **每人一句 "X from Series"** | 角色名 + 长相写在同一句 | 长尾角色必须 |
| **用 `eye contact`** | 要两人面对面时 | 100% 生效（自然语言只有约 50%） |
| **`on the left` / `on the right` / `on the top left`** | 位置描述 | “比较有效”（dskjal）；`left side panel:` 格式对漫画分格有效 |

### 8.3 没有反义标签的传染

有些属性**没有对应的“没有”标签**，无法用负向抵消：
- `closed eyes` 没有 `open eyes` → 写 `brown eyes` 等瞳色标签能让眼睛睁开
- `nail polish` 没有“没涂指甲油” → 男性角色也会被涂
- `lipstick` 同理

### 8.4 其它多人注意

- **代词不可靠**：`He` / `She` / `the girl with white hair` 基本指错对象，一律写名字。
- **面积控制**：写得更详细的对象会画得更大。背景写得详细 → 人物变小；只详写一个角色 → 其它角色变小/变远/被裁。
- **3 个以上角色标签**：区分成功率“非常低”（dskjal 数十次重试）。
- **左右指定**：自然语言写面对面约 50% 正确；把两人描述顺序对调可到约 80%；`eye contact` 100%。
- **`face-to-face` 标签**会把两人头部位置对齐，导致其中一方被幼化——追成熟体型时避免。

---

## 9. 按版本调整

| 项目 | Base | Aesthetic | Turbo |
|---|---|---|---|
| 质量标签 | 建议加 `masterpiece, best quality` | 可留可不留 | 不需要（蒸馏时已烘入负向） |
| `score_*` | 可用（`score_7`） | **正负向都不要**（推向 slop） | 不需要 |
| 安全标签 | 四选一 | 四选一 | 四选一 |
| 负向 | 官方/Volnovik/dskjal 任一 | 去掉 score 项 | **无效**（CFG 1） |
| CFG | 4–5 | 4–5 | 1 |
| 步数 | 30–50 | 30–50 | 8–12 |
| 采样器 | `er_sde`（默认）/ `euler_a` / `dpmpp_2m_sde_gpu` | `euler` 好 | `euler`（dskjal：`er_sde` 噪点多不推荐） |
| 多样性 | 最高 | 中 | 低（种子间变化小） |

**质量标签与画师风格的关系**【社区】：有质量标签时画师标签的画风固定会“漂移”；`score_9/8/7` 容易偏“海外画师风”。
- 想固定某画师风格 → **去掉质量标签**
- 想要动画感 → 去掉质量标签，加 `anime screenshot`
- 想要官方插画感 → 去掉质量标签，加 `official art` 或 `game cg`
- 想要厚涂 → 负向放动画系画师
- 想要 2.5D → 正向 `masterpiece`，负向 `anime coloring, anime screenshot`
- 想要插画风 → 正向 `masterpiece`，负向 `anime coloring, anime screenshot, 3d`

**画风控制的捷径**：负向放**低画力画师**或不喜欢的工作室作品名（`the simpsons`, `overwatch`, `apex legends`）→ dskjal 称“非常稳定”。

**CFG 1 下用负向**：NegPip（`pamparamm/ComfyUI-ppm`，语法 `(worst quality:-1)`，反转 V 矩阵）或 NAG（`hybskgks28275/ComfyUI-Anima-NAG`，正负 KV 相减）。

---

## 10. 实战模板

### A. SFW 单人（Base）

```
masterpiece, best quality, score_7, safe, 1girl, solo, long black hair, amber eyes, white sailor dress, red hair ribbon, gentle smile, standing, looking at viewer, upper body, outdoors, cherry blossoms, wind, sunlight, depth of field
```
负向：`worst quality, low quality, score_1, score_2, score_3, artist name, blurry, jpeg artifacts, chromatic aberration, nsfw, explicit`

### B. sensitive 级（泳装 / 高叉）

```
masterpiece, best quality, highres, sensitive, 1girl, solo, mature female, skinny, wide hips, silver hair, long hair, blue eyes, highleg bikini, skindentation, standing, contrapposto, looking at viewer, indoors, complex interior
```
负向：`worst quality, low quality, score_1, score_2, score_3, artist name, censored, jpeg artifacts, chromatic aberration, explicit, nsfw`

### C. explicit 级（dskjal 示例改，双人穿衣）

```
@画师, masterpiece, best quality, highres, explicit, uncensored, 1boy, 1girl, clothed female nude male, indoors, hotel room.

A faceless fat bald ugly bastard with grin wearing t-shirt is standing on the right side. He grabbed the girl's breast over shoulder and v sign with his right hand.

A embarrassed girl with perky breasts and puffy nipples is standing on the left side and looking to the left side. Her arms at sides.
```
负向：`censored, bar censor, mosaic censoring, upper teeth only, 3d, sketch, flat color, worst quality, low quality, score_1, score_2, score_3, blurry, jpeg artifacts, sepia, watermark, logo, text, shaded face, blacklighting, bad anatomy, bad hands, missing fingers, extra digits, fewer digits, artistic error`

### D. 多人不传染（`and` 法 + 连带规则）

```
masterpiece, best quality, nsfw, 2girls, clothed female nude female, complex interior, photo background.

A girl with silver long hair and blue eyes wearing highleg leotard with navel cutout is standing on the left.

A girl with brown medium hair and red eyes wearing highleg leotard with cleavage cutout is standing on the right.
```

### E. 漫画分格（位置标签）

```
@画师, highres, absurdres, sensitive, 3koma, multiple views, doujinshi, manga, comic, sound effects, speech bubbles, 2girls, beach, sand,

A girl with brown hair wearing a bikini with covered nipples and skindentation is holding a innertube, full body on the right.

A black hair girl and a brown hair girl are facing each other, profile on the top left.

The two girls make heart hands duo on the left bottom.
```
负向：`censored, bar censor, sketch, flat color, worst quality, low quality, score_1, score_2, score_3, blurry, jpeg artifacts, sepia, watermark, logo, text, shaded face, blacklighting, english text, engrish text, chinese text, korean text`

### F. "正在做"的露骨场景（dskjal 示例，姿势靠标签）

```
@画师, masterpiece, best quality, highres, 2girls, explicit, uncensored, futa with female, indoors, bed sheet, pillow, window, curtains, yuri, vaginal sex, cum in pussy.

// left
A naked girl with embarrassed and brown long hair and perky breasts and puffy nipples is lying on the left. Her left leg up vertically and her right leg is outstretched horizontally.

// right
A naked futanari girl with black long hair and perky breasts and grin and looking down is straddling on her right leg on the right. She is holding the brown haired girl's leg.
```
负向：`3d, white background, bar censor, worst quality, low quality, score_1, score_2, score_3, blurry, jpeg artifacts, sepia, watermark, logo, motion lines, text, flat color, shaded face, blacklighting`

> `//` 是 ComfyUI 的注释语法，该行不进入提示词。F 示例里的 `// left` 分段方式 dskjal 在用；但更稳妥的做法是用空行分段。

---

## 11. 排错清单

| 现象 | 先检查 |
|---|---|
| 器官被遮 / 画面发软 | 安全等级是否匹配（该用 `explicit` 却写了 `safe`/`sensitive`/`nsfw`）；正向是否误写 `censored`；是否误用了 `covered nipples` |
| 出现黑条 / 马赛克 | 正向是否写了 `censored`；负向是否放了 `censored, bar censor, mosaic censoring` |
| SFW 图里冒出裸露 | 正向是否写了 `safe`；提示词是否太短太笼统；负向是否放了 `nsfw, explicit` |
| 多出一个人（双胞胎） | 负向 `twins`；检查是否描述了双侧对称特征 |
| 一个角色的特征串到另一个 | 连带规则（所有人写全）；`and` 法；按阅读顺序写位置 |
| 两人位置不对 | 用 `eye contact`；调整描述顺序；`on the left/right` |
| 一方被幼化 | 是否用了 `face-to-face`；加 `mature female` |
| 男性也被涂指甲油/口红 | 没有反义标签，只能用句子明确写 "bare nails" 之类或接受 |
| 脸发黑 | 负向 `shaded face, blacklighting` |
| 整张图被吸成特定样子 | 对照 §7 陷阱表，句子里是否混入了普通英文单词恰好是标签 |
| 背景一片白 | 具体描述背景；加 `scenery` / `detailed background`；负向 `simple background` |
| 手崩 | 加步数/分辨率；负向 `bad anatomy, bad hands, missing fingers, extra digits, fewer digits, artistic error`；`ModelSamplingAuraFlow` shift ≥6 |
| 画师风格没出来 | 是否忘了 `@`；是否同时用了质量标签（去掉试试）；是否长尾画师（帖子太少） |
| 画风太“AI” | 去掉 `score_*`；去掉 `masterpiece, best quality`；换采样器 |
| 文字乱码 / 衣服上出现英文 | 负向 `text, english text, logo, watermark`；删掉可能被画上去的普通词 |
| 负向不生效 | 是否 Turbo/CFG 1；换 NegPip / NAG；或把想要的东西写进正向 |
| 提示词一长就不听话 | 精简到 15–30 个标签；分段（空行）；删掉形容词堆砌。机制见 §1.5：ComfyUI 不截断，是注意力稀释 |
| 灰度图 / 复古感不对 | 负向 `monochrome, greyscale`；检查 `newest, year 2025` 是否引发异常（dskjal 发现某例会变单色） |

---

## 12. 合规与风险提示

| 事项 | 说明 |
|---|---|
| 模型许可 | CircleStone Labs 非商业许可：**模型和衍生权重**只能非商业；**生成的图片可以商用**（卖图、约稿、商业项目概念图）。不可：收费 API、付费平台、嵌入收费产品 |
| NSFW 内容的法律边界 | 各国对色情内容（尤其涉及未成年人、非自愿、人兽、极端暴力）的法律不同，用户自行负责。**`loli` / `shota` 等性化未成年人的标签在任何情况下都不应使用** |
| 平台规则 | Civitai、TensorArt、mage、KusArt、IMGNAI 等托管平台各有审核规则；本地生成不受平台约束但受法律约束 |
| 画师标签 | 用 `@画师` 模仿在世画师风格存在伦理与版权争议；日本文化厅意见：画风本身不受版权保护，但 LoRA 文件和使用 LoRA 生成的图片**可能**构成侵权（dskjal 引用） |
| 数据集来源 | 主数据集 Gelbooru 抓取自各画师作品；用于学习的合法性在日本法下有“信息解析”例外条款，其它法域不同 |

---

## 13. 来源清单

**官方**
- 模型卡：https://huggingface.co/circlestone-labs/Anima
- Comfy Org 教程：https://docs.comfy.org/tutorials/image/anima/anima
- ComfyUI 官方模板：https://github.com/Comfy-Org/workflow_templates/blob/main/templates/image_anima_base_v1.json
- ComfyUI Anima 文本编码器源码：https://github.com/comfyanonymous/ComfyUI/blob/master/comfy/text_encoders/anima.py
- 官方 LoRA：https://huggingface.co/circlestone-labs/Anima-Official-LoRAs

**平台**
- Civitai 开发者文档（Anima recipe）：https://developer.civitai.com/orchestration/recipes/anima
- mage.space 指南：https://www.mage.space/models/anima/prompting-guide
- MooshieUI Wiki：https://mooshieui.com/wiki/anima-prompting
- SimpliGen：https://www.simpligen.io/prompting-guides/anima

**社区**
- Volnovik《ANIMA generation guide》合集：https://civitai.com/collections/17451195（Part 1: 33274，Part 2: 33315，**Part 4 Prompting: 33857**，Part 5 img2img: 34963）
- Volnovik `anima-prompting` 技能（含蒸馏指南、starter-tags、Danbooru 本地词库）：https://github.com/Volnovik/anima-prompting
- Rainmaker666《The Ultimate Anima Prompting Guidebook》：https://civitai.com/articles/35368
- F4nta5IA《How Your Prompt Breaks ANIMA》：https://civitai.com/articles/31399
- DXMPie《Anima Made Easy》：https://civitai.com/articles/37140
- dskjal《【NSFW 注意】ComfyUI で circlestone-labs の Anima を使う》（日文，NSFW 实战、标签传染、分词分析）：https://dskjal.com/deeplearning/circlestone-labs-anima
- Boredafk《Guide? (Or Musing?)+ Poll》：https://civitai.com/articles/31037

**词典**
- Danbooru 分级定义 `howto:rate`：https://danbooru.donmai.us/wiki_pages/howto:rate
- Danbooru `censored` / `uncensored` / `ahegao` / `torogao` / `fucked silly` / `perky breasts` / `skindentation` / `presenting own body` / `clothed female nude male` / `imminent penetration` 词条
- Danbooru tag group（sex acts / face tags / posture / body parts / image composition）
- Gelbooru：https://gelbooru.com（拼写以此为准）
- ANIMADEX（角色/画师查询）：https://animadex.net

---

## 附：对现有笔记的修改建议

1. `Anima生图学习报告.md` §7 资源表："作者提示词指南 | Civitai 文章 33857" → 改为 "**社区**提示词指南（Volnovik）| Civitai 文章 33857"。
2. 同文件 §4.3 安全标签行可补充："`nsfw` ≈ Danbooru Questionable 档（简单裸露、无性行为）；`explicit` = 露生殖器/性行为/体液"。
3. 同文件 §3 参数表 Turbo 行"负面提示词基本不起作用"可补充 NegPip / NAG 绕过方案。
