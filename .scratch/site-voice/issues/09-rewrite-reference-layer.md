# 09: 参考层改写（资源 9 篇 + 排错 51 张）

**What to build:** 参考层按《站点文风》过一遍。资源 9 篇（6542 字、85 处加粗，8 篇超标）整篇改写；排错 51 张是刻意的「先 / 再 / 不要」速查体，读者看到的文字在 frontmatter 的 `first` / `then` / `dont` 里，合计不到 1000 字——不要把它改成散文，只检查加粗、标题和软规则里明显碍眼的地方。

先读：`docs/文风.md`、`docs/adr/0001-派生时重写文风.md`、`.scratch/site-voice/spec.md`，以及试点课 `01-03-prompt-basics.md`。事实来源在 `source/`，不改它。

规则：资源篇同课程（事实 / 数值 / 来源不动；七条软规则都过；加粗 ≤ 4 / 千字；直引号换 “ ”；超 40 字的句子拆开）。排错卡只修 lint 报出的项（含 frontmatter 里的直引号，注意 YAML 转义）和明显违反软规则处。全部加进「已改写」名单，lint 强制全绿。
- 改小节标题前先 `grep -rn '<课的 id>#' src` 看有没有别的页面链到本课的旧标题锚点（03 发现 `src/pages/tools/prompt-lint.astro` 有 10 处）。有的话在工作树里同步改锚点；该文件若在仓库主人未提交的批次里就**不要 add**，在回报里写明。

**Blocked by:** 03

**Status:** done（提交 a71e1f9；作者通读待定）

- [x] 9 篇资源 + 51 张排错都在名单内且 lint 全绿
- [x] 排错卡仍是速查体，没有被改成段落
- [x] 资源篇的加粗只出现在控件 / 节点名和每节一句关键话上
- [x] 四项收尾检查全过

## Comments

**2026-11-26 · 实现记录（提交 a71e1f9）**

改写结果（资源 9 篇；字数与密度按 lint 口径，即代码块与行内代码遮掉后的汉字数）：加粗合计 86 → 14 处。experiment-log 7 → 1 处（522 字，1.9 / 千字）；links 1 → 0（363 字）；misconceptions 11 → 0（1192 字），标题 11 → 4 字；model-files 2 → 1（346 字，2.9 / 千字）；param-baseline 6 → 0（572 字）；prompt-templates 25 → 3（1085 字，2.8 / 千字）；startup-args 9 → 4（1080 字，3.7 / 千字），标题 23 → 18 字；transfer 18 → 3（948 字，3.2 / 千字）；tuning-goals 7 → 2（745 字，2.7 / 千字）。9 篇正文（代码块外）无箭头、直引号、「我们 / 您」，破折号只剩表格里的「—」占位；S7 按 05 的口径（汉字 + 中文标点 + 拉丁词，「；」作句界，表格按单元格拆）查过，最长 40。新标题：「常见误区」「启动参数与 Attention 后端」。剩下的 14 处加粗里 1 处是控件名 **Launch / Startup arguments**，其余都是每节（或页面导语）的一句关键话，整句加粗。

排错 51 张只动了 20 张，另 31 张没有可修的项。lint 项：frontmatter 7 个字段的直引号（含 YAML 转义的 `\"`）、正文 6 处共 12 个直引号，换成 “ ”；black-image、cuda-oom 各 1 处加粗去掉。软规则：句中的箭头、破折号、上下箭头 12 处，如 `GrowMask 8 → 16` 改成「从 8 加到 16」，`cfg ↓（3.5）` 改成「cfg 降到 3.5」，tiled-seam 的四步箭头链改成「先…，再…，最后…」。先 / 再 / 不要三栏和正文短注的结构原样，改后 lint 表里 troubleshooting 一行全 0。

锚点：按票里的命令逐篇 grep（`<资源 id>#`，范围 `src` / `scripts` / `tests`），9 个 id 都是 0 处，因为资源页的入链写成 `resources/<id>/`。换一种写法 `resources/[a-z-]+/#` 查到 8 处：`src/pages/tools/lab-log.astro` 第 53–58 行、`src/components/LabLog.tsx` 第 41、43 行，全部指向 experiment-log 的「## 记录规则」。这个小节名原样保留，没有改任何锚点。开工时工作树是干净的，没有仓库主人未提交的批次。

需要作者看一眼的取舍：

1. links.md 的裸 URL 改成了带名字的 Markdown 链接。原因：构建产物里有 3 个外链被自动链接吞掉了紧跟的全角括号（`…image_anima_base_v1.json%EF%BC%88ComfyUI`、`https://gelbooru.com%EF%BC%88…`、`https://docs.comfy.org/zh%EF%BC%88…`）。URL 目标逐个保留；原来缩写的「/inpaint 、/outpaint」按同格 /upscale 的模式补成完整地址（curl 均 200）；「Civitai 文章 33857」加了指向 `https://civitai.com/articles/33857` 的链接，这个地址旧页面没有，它是站内 sources 徽章一直用的。这三个新 href 票没有要求（Spec 评审标的判断题）。不要的话，去掉链接语法、在 URL 与后面的全角括号之间留一个空格，同样能修掉坏链。
2. 两个标题。「常见误区（核实后修正）」去掉括号补充，「逐条核实过」放进导语；全站指过来的链接文字本来就是「常见误区」。「启动参数与 Attention 后端（命令行）」去掉括号后 18 字，原 23 字超 H3。
3. 小节名。带括号的改成名词短语，括号里的信息挪成该节第一句：「模板（复制即用）」「每日复盘（5 分钟）」「采样器风格（来自模型卡）」「精度（全局强制）」「Attention 后端（速度 / 显存 / 画质）」「负向逐词含义（SFW 常用）」「成品模板 E（Aesthetic 定稿，CFG 4、30 步）」。问句 / 使句式的三个按「小节标题用名词短语」改：「重绘与扩图怎么写」改成「重绘与扩图的提示词」，「参数加在哪」改成「参数的添加位置」，「让 ComfyUI 自动对上记录」改成「自动对上记录」。prompt-templates 的 5 个加粗段首标签改成三级标题「模板 A 单人标签版」「模板 B 自然语言版」「模板 C 混合版」「模板 D 带画师」「负面」，括号里的适用版本挪到代码块前的一句。03-01 说的「成品模板 E」这个名字没变。
4. 表格和代码块前补了一句引导句（links、misconceptions 的页面导语；model-files 的 LoRA 表；param-baseline 的两处；prompt-templates 的五处；startup-args 的 Attention 后端；tuning-goals 的速度与显存）。原因之一是资源首页卡片的摘要取正文前 110 字，links 原来的摘要是一串表头。引导句只复述该节已有的信息。
5. 几处措辞上的增补，都核过依据。experiment-log「导出 CSV / Markdown 就是下面这张表」改成「用的就是上面这张表的列」：原句方位写反，这句在表的下面；`src/lib/lab-log.ts` 的 COLUMNS 与模板表 14 列逐一相同。记录规则从有序列表改成无序，00-01 的同一节就是无序。param-baseline 的「0.35（→ 0.45）」改成「0.35（不够再升到 0.45）」，与 04-03 的「0.35 起步，不够再升到 0.45」一致。tuning-goals 的「上面一行是人话描述」改成「通俗的描述」。「调参口诀」那段改成普通句子。
6. 数值按「起点值」说。model-files 的 LoRA 表前补「用法里的数值都是起点值」；prompt-templates 的「定稿用 CFG 4、30 步」改成「从 CFG 4、30 步起步」。
7. 排错卡里没动的。两处「=」当「就是」用的速记（cuda-oom、lllite-edge-cropped）；painter-mask-black 的 sources note 里的箭头，按「来源徽章不动」保留（07 的口径）。用旧课名 / 旧小节名做文字的站内链接：`outpaint-style-mismatch`、`detailer-face-changed` 的「扩图、裁剪法与 Detailer」，`nag-slow-or-silent` 的「shift 与引导补丁」，`filename-variable-ignored`、`grid-axes-swapped`、`loop-iteration-noise` 的「L8」。票 07、08 把它们交给本票，但本票对排错卡的规则是只修 lint 项和明显违反软规则处，链接文字不属于二者，这些叫法也仍是目标页的小节名或级别名，所以没动；要不要统一由作者定。资源篇里的同类链接文字都改成了现在的课名 / 小节名（如「准备 · 安装」改成「准备课的安装步骤」，「A · HTTP API 与无界面批量」改成「A · 用脚本批量出图」，tuning-goals 指向 02-02 的「多人、场景与排错」改成它现有的小节名「场景与风格」）。
8. 名单里 `bad-hands` 写成全路径 `src/content/troubleshooting/bad-hands.md`：标签卡里有同名的 `tags/bad-hands.md`，只写 id 会把票 10 的卡片一起锁上。写全路径后名单 80 个条目对应 80 个文件。
9. 没做的：只改内容，没有做浏览器截图检查；构建产物按结构核对过（9 页的 `<strong>` 数与 Markdown 里的加粗对数一致，没有残留星号，外链 href 里没有被吞进去的全角标点）。资源首页卡片摘要里会出现表格分隔行的「------------」，是 `resources/index.astro` 的 excerpt() 没过滤分隔行，属页面模板，不在本票范围。

评审：两轴各一轮（两个 `reviewer` 并行，证据在 `reports/t09-review/`，已被 gitignore）。Standards 报 P1 1 条、P2 2 条、判断题 1 条。P1 是 3 处半句加粗（transfer、model-files、prompt-templates），已扩到整句。P2 均已修：3 个问句 / 使句式小节名改成名词短语（第 3 条）；两处数值补「起点值」的说法（第 6 条）。判断题是第 7 条的措辞：07、08 是把这些链接交给本票，不是留给作者，已按实情写。Spec 报 P1 0 条、P2 4 条：links.md 的 3 个新 href 与两个同名 `note.com` 链接（第 1 条；两个 note 链接已改成挂在文章标题上）；transfer 步骤 2 的「cfg、steps、采样器」丢了先后，改成「先 cfg，再 steps，最后采样器」；experiment-log 的方位修正核实后保留（第 5 条）；missing-nodes 的「“错误”页」改成 00-01 的写法「“问题 / 错误”页」。

证据：`npm run build` 退出码 0，`npm run check:site` 退出码 0（页面 469，死链 0，已改写名单 80 个全部通过），`npx astro check` 0 errors 0 warnings 0 hints，`npm test` 43 个全过；评审修订后四项重跑仍全过。事实对照（HEAD 对工作树）：资源 9 篇正文里含数字的记号，减少的只有 experiment-log 的 5 个列表序号，新增的只有 links 里链接文字重复的 2 个（v1.json、33857）；围栏代码块、行内代码、表格行列数逐篇相同；`sources` 除两条 note 的直引号换弯引号外逐字相同；排错 20 张正文的数值、URL、站内链接零增减。
