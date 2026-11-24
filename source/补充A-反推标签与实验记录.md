# 补充A：反推标签（Tagger）与实验记录

> 面向对象：读完《Anima提示词总结报告》后，面对一张喜欢的图不知道该用哪些标签描述；以及调参时出了好图却记不清当时改了什么。
> 调研时间：2026 年 11 月。来源标注：【官方】【源码】【社区】。
> 配套：《提示词报告》§2 书写规则、§3 标签表、§7 陷阱标签；《递进报告》§0.3 纪律、L2 参数扫描。

## 0. 一页速览

| 问题 | 答案 |
|---|---|
| 标签表几百条背不下来怎么办 | 不背。拿参考图跑 **tagger**，看"这个视觉特征对应哪个标签"，再回 Danbooru wiki 看图确认 |
| 用哪个 tagger | ComfyUI 自定义节点 `ComfyUI-WD14-Tagger`（pythongosssss，Manager 可装）；模型选 SmilingWolf 的 WD Tagger v3 系列（如 `wd-eva02-large-tagger-v3`）或 v2 系列 |
| tagger 输出能直接当提示词吗 | 不能照抄。它是"图里有什么"的全量清单（含 `1girl` `solo` `looking_at_viewer` `highres`…），当作**候选词表**，按《提示词报告》§3 的四段式挑 15~30 个重写 |
| 为什么输出带下划线 | tagger 给的是 Danbooru 原始写法 `long_hair`；写进 Anima 提示词前要换成空格（§2 规则 1） |
| 实验怎么记 | PNG 里嵌的工作流能还原"当时怎么连的"，但还原不了"为什么这么改、哪张更好"。用本附的模板，**每次只记变量和结论**，一天 10 行 |

## 1. 反推标签：把"看着像"变成"叫什么"

### 1.1 为什么这是学标签最快的路

Anima 的标签体系来自 Danbooru / Gelbooru，每个标签都有 wiki 页（定义、别名、示例图）。但"我想要她那种发型 → 这叫 `hime cut` 还是 `curtained hair`"这类问题是反向的，查表很慢；让 tagger 直接告诉你答案，是正向的。顺带它也是校验工具：把自己的成图丢进去，看模型"觉得"图里多了什么。

### 1.2 安装与连线【社区】

- 节点包：`pythongosssss/ComfyUI-WD14-Tagger`（Manager 搜 `comfyui-wd14-tagger`；依赖 `onnxruntime`，Manager 会自动装）。模型文件首次使用时自动从 Hugging Face 下载到节点的模型目录（具体路径以节点 README / 启动日志为准）。
- 连线只要一根：`加载图像.IMAGE ──▶ WD14 Tagger.image`，`tags` 字符串直接显示在节点上。要接进工作流就把 `tags` 输出接到 `CLIPTextEncode.text`，或先接 `字符串（多行）` 节点手工删改后再接。
- 关键参数（名称以节点实际显示为准）：`model`（选 SmilingWolf v3 系列，如 EVA02-Large v3）、`threshold`（默认 0.35；调高只留更有把握的标签）、`character_threshold`（角色名识别阈值，默认 0.85，免得乱认角色）、`exclude_tags`（填 `1girl, solo, looking at viewer` 之类不想要的）。
- 输出分四类：rating（general / sensitive / questionable / explicit）、general 标签、character、artist——后两类也能直接拿来做《提示词报告》§3.2 的角色标签与 `@画师`。

### 1.3 三步把 tagger 输出变成 Anima 提示词

1. **跑**：加载参考图 → 读 `tags`。
2. **筛**：删掉元数据类（`highres` `absurdres` `bad_id` `commentary_request` 等）、按需删人数/视线类（`1girl` `solo` `looking_at_viewer`），删掉不想要的，留 15~30 个。
3. **改写并排序**：下划线 → 空格；画师名前加 `@`（tagger 不会帮你加）；带括号的转义；按四段式顺序排好；最前面补质量 / 年代 / 安全标签。

```
tagger 原始输出（节选）：
1girl, solo, long_hair, brown_hair, blue_eyes, sailor_collar, serafuku, pleated_skirt,
looking_at_viewer, smile, standing, outdoors, cherry_blossoms, depth_of_field, highres, absurdres

改写后：
masterpiece, best quality, safe, 1girl, solo, long hair, brown hair, blue eyes, sailor collar, serafuku,
pleated skirt, smile, standing, looking at viewer, outdoors, cherry blossoms, depth of field
```

### 1.4 进阶用法

- **校验自己的图**：把成图丢进 tagger，看模型"觉得"图里有什么。出现 `wet`、`monochrome`、`cosplay` 这类你不想要的标签，说明提示词里某个普通英文词被当成标签吃掉了（《提示词报告》§7），回去找那个词。
- **建个人词表**：收集 10~20 张喜欢的参考图，各跑一次 tagger，合并出现频率高的标签，就是你的"审美 / 画风词表"——比背通用表有效得多。
- **局限**：tagger 只认 Danbooru 标签，不认自然语言，也识别不了 Anima 的"伪标签"；对非动漫图（油画、3D）输出很弱。

### 1.5 不装节点的替代

- Hugging Face Space `SmilingWolf/wd-v1-4-tags`（WD14 Tagger 节点源码注释里引用的那个）：浏览器上传即可。
- 任何能跑 WD Tagger 模型的在线工具；模型本身是 ONNX，`onnxruntime` 几行代码也能自己跑。

## 2. 实验记录模板

### 2.1 为什么 PNG 元数据不够

PNG 嵌的是"最终工作流"，能还原连线与参数。但它不知道：你在对比什么、你觉得哪张好、为什么；被覆盖 / 删除的中间版本无处可寻；跨天回看时找不到"那个 cfg 3.5 的图在哪"。《节点详解》§5.2 说的"一次只改一个变量、用 `图像表格` 拼图"解决了"看"，这里解决"记"。

### 2.2 模板（Markdown 表格，复制即用）

| 日期 | 实验 ID | 目的 | 模型 / LoRA（强度） | 提示词（摘要） | seed | 分辨率 | steps | cfg | 采样器 / 调度器 | denoise | 其它变量 | 结论（好 / 坏 / 为什么） | 文件名或目录 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 11-25 | E001 | 找 cfg 甜点 | base-v1.0 | 樱花少女 A | 12345 | 1024² | 30 | 3.5 | euler / simple | 1 | — | 3.5 偏淡，发色特征丢失 | `Anima/E001/00003` |
| | E001 | | | | | | | 4.0 | | | | **4.0 最佳**，线条干净、颜色到位 | `Anima/E001/00004` |
| | E001 | | | | | | | 4.5 | | | | 4.5 开始线条发硬 | `Anima/E001/00005` |
| 11-25 | E002 | 采样器风格 | 同上 | 同上 | 12345 | 1024² | 30 | 4.0 | er_sde / simple | 1 | — | 比 euler 更平涂；细节略少 | `Anima/E002/00001` |

记录规则：

1. **一个实验 ID = 一次扫描 = 一个变量**。同一 ID 下其它列不变，只填变化的那一列（如上表 E001 只变 cfg）。
2. **结论列必须写"为什么"**，不能只写"好"。
3. **文件名列用 `SaveImage.filename_prefix` 带实验 ID**（如 `Anima/E001`），表和图就能对上；PNG 拖回画布可以还原全部参数，所以参数列允许写"见 PNG"，但**目的与结论列必须手写**。
4. 每天最后一行写"**今日基线**"：当前认定的最佳组合（模型 / 采样器 / cfg / steps / denoise），第二天的实验从它出发。
5. 失败也记（"3.5 发色丢失"是信息），否则会重复踩。

### 2.3 让 ComfyUI 自动对上记录

- `SaveImage.filename_prefix` 支持变量（《节点详解》3.5）：`%date:yyyy-MM-dd%`、`%节点名.参数%`。设成 `Anima/E001/%KSampler.cfg%` 就自动按 cfg 分目录。
- 用《递进报告》L2 的 `创建列表` 做扫描时，列表顺序 = 输出顺序，表里按同一顺序记即可。
- 要全自动化：用《补充B》的 API 跑扫描，脚本顺手把参数写进 CSV。

### 2.4 每日复盘（5 分钟）

三个问题：① 今天最佳是哪张、为什么；② 今天学到的"不要这样做"；③ 明天的实验 ID 和要验证的假设。写进表尾或当天笔记，第二天开工先看它。

## 3. 来源

- 【社区】`pythongosssss/ComfyUI-WD14-Tagger`（https://github.com/pythongosssss/ComfyUI-WD14-Tagger，v1.0.1）
- 【社区】`SmilingWolf/wd-eva02-large-tagger-v3` 等模型卡（https://huggingface.co/SmilingWolf/wd-eva02-large-tagger-v3），`selected_tags.csv` 含 rating / general / character / artist 四类
- 【官方】Danbooru wiki 标签页（https://danbooru.donmai.us/wiki_pages）——用来确认含义与示例图
