---
symptom: "画面上出现签名 / 水印 / 乱码文字"
area: 提示词
first: "负向保留 artist name，可再加 signature、watermark、text、logo"
then: "删掉正向里可能被画到衣服上的普通词"
dont: ""
sources:
  - { badge: 官方, url: https://huggingface.co/circlestone-labs/Anima, note: "模型卡" }
  - { badge: 社区, url: https://civitai.com/articles/33857, note: "Volnovik 指南（非模型作者）" }
verified: 2026-11-24
---
`artist name` 是"画面上出现了画师署名"的元标签，与正向 `@画师` 不冲突。
