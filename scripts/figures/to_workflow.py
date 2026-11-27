#!/usr/bin/env python
"""把 figures.py 提交的 API 格式工作流转成前端的工作流 JSON（litegraph 格式，version 0.4），
放 public/workflows/ 给学习者下载，也用来嵌进 PNG（ComfyUI 的 extra_pnginfo.workflow）。

    python to_workflow.py figures-out/l0-prompt-tags/l0-prompt-tags.api.json -o public/workflows/L0.json
    python to_workflow.py --all                      # 按 WORKFLOWS 表批量生成

布局是按拓扑深度自动排的列，能加载、能跑，不追求好看。
节点字段对照的是本机 ComfyUI 前端 1.41 存出来的文件（user/default/workflows/测试1.json）。
"""
from __future__ import annotations

import argparse
import json
import sys
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from comfy_client import _req

ROOT = Path(__file__).resolve().parents[2]
WF_DIR = ROOT / "public" / "workflows"
OUT_DIR = ROOT / "figures-out"

# 站点要分发的工作流：名称 → (源 api.json, 覆盖 SaveImage 前缀)
WORKFLOWS = {
    "L0-minimal": ("l0-prompt-tags/l0-prompt-tags.api.json", "Anima/L0"),
    "L2-sweeps": ("l2-cfg-sweep/l2-cfg-sweep.api.json", "Anima/L2"),
    "L3-img2img": ("l3-denoise/l3-denoise.api.json", "Anima/L3"),
    "L4-upscale": ("l4-hires/l4-hires.api.json", "Anima/L4"),
    "L6-inpaint": ("l6b-b-after/l6b-b-after.api.json", "Anima/L6"),
    "L7-custom-sampler": ("l7-guider/l7-guider.guider.api.json", "Anima/L7"),
    "L5-lllite": ("l5b/l5b.api.json", "Anima/L5"),
    "L8-compare-grid": ("l8b-grid/l8b-grid.api.json", "Anima/L8"),
    "L1-turbo-switch": ("l1-turbo-vs-full/l1-turbo-vs-full.api.json", "Anima/L1"),
}

WIDGET_TYPES = {"INT", "FLOAT", "STRING", "BOOLEAN", "COMBO", "COLOR", "BOUNDING_BOX", "COMFY_MATCHTYPE_V3",
                "COMFY_DYNAMICCOMBO_V3", "COMFY_AUTOGROW_V3"}
SIZE = {"KSampler": (320, 270), "CLIPTextEncode": (400, 200), "UNETLoader": (340, 90), "CLIPLoader": (340, 130),
        "VAELoader": (300, 60), "EmptyLatentImage": (320, 110), "VAEDecode": (220, 50), "VAEEncode": (220, 50),
        "SaveImage": (320, 380), "PreviewImage": (320, 300), "LoadImage": (320, 350), "LoadImageMask": (320, 380),
        "TextOverlay": (340, 230), "ImageGrid": (300, 220), "ImageBatch": (220, 50), "ImageStitch": (300, 220),
        "MarkdownNote": (400, 200)}


def object_info() -> dict:
    st, info = _req("GET", "/object_info")
    if st != 200:
        raise SystemExit("object_info 拉取失败，ComfyUI 开着吗？")
    return info


def input_type(spec) -> str:
    t = spec[0] if isinstance(spec, list) else spec
    return "COMBO" if isinstance(t, list) else t


def ordered_inputs(defn: dict) -> list[tuple[str, str, dict, bool]]:
    """[(name, type, options, is_required)]，按前端顺序：先真正的连线输入（required 再 optional），再控件输入。"""
    req = list((defn["input"].get("required") or {}).items())
    opt = list((defn["input"].get("optional") or {}).items())
    link_inputs = [(k, input_type(v), v[1] if isinstance(v, list) and len(v) > 1 and isinstance(v[1], dict) else {}, True)
                   for k, v in req if input_type(v) not in WIDGET_TYPES]
    link_inputs += [(k, input_type(v), v[1] if isinstance(v, list) and len(v) > 1 and isinstance(v[1], dict) else {}, False)
                    for k, v in opt if input_type(v) not in WIDGET_TYPES]
    widget_inputs = [(k, input_type(v), v[1] if isinstance(v, list) and len(v) > 1 and isinstance(v[1], dict) else {}, True)
                     for k, v in req if input_type(v) in WIDGET_TYPES]
    widget_inputs += [(k, input_type(v), v[1] if isinstance(v, list) and len(v) > 1 and isinstance(v[1], dict) else {}, False)
                      for k, v in opt if input_type(v) in WIDGET_TYPES]
    return link_inputs + widget_inputs


def to_ui(api: dict, info: dict, save_prefix: str | None = None) -> dict:
    nodes_out: dict[int, dict] = {}
    links: list = []
    link_id = 1
    pending_links: list[tuple[str, str, int, str, str]] = []  # (src_node, src_slot, target_node, target_input, type)

    # 第一遍：建节点与输入口
    for nid_str, n in api.items():
        nid = int(nid_str)
        ct = n["class_type"]
        defn = info.get(ct)
        if defn is None:
            raise SystemExit(f"节点 {ct} 不在当前 ComfyUI 的节点表里，无法生成前端格式")
        inputs_json = []
        widget_values = []
        named = {}
        for name, typ, opts, _req in ordered_inputs(defn):
            val = n["inputs"].get(name)
            is_widget = typ in WIDGET_TYPES
            if not (is_widget and opts.get("socketless", False)):
                entry = {"localized_name": name, "name": name, "type": typ, "link": None}
                if is_widget:
                    entry["widget"] = {"name": name}
                inputs_json.append(entry)
            if isinstance(val, list):  # 这个输入接了线：控件位留默认值，连线第二遍再回填
                pending_links.append((str(val[0]), val[1], nid_str, name, typ))
                if is_widget:
                    widget_values.append(opts.get("default", ""))
            elif is_widget:            # 控件没接线：值写进 widgets_values
                v = val if val is not None else opts.get("default", "")
                widget_values.append(v)
                named[name] = v
            if is_widget and typ == "INT" and opts.get("control_after_generate"):
                widget_values.append("fixed")
                named["control_after_generate"] = "fixed"
            if is_widget and opts.get("image_upload"):
                widget_values.append("image")
                named["image"] = "image"
        outs = defn.get("output") or []
        out_names = defn.get("output_name") or outs
        outputs_json = [{"localized_name": out_names[i], "name": out_names[i], "type": t, "slot_index": i, "links": []}
                        for i, t in enumerate(outs)]
        if ct == "SaveImage" and save_prefix is not None:
            widget_values = [save_prefix]
            named = {"filename_prefix": save_prefix}
        nodes_out[nid] = {
            "id": nid, "type": ct, "pos": [0, 0], "size": list(SIZE.get(ct, (300, 200))), "flags": {}, "order": 0, "mode": 0,
            "inputs": inputs_json, "outputs": outputs_json,
            "properties": {"Node name for S&R": ct},
            "widgets_values": widget_values, "widgets_values_named": named,
        }
        if n.get("_meta", {}).get("title"):
            nodes_out[nid]["title"] = n["_meta"]["title"]

    # 第二遍：连线
    for src, slot, dst, inp, typ in pending_links:
        s, d = int(src), int(dst)
        if s not in nodes_out or d not in nodes_out:
            raise SystemExit(f"连线 {src}→{dst} 指向不存在的节点")
        tgt_slot = next((i for i, j in enumerate(nodes_out[d]["inputs"]) if j["name"] == inp), None)
        if tgt_slot is None:
            raise SystemExit(f"{d} {nodes_out[d]['type']} 没有输入口 {inp}")
        links.append([link_id, s, slot, d, tgt_slot, typ])
        nodes_out[d]["inputs"][tgt_slot]["link"] = link_id
        if slot < len(nodes_out[s]["outputs"]):
            nodes_out[s]["outputs"][slot]["links"].append(link_id)
        link_id += 1

    # 第三遍：拓扑深度 → 列布局 + order
    depth: dict[int, int] = {}
    def dep(n: int) -> int:
        if n in depth:
            return depth[n]
        depth[n] = 0  # 防环
        parents = [l[1] for l in links if l[3] == n]
        depth[n] = 0 if not parents else 1 + max(dep(p) for p in parents)
        return depth[n]
    for n in nodes_out:
        dep(n)
    order = sorted(nodes_out, key=lambda n: (depth[n], n))
    size_of = lambda n: SIZE.get(nodes_out[n]["type"], (300, 200))  # noqa: E731
    col_w: dict[int, int] = {}
    for n in order:
        col_w[depth[n]] = max(col_w.get(depth[n], 0), size_of(n)[0])
    col_x: dict[int, int] = {}
    col_y: dict[int, int] = {}
    for i, n in enumerate(order):
        col = depth[n]
        w, h = size_of(n)
        if col not in col_x:
            col_x[col] = 60 if col == 0 else col_x[col - 1] + col_w[col - 1] + 120
        y = col_y.get(col, 60)
        col_y[col] = y + h + 60
        nodes_out[n]["pos"] = [col_x[col], y]
        nodes_out[n]["order"] = i

    return {
        "id": str(uuid.uuid4()), "revision": 0, "last_node_id": max(nodes_out), "last_link_id": link_id - 1,
        "nodes": [nodes_out[n] for n in sorted(nodes_out)], "links": links, "groups": [], "config": {}, "extra": {},
        "version": 0.4,
    }


def convert(api_path: Path, out_path: Path, info: dict, save_prefix: str | None):
    api = json.loads(api_path.read_text())
    ui = to_ui(api, info, save_prefix)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(ui, ensure_ascii=False, indent=1))
    try:
        rel = out_path.relative_to(ROOT)
    except ValueError:
        rel = out_path
    print(f"{api_path.name} → {rel}  ({len(ui['nodes'])} 节点, {len(ui['links'])} 连线)")


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("api", nargs="?")
    ap.add_argument("-o", "--out")
    ap.add_argument("--prefix", help="覆盖 SaveImage 的 filename_prefix")
    ap.add_argument("--all", action="store_true", help="按 WORKFLOWS 表批量生成到 public/workflows/")
    a = ap.parse_args(argv)
    info = object_info()
    if a.all:
        for name, (rel, prefix) in WORKFLOWS.items():
            src = OUT_DIR / rel
            if src.exists():
                convert(src, WF_DIR / f"{name}.json", info, prefix)
            else:
                print(f"跳过 {name}：{rel} 不存在")
        return
    if not a.api or not a.out:
        ap.error("需要 api 与 -o，或 --all")
    convert(Path(a.api), Path(a.out), info, a.prefix)


if __name__ == "__main__":
    main()
