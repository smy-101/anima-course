---
name_zh: 终极 SD 放大 (UltimateSDUpscale)
category: 社区节点
first_level: L4
sources:
  - { badge: 社区, url: "https://github.com/ssitu/ComfyUI_UltimateSDUpscale", note: "ssitu；Manager 搜 comfyui_ultimatesdupscale" }
  - { badge: 社区, note: "参数区间来自节点说明与社区经验，以自己固定种子对照为准" }
verified: 2026-11-24
inputs:
  - { name: image, type: IMAGE, desc: "接 VAE解码① 的 IMAGE" }
  - { name: model, type: MODEL, desc: "接 UNet加载器 / LoRA 链末端" }
  - { name: positive, type: CONDITIONING, desc: "整图提示词" }
  - { name: negative, type: CONDITIONING, desc: "整图负向" }
  - { name: vae, type: VAE, desc: "接 加载VAE" }
  - { name: upscale_model, type: UPSCALE_MODEL, desc: "接 加载放大模型（动漫向 4x）" }
params:
  - { name: upscale_by, default: "2", range: "倍率", desc: "1024² → 2048² 用 2" }
  - { name: "tile_width / tile_height", default: "1024", range: "像素", desc: "每块尺寸，取模型舒适区（Anima 约 1 MP）" }
  - { name: tile_padding, default: "32", range: "32 ~ 64", desc: "块与块的重叠；接缝明显就加" }
  - { name: denoise, default: "0.35", range: "0.3 ~ 0.5", desc: "每块重绘强度；过高会改细节" }
  - { name: mode_type, default: "Chess", range: "Linear / Chess 等", desc: "棋盘错位让相邻块不同时处理，接缝更隐蔽" }
  - { name: "steps / cfg / sampler / scheduler", default: "20 ~ 30 / 4 / euler / simple", range: "同二次采样", desc: "每块的采样参数" }
  - { name: "mask_blur / seam_fix_*", default: "默认", range: "—", desc: "块边缘羽化与二次接缝修复，先用默认" }
outputs:
  - { name: IMAGE, type: IMAGE, desc: "拼回后的整图" }
---

分块放大（Tiled）的标准节点：把“放大模型 → 切块 → 每块 img2img → 拼回 → 接缝修复”打包成一个节点。要 2K / 4K 时的正路，突破“单段 ≤ 1.5×”的上限。
