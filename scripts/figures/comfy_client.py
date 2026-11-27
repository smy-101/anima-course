"""ComfyUI HTTP 客户端 + API 格式工作流的拼装工具。

直连 127.0.0.1:8188（WSL mirrored 网络，Windows 端的 Comfy Desktop），用 http.client，
不经过任何代理。用法见 figures.py。
"""
from __future__ import annotations

import http.client
import io
import json
import mimetypes
import os
import shutil
import time
import uuid
from pathlib import Path

HOST, PORT = "127.0.0.1", 8188
SHARED = Path("/mnt/d/Comfy-Desktop/ComfyUI-Shared")
OUTPUT_DIR = SHARED / "output"
INPUT_DIR = SHARED / "input"
CLIENT_ID = "anima-figures"  # 只用于 WebSocket 事件；执行缓存对照的是同一节点 id 的上一次执行


# ---------------------------------------------------------------- HTTP 基础
def _req(method, path, body=None, headers=None, timeout=120):
    c = http.client.HTTPConnection(HOST, PORT, timeout=timeout)
    data = None
    hdrs = dict(headers or {})
    if body is not None:
        data = body if isinstance(body, (bytes, bytearray)) else json.dumps(body).encode()
        hdrs.setdefault("Content-Type", "application/json")
    c.request(method, path, body=data, headers=hdrs)
    r = c.getresponse()
    raw = r.read()
    c.close()
    if not raw:
        return r.status, None
    try:
        return r.status, json.loads(raw)
    except Exception:
        return r.status, raw.decode(errors="replace")


def queue() -> dict:
    _, q = _req("GET", "/queue")
    return q or {}


def submit(prompt: dict, extra_data: dict | None = None) -> str:
    body = {"prompt": prompt, "client_id": CLIENT_ID}
    if extra_data:
        body["extra_data"] = extra_data
    st, resp = _req("POST", "/prompt", body)
    if st != 200:
        raise RuntimeError(f"submit failed HTTP {st}: {json.dumps(resp, ensure_ascii=False)[:3000]}")
    return resp["prompt_id"]


def history(prompt_id: str) -> dict | None:
    _, h = _req("GET", f"/history/{prompt_id}")
    return (h or {}).get(prompt_id)


def wait(prompt_id: str, timeout=3600, poll=1.0) -> dict:
    t0 = time.time()
    while time.time() - t0 < timeout:
        h = history(prompt_id)
        if h:
            st = h.get("status", {})
            if st.get("status_str") == "error" or st.get("completed", False):
                return h
        time.sleep(poll)
    raise TimeoutError(f"prompt {prompt_id} not finished in {timeout}s")


def output_files(entry: dict) -> list[tuple[str, str, str]]:
    """[(filename, subfolder, type)]"""
    out = []
    for node_out in entry.get("outputs", {}).values():
        for key in ("images", "gifs", "videos"):
            for im in node_out.get(key, []) or []:
                out.append((im["filename"], im.get("subfolder", ""), im.get("type", "output")))
    return out


def copy_outputs(entry: dict, dest_dir: Path) -> list[Path]:
    dest_dir.mkdir(parents=True, exist_ok=True)
    copied = []
    for fn, sub, typ in output_files(entry):
        if typ != "output":
            continue
        # Windows 端返回的 subfolder 带反斜杠
        src = OUTPUT_DIR / sub.replace("\\", "/") / fn.replace("\\", "/")
        dst = dest_dir / fn
        shutil.copy2(src, dst)
        copied.append(dst)
    return copied


def upload(path: Path, subfolder: str = "anima-course") -> str:
    """multipart 上传到 ComfyUI 的 input 目录，返回节点里要填的文件名（含子目录）。"""
    boundary = "----animafigures" + uuid.uuid4().hex
    name = f"{subfolder}/{Path(path).name}"
    ctype = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    body = io.BytesIO()
    for k, v in (("subfolder", subfolder), ("overwrite", "true")):
        body.write(f"--{boundary}\r\nContent-Disposition: form-data; name=\"{k}\"\r\n\r\n{v}\r\n".encode())
    body.write(f"--{boundary}\r\nContent-Disposition: form-data; name=\"image\"; filename=\"{Path(path).name}\"\r\nContent-Type: {ctype}\r\n\r\n".encode())
    body.write(Path(path).read_bytes())
    body.write(f"\r\n--{boundary}--\r\n".encode())
    st, resp = _req("POST", "/upload/image", body.getvalue(), {"Content-Type": f"multipart/form-data; boundary={boundary}"})
    if st != 200:
        raise RuntimeError(f"upload failed HTTP {st}: {resp}")
    return name


def free_cache():
    """清掉 ComfyUI 的执行缓存（同样输入的节点不会重跑），模型留在显存里。"""
    st, resp = _req("POST", "/free", {"unload_models": False, "free_memory": True})
    if st != 200:
        raise RuntimeError(f"free failed HTTP {st}: {resp}")


def run(prompt: dict, dest_dir: Path, label: str = "", extra_data: dict | None = None) -> tuple[dict, list[Path]]:
    """submit → wait → copy。返回 (history 条目, 拷回的文件)。"""
    pid = submit(prompt, extra_data)
    t0 = time.time()
    h = wait(pid)
    dt = time.time() - t0
    st = h.get("status", {})
    if st.get("status_str") == "error":
        msgs = [m for m in st.get("messages", []) if m[0] == "execution_error"]
        raise RuntimeError(f"[{label or pid}] execution error: {json.dumps(msgs, ensure_ascii=False)[:3000]}")
    files = copy_outputs(h, dest_dir)
    print(f"[{label or pid}] {dt:6.1f}s → {[f.name for f in files]}", flush=True)
    return h, files


# ---------------------------------------------------------------- 图的拼装
class Graph:
    """API 格式（/prompt 的 prompt 字段）。节点 id 用 int，连线写 [源 id, 源槽位]。"""

    def __init__(self):
        self.nodes: dict[int, dict] = {}
        self._next = 1

    def add(self, class_type: str, inputs: dict | None = None, title: str | None = None, nid: int | None = None) -> int:
        if nid is None:
            nid = self._next
            self._next += 1
        n = {"class_type": class_type, "inputs": inputs or {}}
        if title:
            n["_meta"] = {"title": title}
        self.nodes[nid] = n
        return nid

    def out(self, nid: int, slot: int = 0) -> list:
        return [str(nid), slot]

    def prompt(self) -> dict:
        return {str(k): v for k, v in self.nodes.items()}


# ---------------------------------------------------------------- Anima 基线
# 官方模板（Anima Base v1）的加载器取值；本机装的是 preview3 权重，文件名以本机为准。
UNET = "anima-base-v1.0.safetensors"  # 官方模板用的权重；课程正文按它写
CLIP = "qwen_3_06b_base.safetensors"
VAE = "qwen_image_vae.safetensors"

# 官方模板默认负向（ComfyUI 模板）
NEG_TEMPLATE = "worst quality, low quality, score_1, score_2, score_3, blurry, jpeg artifacts, sepia"
# 模型卡负向（Base / Aesthetic，CFG 4–5）
NEG_CARD = "worst quality, low quality, score_1, score_2, score_3, artist name, blurry, jpeg artifacts, chromatic aberration"

# 提示词模板（resources/prompt-templates.md）
TPL_A = ("masterpiece, best quality, score_7, newest, highres, safe, "
         "1girl, solo, long black hair, amber eyes, white sailor dress, hair ribbon, standing, looking at viewer, "
         "gentle smile, upper body, outdoors, cherry blossoms, wind, sunlight, depth of field")
TPL_B = ("An anime illustration of a young woman with long black hair and amber eyes, standing under a cherry tree in full bloom. "
         "She wears a white sailor dress with a red ribbon, and petals drift around her in the wind. "
         "Warm afternoon sunlight falls on her face, and the background is soft and out of focus.")
TPL_C = ("masterpiece, best quality, safe, 1girl, solo, long black hair, amber eyes, white sailor dress, red hair ribbon, gentle smile. "
         "She stands beneath a cherry tree in full bloom, with one hand reaching out to catch a falling petal. "
         "The late-afternoon sun lights her from the left, and the park behind her is softly blurred.")
# 官方 Anima Base v1 模板自带的示例提示词
TPL_EXAMPLE = ("Anime monochrome cyberpunk front portrait, male figure, sleek skin with delicate mechanical lines, "
               "piercing glowing eyes, partial exposed metallic mecha components and light cables, sharp domineering cool style, "
               "textured anime brushwork, faint circuit background, high contrast chiaroscuro lighting, immersive cinematic shadows, "
               "ultra fine details, 8K high-def render, futuristic dystopian mood")


def loaders(g: Graph, nid: int = 10) -> tuple[int, int, int]:
    """返回 (model, clip, vae) 三个节点的 id。"""
    m = g.add("UNETLoader", {"unet_name": UNET, "weight_dtype": "default"}, nid=nid)
    c = g.add("CLIPLoader", {"clip_name": CLIP, "type": "stable_diffusion", "device": "default"}, nid=nid + 1)
    v = g.add("VAELoader", {"vae_name": VAE}, nid=nid + 2)
    return m, c, v


def cond(g: Graph, clip: int, pos: str, neg: str, nid: int = 20) -> tuple[int, int]:
    p = g.add("CLIPTextEncode", {"text": pos, "clip": g.out(clip)}, "Positive", nid=nid)
    n = g.add("CLIPTextEncode", {"text": neg, "clip": g.out(clip)}, "Negative", nid=nid + 1)
    return p, n


def ksampler(g: Graph, model: int, pos: int, neg: int, latent, nid: int, *, seed: int, steps=30, cfg=4.0,
             sampler="euler", scheduler="simple", denoise=1.0, title: str | None = None) -> int:
    if isinstance(latent, int):
        latent = g.out(latent)
    return g.add("KSampler", {"model": g.out(model), "positive": g.out(pos), "negative": g.out(neg), "latent_image": latent,
                              "seed": seed, "steps": steps, "cfg": cfg, "sampler_name": sampler, "scheduler": scheduler,
                              "denoise": denoise}, title, nid=nid)


def t2i(pos: str, neg: str = NEG_TEMPLATE, *, seed: int, width=1024, height=1024, steps=30, cfg=4.0,
        sampler="euler", scheduler="simple", prefix="Anima_course", batch=1, nid: int = 10) -> Graph:
    """L0 最短管线（9 节点）。"""
    g = Graph()
    m, c, v = loaders(g, nid)
    p, n = cond(g, c, pos, neg, nid + 10)
    lat = g.add("EmptyLatentImage", {"width": width, "height": height, "batch_size": batch}, nid=nid + 20)
    ks = ksampler(g, m, p, n, lat, nid + 21, seed=seed, steps=steps, cfg=cfg, sampler=sampler, scheduler=scheduler)
    dec = g.add("VAEDecode", {"samples": g.out(ks), "vae": g.out(v)}, nid=nid + 22)
    g.add("SaveImage", {"images": g.out(dec), "filename_prefix": prefix}, nid=nid + 23)
    return g


def label(g: Graph, image: int, text: str, nid: int, font_size=5.5, position="top", align="left") -> int:
    return g.add("TextOverlay", {"images": g.out(image), "text": text, "font_size": font_size, "color": "#ffffff",
                                 "position": position, "align": align, "outline": True}, nid=nid)


def batch_all(g: Graph, image_ids: list[int], nid: int) -> int:
    """把多张单图合成一个 batch（ImageBatch 逐个串）。"""
    cur = image_ids[0]
    for i, iid in enumerate(image_ids[1:]):
        cur = g.add("ImageBatch", {"image1": g.out(cur), "image2": g.out(iid)}, nid=nid + i)
    return cur


def grid(g: Graph, images: int, nid: int, columns: int, cell=512, padding=4) -> int:
    return g.add("ImageGrid", {"images": g.out(images), "columns": columns, "cell_width": cell, "cell_height": cell,
                               "padding": padding}, nid=nid)


def stitch_down(g: Graph, image_ids: list[int], nid: int) -> int:
    cur = image_ids[0]
    for i, iid in enumerate(image_ids[1:]):
        cur = g.add("ImageStitch", {"image1": g.out(cur), "image2": g.out(iid), "direction": "down", "match_image_size": False,
                                    "spacing_width": 0, "spacing_color": "white"}, nid=nid + i)
    return cur


def stitch_right(g: Graph, image_ids: list[int], nid: int) -> int:
    cur = image_ids[0]
    for i, iid in enumerate(image_ids[1:]):
        cur = g.add("ImageStitch", {"image1": g.out(cur), "image2": g.out(iid), "direction": "right", "match_image_size": True,
                                    "spacing_width": 0, "spacing_color": "white"}, nid=nid + i)
    return cur


def save(g: Graph, image: int, prefix: str, nid: int) -> int:
    return g.add("SaveImage", {"images": g.out(image), "filename_prefix": prefix}, nid=nid)
