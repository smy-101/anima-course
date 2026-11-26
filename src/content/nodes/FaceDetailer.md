---
name_zh: 脸部细化 (FaceDetailer)
category: 社区节点
first_level: L6
sources:
  - { badge: 社区, url: "https://github.com/ltdrdata/ComfyUI-Impact-Pack", note: "Impact Pack；检测器节点在 Impact Subpack" }
  - { badge: 社区, note: "参数为社区常用起点，以节点内置说明为准" }
verified: 2026-11-24
inputs:
  - { name: image, type: IMAGE, desc: "接 VAE解码 的 IMAGE" }
  - { name: model, type: MODEL, desc: "与 K采样器 相同" }
  - { name: clip, type: CLIP, desc: "与 K采样器 相同" }
  - { name: vae, type: VAE, desc: "与 K采样器 相同" }
  - { name: positive, type: CONDITIONING, desc: "只写这张脸该有的样子" }
  - { name: negative, type: CONDITIONING, desc: "同 K采样器" }
  - { name: bbox_detector, type: BBOX_DETECTOR, desc: "接 UltralyticsDetectorProvider（在 Impact Subpack 里）" }
params:
  - { name: guide_size, default: "512", range: "像素", desc: "检测框放大到多大再重绘" }
  - { name: denoise, default: "0.4 ~ 0.5", range: "0 ~ 1", desc: "重绘强度。先用 0.35，不够再升" }
  - { name: feather, default: "5", range: "像素", desc: "贴回时的羽化" }
  - { name: bbox_threshold, default: "0.5", range: "0 ~ 1", desc: "检测阈值，漏检就降" }
outputs:
  - { name: image, type: IMAGE, desc: "贴回后的整图" }
  - { name: cropped_refined, type: IMAGE, desc: "单独的重绘小图，接 预览图像 看效果" }
---

让节点替你找区域、涂遮罩、重绘、贴回（路线 E）。检测模型（如 `face_yolov8m.pt`）放 `ComfyUI/models/ultralytics/bbox/`，由 [UltralyticsDetectorProvider](/nodes/UltralyticsDetectorProvider/) 加载，可由 Manager 下载。在放大之前做；修完再走 L4。手用同包的 HandDetailer（`hand_yolov8s.pt`），参数相同。
