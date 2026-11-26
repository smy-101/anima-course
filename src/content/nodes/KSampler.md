---
name_zh: K采样器
category: 采样
first_level: L0
sources:
  - { badge: 源码, url: https://github.com/comfyanonymous/ComfyUI/blob/master/nodes.py, note: 参数默认值与范围 }
  - { badge: 源码, url: https://github.com/comfyanonymous/ComfyUI/blob/master/comfy/samplers.py, note: "KSampler.set_steps：denoise 不减步数" }
verified: 2026-11-24
inputs:
  - { name: model, type: MODEL, desc: "去噪模型（可带 LoRA、补丁）" }
  - { name: positive, type: CONDITIONING, desc: "正向条件，接 CLIP文本编码（正向）" }
  - { name: negative, type: CONDITIONING, desc: "负向条件；CFG = 1 时不起作用" }
  - { name: latent_image, type: LATENT, desc: "起始画布。文生图接 空Latent图像；图生图接 VAE编码" }
params:
  - { name: seed, default: "0", range: "0 ~ 1.8×10¹⁹", desc: "随机噪声的起点。相同种子 + 相同设置 = 相同图。复现时设 fixed" }
  - { name: steps, default: "20", range: "1 ~ 10000", desc: "去噪步数。Anima 30 够用、40 出成品；Turbo 8 ~ 12" }
  - { name: cfg, default: "8.0", range: "0 ~ 100", desc: "提示词引导强度。Anima 4 ~ 5；Turbo 固定 1" }
  - { name: sampler_name, default: "—", range: "45 种", desc: "每一步用什么数学方法去噪。Anima 先用 euler / er_sde" }
  - { name: scheduler, default: "—", range: "9 种", desc: "每一步去掉多少噪声的时间表。simple 起步" }
  - { name: denoise, default: "1.0", range: "0 ~ 1", desc: "去噪比例：1 = 完全重画；图生图细化 0.4 ~ 0.6；微调 0.2 ~ 0.35" }
outputs:
  - { name: LATENT, type: LATENT, desc: "去噪后的潜空间图，还要经 VAE解码才能看" }
---

最该吃透的节点：steps、cfg、采样器、调度器、种子、denoise 都在这里。

三个核心概念

- CFG：模型分别预测“有提示词”和“没提示词”时的噪声，最终方向 = 无条件预测 + CFG ×（有条件预测 − 无条件预测）。越高越听话，过高过饱和、线条发硬（“烧图”）。CFG = 1 时负向完全不起作用——这就是 Turbo 不用写负面的原因。
- denoise：只执行 sigma 时间表的后一段。⚠️ 步数不会缩水：源码先按 int(steps/denoise) 生成更细的时间表再取最后 steps+1 个 sigma——30 步 + denoise 0.5 仍跑满 30 步。会真正减步数的是 K采样器（高级）的起止步与分离Sigma降噪。
- seed：决定初始噪声。噪声张量的形状跟着 latent 尺寸走：同种子换分辨率就是另一张图，固定种子对比时画幅也不能动；batch 内同一 seed 的每张噪声各不相同（L2 利用的正是这一点）；不同显卡 / 精度下同种子也可能有细微差异。

> 个别中文文档把 denoise 写成“值越低，与输入图像的关联性越小”，这是译反了。正确的是：值越低，越接近输入图。
