#!/usr/bin/env python
"""把课程需要的模型从 Hugging Face 下到 Windows 端 ComfyUI 的 models 目录。

    python download_models.py            # 全部
    python download_models.py --check    # 只检查已存在的文件大小
    python download_models.py --only anima-base-v1.0 anima-turbo-lora-v0.2

每个文件先存为 <名字>.part，curl 断点续传；下完对照 HF API 给的字节数，safetensors 再验一下头部，
通过才改名。已存在且大小正确的文件跳过。
"""
from __future__ import annotations

import json
import subprocess
import sys
import time
from pathlib import Path

MODELS = Path("/mnt/d/Comfy-Desktop/ComfyUI-Shared/models")

# (仓库名, 仓库内路径, 本地类别目录)
FILES = [  # 小的先下，两个 3.9 GB 的放最后
    ("circlestone-labs/Anima-Official-LoRAs", "anima-turbo-lora-v0.2.safetensors", "loras"),
    ("circlestone-labs/Anima-Official-LoRAs", "anima-highres-aesthetic-boost.safetensors", "loras"),
    ("circlestone-labs/Anima-Official-LoRAs", "anima-greg-rutkowski-style.safetensors", "loras"),
    ("Comfy-Org/Anima-LLLite", "model_patches/anima-lllite-any-test-like-v2.safetensors", "model_patches"),
    ("Comfy-Org/Anima-LLLite", "model_patches/anima-lllite-depth-1.safetensors", "model_patches"),
    ("Comfy-Org/Anima-LLLite", "model_patches/anima-lllite-inpainting-v2.safetensors", "model_patches"),
    ("Bingsu/adetailer", "face_yolov8m.pt", "ultralytics/bbox"),
    ("Bingsu/adetailer", "hand_yolov8s.pt", "ultralytics/bbox"),
    ("halllooo/4x_illustrationJaNaiV1", "4x_IllustrationJaNai_V1_ESRGAN_135k.pth", "upscale_models"),
    ("Comfy-Org/Depth-Anything-3", "geometry_estimation/depth_anything_3_mono_large.safetensors", "geometry_estimation"),
    ("circlestone-labs/Anima", "split_files/diffusion_models/anima-base-v1.0.safetensors", "diffusion_models"),
    ("circlestone-labs/Anima", "split_files/diffusion_models/anima-aesthetic-v1.1.safetensors", "diffusion_models"),
]


def hf_sizes(repo: str) -> dict[str, int]:
    out = subprocess.run(["curl", "-sL", "-m", "60", f"https://huggingface.co/api/models/{repo}/tree/main?recursive=true"],
                         capture_output=True, text=True, check=True).stdout
    return {it["path"]: it.get("size", 0) for it in json.loads(out) if it.get("type") == "file"}


def safetensors_ok(path: Path) -> bool:
    import struct
    with path.open("rb") as f:
        head = f.read(8)
        if len(head) < 8:
            return False
        (n,) = struct.unpack("<Q", head)
        if n <= 0 or n > path.stat().st_size - 8:
            return False
        try:
            json.loads(f.read(n))
        except Exception:
            return False
    return True


def main(argv):
    only = []
    if "--only" in argv:
        i = argv.index("--only"); only = argv[i + 1:]; argv = argv[:i]
    check = "--check" in argv
    total = 0
    sizes: dict[str, dict[str, int]] = {}
    for repo, rel, cat in FILES:
        name = rel.rsplit("/", 1)[-1]
        if only and not any(o == name or o == Path(name).stem for o in only):
            continue
        if repo not in sizes:
            sizes[repo] = hf_sizes(repo)
        expected = sizes[repo].get(rel)
        if not expected:
            print(f"!! {repo}/{rel} 在 HF 上找不到，跳过"); continue
        dest = MODELS / cat / name
        dest.parent.mkdir(parents=True, exist_ok=True)
        have = dest.stat().st_size if dest.exists() else -1
        if have == expected:
            print(f"✓ {name:48s} {expected/2**20:8.1f} MB 已存在"); total += expected; continue
        if check:
            print(f"✗ {name:48s} {expected/2**20:8.1f} MB 缺" if have < 0 else f"~ {name} 大小不对 {have} ≠ {expected}"); continue
        part = dest.with_name(dest.name + ".part")
        url = f"https://huggingface.co/{repo}/resolve/main/{rel}"
        t0 = time.time()
        print(f"↓ {name:48s} {expected/2**20:8.1f} MB ← {repo}", flush=True)
        r = subprocess.run(["curl", "-L", "--fail", "-C", "-", "--retry", "5", "--retry-delay", "5", "-sS",
                            "-o", str(part), url], capture_output=True, text=True)
        got = part.stat().st_size if part.exists() else -1
        if r.returncode != 0 or got != expected:
            print(f"!! {name} 下载失败（curl {r.returncode}，{got} / {expected} 字节）：{r.stderr.strip()[:200]}", flush=True)
            continue
        if dest.suffix == ".safetensors" and not safetensors_ok(part):
            print(f"!! {name} safetensors 头部校验失败，保留 .part 待查"); continue
        part.rename(dest)
        dt = time.time() - t0
        print(f"✓ {name} 完成，{expected/2**20:.0f} MB / {dt:.0f}s = {expected/2**20/max(dt,1):.1f} MB/s", flush=True)
        total += expected
    print(f"\n合计 {total/2**30:.2f} GB 已就位")


if __name__ == "__main__":
    main(sys.argv[1:])
