---
title: 让多人场景不串特征
stage: 2
order: 2
summary: "学完你能写出不串特征的多人场景，把空白背景填上，并按排错清单定位提示词的问题。"
levels: [L2]
days: [4]
promptTrack: true
prerequisites:
  - 01-03-prompt-basics
  - 02-01-l2-sweeps
nodes: []
tags:
  - 1girl
  - 2girls
  - solo
  - scenery
  - simple-background
  - detailed-background
  - eye-contact
  - closed-eyes
  - nail-polish
  - twins
  - face-to-face
  - shaded-face
  - text
  - monochrome
  - newest
deliverable: "一张不串特征的两人互动图（固定种子，用对照图验证过）。"
acceptance:
  - 能解释“标签传染”为什么会发生（逗号 + 空格 = 独立标签，影响力扩散到全图）
  - 两人场景里给所有角色都写了发色 / 瞳色等属性，特征没有串
  - 用 and 法、阅读顺序、eye contact 各做过一次对照
  - 解决过一次“背景一片白”
  - 用排错清单定位并修好过至少一个提示词问题，并在实验记录本里写下为什么
figures:
  - id: pm-contagion
    caption: "传染对照：逗号写法 vs and 法（红眼串到另一人 / 不串）"
    group: 多人
  - id: pm-order
    src: ../../assets/figures/pm-order.webp
    caption: "同一提示词，两人描述顺序对调前后"
    group: 多人
  - id: pm-eye-contact
    caption: "eye contact 标签 vs 自然语言“面对面”"
    group: 多人
  - id: pm-background
    src: ../../assets/figures/pm-background.webp
    caption: "背景一片白 vs 具体描述背景 / 加 scenery"
    group: 场景
  - id: pm-sheet
    src: ../../assets/figures/pm-sheet.webp
    caption: "角色设定图：character design sheet 的输出"
    group: 场景
transfers: false
sources:
  - badge: 社区
    url: https://civitai.com/articles/33857
    note: Volnovik 指南：连带规则、and 法（非模型作者）
  - badge: 社区
    note: dskjal 实测：eye contact 100%、左右指定约 50%、3 人以上成功率很低
  - badge: 官方
    url: https://huggingface.co/circlestone-labs/Anima
    note: 多角色“报名字 + 说长相”；数据集标签头
verified: 2026-11-24
---

## 标签传染

单人图稳了以后，多人互动是最常见的翻车点。一个角色的红眼会串到所有人身上，两个人的位置对调，背景一片白。

### 传染的原因

**逗号隔开的标签影响力大，会扩散到画面里的所有人。** 比如写了 `A girl with red eyes,`，另一个角色的眼睛也会变红。机制在提示词基础一课的“逗号后的空格”一节讲过。`标签, 空格` 这个组合本身就在告诉模型“这是一个独立标签”。独立标签的作用范围是整张图。社区实测，`faceless fat bald ugly bastard` 这类描述完全不传染，`v sign` 却会传染。

### 对策

| 方法 | 做法 | 效果 |
|---|---|---|
| 连带规则 | 给一个角色写了某属性（发色 / 瞳色 / 表情 / 姿势 / 衣服），就给所有人都写 | 必须。Volnovik 与官方模型卡都强调 |
| `and` 法 | 自然语言里用 `and` 代替逗号：`A girl with red hair and blue eyes wearing beige sweater` | 明显缓解传染 |
| 按阅读顺序写位置 | 先左到右、再上到下，一个角色一句 | 减少身份互换 |
| 每人一句 “X from Series” | 角色名和长相写在同一句 | 长尾角色必须 |
| 用 `eye contact` | 要两人面对面时用 | 标签 100% 生效，自然语言只有约 50% |
| `on the left` / `on the right` / `on the top left` | 位置描述 | “比较有效”；`left side panel:` 格式对漫画分格有效 |

### 没有反义标签的传染

有些属性没有对应的“没有”标签，负向里没法抵消。

- `closed eyes` 没有 `open eyes`。写 `brown eyes` 这类瞳色标签，能让眼睛睁开。
- `nail polish` 没有“没涂指甲油”的标签，男性角色也会被涂。
- `lipstick` 同理。

### 其它注意事项

- 代词不可靠。`He`、`She`、`the girl with white hair` 基本都会指错对象，一律写名字。
- 面积控制：**写得更详细的对象会画得更大。** 背景写得详细，人物就变小；只详写一个角色，其它角色会变小、变远或者被裁掉。
- 3 个以上角色，区分成功率“非常低”。
- 左右指定用自然语言写面对面，约 50% 正确。把两人的描述顺序对调，可以到约 80%。用 `eye contact` 标签是 100%。
- `face-to-face` 标签会把两人的头部位置对齐，导致其中一方被幼化。追成熟体型时避免。

## 场景与风格

背景总是一片空白，是因为语料里 `simple background` 占比很高，这是最常见的翻车点。具体描述背景的内容、光线和纵深，或者加标签 `scenery`、`detailed background`；负向里可以放 `simple background`。

想要角色设定图，用这一串：

```
character design sheet, front and side views, expression sheet, multiple views of the same character, ...
```

booru 没收录的概念，可以自己造标签式的短语，比如 `high twintails`。Anima 对这种“伪标签”的容忍度比 SD1.5 / Pony / Illustrious 高。别造到离谱，`85mm anime cinematic lens` 这种就不行。

想出油画、抽象、概念艺术这类非动漫风格，在提示词最开头写数据集标签并换行。第二行可选一个标题，第三行开始写描述：

```
deviantart
Flame
Digital painting of a fiery dragon with glowing yellow eyes, black horns, and a long, sinuous tail, perched on a glowing, molten rock formation. The background is a gradient of dark purple to orange.
```

标签不必堆全。训练时做了随机标签丢弃，所以种子之间的差异也很大。

## 提示词排错清单

出图不满意先查这里。每一行都是一个“先检查”，不是“加参数”。

| 现象 | 先检查 |
|---|---|
| 多个种子都出同一个毛病 | 是某个标签的数据集偏见，不是运气。换标签，或把它放进负向 |
| 画风不对 | 质量标签用法、Aesthetic 上是否误用了 `score_*`、采样器 |
| 画师风格没出来 | 是否忘了 `@`，没加效果很弱；是否同时用了质量标签，去掉试试；是否长尾画师 |
| 整张图被吸成某种特定样子 | 对照[陷阱标签](/tags/#陷阱标签)，句子里是否混入了普通英文单词恰好是标签 |
| 画面上出现签名 / 水印 / 乱码文字 | 负面保留 `artist name`，可再加 `signature`, `watermark`, `text`, `logo`；检查正向里是否有会被画到衣服上的普通词 |
| 某概念“不认识” | 可能只是 booru 没这个标签，试试伪标签 |
| 自然语言不生效 | 句数够不够（≥ 2）、是否一词多义、角色名大小写、每个细节是否绑定到角色 |
| 非动漫画面往动漫跑 | 加 `ye-pop` / `deviantart` 数据集标签头 |
| 角色画错或缺特征 | 给所有角色补上发型 / 发色 / 瞳色标签 |
| 背景是一片白 | 具体描述背景或加 `scenery` |
| 手崩 | 补手部细节标签（`own hands together`, `hand up` 等）；提示词解决不了的留给图生图 / 局部重绘（阶段 3–4） |
| 衣服上冒出无意义的英文单词 | 模型会把普通词画到空白衣物上，把那个词删掉 |
| 多出一个人（“双胞胎”） | 负向 `twins`；检查是否描述了双侧对称特征 |
| 一个角色的特征串到另一个 | 连带规则，所有人写全；`and` 法；按阅读顺序写位置 |
| 两人位置不对 | 用 `eye contact`；调整描述顺序；`on the left/right` |
| 一方被幼化 | 是否用了 `face-to-face`；加 `mature female` |
| 男性也被涂指甲油 / 口红 | 没有反义标签，只能用句子明确写 “bare nails” 之类，或接受 |
| 脸发黑 | 负向 `shaded face, blacklighting` |
| 画风太“AI” | 去掉 `score_*`；去掉 `masterpiece, best quality`；换采样器 |
| 负向不生效 | 是否 Turbo / CFG 1；或把想要的东西写进正向 |
| 提示词一长就不听话 | 精简到 15–30 个标签；分段（空行）；删掉形容词堆砌。机制：ComfyUI 不截断，是注意力稀释 |
| 灰度图 / 复古感不对 | 负向 `monochrome, greyscale`；检查 `newest, year 2025` 是否引发异常 |

更多现象见[排错速查](/troubleshooting/)，每一条都按先调、再调、不要的顺序写。

## 提示词练习

用上一课的扫描工作流做一组对照：固定 seed，先用逗号写法出一张，再用 `and` 法出一张。最后调换两人的描述顺序出一张，三张用图像表格拼成对照。把哪张对、为什么记进实验记录本。

提示词用 2 人互动场景，练“名字、长相、位置”的写法和连带规则，顺带练背景描述。目标是稳定出一张不串特征的多人图。“雨天的电车站台”这条贯穿想法可以做成两人版本，正好看背景和面积控制的效果。
