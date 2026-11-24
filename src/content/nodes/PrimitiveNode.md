---
name_zh: 通用 Primitive
category: 工具与逻辑
first_level: L2
sources:
  - { badge: 官方, url: https://github.com/circlestone-labs/Anima, note: "anima_comparison.json 用 COMBO 驱动 sampler_name" }
verified: 2026-11-24
inputs: []
params:
  - { name: type, default: "—", range: "INT / FLOAT / STRING / BOOLEAN / COMBO", desc: "值类型" }
  - { name: value, default: "—", range: "依类型", desc: "COMBO 时可选下拉项，如 er_sde" }
outputs:
  - { name: value, type: "同类型", desc: "接到下拉控件（如 sampler_name）" }
---

值类型可选 **COMBO**，用来驱动 `sampler_name`、`scheduler` 这类下拉控件——官方 `anima_comparison.json` 就这么做。配合创建列表可以一次扫多个采样器。
