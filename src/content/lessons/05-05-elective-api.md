---
title: 选修 A · 用脚本批量出图
stage: 5
order: 5
elective: true
summary: "学完你能把跑通的工作流导出成 API JSON，用几十行 Python 提交、轮询、取图，写成扫描循环，并无界面启动 ComfyUI。"
levels: []
days: []
promptTrack: false
prerequisites:
  - 05-04-l8-pipeline
nodes:
  - UNETLoader
  - CLIPLoader
  - VAELoader
  - LoraLoaderModelOnly
  - KSampler
  - SaveImage
tags: []
deliverable: 一个能对 Anima 工作流跑 cfg 扫描、把参数和文件名写进 CSV 的脚本；一次无界面启动并用 /system_stats 确认环境。
acceptance:
  - 画布上跑通的 Anima 工作流导出了 API JSON，打开能看到节点 id、class_type、inputs
  - 脚本提交一次任务，从 /history 取到图片文件名并用 /view 下载到本地
  - 用循环跑完一次 cfg 3 / 3.5 / 4 / 4.5 / 5 的扫描，参数与文件名写进 CSV
  - 知道同一份 JSON 重复提交不出新文件时怎么办
  - 无界面启动过一次，并用 /system_stats 确认了显存与 torch 版本
sources:
  - badge: 源码
    url: https://github.com/comfyanonymous/ComfyUI/blob/master/script_examples/basic_api_example.py
    note: "API JSON 结构与提交方式"
  - badge: 源码
    url: https://github.com/comfyanonymous/ComfyUI/blob/master/server.py
    note: "路由定义：/prompt、/history、/view、/upload/image、/object_info、/system_stats、/queue、/interrupt、/free、/ws"
  - badge: 源码
    url: https://github.com/comfyanonymous/ComfyUI/blob/master/comfy/cli_args.py
    note: "--listen / --port / --disable-auto-launch / --force-output-rerun"
  - badge: 官方
    url: https://docs.comfy.org/zh/development/comfyui-server/comms_routes
    note: "ComfyUI 服务器路由（HTTP 和 WebSocket API）：路由表与 WebSocket 消息类型"
verified: 2026-11-24
---

## 路由速查

会写 Python 的话，ComfyUI 不只是个画布：它是一个本地的 HTTP 服务，画布只是它的一个客户端。这一课把 [L2 的参数扫描](/lessons/02-01-l2-sweeps/)做成脚本版。几十上百组参数、结果要写进表格、要跟一批提示词文件绑定，这些时候脚本省事得多。**先画布，后脚本**。工作流永远先在画布上跑通、对照过，再导出给脚本，不要手写 JSON。

| 要做的事 | 入口 |
|---|---|
| 把画布上的工作流变成可调用的 JSON | 工作流菜单里的 **Export (API)**，旧称 Save (API Format)，得到 `{"节点id": {"class_type": …, "inputs": …}}` |
| 提交任务 | `POST http://127.0.0.1:8188/prompt`，body 是 `{"prompt": <上面的 JSON>}`；返回 `prompt_id` 与队列位置，校验失败返回 `error` + `node_errors` |
| 查进度 | `GET /history/{prompt_id}`，完成后含每张图的文件名；或 WebSocket `/ws` 的 `progress` / `executing` / `executed` 消息 |
| 取图 | `GET /view?filename=…&subfolder=…&type=output` |
| 上传输入图 | `POST /upload/image`，multipart 表单 |
| 查有哪些节点 / 参数 | `GET /object_info`（全部）或 `/object_info/KSampler`（单个：参数类型、默认、范围、下拉选项） |
| 系统状态 | `GET /system_stats`，Python、torch 版本、设备、显存 |
| 控制 | `POST /interrupt` 中断当前任务；`GET` / `POST /queue` 查看、清空队列；`POST /free` 卸载模型释放显存 |
| 无界面常驻 | `python main.py --listen 127.0.0.1 --port 8188 --disable-auto-launch` |

全部路由与消息类型见官方文档《ComfyUI 服务器路由》，就是本页来源徽章里那一条。

## 导出 API JSON

在画布上把工作流调好，点工作流菜单里的 **Export (API)**。它与普通工作流 JSON 的区别是只保留执行必需的信息：节点 id、`class_type`（英文类名）和 `inputs`。坐标、注释和连线的视觉信息都没有。连线用 `["节点id", 输出序号]` 表示，例如 `"model": ["4", 0]` 表示 4 号节点的第 0 个输出。被忽略（Bypass）的节点不会出现。控件被转成输入口时，值来自上游节点。导出后先打开 JSON 对一眼，节点 id 和你想改的参数名都在里面。

官方示例（默认工作流）的结构：

```json
{
  "3": {"class_type": "KSampler", "inputs": {
      "cfg": 8, "denoise": 1, "seed": 8566257, "steps": 20,
      "sampler_name": "euler", "scheduler": "normal",
      "latent_image": ["5", 0], "model": ["4", 0], "negative": ["7", 0], "positive": ["6", 0]}},
  "4": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": "v1-5-pruned-emaonly.safetensors"}},
  "5": {"class_type": "EmptyLatentImage", "inputs": {"batch_size": 1, "height": 512, "width": 512}},
  "6": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["4", 1], "text": "masterpiece best quality girl"}},
  "7": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["4", 1], "text": "bad hands"}},
  "8": {"class_type": "VAEDecode", "inputs": {"samples": ["3", 0], "vae": ["4", 2]}},
  "9": {"class_type": "SaveImage", "inputs": {"filename_prefix": "ComfyUI", "images": ["8", 0]}}
}
```

Anima 版本把 4 号换成 [UNet加载器](/nodes/UNETLoader/)、[加载CLIP](/nodes/CLIPLoader/)、[加载VAE](/nodes/VAELoader/) 三个节点。LoRA 走 [LoRA加载器（仅模型）](/nodes/LoraLoaderModelOnly/) 串在 `model` 线上，连线见 [L1](/lessons/01-02-l1-controllable/)。用了子图的工作流，以导出 JSON 里实际出现的类名为准。提交时子图会展开成内部节点，`class_type` 不再是你画的那个子图节点。

## 提交与轮询

只用标准库，复制即用：

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

- `client_id` 可省略，它用于通过 WebSocket 接收进度。
- 历史记录项的结构：`outputs.<节点id>.images[]` 每项有 `filename`、`subfolder`、`type`，`type` 通常是 `output`，预览节点是 `temp`。
- 校验失败时 `node_errors` 会告诉你哪个节点缺输入、哪个类名不存在。后者多半是没装自定义节点包，先在画布上解决。

## 循环做参数扫描

[L2](/lessons/02-01-l2-sweeps/) 用创建列表在画布上做扫描，脚本版就是循环改 `prompt["<id>"]["inputs"]["<param>"]` 再 `queue`。两者的取舍：

| | 画布版，创建列表加 batch | 脚本版 |
|---|---|---|
| 适合 | 几到十几个取值，想当场看图 | 几十上百组；参数要写进 CSV；要跟一批提示词文件或一张表绑定 |
| 对照图 | 图像表格 直接拼 | 自己拼，或只记文件名回画布看 |
| 归因 | 一次只改一个变量（T1 / T2） | 同样，循环里只改一个值，`filename_prefix` 带上它 |

**四条纪律在脚本里更不能丢**。脚本里 seed 固定、分辨率固定、每次只动一个值。`filename_prefix` 带实验 ID 与参数，如 `Anima/E001/cfg4.0`，与[实验记录本](/resources/experiment-log/)对得上。

同一份 JSON 重复提交没有产生新文件，是命中了节点缓存：上游没变，输出节点就不重跑。改 seed、改 `filename_prefix`，或启动时加 `--force-output-rerun`。`--force-output-rerun` 的意思是即使结果已缓存，也重新执行输出节点以写出文件，上游节点照常缓存。见[启动参数](/resources/startup-args/)。

## WebSocket 进度

WebSocket 地址是 `ws://127.0.0.1:8188/ws?clientId=<client_id>`。消息类型有 `status`、`execution_start`、`execution_cached`、`executing`、`progress` 和 `executed`。`executing` 带当前节点 id，整个任务结束时为 `null`；`progress` 是当前步和总步数；`executed` 表示节点完成。长任务想显示“第几步”就监听 `progress`，只在完成后取图的话，轮询 `/history` 就够了。

## 无界面常驻

| 安装方式 | 怎么起 |
|---|---|
| 便携版 | 编辑 `.bat`，在 `python -s main.py` 后加 `--listen 127.0.0.1 --disable-auto-launch`；要局域网访问改 `--listen 0.0.0.0`。Windows 开机自启用任务计划程序 |
| 手动安装 / Linux 服务器 | `python main.py --disable-auto-launch` |
| 桌面版 | 从启动器 Home 启动 build 后，API 同样在该 build 的端口上可用；端口见构建页 Overview。桌面版默认 8000，沿袭自 Legacy Desktop；便携版和手动安装默认 8188 |

- 脚本开工前先 `GET /system_stats`：显存多少、torch 版本、设备名，省得跑到一半才发现不对。
- 批量期间别在前端改工作流，前端 Queue 与脚本共用一个执行队列。`GET /queue` 看积压，`POST /interrupt` 停当前任务。
- 日志：服务端控制台即日志。`--verbose DETAIL` 会在采样第一步打印模型、采样器、步数、cfg、seed，见[启动参数](/resources/startup-args/)。
- 这台机器上只监听回环地址 `127.0.0.1` 就够。`--listen 0.0.0.0` 会把一个能执行任意节点包的服务暴露到局域网，只在可信网络里用。

## 具体用法

1. 参数扫描脚本化。L2 的 cfg × seed、采样器 × 调度器网格用上面的循环跑，参数与文件名写进 CSV。CSV 表头照[实验记录模板](/resources/experiment-log/)的列名写，就能导进[实验记录本](/tools/lab-log/)手写目的与结论。
2. 提示词 A / B。一批提示词存成 JSON 或 YAML，脚本逐条提交，`filename_prefix` 带上提示词 id。
3. 接进自己的流程。先出图，在外部处理，如拼接、打标签、入库，再提交图生图。两段之间用 `POST /upload/image` 把处理过的图送回 `input/`。
4. 先画布后脚本。永远先在画布上把工作流跑通、Export (API)，再写脚本。

## 常见问题

| 现象 | 原因 | 处理 |
|---|---|---|
| 连不上 `127.0.0.1:8188` | 桌面版的端口不是 8188，或服务没起 | 看启动日志里的 `To see the GUI go to:`；`GET /system_stats` 试一下 |
| 提交返回 `error` 和 `node_errors` | 某节点缺输入，或 `class_type` 不存在 | 按提示的节点 id 查 JSON；类名不存在就是缺自定义节点包，先在画布上解决 |
| 提交成功但 `outputs` 为空 | 工作流里没有输出节点，保存或预览，或输出节点被 Bypass | 导出前确认保存图像节点在 |
| 重复提交不出新文件 | 节点缓存 | 改 seed 或 `filename_prefix`，或 `--force-output-rerun` |
| 轮询 `/history` 一直为空 | 任务还在排队，或已被中断 | `GET /queue` 看积压；服务端控制台看报错 |
| 桌面版关了窗口脚本就连不上 | 服务随应用退出 | 批量期间保持运行；长期跑用便携版或手动安装做无界面常驻 |

想给 ComfyUI 加一个它没有的功能，比如一个整理标签的节点，看下一篇选修。
