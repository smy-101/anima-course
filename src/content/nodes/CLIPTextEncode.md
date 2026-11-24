---
name_zh: CLIP文本编码
category: 提示词与条件
first_level: L0
sources:
  - { badge: 源码, url: https://github.com/comfyanonymous/ComfyUI/blob/master/nodes.py, note: 参数 }
  - { badge: 源码, url: https://github.com/comfyanonymous/ComfyUI/blob/master/comfy/text_encoders/anima.py, note: "Anima 双分词器、Qwen 路权重归 1、无长度截断" }
verified: 2026-11-24
inputs:
  - { name: clip, type: CLIP, desc: "接 加载CLIP 的输出" }
params:
  - { name: text, default: "", range: "多行文本", desc: "提示词。Anima 写法见课程「提示词基础」" }
outputs:
  - { name: CONDITIONING, type: CONDITIONING, desc: "编码后的提示词向量" }
---

每个工作流至少两个：一个写正向，一个写负向。把提示词抽出来集中管理可以用字符串（多行）节点，再用创建列表一次跑多条提示词。

Anima 的 `text` 不会被截断（`max_length=99999999`），写长了不听话是注意力稀释。`(tag:1.2)` 这种权重只在 T5 一路生效，Qwen 路无视——所以要 1.5 起、2.0 才明显。
