---
symptom: "提示词一长就不听话"
area: 提示词
first: "精简到 15～30 个标签；分段（空行）；删形容词堆砌"
then: "把关键内容靠前"
dont: "继续加"
sources:
  - { badge: 源码, url: https://github.com/comfyanonymous/ComfyUI/blob/master/comfy/text_encoders/anima.py, note: "max_length 无截断" }
verified: 2026-11-24
---
ComfyUI 不截断，是注意力稀释。
