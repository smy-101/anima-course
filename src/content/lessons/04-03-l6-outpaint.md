---
title: "L6 · 扩图、裁剪法与自动修脸修手（Detailer）"
stage: 4
order: 3
summary: 向外扩画布（横图扩成方图），用裁剪法把小区域放大到整张画布重绘再贴回，再用 Impact Pack 的 FaceDetailer / HandDetailer 让节点替你找区域、涂遮罩、重绘、贴回。扩图的提示词要写整张画面。
levels: [L6]
days: [11]
promptTrack: true
prerequisites:
  - 04-02-l6-inpaint
nodes:
  - ImagePadForOutpaint
  - ImageCropV2
  - CropMask
  - ImageCompositeMasked
  - ResizeImageMaskNode
  - FaceDetailer
  - HandDetailer
  - PreviewImage
tags: []
deliverable: 一张横图扩成的方图；一张裁剪法修好的手；一张 FaceDetailer 修脸前后对比。
acceptance:
  - 用外补画板把一张横图扩成方图，新区域与原图风格一致、没有硬边
  - 扩图的提示词描述的是整张画面，分辨率控制在约 1 MP
  - 用裁剪法重绘过一个小区域（手或脸）并贴回，贴回坐标正确
  - Impact Pack 与 Impact Subpack 两个都装了，FaceDetailer 能跑；能说出为什么要在放大之前修
  - 做过 denoise 0.35 / 0.45 的对照，没有"修过头"
figures:
  - id: l6-outpaint-before
    caption: "扩图前：横图与外补画板补出的边（MASK 白 = 新区域）"
    group: 扩图
  - id: l6-outpaint-after
    caption: "扩图后：方图，新区域与原图风格一致"
    group: 扩图
  - id: l6-crop-hand
    caption: "裁剪法修手：裁剪框 → 放大到 1 MP 重绘 → 缩回贴回"
    group: 裁剪法
  - id: l6-detailer
    caption: "FaceDetailer 修脸前后（局部放大）"
    group: Detailer
transfers: true
sources:
  - badge: 官方
    url: https://docs.comfy.org/zh/tutorials/basic/outpaint
    note: 官方扩图教程：外补画板 → 局部重绘
  - badge: 社区
    url: https://github.com/ltdrdata/ComfyUI-Impact-Pack
    note: "Impact Pack：FaceDetailer / HandDetailer；V8.0 起 UltralyticsDetectorProvider 在 Subpack"
  - badge: 社区
    url: https://github.com/ltdrdata/ComfyUI-Impact-Subpack
    note: 检测器加载节点所在包
  - badge: 官方
    url: https://docs.comfy.org/zh/tutorials/basic/inpaint
    note: 官方局部重绘教程：提示词描述遮罩区域内想出现的东西；遮罩大一圈
verified: 2026-11-24
---

## 目标

上一课重绘的是"图里已有的一块"。这一课处理三种更具体的需要：**画面不够大**（扩图）、**区域太小涂不准**（裁剪法）、**位置可预测的脸和手**（让节点自动找、自动修）。做完这三件，阶段 4 结束——你手里有了从草稿到成品、再到精修的全部工具。

## 新增节点

| 节点 `类名` | 作用 | 关键参数 |
|---|---|---|
| 外补画板 `ImagePadForOutpaint` | 四周补边，输出补边后的图 + 新区域的 MASK | `left/top/right/bottom`，`feathering 40` |
| 图像裁剪 `ImageCropV2` / 裁剪遮罩 `CropMask` / 合成图像（遮罩）`ImageCompositeMasked` | "裁剪法"：把小区域放大到整张画布重绘再贴回 | 同一组 x / y / w / h |
| 脸部细化 `FaceDetailer` / 手部细化 `HandDetailer`（社区 Impact Pack） | 检测 → 裁出放大 → 重绘 → 羽化贴回 | `guide_size`、`denoise`、`feather`、`bbox_threshold` |

端口细节：[ImagePadForOutpaint](/nodes/ImagePadForOutpaint/) · [ImageCropV2](/nodes/ImageCropV2/) · [CropMask](/nodes/CropMask/) · [ImageCompositeMasked](/nodes/ImageCompositeMasked/) · [FaceDetailer](/nodes/FaceDetailer/) · [HandDetailer](/nodes/HandDetailer/)

## 扩图（Outpaint）

把上一课重绘路线里的"遮罩"换成外补画板给的：

```
LoadImage.IMAGE ──▶ ImagePadForOutpaint(left/top/right/bottom 各补多少) ──IMAGE──▶ 路线 A / B 的 image
                                                              └──MASK───▶ 路线 A / B 的 mask（白 = 新补的区域）
```

补边后的图走上一课的路线 A（空画布 + 控制图）或路线 B（图生图 + 遮罩）。`feathering` 控制新旧区域的过渡宽度（默认 40）。

## 今天的提示词练习：扩图写整图

重绘只写区域，**扩图要描述整张画面**（不只是新区域）——因为模型是对照着"整张图应该长什么样"来补边的。写法就是阶段 1 的四段式，把新区域的内容写进去：`…, standing in a wide flower field, distant mountains on the left, sunset sky`。

| 项目 | 做法 |
|---|---|
| 分辨率 | 补边后的**总尺寸**控制在约 1 MP；原图太大就先缩 |
| 一次扩几边 | 先一边或两边；风格不一致就分两次扩，每次一边 |
| 硬边 | `feathering` 加大；或改用路线 B |

## 裁剪法（路线 D）：小区域重绘细节最好

```
LoadImage.IMAGE ──▶ ImageCropV2(x,y,w,h，四周留余量) ──▶ ResizeImageMaskNode(放大到约 1 MP) ──▶ 路线 A 或 B
重绘结果 ──VAEDecode──▶ ResizeImageMaskNode(缩回 w×h) ──▶ ImageCompositeMasked.source
LoadImage.IMAGE ──▶ ImageCompositeMasked.destination；x,y = 裁剪坐标；mask = 裁剪遮罩（CropMask）
```

在整图上涂一小块，重绘区域只有几十个潜空间像素，细节上不去；把这一块裁出来放大到整张画布去重绘，再缩回贴回，细节远好于前者。遮罩（CropMask）用来只贴重绘区域、不覆盖周围的余量。

## 路线 E：Detailer——让节点替你找区域、涂遮罩、重绘、贴回

脸崩、手崩这类"位置可预测"的问题，用 `ltdrdata/ComfyUI-Impact-Pack` 的 **FaceDetailer / HandDetailer** 更省事：检测器找出每张脸 / 每只手 → 裁出并放大到 `guide_size` → 以 `denoise`（0.4 ~ 0.5）重绘 → 羽化后贴回原图。它内部就是裁剪法的自动化。

| 要点 | 说明 |
|---|---|
| 安装 | **Impact Pack 与 Impact Subpack 两个都要装**：`UltralyticsDetectorProvider`（加载检测模型的节点）在 Subpack 里，V8.0 起不再随 Pack 自动安装。Impact Pack 对 ComfyUI 版本有要求（V8.24 起需 0.3.63+，以其 README 为准） |
| 检测模型 | 如 `face_yolov8m.pt`、`hand_yolov8s.pt`，放 `ComfyUI/models/ultralytics/bbox/`，可由 Manager 下载 |
| 连线 | `VAEDecode.IMAGE ──▶ FaceDetailer.image`；`UltralyticsDetectorProvider.BBOX_DETECTOR ──▶ bbox_detector`；model / clip / vae / positive / negative 与 K采样器 相同 |
| 关键参数 | `guide_size`（检测框放大到多大再重绘，约 512）、`denoise`（0.4 ~ 0.5）、`feather`（贴回羽化）、`bbox_threshold`（检测阈值，漏检就降）；正负提示词**只写这张脸 / 手该有的样子**（如 `detailed face, looking at viewer`），不写整图 |
| 输出 | `image` = 贴回后的整图；`cropped_refined` = 单独的重绘小图，接 预览图像 看效果 |
| 顺序 | **在放大之前做**；修完再走 L4。先用小 `denoise`（0.35）试，不够再升 |

## 参数与取值（起点值）

| 参数 | 起始 | 说明 |
|---|---|---|
| 外补画板 各边 | 按目标比例算 | 横图 1344×768 扩成方图：上下各补 288（总 1344×1344 ≈ 1.8 MP，可先缩原图） |
| `feathering` | 40 | 硬边就加 |
| 裁剪框 | 目标区域 + 四周余量 | 余量给模型上下文，贴回时用遮罩只贴目标区域 |
| Detailer `denoise` | 0.35 → 0.45 | 先小后大；修过头会换脸 |
| Detailer `guide_size` | 512 | 检测框放大到多大再重绘 |

## 动手步骤

1. **扩图**：选一张阶段 3 的横图（或把 1024² 的图裁成 1344×768），接外补画板，上下各补 288；IMAGE 与 MASK 接上一课的路线 B；提示词写整张画面（含新区域）。跑。硬边就加大 `feathering`，或分两次各扩一边。
2. **裁剪法修手**：找一张手崩的图，图像裁剪 框出手（四周留 20% 余量）→ 调整大小 到 1 MP → 路线 A（Turbo 开）重绘，提示词 `detailed hands, own hands together` → VAE解码 → 调整大小 缩回裁剪尺寸 → 合成图像（遮罩） 贴回（x / y = 裁剪坐标，mask = 裁剪遮罩 的输出经同样缩放）。
3. **Detailer**：Manager 装 Impact Pack 与 Impact Subpack，重启；`UltralyticsDetectorProvider` 选 `face_yolov8m.pt`（没有就按提示下载）；`VAEDecode → FaceDetailer`，正负提示词只写脸；denoise 0.35 跑一张，再 0.45 跑一张，`cropped_refined` 接预览图像 看单张脸。
4. 三张前后对比都拼好，记进实验记录本。

## 调参顺序

扩图：先确认 mask 范围（预览遮罩）→ 提示词写整图 → 硬边加 `feathering` → 风格不一致分次扩。裁剪法：裁剪框留足余量 → 重绘 → 贴回坐标对齐 → 遮罩只贴目标区。Detailer：denoise 0.35 起步，看 `cropped_refined`，不够再升；漏检降 `bbox_threshold`。

## 常见问题

| 现象 | 原因 / 处理 |
|---|---|
| 扩图后新区域和原图风格不一致 | 提示词描述整图；`feathering` 加大；分两次扩（每次一边） |
| 扩图补出的区域是纯色 / 模糊 | 用的是路线 C 或没有 LLLite 约束；换路线 A / B；总尺寸超 1 MP 太多 |
| 裁剪法贴回位置错位 | x / y 要用裁剪时的坐标；缩回尺寸必须等于裁剪的 w × h |
| 裁剪法贴回后有方形边 | 没用 mask：裁剪遮罩 框出目标区域（不含余量）再贴 |
| FaceDetailer 换了一张脸 | denoise 过高；降到 0.35；或提示词写了与角色冲突的描述 |
| 找不到 `UltralyticsDetectorProvider` | 只装了 Pack 没装 Subpack |
| 修完再放大，接缝被放大 | 正常——这也是"先修后放"的原因：修的时候接缝小，放大后不显；反过来则会强调 |

## 验收

- 扩图一张、裁剪法修手一张、Detailer 修脸前后一张。
- 阶段 4 结束：现在你能控制构图（LLLite）、修局部（重绘）、改画幅（扩图）、自动修脸手（Detailer）。
- 下一阶段[拆开采样器·流水线化](/#stage-5)：[L7 · 拆开采样器：引导器与两段采样](/lessons/05-01-l7-custom-sampler/)。
