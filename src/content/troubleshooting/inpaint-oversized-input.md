---
symptom: "输入图很大（如 2000×3000）直接重绘全崩"
area: 重绘
first: "调整图像/掩码大小 缩到约 1 MP 再重绘"
then: "修完再放大回去（L4）"
dont: "在原尺寸上硬涂"
sources:
  - { badge: 官方, url: "https://github.com/Comfy-Org/workflow_templates/blob/main/templates/image_anima_lllite_image_inpainting.json", note: "模板便签：输入超过 1024×1024 先缩" }
  - { badge: 社区, note: "《递进报告》§5 速查表与各级常见问题：综合官方、作者与社区" }
verified: 2026-11-24
---
重绘在模型舒适区分辨率内做，细节交给后续放大。
