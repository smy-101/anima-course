---
symptom: "扩图后新区域和原图风格不一致"
area: 重绘
first: "提示词描述整张画面（不只是新区域）"
then: "feathering 加大；分两次扩（每次一边）；补边后总尺寸控制在约 1 MP"
dont: "只写新区域的内容"
sources:
  - { badge: 官方, url: "https://docs.comfy.org/zh/tutorials/basic/outpaint", note: 官方扩图教程 }
  - { badge: 社区, note: "原始笔记《ComfyUI 工作流递进实现报告》§5 速查表与各级常见问题：综合官方、作者与社区" }
verified: 2026-11-24
---
模型是对照“整张图应该长什么样”来补边的。见 [扩图、裁剪法与 Detailer](/lessons/04-03-l6-outpaint/)。
