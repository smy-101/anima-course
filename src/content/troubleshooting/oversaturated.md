---
symptom: "画面过饱和、线条发硬、“烧了”"
area: 参数
first: "cfg 降到 3.5"
then: "换 euler_ancestral / CFG++（CFG 1.5）/ 挂 APG"
dont: "堆负向"
sources:
  - { badge: 社区, note: "原始笔记《ComfyUI 工作流递进实现报告》§5 速查表：综合官方、作者与社区" }
  - { badge: 官方, url: https://huggingface.co/circlestone-labs/Anima, note: "模型卡" }
verified: 2026-11-24
---
Anima 甜点 3～5；`euler_ancestral` 可以比其他采样器用更高 CFG 而不烧图。CFG++ 系列必须 CFG < 2。
