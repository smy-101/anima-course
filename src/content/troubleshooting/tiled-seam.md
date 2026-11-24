---
symptom: "分块放大有接缝"
area: 放大
first: "tile_padding 加到 64"
then: "mode_type 用 Chess；开 seam_fix；每块 denoise 降到 0.3"
dont: "靠锐化掩盖"
sources:
  - { badge: 社区, url: "https://github.com/ssitu/ComfyUI_UltimateSDUpscale", note: UltimateSDUpscale 节点说明 }
  - { badge: 社区, note: "《递进报告》§5 速查表与各级常见问题：综合官方、作者与社区" }
verified: 2026-11-24
---
1024² 底图先验收 → 2048² 看接缝 → 加 padding / 开 seam_fix → 再扫 denoise。见 [两段放大、分块放大](/lessons/03-05-l4-large/)。
