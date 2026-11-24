---
symptom: "FaceDetailer 把脸换人了 / 修过头"
area: 重绘
first: "denoise 降到 0.35"
then: "提示词只写这张脸该有的样子，不写与角色冲突的描述；漏检就降 bbox_threshold"
dont: "把整图提示词原样接进去"
sources:
  - { badge: 社区, url: "https://github.com/ltdrdata/ComfyUI-Impact-Pack", note: Impact Pack README }
  - { badge: 社区, note: "《递进报告》§5 速查表与各级常见问题：综合官方、作者与社区" }
verified: 2026-11-24
---
先看 `cropped_refined` 单张小图，再决定是否升 denoise。见 [扩图、裁剪法与 Detailer](/lessons/04-03-l6-outpaint/)。
