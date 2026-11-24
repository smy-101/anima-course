# 补充B：开发者方向 —— ComfyUI HTTP API、无界面批量、自定义节点

> 面向对象：会写 Python、想把 ComfyUI 当作"可编程的生图后端"的学习者——批量跑参数扫描、把出图接进自己的脚本 / 服务、或写一个节点补上没有的功能。
> 调研时间：2026 年 11 月。依据：【源码】ComfyUI `master` 当日的 `script_examples/basic_api_example.py`、`custom_nodes/example_node.py.example`、`comfy/cli_args.py`；【官方】docs.comfy.org《ComfyUI Server Routes (HTTP and WebSocket API)》。
> 配套：《递进报告》L2 参数扫描（本文是其脚本版）、《节点详解》§1.2 数据类型、§3.8 工具节点。

## 0. 一页速览

| 要做的事 | 入口 |
|---|---|
| 把画布上的工作流变成可调用的 JSON | 工作流菜单 → **Export (API)**（旧称 Save (API Format)），得到 `{"节点id": {"class_type": …, "inputs": …}}` |
| 提交任务 | `POST http://127.0.0.1:8188/prompt`，body `{"prompt": <上面的JSON>}`；返回 `prompt_id` 与队列位置，校验失败返回 `error` + `node_errors` |
| 查进度 | `GET /history/{prompt_id}`（完成后含每张图的文件名）；或 WebSocket `/ws` 的 `progress` / `executing` / `executed` 消息 |
| 取图 | `GET /view?filename=…&subfolder=…&type=output` |
| 上传输入图 | `POST /upload/image`（multipart 表单） |
| 查有哪些节点 / 参数 | `GET /object_info`（全部）或 `/object_info/KSampler`（单个：参数类型、默认、范围、下拉选项） |
| 系统状态 | `GET /system_stats`（Python / torch 版本、设备、显存） |
| 控制 | `POST /interrupt` 中断当前任务；`GET/POST /queue` 查看 / 清空队列；`POST /free` 卸载模型释放显存 |
| 无界面常驻 | `python main.py --listen 127.0.0.1 --port 8188 --disable-auto-launch` |
| 自己写节点 | 一个 `.py` 放进 `custom_nodes/<你的目录>/`；官方当前示例用 **V3 节点 API**（`io.ComfyNode` + `define_schema` + `execute` + `comfy_entrypoint`）；老式 `NODE_CLASS_MAPPINGS` 写法仍完全支持，绝大多数社区节点用的是它 |

## 1. 工作流 → API JSON

### 1.1 导出

在画布上把工作流调好 → 菜单 **Export (API)**。与普通工作流 JSON 的区别：**只保留执行必需的信息**——节点 id、`class_type`（英文类名）、`inputs`；没有坐标、注释、连线的视觉信息。连线用 `["节点id", 输出序号]` 表示，例如 `"model": ["4", 0]` 表示"4 号节点的第 0 个输出"。被忽略（Bypass）的节点不会出现；控件被转成输入口时，值来自上游节点。导出后先打开 JSON 对一眼，节点 id 和你想改的参数名都在里面。

### 1.2 结构（源码示例，默认工作流）

```json
{
  "3": {"class_type": "KSampler", "inputs": {
      "cfg": 8, "denoise": 1, "seed": 8566257, "steps": 20,
      "sampler_name": "euler", "scheduler": "normal",
      "latent_image": ["5", 0], "model": ["4", 0], "negative": ["7", 0], "positive": ["6", 0]}},
  "4": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": "v1-5-pruned-ema.safetensors"}},
  "5": {"class_type": "EmptyLatentImage", "inputs": {"batch_size": 1, "height": 512, "width": 512}},
  "6": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["4", 1], "text": "masterpiece best quality girl"}},
  "7": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["4", 1], "text": "bad hands"}},
  "8": {"class_type": "VAEDecode", "inputs": {"samples": ["3", 0], "vae": ["4", 2]}},
  "9": {"class_type": "SaveImage", "inputs": {"filename_prefix": "ComfyUI", "images": ["8", 0]}}
}
```

Anima 版本把 4 号换成 `UNETLoader` / `CLIPLoader` / `VAELoader` 三个节点（《递进报告》§2.2），LoRA 走 `LoraLoaderModelOnly` 串在 `model` 线上。用了子图的工作流，导出后以 JSON 里实际出现的类名为准（子图在提交时会被展开为内部节点）。

### 1.3 提交与轮询（最小可用脚本）

```python
import json, time, uuid, urllib.request

COMFY = "http://127.0.0.1:8188"

def queue(prompt: dict) -> str:
    body = json.dumps({"prompt": prompt, "client_id": uuid.uuid4().hex}).encode()
    req = urllib.request.Request(f"{COMFY}/prompt", data=body,
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req) as r:
        resp = json.loads(r.read())
    if "error" in resp:
        raise RuntimeError(resp["error"], resp.get("node_errors"))
    return resp["prompt_id"]

def wait(prompt_id: str, timeout=1800) -> dict:
    t0 = time.time()
    while time.time() - t0 < timeout:
        with urllib.request.urlopen(f"{COMFY}/history/{prompt_id}") as r:
            hist = json.loads(r.read())
        if prompt_id in hist:
            return hist[prompt_id]      # 含 outputs: {节点id: {"images": [{filename, subfolder, type}]}}
        time.sleep(1)
    raise TimeoutError(prompt_id)

def images_of(history_item: dict) -> list[str]:
    out = []
    for node_out in history_item.get("outputs", {}).values():
        for im in node_out.get("images", []):
            out.append(f"{COMFY}/view?filename={im['filename']}"
                       f"&subfolder={im['subfolder']}&type={im['type']}")
    return out

if __name__ == "__main__":
    with open("anima_api.json", encoding="utf-8") as f:
        prompt = json.load(f)
    for cfg in (3.0, 3.5, 4.0, 4.5, 5.0):          # 改 JSON 里的一个值 = 一次扫描
        prompt["3"]["inputs"]["cfg"] = cfg
        prompt["9"]["inputs"]["filename_prefix"] = f"Anima/E001/cfg{cfg}"
        print(cfg, images_of(wait(queue(prompt))))
```

`client_id` 可省略（用于通过 WebSocket 接收进度）。历史记录项的结构：`outputs.<节点id>.images[]` 每项有 `filename / subfolder / type`，`type` 通常是 `output`。

### 1.4 参数扫描 = 循环改一个值

《递进报告》L2 用 `创建列表` 在画布上做扫描；脚本版就是循环改 `prompt["<id>"]["inputs"]["<param>"]` 再 `queue`。取舍：画布版一次排队、用 `图像表格` 拼图直观；脚本版适合几十上百组、要把参数写进 CSV、或要跟外部数据（一批提示词文件、一张表）绑定的场景。提示：若同一 JSON 重复提交没有产生新文件，是命中了节点缓存——改 seed、改 `filename_prefix`，或启动时加 `--force-output-rerun`（源码说明："即使结果已缓存也重新执行输出节点以写出文件"）。

### 1.5 WebSocket 进度（可选）

`ws://127.0.0.1:8188/ws?clientId=<client_id>`，消息类型（官方文档）：`status`、`execution_start`、`execution_cached`、`executing`（含当前节点 id；整个任务结束时为 `null`）、`progress`（当前步 / 总步数）、`executed`（节点完成）。长任务想显示"第几步"就监听 `progress`。

## 2. 无界面（headless）常驻

- 便携版：编辑 `.bat`，在 `python -s main.py` 后加 `--listen 127.0.0.1 --disable-auto-launch`；要局域网访问改 `--listen 0.0.0.0`。Windows 开机自启用任务计划程序。
- 手动 / git：`python main.py --disable-auto-launch`；Linux 服务器同。
- 桌面版：从 Home 启动 build 后，API 同样在该 build 的端口上可用；端口见构建页 Overview（迁移自 Legacy Desktop 的默认 8000；便携版 / 手动默认 8188）。
- 脚本开工前先 `GET /system_stats`：显存多少、torch 版本、设备名，省得跑到一半才发现不对。
- 批量期间别在前端改工作流——前端"Queue"与脚本共用一个执行队列；`GET /queue` 看积压，`POST /interrupt` 停当前任务。
- 日志：服务端控制台即日志；`--verbose DETAIL` 会在采样第一步打印模型 / 采样器 / 步数 / cfg / seed（《节点详解》§5.5）。

## 3. 自定义节点：最小可用

### 3.1 两套写法

| 写法 | 状态 | 用在哪 |
|---|---|---|
| 老式：`NODE_CLASS_MAPPINGS = {"类名": Python类}`，类里定义 `INPUT_TYPES()`（`required` / `optional` 字典）、`RETURN_TYPES`、`FUNCTION`、`CATEGORY`，目录的 `__init__.py` 里导出 | 仍完全支持 | 99% 的社区节点（WD14 Tagger、Impact Pack、UltimateSDUpscale……），读别人源码看到的都是它 |
| 新式 V3：`comfy_api.latest` 的 `io.ComfyNode`，`define_schema()` 返回 `io.Schema(node_id, inputs=[io.Image.Input(...), io.Int.Input(...)], outputs=[...])`，`execute()` 返回 `io.NodeOutput(...)`；用 `ComfyExtension.get_node_list()` 列出节点，`comfy_entrypoint()` 返回扩展 | 官方当前示例 | 核心新节点（`BasicScheduler`、`KSamplerSelect`、`SplitSigmas` 等都已改为 V3）与 `custom_nodes/example_node.py.example` |

### 3.2 骨架（照官方示例改，V3）

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

要点：① `inputs` 里声明的名字就是 `execute` 的关键字参数名；② 类型用 `io.Image / io.Model / io.Conditioning / io.Latent / io.Mask / io.Int / io.Float / io.String / io.Boolean / io.Combo`，输入用 `.Input(...)`、输出用 `.Output()`；③ 目录里放一个（可为空的）`__init__.py`，社区节点的通行做法；④ 改完代码要重启 ComfyUI（或 Manager 的 Reload），界面上按 `R` 刷新节点定义；⑤ 依赖写进 `pyproject.toml` 的 `[project] dependencies`，Manager 会据此安装；要发布到 registry 见 registry.comfy.org 的说明。

### 3.3 常见坑

- 节点改了但界面没变：重启；再按 `R`。
- 老式 `RETURN_TYPES` 写的是字符串 `"IMAGE"`；V3 用 `io.Image.Output()`。两套别混在一个类里。
- 节点里 `print` 出现在**服务端控制台**，不是浏览器；要在画布上看用核心节点 `预览任意`。
- 张量约定（《节点详解》§1.2）：`IMAGE` 是 `[B, H, W, C]` float32、0–1；`MASK` 是 `[B, H, W]`；`LATENT` 是 `{"samples": [B, C, H//8, W//8]}`。别假设设备类型，用传入张量自己的 `.device`。
- `fingerprint_inputs` 可控制"输入没变时是否重算"（官方示例里有注释）。
- 想加自己的 HTTP 路由：`@PromptServer.instance.routes.get("/hello")`（官方 Server Routes 文档有示例）。

## 4. 对 Anima 学习的具体用法

1. **参数扫描脚本化**：L2 的 cfg × seed、采样器 × 调度器网格用 §1.3 的循环跑，参数与文件名写进 CSV，配合《补充A》的记录表。
2. **提示词 A/B**：一批提示词存成 JSON / YAML，脚本逐条提交，`filename_prefix` 带上提示词 id。
3. **练手小节点**："把 tagger 输出的下划线标签转成空格并按四段式排序"——十来行代码，正好把《补充A》与本文连起来。
4. **先画布后脚本**：永远先在画布上把工作流跑通、Export (API)，再写脚本——不要手写 JSON。

## 5. 来源

- 【源码】`script_examples/basic_api_example.py`（API JSON 结构与提交方式）、`custom_nodes/example_node.py.example`（V3 节点 API）、`comfy/cli_args.py`（`--listen / --port / --disable-auto-launch / --force-output-rerun / --verbose`）、`server.py`（路由定义，文档指引"搜 `@routes`"）
- 【官方】https://docs.comfy.org/development/comfyui-server/comms_routes （路由表与 WebSocket 消息类型）
