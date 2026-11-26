---
name_zh: 自定义采样器（高级）
category: 采样
first_level: L7
sources:
  - { badge: 源码, url: "https://github.com/comfyanonymous/ComfyUI/blob/master/comfy_extras/nodes_custom_sampler.py", note: "五个输入全必填；输出 output / denoised_output" }
verified: 2026-11-24
inputs:
  - { name: noise, type: NOISE, desc: "随机噪波 或 禁用噪波" }
  - { name: guider, type: GUIDER, desc: "基本引导器 或 CFG引导器" }
  - { name: sampler, type: SAMPLER, desc: "K采样器选择 / ER-SDE 采样器" }
  - { name: sigmas, type: SIGMAS, desc: "基本调度器 或 分离Sigma 的一段" }
  - { name: latent_image, type: LATENT, desc: "空Latent图像 / VAE编码 / 上一段的输出" }
params: []
outputs:
  - { name: output, type: LATENT, desc: "采样结果，接 VAE解码 或下一段" }
  - { name: denoised_output, type: LATENT, desc: "模型对「干净图」的预测，特殊工作流才用" }
---

把 K采样器 拆成零件后的执行器。五个输入全必填，报“缺少输入”就是漏了其中一个。日常取 `output`。
