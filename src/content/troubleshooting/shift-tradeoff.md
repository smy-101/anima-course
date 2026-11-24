---
symptom: "shift 调高后图变糊 / 变慢"
area: 参数
first: "steps 加 5 ~ 10 再看"
then: "shift 回到 3（Anima 默认）；用 LLLite v2 权重时保持 3.0"
dont: "cfg / steps 没定就调 shift"
sources:
  - { badge: 源码, url: "https://github.com/comfyanonymous/ComfyUI/blob/master/comfy/supported_models.py", note: "Anima shift 写死 3.0" }
  - { badge: 官方, url: "https://huggingface.co/kohya-ss/Anima-LLLite", note: "v2 权重训练时 shift 3.0" }
verified: 2026-11-24
---
步数固定时，高噪声段分到更多步、低噪声段变少。T4 参数只在 T1–T3 调好后碰。见 [L7](/lessons/05-02-l7-shift-guidance/)。
