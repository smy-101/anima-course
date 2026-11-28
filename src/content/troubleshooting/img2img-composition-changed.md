---
symptom: "图生图后构图面目全非"
area: 参数
first: "denoise 降到 0.4 ~ 0.6"
then: "输入图先用调整图像/掩码大小 缩到约 1 MP"
dont: "加步数找补"
sources:
  - { badge: 社区, note: "原始笔记《ComfyUI 工作流递进实现报告》§5 速查表与各级常见问题：综合官方、作者与社区" }
verified: 2026-11-24
---
输入图的尺寸就是输出尺寸；denoise 0.7 以上本来就是“换风格换内容”。见 [L3](/lessons/03-01-l3-img2img/)。
