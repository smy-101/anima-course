---
symptom: "启动日志有 import failed"
area: 环境
first: "--disable-all-custom-nodes 逐个定位；配合 --whitelist-custom-nodes 放回（见[启动参数](/resources/startup-args/)）"
then: "Manager 更新 / 重装该节点"
dont: ""
sources:
  - { badge: 源码, note: "《节点详解》§5.2–5.3，依据源码与官方文档" }
verified: 2026-11-24
---
自定义节点依赖缺失或与新版本不兼容。
