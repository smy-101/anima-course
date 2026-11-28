#!/usr/bin/env python
"""给每张图的 PNG 原图嵌上它自己用的工作流（前端格式），再按图 id 打包成zip，供 GitHub Releases 下载。

    python embed_all.py            # 嵌入 + 打包
    python embed_all.py --check    # 只检查各 PNG 里有没有 workflow 块

对应关系来自 prepare-site.mjs 的 MAP（经 --dump-map）。工作流取 PNG 同目录的 .api.json 转换而来；
个别图例外，见 OVERRIDES。
"""
from __future__ import annotations

import json
import shutil
import subprocess
import sys
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from embed_workflow import embed, read_texts  # noqa: E402
from to_workflow import object_info, to_ui  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "figures-out"
WF_DIR = ROOT / "public" / "workflows"

# 图 id → 用哪个现成的工作流文件（而不是同目录的 .api.json）
OVERRIDES = {
    # 拼图工作流只有 LoadImage + 标签，没有教学价值；嵌基本引导器那条
    "l7-basic-guider": WF_DIR / "L7-custom-sampler.json",
    # 这张是用官方模板出的，模板子图不在手里；嵌 L0 的 9 节点等价工作流
    "setup-first": WF_DIR / "L0-minimal.json",
}


def figure_map() -> dict[str, Path]:
    out = subprocess.run(["node", str(ROOT / "scripts" / "figures" / "prepare-site.mjs"), "--dump-map"],
                         capture_output=True, text=True, check=True).stdout
    return {k: Path(v) for k, v in json.loads(out).items()}


def api_json_for(png: Path) -> Path:
    """PNG 同目录的 .api.json：优先 <目录名>.api.json，其次唯一的 before-after，否则排序取第一个。"""
    d = png.parent
    cands = sorted(d.glob("*.api.json"))
    if not cands:
        raise SystemExit(f"{d} 里没有 .api.json")
    for c in cands:
        if c.name == f"{d.name}.api.json":
            return c
    ba = [c for c in cands if ".before-after." in c.name]
    return (ba or cands)[0]


def main(argv=None):
    argv = sys.argv[1:] if argv is None else argv
    check_only = "--check" in argv
    info = object_info()
    fmap = figure_map()
    done, skipped = [], []
    for fid, png in sorted(fmap.items()):
        if png.parent.name == "screens":
            # 界面截图：不是 ComfyUI 直出的图，没有工作流可嵌，也不进原图包
            skipped.append(fid)
            continue
        if check_only:
            t = read_texts(png)
            n = len(json.loads(t["workflow"])["nodes"]) if "workflow" in t else 0
            print(f"{fid:18s} workflow: {'✅ ' + str(n) + ' 节点' if n else '—'}")
            continue
        if fid in OVERRIDES:
            ui = json.loads(OVERRIDES[fid].read_text())
            src = OVERRIDES[fid].name
        else:
            api = json.loads(api_json_for(png).read_text())
            ui = to_ui(api, info)
            src = api_json_for(png).name
        embed(png, ui)
        done.append((fid, png, src))
        print(f"{fid:18s} ← {src} ({len(ui['nodes'])} 节点)")
    if check_only:
        return
    # 打包：文件名 = 图 id
    zpath = OUT / "anima-course-figures-originals.zip"
    with zipfile.ZipFile(zpath, "w", zipfile.ZIP_STORED) as z:   # PNG 已压缩，只存不压
        for fid, png, _ in done:
            z.write(png, f"{fid}.png")
    size = zpath.stat().st_size / 2**20
    print(f"\n{len(done)} 张已嵌入；打包 → {zpath.relative_to(ROOT)}（{size:.1f} MB）")
    if skipped:
        print("跳过：", skipped)


if __name__ == "__main__":
    main()
