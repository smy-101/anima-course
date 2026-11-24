---
symptom: "控制图的花纹 / 线条原样出现在成图里"
area: 工作流
first: "strength 降到 0.6 ~ 0.8"
then: "控制图先缩到 1 MP；end_percent 0.85 让模型自由收尾"
dont: "把 strength 加到 3"
sources:
  - { badge: 官方, url: "https://huggingface.co/kohya-ss/Anima-LLLite", note: "kohya：控制太强就降 strength 或缩小区间" }
  - { badge: 社区, note: "《递进报告》§5 速查表与各级常见问题：综合官方、作者与社区" }
verified: 2026-11-24
---
强度过高，或控制图分辨率远高于输出。先用预览图像 确认控制图本身正确。见 [L5](/lessons/04-01-l5-lllite/)。
