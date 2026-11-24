---
name_zh: 手部细化 (HandDetailer)
category: 社区节点
first_level: L6
sources:
  - { badge: 社区, url: "https://github.com/ltdrdata/ComfyUI-Impact-Pack", note: "与 FaceDetailer 同包，参数相同" }
verified: 2026-11-24
inputs:
  - { name: image, type: IMAGE, desc: "接 VAE解码 的 IMAGE" }
  - { name: bbox_detector, type: BBOX_DETECTOR, desc: "接 UltralyticsDetectorProvider，加载 hand_yolov8s.pt" }
params:
  - { name: guide_size, default: "512", range: "像素", desc: "检测框放大到多大再重绘" }
  - { name: denoise, default: "0.4 ~ 0.5", range: "0 ~ 1", desc: "重绘强度" }
  - { name: bbox_threshold, default: "0.5", range: "0 ~ 1", desc: "手比脸难检，漏检时降阈值" }
outputs:
  - { name: image, type: IMAGE, desc: "贴回后的整图" }
  - { name: cropped_refined, type: IMAGE, desc: "单独的重绘小图" }
---

与 FaceDetailer 同构，检测模型换成 `hand_yolov8s.pt`。提示词只写手该有的样子（如 `detailed hands, own hands together`），不写整图。修手的第一选择；修完再放大。
