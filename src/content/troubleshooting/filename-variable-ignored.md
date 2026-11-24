---
symptom: "保存前缀里的 %变量% 没生效"
area: 工作流
first: "变量名写节点标题，不是类名"
then: "给节点改一个短标题（如 ks），再用 %ks.denoise%"
dont: "用中文标题带空格"
sources:
  - { badge: 源码, url: "https://github.com/comfyanonymous/ComfyUI/blob/master/nodes.py", note: "SaveImage.filename_prefix 的变量语法" }
verified: 2026-11-24
---
官方提示的写法是 `%Empty Latent Image.width%`——节点标题 + 控件名。更复杂的拼法用字符串格式化。见 [L8](/lessons/05-03-l8-compare-loop/)。
