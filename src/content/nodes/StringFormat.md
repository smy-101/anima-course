---
name_zh: 字符串格式化
category: 工具
first_level: L8
sources:
  - { badge: 源码, url: "https://github.com/comfyanonymous/ComfyUI/blob/master/comfy_extras/nodes_string.py", note: "Python format 语法；values 自动增长" }
verified: 2026-11-24
inputs:
  - { name: values, type: "任意（自动增长 a, b, c…）", desc: "要代入的值" }
params:
  - { name: f_string, default: "{a}", range: "Python 格式字符串", desc: "如 Anima/L4_d{a}_s{b}" }
outputs:
  - { name: STRING, type: STRING, desc: "格式化结果" }
---

同 Python 的 `format`。把倍率、denoise 等数值代进文件名模板：`Anima/L4_hires_d{a}_s{b}`，a 接 K采样器.denoise、b 接 缩放Latent（比例）.scale_by。
