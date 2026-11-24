---
symptom: "两段采样第二段出图是纯噪声"
area: 工作流
first: "第二段 add_noise = disable，第一段 return_with_leftover_noise = enable"
then: "想每段 30 步，两段的 steps 都设 60（起止步按全表索引截取）"
dont: "给第二段再接一个随机噪波"
sources:
  - { badge: 源码, url: "https://github.com/comfyanonymous/ComfyUI/blob/master/nodes.py", note: KSamplerAdvanced 参数 }
verified: 2026-11-24
---
拆开写法等价：第二段用 禁用噪波，latent_image 接第一段 output。见 [L7](/lessons/05-01-l7-custom-sampler/)。
