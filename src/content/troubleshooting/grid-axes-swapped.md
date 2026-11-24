---
symptom: "模型 × 种子网格的行列反了"
area: 工作流
first: "图像拼接 direction = right 拼列，图像表格 columns = 1 铺行"
then: "绘制文本叠加 给每列写模型名再核对"
dont: "调 batch_size"
sources:
  - { badge: 官方, url: "https://github.com/circlestone-labs/Anima", note: "anima_comparison.json 的拼法" }
verified: 2026-11-24
---
列 = 模型、行 = 种子。见 [L8](/lessons/05-03-l8-compare-loop/)。
