---
title: 选修 B · 写一个自定义节点
stage: 5
order: 6
elective: true
summary: "学完你能照官方示例写一个透传节点，分清老式 NODE_CLASS_MAPPINGS 与 V3 两套写法，知道张量约定和调试时的常见问题。"
levels: []
days: []
promptTrack: false
prerequisites:
  - 05-04-l8-pipeline
nodes:
  - KSampler
  - CLIPTextEncode
  - PreviewImage
tags: []
deliverable: 一个出现在节点库、能拖进画布运行的透传节点；打印出现在服务端控制台。
acceptance:
  - custom_nodes/<你的目录>/ 里的节点重启后出现在节点库，拖进画布能运行
  - 节点里的 print 出现在服务端控制台，不是浏览器
  - 能说出老式 NODE_CLASS_MAPPINGS 与新式 V3 两套写法各在哪里见到，且不混用
  - 知道 IMAGE / MASK / LATENT 三种张量的形状约定
  - 写出“下划线标签转空格并按四段式排序”的小节点，或等价的练手节点
sources:
  - badge: 源码
    url: https://github.com/comfyanonymous/ComfyUI/blob/master/custom_nodes/example_node.py.example
    note: "V3 节点 API：io.ComfyNode、define_schema、execute、ComfyExtension、comfy_entrypoint、fingerprint_inputs、自定义路由"
  - badge: 源码
    url: https://github.com/comfyanonymous/ComfyUI/blob/master/nodes.py
    note: "老式写法：INPUT_TYPES / RETURN_TYPES / FUNCTION / CATEGORY / NODE_CLASS_MAPPINGS"
  - badge: 官方
    url: https://docs.comfy.org/zh/development/core-concepts/custom-nodes
    note: 自定义节点开发文档
  - badge: 官方
    url: https://docs.comfy.org/registry/overview
    note: "发布到 Comfy Registry：pyproject.toml 与依赖声明"
verified: 2026-11-24
---

## 两套写法

ComfyUI 没有、社区也没人写的那个小功能，可以自己写一个节点补上。比如把 Tagger 输出的下划线标签转成空格，并按四段式排好序。这一课只做最小可用：一个目录、一个 `.py`，让节点出现在节点库、能跑、能打印调试信息。读完还能看懂 99% 的社区节点源码。

| 写法 | 状态 | 用在哪 |
|---|---|---|
| 老式：`NODE_CLASS_MAPPINGS = {"类名": Python类}`，类里定义 `INPUT_TYPES()`（`required` / `optional` 字典）、`RETURN_TYPES`、`FUNCTION`、`CATEGORY`，目录的 `__init__.py` 里导出 | 仍完全支持 | 99% 的社区节点，如 WD14 Tagger、Impact Pack、UltimateSDUpscale，读别人源码看到的都是它 |
| 新式 V3：`comfy_api.latest` 的 `io.ComfyNode`，`define_schema()` 返回 `io.Schema(node_id, inputs=[io.Image.Input(...), io.Int.Input(...)], outputs=[...])`，`execute()` 返回 `io.NodeOutput(...)`；用 `ComfyExtension.get_node_list()` 列出节点，`comfy_entrypoint()` 返回扩展 | 官方当前示例 | 核心新节点，如[基本调度器](/nodes/BasicScheduler/)、[K采样器选择](/nodes/KSamplerSelect/)、[分离Sigma降噪](/nodes/SplitSigmasDenoise/)，都已改为 V3；官方 `example_node.py.example` |

两套别混在一个类里：老式 `RETURN_TYPES` 写的是字符串 `"IMAGE"`，V3 用 `io.Image.Output()`。**新写节点建议用 V3**，类型、默认值、范围都在 schema 里声明，前端和校验都从它来。

## 骨架

```
custom_nodes/
└── my_nodes/
    ├── __init__.py      ← 可以是空文件；社区节点的通行做法
    └── example.py
```

```python
# custom_nodes/my_nodes/example.py
from typing_extensions import override
from comfy_api.latest import ComfyExtension, io

class PassThrough(io.ComfyNode):
    @classmethod
    def define_schema(cls) -> io.Schema:
        return io.Schema(
            node_id="PassThrough",
            display_name="示例：透传",
            category="my_nodes",
            inputs=[
                io.Image.Input("image"),
                io.Float.Input("cfg", default=4.0, min=0.0, max=100.0, step=0.1),
                io.Combo.Input("mode", options=["a", "b"]),
            ],
            outputs=[io.Image.Output()],
        )

    @classmethod
    def execute(cls, image, cfg, mode) -> io.NodeOutput:
        print(f"cfg={cfg} mode={mode}")       # 打印在服务端控制台
        return io.NodeOutput(image)           # 这里放你的处理

class MyExtension(ComfyExtension):
    @override
    async def get_node_list(self) -> list[type[io.ComfyNode]]:
        return [PassThrough]

async def comfy_entrypoint() -> MyExtension:  # ComfyUI 用它加载你的扩展
    return MyExtension()
```

要点：

1. **声明的输入名就是 `execute` 的关键字参数名**，顺序无关。
2. 类型用 `io.Image / io.Model / io.Conditioning / io.Latent / io.Mask / io.Int / io.Float / io.String / io.Boolean / io.Combo`，输入用 `.Input(...)`、输出用 `.Output()`。`io.Int.Input` / `io.Float.Input` 的 `default / min / max / step` 就是画布上控件的默认值与范围，和本站节点卡里列的参数是同一回事。
3. 目录里放一个 `__init__.py`，可以是空文件。
4. 改完代码要重启 ComfyUI，或用 Manager 的 Reload。界面上按 `R` 刷新节点定义。
5. `fingerprint_inputs` 可控制“输入没变时是否重算”，官方示例里有注释：返回值与上次不同才重跑。
6. 想加自己的 HTTP 路由，写 `@PromptServer.instance.routes.get("/hello")`，官方示例与[服务器路由文档](https://docs.comfy.org/zh/development/comfyui-server/comms_routes)都有。
7. 依赖写进 `pyproject.toml` 的 `[project] dependencies`，Manager 会据此安装。要发布到 Comfy Registry 见 registry 的说明，就是本页来源徽章里那一条。

## 张量约定

在节点里拿到的数据是这样组织的，潜空间是什么在[准备课](/lessons/00-01-setup/)讲过：

| 类型 | 形状 | 备注 |
|---|---|---|
| `IMAGE` | `[B, H, W, C]`，float32，0 ~ 1 | 通道在最后，不是 PyTorch 惯例的 `[B, C, H, W]` |
| `MASK` | `[B, H, W]` | 与 IMAGE 同高宽 |
| `LATENT` | `{"samples": [B, C, H // 8, W // 8]}` | 不要直接改；要改像素先 [VAE解码](/nodes/VAEDecode/) |

别假设设备类型，用传入张量自己的 `.device`，新张量也放到同一个设备上。

## 标签整理节点

把《补充A》里的反推标签和这一课连起来，只要十来行代码。输入一个多行字符串，即 Tagger 输出、下划线分隔，输出一个整理好的提示词。整理规则是下划线换空格、去重，再按[四段式](/lessons/01-03-prompt-basics/)的顺序排。第一段是质量、年代、元数据和安全，第二段是人数，第三段是角色和画师，第四段是其它。几个提示：

- 输入用 `io.String.Input("tags", multiline=True)`，输出 `io.String.Output()`。
- 排序用一张小表，记每个段的关键词前缀。例如 `score_`、`masterpiece` 属第一段，`1girl` / `1boy` / `solo` 属第二段，不在表里的放最后。
- `execute` 里 `print` 整理前后的字符串，服务端控制台就能看到。想在画布上看，输出接一个 `预览任意` 类节点。
- 写完在画布上把它接在 [Tagger](/lessons/01-03-prompt-basics/) 与 [CLIP文本编码](/nodes/CLIPTextEncode/) 之间，跑一张验证。

## 常见问题

| 现象 | 原因 | 处理 |
|---|---|---|
| 节点改了但界面没变 | 代码没重新加载 | 重启 ComfyUI，再按 `R` |
| 节点库里找不到自己的节点 | 目录没有 `__init__.py`；`comfy_entrypoint` 没返回扩展；`py` 文件有语法错误 | 看服务端启动日志的 `import failed`，逐个排除；`--disable-all-custom-nodes` 定位法见[启动参数](/resources/startup-args/) |
| `execute` 报缺少参数 | schema 里的输入名与函数参数名不一致 | 两者必须完全相同 |
| `print` 在浏览器里看不到 | 打印在服务端控制台 | 看启动 ComfyUI 的那个窗口或终端 |
| 图像尺寸对不上 | IMAGE 是 `[B, H, W, C]`，按 `[B, C, H, W]` 处理了 | permute 之后再换回来 |
| 类型不匹配、连线是红的 | 老式 `"IMAGE"` 与 V3 `io.Image` 混在一个类里 | 一个类只用一套写法 |
| 与核心节点同名 | `node_id` 撞车，一个会把另一个盖掉 | 给 `node_id` 加自己的前缀，如 `MyCompany_PassThrough` |

两篇选修到这里结束。往后排错、写提示词、记实验，回到站内的[排错速查](/troubleshooting/)、[标签字典](/tags/)与[实验记录模板](/resources/experiment-log/)；季度回来对照一次各页的核实日期。
