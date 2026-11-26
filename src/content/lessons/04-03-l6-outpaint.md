---
title: L6 · 扩画布，自动修脸和手
stage: 4
order: 3
summary: "学完你能把横图扩成方图，把崩掉的手裁出来放大重绘再贴回，并让 FaceDetailer / HandDetailer 自动修脸和手。"
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
  - UltralyticsDetectorProvider
  - PreviewImage
tags: []
deliverable: 一张横图扩成的方图；一张裁剪法修好的手；一张 FaceDetailer 修脸前后对比。
acceptance:
  - 用外补画板把一张横图扩成方图，新区域与原图风格一致、没有硬边
  - 扩图的提示词描述的是整张画面，分辨率控制在约 1 MP
  - 用裁剪法重绘过一个小区域（手或脸）并贴回，贴回坐标正确
  - Impact Pack 与 Impact Subpack 两个都装了，FaceDetailer 能跑；能说出为什么要在放大之前修
  - 做过 denoise 0.35 / 0.45 的对照，没有“修过头”
figures:
  - id: l6-outpaint-before
    caption: "扩图前：横图与外补画板补出的边（MASK 白 = 新区域）"
    group: 扩图
  - id: l6-outpaint-after
    caption: "扩图后：方图，新区域与原图风格一致"
    group: 扩图
  - id: l6-crop-hand
    caption: "裁剪法修手：裁剪框放大到 1 MP 重绘，再缩回贴回"
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

## 新增节点

上一课重绘的是图里已有的一块。这一课处理三种更具体的需要。画面不够大时扩图。区域太小涂不准时，用裁剪法把它裁出来放大重绘。位置可预测的脸和手，交给节点自动找、自动修。

| 节点 `类名` | 作用 | 关键参数 |
|---|---|---|
| 外补画板 `ImagePadForOutpaint` | 四周补边，输出补边后的图 + 新区域的 MASK | `left/top/right/bottom`，`feathering 40` |
| 图像裁剪 `ImageCropV2` / 裁剪遮罩 `CropMask` / 合成图像（遮罩）`ImageCompositeMasked` | 裁剪法的三个节点，把小区域放大到整张画布重绘再贴回 | 同一组 x / y / w / h |
| 脸部细化 [FaceDetailer](/nodes/FaceDetailer/) / 手部细化 [HandDetailer](/nodes/HandDetailer/)（社区 Impact Pack） | 检测，裁出放大，重绘，羽化贴回 | `guide_size`、`denoise`、`feather`、`bbox_threshold` |

端口细节：[ImagePadForOutpaint](/nodes/ImagePadForOutpaint/) · [ImageCropV2](/nodes/ImageCropV2/) · [CropMask](/nodes/CropMask/) · [ImageCompositeMasked](/nodes/ImageCompositeMasked/) · [FaceDetailer](/nodes/FaceDetailer/) · [HandDetailer](/nodes/HandDetailer/)

## 扩图

扩图沿用上一课的重绘路线，只把遮罩换成外补画板给的。

```
LoadImage.IMAGE ──▶ ImagePadForOutpaint(left/top/right/bottom 各补多少) ──IMAGE──▶ 路线 A / B 的 image
                                                              └──MASK───▶ 路线 A / B 的 mask（白 = 新补的区域）
```

补边后的图走上一课的路线 A 或路线 B。`feathering` 控制新旧区域的过渡宽度，默认 40。

## 提示词练习

上一课重绘只写区域，**扩图要描述整张画面**，不只是新区域。模型是对照着“整张图应该长什么样”来补边的。写法就是阶段 1 的四段式，把新区域的内容写进去，例如 `…, standing in a wide flower field, distant mountains on the left, sunset sky`。

| 项目 | 做法 |
|---|---|
| 分辨率 | 补边后的总尺寸控制在约 1 MP；原图太大就先缩 |
| 一次扩几边 | 先一边或两边；风格不一致就分两次扩，每次一边 |
| 硬边 | `feathering` 加大；或改用路线 B |

## 路线 D 裁剪法

```
LoadImage.IMAGE ──▶ ImageCropV2(x,y,w,h，四周留余量) ──▶ ResizeImageMaskNode(放大到约 1 MP) ──▶ 路线 A 或 B
重绘结果 ──VAEDecode──▶ ResizeImageMaskNode(缩回 w×h) ──▶ ImageCompositeMasked.source
LoadImage.IMAGE ──▶ ImageCompositeMasked.destination；x,y = 裁剪坐标；mask = 裁剪遮罩（CropMask）
```

在整图上涂一小块，重绘区域只有几十个潜空间像素，细节上不去。**把这一块裁出来，放大到整张画布去重绘，再缩回贴回，细节远好于前者**。裁剪遮罩 用来只贴重绘区域，不覆盖周围的余量。

## 路线 E Detailer

脸崩、手崩这类“位置可预测”的问题，用 `ltdrdata/ComfyUI-Impact-Pack` 的 FaceDetailer / HandDetailer 更省事。检测器找出每张脸、每只手，裁出并放大到 `guide_size`，以 `denoise` 0.4 ~ 0.5 重绘，羽化后贴回原图。它内部就是裁剪法的自动化。**修脸和手要放在放大之前。**

| 要点 | 说明 |
|---|---|
| 安装 | Impact Pack 与 Impact Subpack 两个都要装：[UltralyticsDetectorProvider](/nodes/UltralyticsDetectorProvider/)（加载检测模型的节点）在 Subpack 里，V8.0 起不再随 Pack 自动安装。Impact Pack 对 ComfyUI 版本有要求（V8.24 起需 0.3.63+，以其 README 为准） |
| 检测模型 | 如 `face_yolov8m.pt`、`hand_yolov8s.pt`，放 `ComfyUI/models/ultralytics/bbox/`，可由 Manager 下载 |
| 连线 | VAEDecode 的 IMAGE 接 FaceDetailer.image；UltralyticsDetectorProvider 的 BBOX_DETECTOR 接 bbox_detector；model / clip / vae / positive / negative 与 K采样器 相同 |
| 关键参数 | `guide_size`（检测框放大到多大再重绘，约 512）；`denoise`（0.4 ~ 0.5）；`feather`（贴回羽化）；`bbox_threshold`（检测阈值，漏检就降）；正负提示词只写这张脸 / 手该有的样子（如 `detailed face, looking at viewer`），不写整图 |
| 输出 | `image` = 贴回后的整图；`cropped_refined` = 单独的重绘小图，接 预览图像 看效果 |
| 顺序 | 在放大之前做；修完再走 L4。先用较小的 `denoise`（0.35）试，不够再升 |

## 参数与取值

表里都是起点值。

| 参数 | 起始 | 说明 |
|---|---|---|
| 外补画板 各边 | 按目标比例算 | 横图 1344×768 扩成方图：上下各补 288（总 1344×1344 ≈ 1.8 MP，可先缩原图） |
| `feathering` | 40 | 硬边就加 |
| 裁剪框 | 目标区域 + 四周余量 | 余量给模型上下文，贴回时用遮罩只贴目标区域 |
| Detailer `denoise` | 0.35 起步，不够再升到 0.45 | 先小后大；修过头会换脸 |
| Detailer `guide_size` | 512 | 检测框放大到多大再重绘 |

## 动手步骤

1. 扩图。选一张阶段 3 的横图，或把 1024² 的图裁成 1344×768，接外补画板，上下各补 288。IMAGE 与 MASK 接上一课的路线 B，提示词写整张画面，含新区域。跑。硬边就加大 `feathering`，或分两次各扩一边。
2. 裁剪法修手。找一张手崩的图，用图像裁剪 框出手，四周留 20% 余量。接调整图像/掩码大小 放大到 1 MP，再走路线 A 重绘，Turbo 开，提示词 `detailed hands, own hands together`。重绘结果接 VAE解码，再用调整图像/掩码大小 缩回裁剪尺寸，最后用合成图像（遮罩） 贴回。x / y 用裁剪时的坐标，mask 接裁剪遮罩 的输出，经同样的缩放。
3. Detailer。用 Manager 装 Impact Pack 与 Impact Subpack，重启。`UltralyticsDetectorProvider` 选 `face_yolov8m.pt`，没有就按提示下载。VAEDecode 接 FaceDetailer，正负提示词只写脸。denoise 0.35 跑一张，再 0.45 跑一张，`cropped_refined` 接预览图像 看单张脸。
4. 三张前后对比都拼好，记进实验记录本。

## 调参顺序

扩图先确认 mask 范围（预览遮罩），提示词写整图；有硬边就加 `feathering`，风格不一致就分次扩。裁剪法先给裁剪框留足余量，重绘后对齐贴回坐标，用遮罩只贴目标区。Detailer 从 denoise 0.35 起步，看 `cropped_refined`，不够再升；漏检就降 `bbox_threshold`。

## 常见问题

| 现象 | 原因 / 处理 |
|---|---|
| 扩图后新区域和原图风格不一致 | 提示词描述整图；`feathering` 加大；分两次扩（每次一边） |
| 扩图补出的区域是纯色 / 模糊 | 用的是路线 C 或没有 LLLite 约束；换路线 A / B；总尺寸超 1 MP 太多 |
| 裁剪法贴回位置错位 | x / y 要用裁剪时的坐标；缩回尺寸必须等于裁剪的 w × h |
| 裁剪法贴回后有方形边 | 没用 mask：裁剪遮罩 框出目标区域（不含余量）再贴 |
| FaceDetailer 换了一张脸 | denoise 过高；降到 0.35；或提示词写了与角色冲突的描述 |
| 找不到 `UltralyticsDetectorProvider` | 只装了 Pack 没装 Subpack |
| 修完再放大，接缝被放大 | 正常。先修后放就是为了这个：修的时候接缝小，放大后不显；反过来则会强调 |

阶段 4 到这里结束。从草稿到成品、再到精修的工具都在手里了。
