---
symptom: "想保留原图颜色但总在变 / 没涂的地方颜色也变了"
area: 重绘
first: "图生图 denoise ≤ 0.35"
then: "重绘换路线 B（img2img + 遮罩，VAE编码（局部重绘））"
dont: "给 LLLite 的 mask 羽化（会被二值化）"
sources:
  - { badge: 官方, url: "https://huggingface.co/kohya-ss/Anima-LLLite", note: "kohya：img2img 时配合 mask 使用，否则颜色会略有偏移" }
  - { badge: 社区, note: "《递进报告》§5 速查表与各级常见问题：综合官方、作者与社区" }
verified: 2026-11-24
---
路线 A（空画布 + 控制图）是整张图重新生成，未涂区域只是被控制图约束；路线 B 的画布是原图潜空间，未遮罩区域真正原样保留。见 [L6](/lessons/04-02-l6-inpaint/)。
