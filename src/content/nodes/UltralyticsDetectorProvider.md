---
name_zh: Ultralytics 检测器 (UltralyticsDetectorProvider)
category: 社区节点
first_level: L6
sources:
  - { badge: 社区, url: https://github.com/ltdrdata/ComfyUI-Impact-Subpack, note: "检测器节点在 Impact Subpack；读取 models/ultralytics/bbox 与 segm" }
verified: 2026-11-24
inputs: []
params:
  - { name: model_name, default: "—", range: "ultralytics/bbox 与 ultralytics/segm 目录下的文件", desc: "脸用 face_yolov8m.pt，手用 hand_yolov8s.pt（Manager 可下载）" }
outputs:
  - { name: BBOX_DETECTOR, type: BBOX_DETECTOR, desc: "接 FaceDetailer / HandDetailer 的 bbox_detector" }
  - { name: SEGM_DETECTOR, type: SEGM_DETECTOR, desc: "分割检测器（需 segm/ 下的模型）" }
---

给 [FaceDetailer](/nodes/FaceDetailer/) / [HandDetailer](/nodes/HandDetailer/) 提供检测模型。检测文件放 `ComfyUI/models/ultralytics/bbox/`（分割模型放 `segm/`）。

节点在 Impact Subpack 里，不在 Impact Pack 里：两个包都要装，只装 Pack 会在节点库里找不到它（V8.0 起不再随 Pack 自动安装）。连线与安装步骤见课程 [扩图、裁剪法与 Detailer](/lessons/04-03-l6-outpaint/)。
