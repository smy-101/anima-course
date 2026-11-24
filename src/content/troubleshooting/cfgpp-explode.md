---
symptom: "带 _cfg_pp 后缀的采样器出图\"炸\""
area: 参数
first: "CFG 降到 1.5"
then: "换普通采样器"
dont: "CFG 4.5"
sources:
  - { badge: 社区, url: https://huggingface.co/circlestone-labs/Anima/discussions/165, note: "HF 讨论区 #165" }
verified: 2026-11-24
---
CFG++ 把引导放进采样步骤内部，cfg 的含义与普通模式不同。
