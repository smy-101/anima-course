---
name_zh: 字符串连接
category: 工具
first_level: L8
sources:
  - { badge: 源码, url: "https://github.com/comfyanonymous/ComfyUI/blob/master/comfy_extras/nodes_string.py", note: "参数" }
verified: 2026-11-24
inputs:
  - { name: string_a, type: STRING, desc: "前半" }
  - { name: string_b, type: STRING, desc: "后半" }
params:
  - { name: delimiter, default: "", range: "字符串", desc: "中间夹的分隔符" }
outputs:
  - { name: STRING, type: STRING, desc: "拼好的字符串，接 CLIP文本编码.text 或文件名前缀" }
---

把提示词前缀与正文、或文件名的各段拼起来。配合作战：`字符串（多行）` 存前缀 → 字符串连接 → 接 CLIP文本编码 的 text，改一处全图生效。
