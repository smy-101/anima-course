#!/usr/bin/env python
"""把前端格式的工作流 JSON 嵌进 PNG 的 tEXt "workflow" 块（ComfyUI 前端拖图进画布时读的就是它）。

    python embed_workflow.py --map l0=public/workflows/L0-minimal.json figures-out/l0-seed-a/*.png ...

ComfyUI 自己保存的 PNG 已带 "prompt"（API 格式）块，这里只补 "workflow"（前端格式）。
已有 "workflow" 块会被替换。纯 Python，不重编码像素。
"""
from __future__ import annotations

import argparse
import json
import struct
import zlib
from pathlib import Path


def _chunks(data: bytes):
    assert data[:8] == b"\x89PNG\r\n\x1a\n"
    pos = 8
    while pos < len(data):
        (n,) = struct.unpack(">I", data[pos:pos + 4])
        typ = data[pos + 4:pos + 8]
        body = data[pos + 8:pos + 8 + n]
        yield typ, body
        pos += 12 + n


def _chunk(typ: bytes, body: bytes) -> bytes:
    return struct.pack(">I", len(body)) + typ + body + struct.pack(">I", zlib.crc32(typ + body) & 0xFFFFFFFF)


def read_texts(path: Path) -> dict[str, str]:
    out = {}
    for typ, body in _chunks(path.read_bytes()):
        if typ == b"tEXt":
            k, _, v = body.partition(b"\x00")
            out[k.decode("latin-1")] = v.decode("latin-1")
        elif typ == b"iTXt":
            k, _, rest = body.partition(b"\x00")
            comp = rest[0]
            txt = rest[2:].partition(b"\x00")[2].partition(b"\x00")[2]
            out[k.decode("latin-1")] = (zlib.decompress(txt) if comp else txt).decode("utf-8")
    return out


def embed(path: Path, workflow: dict, prompt: dict | None = None) -> None:
    data = path.read_bytes()
    out = [data[:8]]
    inserted = False
    for typ, body in _chunks(data):
        if typ == b"tEXt" and body.startswith(b"workflow\x00"):
            continue  # 旧的 workflow 块丢掉，下面重新插
        if typ == b"tEXt" and prompt is not None and body.startswith(b"prompt\x00"):
            continue
        if not inserted and typ == b"IDAT":
            # 与 ComfyUI 自己保存时一致：json.dumps 默认 ASCII 转义，tEXt 块纯 ASCII
            out.append(_chunk(b"tEXt", b"workflow\x00" + json.dumps(workflow).encode()))
            if prompt is not None:
                out.append(_chunk(b"tEXt", b"prompt\x00" + json.dumps(prompt).encode()))
            inserted = True
        out.append(_chunk(typ, body))
    if not inserted:
        raise ValueError(f"{path}: no IDAT chunk")
    path.write_bytes(b"".join(out))


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("png", nargs="+")
    ap.add_argument("--map", action="append", default=[], help="前缀=工作流 JSON；文件名以此前缀开头的用该工作流")
    ap.add_argument("--inspect", action="store_true", help="只打印各 PNG 里已有的文本块")
    a = ap.parse_args(argv)
    if a.inspect:
        for f in a.png:
            p = Path(f)
            texts = read_texts(p)
            print(p.name, {k: (v[:60] + "…") for k, v in texts.items()})
        return
    mapping = [(m.split("=", 1)[0], Path(m.split("=", 1)[1])) for m in a.map]
    for f in a.png:
        p = Path(f)
        wf = next((w for pre, w in mapping if p.name.startswith(pre)), None)
        if wf is None:
            print("skip (no workflow mapped):", p.name)
            continue
        embed(p, json.loads(wf.read_text()))
        print(f"{p.name}: workflow ← {wf}")


if __name__ == "__main__":
    main()
