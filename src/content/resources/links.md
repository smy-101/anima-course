---
title: 工具与资源链接
kind: 链接
order: 3
sources:
  - badge: 官方
    url: https://docs.comfy.org/zh
    note: ComfyUI 官方文档（含中文版）
verified: 2026-11-24
---

| 用途 | 资源 |
|---|---|
| 官方模型卡（最权威） | https://huggingface.co/circlestone-labs/Anima |
| ComfyUI 官方 Anima 教程 | https://docs.comfy.org/zh/tutorials/image/anima/anima |
| 官方工作流模板 | https://github.com/Comfy-Org/workflow_templates/blob/main/templates/image_anima_base_v1.json（ComfyUI 模板库内直接有） |
| 官方 LoRA | https://huggingface.co/circlestone-labs/Anima-Official-LoRAs |
| ControlNet LLLite | https://huggingface.co/Comfy-Org/Anima-LLLite |
| 角色 / 画师标签查询 | ANIMADEX https://animadex.net ；标签预览 https://tags.latent.moe |
| 画师风格预览 | https://anima.mooshieblob.com/ |
| 标签 wiki | https://danbooru.donmai.us 、https://gelbooru.com（拼写以 Gelbooru 为准） |
| ComfyUI 文档 | https://docs.comfy.org/zh（安装、界面、模板、更新、排错） |
| ComfyUI Wiki 模型页 | https://comfyui-wiki.com/zh/models/anima |
| 社区提示词指南（**Volnovik，非模型作者**） | Civitai 文章 33857《Anima Generation Guide – Part 4: Prompting》；蒸馏版 https://github.com/Volnovik/anima-prompting |
| 其他 UI 参考 | MooshieUI（ComfyUI 的新手前端）、InvokeAI、WebUI Forge Neo、KusArt（在线） |
| 反推标签（看图识标签） | ComfyUI 自定义节点 `ComfyUI-WD14-Tagger`（pythongosssss，Manager 可装；模型用 SmilingWolf 的 WD Tagger v2/v3 系列） |
| 脸 / 手自动修复 | `ComfyUI-Impact-Pack` + `ComfyUI-Impact-Subpack`（ltdrdata；两个都要装） |
| 分块放大 | `ComfyUI_UltimateSDUpscale`（ssitu，Manager 搜 `comfyui_ultimatesdupscale`） |
| 中文视频 / 社区 | B 站搜"ComfyUI 入门""ComfyUI 节点""Anima 教程"；官方文档本身有中文版。视频里的界面与节点版本可能已变，操作细节以官方文档与本站为准 |
| 社区节点包（按需） | `comfyui_controlnet_aux`（DWPose / 线稿 / HED 预处理）、`ComfyUI-Impact-Pack` + `ComfyUI-Impact-Subpack`（FaceDetailer / HandDetailer）、`rgthree-comfy`（K采样器 预设）、`RES4LYF`（`beta57` 调度器）、`ComfyUI-ppm`（NegPip，CFG 1 下用负向） |
| 子图与蓝图 | 官方文档 https://docs.comfy.org/zh/interface/features/subgraph ；官方蓝图纸引 https://github.com/Comfy-Org/workflow_templates/blob/main/blueprints/index.json |
| 放大 / 重绘 / 扩图官方教程 | https://docs.comfy.org/zh/tutorials/basic/upscale 、/inpaint 、/outpaint ；放大总览 https://docs.comfy.org/zh/tutorials/utility/image-upscale ；博客《AI 放大完全手册》 https://blog.comfy.org/p/upscaling-in-comfyui |
| LLLite 权重与说明 | https://huggingface.co/Comfy-Org/Anima-LLLite ；https://huggingface.co/kohya-ss/Anima-LLLite ；训练 / 推理指南 https://github.com/kohya-ss/sd-scripts/blob/main/docs/anima_train_control_net_lllite.md |
| 社区放大经验 | DXMPie《Anima Made Easy》 https://civitai.com/articles/37140 ；HKMC_AILab《A Complete Guide to Anima Upscaling》 https://note.com/hkmclab/n/ne39ca8184d79 ；nobin《5 Tips》 https://note.com/nobinlog/n/n3620e68d1590 （均非模型作者） |
| 开发者：HTTP API / 无界面批量 / 自定义节点 | 开发者选修（原始笔记《补充B》，站内内容待迁移） |
