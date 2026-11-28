---
symptom: "加载节点变成橙色、带“问题”角标，提示模型缺失"
area: 环境
first: "对照目录表，放好后按 R"
then: "子文件夹里的文件检测不到时在节点里手动选"
dont: "放到 checkpoints/"
sources:
  - { badge: 源码, note: "原始笔记《ComfyUI 节点与参数详解》§5.2–5.3，依据源码与官方文档" }
  - { badge: 官方, url: https://docs.comfy.org/zh/tutorials/image/anima/anima }
verified: 2026-11-24
---
Anima 是拆分模型：diffusion_models / text_encoders / vae 三个目录。桌面版的模型目录在共享目录，不在程序目录。
