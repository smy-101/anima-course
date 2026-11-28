---
symptom: "保存前缀里的 %变量% 没生效"
area: 工作流
first: "变量名写节点标题，不是类名"
then: "给节点改一个短标题（如 ks），再用 %ks.denoise%"
dont: "用中文标题带空格"
sources:
  - { badge: 源码, url: "https://github.com/comfyanonymous/ComfyUI/blob/master/nodes.py", note: "SaveImage.filename_prefix 的变量语法；最后一段是文件名开头，分目录要在它前面再写一段（2026-11-28 在 ComfyUI 0.46.4 上实测）" }
verified: 2026-11-24
---
官方提示的写法是 `%Empty Latent Image.width%`，也就是节点标题加控件名。更复杂的拼法用字符串格式化。

要按参数分目录，在变量后面再写一段，如 `Anima/L4_hires_d%KSampler.denoise%_s%LatentUpscaleBy.scale_by%/img`。前缀的最后一段是文件名开头，前面每一段才是一个目录。只在末尾加斜杠不算，最后一段不能省。见 [L8](/lessons/05-03-l8-compare-loop/)。
