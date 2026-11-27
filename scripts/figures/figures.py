#!/usr/bin/env python
"""课程对照图生成：A 类（只需 anima base 模型 + ComfyUI 核心节点）。

用法：
    python figures.py                 # 全部
    python figures.py l0 l2           # 按组
    FIGURES_ONLY=l2-cfg-sweep python figures.py l2   # 只重跑组里某几张
    python figures.py --list

前提：Windows 端 Comfy Desktop 已开着（127.0.0.1:8188），模型见 comfy_client.UNET。
输出：仓库根目录 figures-out/<id>/ 下的 PNG（ComfyUI 直出，PNG 内嵌 API 工作流）、
      同目录 <id>.api.json（提交的工作流）与 figures-out/manifest.json（耗时、prompt_id）。
之后由 prepare-site.mjs 转成站内用的 WebP。
"""
from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from comfy_client import (Graph, NEG_CARD, NEG_TEMPLATE, TPL_A, TPL_B, TPL_C, TPL_EXAMPLE, batch_all, cond, free_cache, grid, ksampler,
                          label, loaders, run, save, stitch_down, stitch_right, t2i, upload)

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "figures-out"

# 固定种子：基线用 SEED；"种子"对照组用 A / B / C。全部图共用，见各图说明。
SEED = 42
SEED_A, SEED_B, SEED_C = 11, 88, 23
SAMPLER, SCHEDULER = "euler", "simple"   # 官方 Anima Base v1 模板默认

MANIFEST_PATH = OUT / "manifest.json"


def _manifest():
    return json.loads(MANIFEST_PATH.read_text()) if MANIFEST_PATH.exists() else {}


def emit(fig_id: str, graphs: list[tuple[str, Graph]], note: str = ""):
    """跑一张图对应的一个或多个工作流，落盘并记 manifest。graphs: [(tag, Graph)]
    环境变量 FIGURES_ONLY="a b c" 时只跑列出的图（按组重跑时挑出个别图用）。"""
    only = os.environ.get("FIGURES_ONLY", "").split()
    if only and fig_id not in only:
        return
    dest = OUT / fig_id
    dest.mkdir(parents=True, exist_ok=True)
    manifest = _manifest()
    entry = manifest.get(fig_id, {"runs": []})
    entry["note"] = note
    for tag, g in graphs:
        (dest / f"{fig_id}{'.' + tag if tag else ''}.api.json").write_text(json.dumps(g.prompt(), ensure_ascii=False, indent=1))
        t0 = time.time()
        hist, files = run(g.prompt(), dest, label=f"{fig_id}{'/' + tag if tag else ''}")
        entry["runs"].append({"tag": tag, "prompt_id": hist.get("prompt_id"), "seconds": round(time.time() - t0, 1),
                              "files": [f.name for f in files]})
    manifest[fig_id] = entry
    MANIFEST_PATH.write_text(json.dumps(manifest, ensure_ascii=False, indent=1))


# ----------------------------------------------------------------- 基础图的复用
def base_png() -> Path:
    """阶段 2 的基线成图（模板 A、SEED、1024²）：l0-prompt-tags 那张。"""
    p = next(iter(sorted((OUT / "l0-prompt-tags").glob("*.png"))), None)
    if p is None:
        raise SystemExit("先跑 `python figures.py l0`，图生图 / 放大 / 重绘都以它为底图")
    return p


# ===================================================================== 00 准备课
def fig_setup_first():
    """官方模板自带的示例提示词 + 模板默认参数（30 步 / CFG 4 / euler / simple），seed 取模板里的那个。"""
    emit("setup-first", [("", t2i(TPL_EXAMPLE, NEG_TEMPLATE, seed=755918130909406, prefix="Anima_course/setup-first"))],
         note="官方 Anima Base v1 模板示例提示词；权重为本机 anima-preview3-base")


# ===================================================================== 01-01 L0
def fig_l0():
    emit("l0-seed-a", [("", t2i(TPL_A, seed=SEED_A, prefix="Anima_course/l0-seed-a"))], note=f"模板 A，seed {SEED_A}")
    emit("l0-seed-b", [("", t2i(TPL_A, seed=SEED_B, prefix="Anima_course/l0-seed-b"))], note=f"模板 A，seed {SEED_B}")
    emit("l0-seed-c", [("", t2i(TPL_A, seed=SEED_C, prefix="Anima_course/l0-seed-c"))], note=f"模板 A，seed {SEED_C}")
    emit("l0-prompt-tags", [("", t2i(TPL_A, seed=SEED, prefix="Anima_course/l0-prompt-tags"))], note=f"模板 A（纯标签），seed {SEED}")
    emit("l0-prompt-prose", [("", t2i(TPL_B, seed=SEED, prefix="Anima_course/l0-prompt-prose"))], note=f"模板 B（自然语言），seed {SEED}")


# ===================================================================== 01-03 提示词基础
ARTISTS = [None, "@nnn yryr", "@huke", "@wlop"]


def tpl_d(artist: str | None) -> str:
    s = "masterpiece, best quality, safe, 1girl, solo, long black hair, amber eyes, white sailor dress, "
    s += f"{artist}, " if artist else ""
    return s + "soft lighting, detailed background, scenery"


def fig_pb():
    # 三种写法：A / B / C 同 seed
    g = Graph()
    m, c, v = loaders(g)
    p_a, n_a = cond(g, c, TPL_A, NEG_CARD, 20)
    p_b, _ = cond(g, c, TPL_B, NEG_CARD, 22)
    p_c, _ = cond(g, c, TPL_C, NEG_CARD, 24)
    lat = g.add("EmptyLatentImage", {"width": 1024, "height": 1024, "batch_size": 1}, nid=30)
    imgs = []
    for i, (p, txt) in enumerate(((p_a, "A: tags"), (p_b, "B: prose"), (p_c, "C: mixed"))):
        ks = g.add("KSampler", {"model": g.out(m), "positive": g.out(p), "negative": g.out(n_a), "latent_image": g.out(lat),
                                "seed": SEED, "steps": 30, "cfg": 4.0, "sampler_name": SAMPLER, "scheduler": SCHEDULER,
                                "denoise": 1.0}, nid=40 + i * 3)
        dec = g.add("VAEDecode", {"samples": g.out(ks), "vae": g.out(v)}, nid=41 + i * 3)
        imgs.append(label(g, dec, txt, 42 + i * 3))
    save(g, grid(g, batch_all(g, imgs, 60), 70, columns=3, cell=512), "Anima_course/pb-styles", 80)
    emit("pb-styles", [("", g)], note="模板 A / B / C，同 seed；负向为模型卡版本")

    # 画师：不挂 / @nnn yryr / @huke / @wlop（模板 D）
    g = Graph()
    m, c, v = loaders(g)
    n_enc = g.add("CLIPTextEncode", {"text": NEG_CARD + ", signature, watermark, text", "clip": g.out(c)}, "Negative", nid=19)
    lat = g.add("EmptyLatentImage", {"width": 1024, "height": 1024, "batch_size": 1}, nid=30)
    imgs = []
    for i, art in enumerate(ARTISTS):
        p = g.add("CLIPTextEncode", {"text": tpl_d(art), "clip": g.out(c)}, "Positive", nid=20 + i)
        ks = g.add("KSampler", {"model": g.out(m), "positive": g.out(p), "negative": g.out(n_enc), "latent_image": g.out(lat),
                                "seed": SEED, "steps": 30, "cfg": 4.0, "sampler_name": SAMPLER, "scheduler": SCHEDULER,
                                "denoise": 1.0}, nid=40 + i * 3)
        dec = g.add("VAEDecode", {"samples": g.out(ks), "vae": g.out(v)}, nid=41 + i * 3)
        imgs.append(label(g, dec, art or "no artist", 42 + i * 3))
    save(g, grid(g, batch_all(g, imgs, 60), 70, columns=4, cell=512), "Anima_course/pb-artists", 80)
    emit("pb-artists", [("", g)], note="模板 D 换画师：不挂 / @nnn yryr / @huke / @wlop")

    # 陷阱标签：同一句自然语言里混入 line art / monochrome / wet
    trap = {
        "control": TPL_B,
        "line art": "An anime illustration drawn with clean line art of a young woman with long black hair and amber eyes, "
                    "standing under a cherry tree in full bloom. She wears a white sailor dress with a red ribbon, and petals "
                    "drift around her in the wind. Warm afternoon sunlight falls on her face, and the background is soft and out of focus.",
        "monochrome": "An anime illustration in monochrome of a young woman with long black hair and amber eyes, standing under a "
                      "cherry tree in full bloom. She wears a white sailor dress with a red ribbon, and petals drift around her in "
                      "the wind. Warm afternoon sunlight falls on her face, and the background is soft and out of focus.",
        "wet": "An anime illustration of a young woman with long black hair and amber eyes, standing under a cherry tree in full bloom, "
               "caught in the rain so her dress is wet. She wears a white sailor dress with a red ribbon, and petals drift around "
               "her in the wind. Warm afternoon sunlight falls on her face, and the background is soft and out of focus.",
    }
    g = Graph()
    m, c, v = loaders(g)
    n_enc = g.add("CLIPTextEncode", {"text": NEG_CARD, "clip": g.out(c)}, "Negative", nid=19)
    lat = g.add("EmptyLatentImage", {"width": 1024, "height": 1024, "batch_size": 1}, nid=30)
    imgs = []
    for i, (k, txt) in enumerate(trap.items()):
        p = g.add("CLIPTextEncode", {"text": txt, "clip": g.out(c)}, "Positive", nid=20 + i)
        ks = g.add("KSampler", {"model": g.out(m), "positive": g.out(p), "negative": g.out(n_enc), "latent_image": g.out(lat),
                                "seed": SEED, "steps": 30, "cfg": 4.0, "sampler_name": SAMPLER, "scheduler": SCHEDULER,
                                "denoise": 1.0}, nid=40 + i * 3)
        dec = g.add("VAEDecode", {"samples": g.out(ks), "vae": g.out(v)}, nid=41 + i * 3)
        imgs.append(label(g, dec, f'"{k}"' if k != "control" else "control", 42 + i * 3))
    save(g, grid(g, batch_all(g, imgs, 60), 70, columns=4, cell=512), "Anima_course/pb-trap", 80)
    emit("pb-trap", [("", g)], note="模板 B 的句子里混入 line art / monochrome / wet")


# ===================================================================== 02-01 L2 扫描
class Link:
    """KSampler 参数覆盖里表示"接某个节点的输出"。"""
    def __init__(self, nid: int):
        self.nid = nid


def _sweep(variants: list[tuple[str, dict]], prefix: str, columns: int, cell=512, batch=1, per_row_grid=False):
    columns = min(columns, 3)  # 站内最宽 1600，一行超过 3 格就看不清
    """variants: [(标签, KSampler 参数覆盖)]。共用加载器、条件、latent。"""
    g = Graph()
    m, c, v = loaders(g)
    p, n = cond(g, c, TPL_A, NEG_TEMPLATE)
    lat = g.add("EmptyLatentImage", {"width": 1024, "height": 1024, "batch_size": batch}, nid=30)
    imgs = []
    for i, (txt, over) in enumerate(variants):
        params = {"model": g.out(m), "positive": g.out(p), "negative": g.out(n), "latent_image": g.out(lat),
                  "seed": SEED, "steps": 30, "cfg": 4.0, "sampler_name": SAMPLER, "scheduler": SCHEDULER, "denoise": 1.0}
        params.update({k: g.out(val.nid) if isinstance(val, Link) else val for k, val in over.items()})
        ks = g.add("KSampler", params, txt, nid=40 + i * 3)
        dec = g.add("VAEDecode", {"samples": g.out(ks), "vae": g.out(v)}, nid=41 + i * 3)
        imgs.append(label(g, dec, txt, 42 + i * 3))
    if per_row_grid:
        rows = [grid(g, im, 90 + i, columns=batch, cell=384) for i, im in enumerate(imgs)]
        save(g, stitch_down(g, rows, 110), prefix, 130)
    else:
        save(g, grid(g, batch_all(g, imgs, 60), 70, columns=columns, cell=cell), prefix, 80)
    return g


def fig_l2():
    cfgs = [3, 3.5, 4, 4.5, 5, 6]
    emit("l2-cfg-sweep", [("", _sweep([(f"cfg {c:g}", {"cfg": float(c)}) for c in cfgs], "Anima_course/l2-cfg-sweep", len(cfgs)))],
         note="模板 A，seed 固定，CFG 单行扫描")
    steps = [10, 20, 30, 40, 50]
    emit("l2-steps-sweep", [("", _sweep([(f"steps {s}", {"steps": s}) for s in steps], "Anima_course/l2-steps-sweep", len(steps)))],
         note="模板 A，seed 固定，steps 单行扫描")
    samplers = ["euler", "er_sde", "euler_ancestral", "dpmpp_2m_sde_gpu", "res_multistep", "uni_pc"]
    emit("l2-samplers", [("", _sweep([(s, {"sampler_name": s}) for s in samplers], "Anima_course/l2-samplers", len(samplers)))],
         note="模板 A，seed 固定，scheduler simple")
    rows = [3, 3.5, 4, 4.5, 5]
    emit("l2-cfg-seeds", [("", _sweep([(f"cfg {c:g}", {"cfg": float(c)}) for c in rows], "Anima_course/l2-cfg-seeds", len(rows),
                                      batch=4, per_row_grid=True))],
         note="行 = cfg（batch_size 4 当 4 个种子），列 = 种子")
    emit("l2-labeled", [("", _sweep([(f"cfg {c:g}", {"cfg": float(c)}) for c in [3, 3.5, 4]], "Anima_course/l2-labeled", 3))],
         note="三个 KSampler 分支各接 TextOverlay")


# ===================================================================== 02-02 多人与场景
TWO_GIRLS = {
    "comma": "2girls, two girls standing side by side under a cherry tree. The girl on the left has red hair, red eyes, and wears "
             "a beige sweater. The girl on the right has black hair, brown eyes, and wears a white shirt.",
    "and": "2girls, two girls standing side by side under a cherry tree. The girl on the left has red hair and red eyes and wears "
           "a beige sweater. The girl on the right has black hair and brown eyes and wears a white shirt.",
    "swapped": "2girls, two girls standing side by side under a cherry tree. The girl on the left has black hair, brown eyes, and "
               "wears a white shirt. The girl on the right has red hair, red eyes, and wears a beige sweater.",
    "prose": "2girls, two girls standing side by side under a cherry tree, facing each other and looking into each other's eyes. "
             "The girl on the left has red hair and red eyes and wears a beige sweater. The girl on the right has black hair and "
             "brown eyes and wears a white shirt.",
    "tag": "2girls, eye contact, two girls standing side by side under a cherry tree. The girl on the left has red hair and red eyes "
           "and wears a beige sweater. The girl on the right has black hair and brown eyes and wears a white shirt.",
}


def _multi(variants: list[tuple[str, str, str]], prefix: str, columns: int, seed=SEED):
    """variants: [(标签, 正向, 负向)]，同 seed 并排。"""
    g = Graph()
    m, c, v = loaders(g)
    lat = g.add("EmptyLatentImage", {"width": 1024, "height": 1024, "batch_size": 1}, nid=30)
    imgs = []
    for i, (txt, pos, neg) in enumerate(variants):
        p = g.add("CLIPTextEncode", {"text": pos, "clip": g.out(c)}, "Positive", nid=20 + i)
        n = g.add("CLIPTextEncode", {"text": neg, "clip": g.out(c)}, "Negative", nid=24 + i)
        ks = g.add("KSampler", {"model": g.out(m), "positive": g.out(p), "negative": g.out(n), "latent_image": g.out(lat),
                                "seed": seed, "steps": 30, "cfg": 4.0, "sampler_name": SAMPLER, "scheduler": SCHEDULER,
                                "denoise": 1.0}, txt, nid=40 + i * 3)
        dec = g.add("VAEDecode", {"samples": g.out(ks), "vae": g.out(v)}, nid=41 + i * 3)
        imgs.append(label(g, dec, txt, 42 + i * 3))
    save(g, grid(g, batch_all(g, imgs, 60), 70, columns=columns, cell=512), prefix, 80)
    return g


def fig_pm():
    emit("pm-contagion", [("", _multi([("comma", TWO_GIRLS["comma"], NEG_TEMPLATE), ("and", TWO_GIRLS["and"], NEG_TEMPLATE)],
                                      "Anima_course/pm-contagion", 2))], note="逗号写法 vs and 法，同 seed")
    emit("pm-order", [("", _multi([("red-haired girl first", TWO_GIRLS["and"], NEG_TEMPLATE),
                                   ("swapped", TWO_GIRLS["swapped"], NEG_TEMPLATE)], "Anima_course/pm-order", 2))],
         note="两人描述顺序对调前后，同 seed")
    emit("pm-eye-contact", [("", _multi([("prose: facing each other", TWO_GIRLS["prose"], NEG_TEMPLATE),
                                         ("tag: eye contact", TWO_GIRLS["tag"], NEG_TEMPLATE)], "Anima_course/pm-eye-contact", 2))],
         note="自然语言面对面 vs eye contact 标签，同 seed")
    no_bg = ("masterpiece, best quality, score_7, newest, highres, safe, 1girl, solo, long black hair, amber eyes, white sailor dress, "
             "hair ribbon, standing, looking at viewer, gentle smile, upper body")
    scenery = TPL_A + ", scenery, detailed background"
    emit("pm-background", [("", _multi([("no background", no_bg, NEG_TEMPLATE), ("described background", TPL_A, NEG_TEMPLATE),
                                        ("+ scenery", scenery, NEG_TEMPLATE)], "Anima_course/pm-background", 3, seed=1))],
         note="不写背景 vs 写具体背景 vs 加 scenery 标签，同 seed")
    sheet = ("character design sheet, front and side views, expression sheet, multiple views of the same character, "
             "masterpiece, best quality, score_7, safe, 1girl, solo, long black hair, amber eyes, white sailor dress, red hair ribbon, "
             "simple background, white background")
    emit("pm-sheet", [("", t2i(sheet, seed=SEED, prefix="Anima_course/pm-sheet"))], note="character design sheet 标签串")


# ===================================================================== 03-01 L3 图生图
def fig_l3():
    src = base_png()
    name = upload(src, "anima-course")
    g = Graph()
    m, c, v = loaders(g)
    p, n = cond(g, c, TPL_A, NEG_TEMPLATE)
    img = g.add("LoadImage", {"image": name}, "base (stage 2)", nid=30)
    lat = g.add("VAEEncode", {"pixels": g.out(img), "vae": g.out(v)}, nid=31)
    for i, d in enumerate([0.2, 0.35, 0.5, 0.7, 1.0]):
        ks = g.add("KSampler", {"model": g.out(m), "positive": g.out(p), "negative": g.out(n), "latent_image": g.out(lat),
                                "seed": SEED, "steps": 30, "cfg": 4.0, "sampler_name": SAMPLER, "scheduler": SCHEDULER,
                                "denoise": d}, f"denoise {d}", nid=40 + i * 2)
        dec = g.add("VAEDecode", {"samples": g.out(ks), "vae": g.out(v)}, nid=41 + i * 2)
        save(g, dec, f"Anima_course/l3-denoise/d{int(d * 100):03d}", 60 + i)
    emit("l3-denoise", [("", g)], note="底图 = l0-prompt-tags（模板 A、SEED、1024²）；提示词不变，只改 denoise")


# ===================================================================== 03-04 / 03-05 L4 放大
def fig_l4():
    g = Graph()
    m, c, v = loaders(g)
    p, n = cond(g, c, TPL_A, NEG_TEMPLATE)
    lat = g.add("EmptyLatentImage", {"width": 1024, "height": 1024, "batch_size": 1}, nid=30)
    ks1 = g.add("KSampler", {"model": g.out(m), "positive": g.out(p), "negative": g.out(n), "latent_image": g.out(lat),
                             "seed": SEED, "steps": 30, "cfg": 4.0, "sampler_name": SAMPLER, "scheduler": SCHEDULER,
                             "denoise": 1.0}, "KSampler 1 (1024)", nid=31)
    up = g.add("LatentUpscaleBy", {"samples": g.out(ks1), "upscale_method": "bislerp", "scale_by": 1.5}, "x1.5 -> 1536", nid=32)
    outs = {}
    for i, d in enumerate([0.3, 0.4, 0.5]):
        ks2 = g.add("KSampler", {"model": g.out(m), "positive": g.out(p), "negative": g.out(n), "latent_image": g.out(up),
                                 "seed": SEED, "steps": 30, "cfg": 4.0, "sampler_name": SAMPLER, "scheduler": SCHEDULER,
                                 "denoise": d}, f"KSampler 2 (denoise {d})", nid=40 + i * 2)
        dec = g.add("VAEDecode", {"samples": g.out(ks2), "vae": g.out(v)}, nid=41 + i * 2)
        outs[d] = dec
        save(g, dec, f"Anima_course/l4-hires/d{int(d * 100):03d}", 60 + i)
    # 两段放大：1536 → 2048
    up2 = g.add("LatentUpscale", {"samples": g.out(40 + 1 * 2), "upscale_method": "bislerp", "width": 2048, "height": 2048,
                                  "crop": "disabled"}, "-> 2048", nid=80)  # 40+1*2 = denoise 0.4 的 KSampler
    ks3 = g.add("KSampler", {"model": g.out(m), "positive": g.out(p), "negative": g.out(n), "latent_image": g.out(up2),
                             "seed": SEED, "steps": 25, "cfg": 4.0, "sampler_name": SAMPLER, "scheduler": SCHEDULER,
                             "denoise": 0.3}, "KSampler 3 (denoise 0.3)", nid=81)
    dec3 = g.add("VAEDecodeTiled", {"samples": g.out(ks3), "vae": g.out(v), "tile_size": 512, "overlap": 64,
                                    "temporal_size": 64, "temporal_overlap": 8}, nid=82)
    save(g, dec3, "Anima_course/l4-two-stage", 83)
    emit("l4-hires", [("", g)], note="路线 B：LatentUpscaleBy 1.5 → 二次采样 denoise 0.3 / 0.4 / 0.5；两段放大到 2048²（第三段见 l4probe 的结论）")


def fig_l4_sharpen():
    """锐化对照：读已出的 denoise 0.4 那张（1536²），裁脸部局部，左右并排。单独成组，坐标改了也不用重跑采样。"""
    src = next(iter(sorted((OUT / "l4-hires").glob("d040_*.png"))))
    g = Graph()
    img = g.add("LoadImage", {"image": upload(src, "anima-course")}, nid=10)
    crop = g.add("ImageCropV2", {"image": g.out(img), "crop_region": {"x": 520, "y": 300, "width": 560, "height": 560}}, nid=20)
    sharp = g.add("ImageSharpen", {"image": g.out(crop), "sharpen_radius": 1, "sigma": 1.0, "alpha": 0.4}, nid=21)
    a = label(g, crop, "no sharpen", 22)
    b = label(g, sharp, "ImageSharpen alpha 0.4", 23)
    save(g, stitch_right(g, [a, b], 24), "Anima_course/l4-sharpen", 25)
    emit("l4-sharpen", [("", g)], note="底图 l4-hires d040（1536²），脸部裁剪 (520,300,560,560)，ImageSharpen radius 1 / sigma 1 / alpha 0.4")


# ===================================================================== 04-02 / 04-03 L6 重绘与扩图
def _mask_png(path: Path, size: tuple[int, int], ellipses: list[tuple[int, int, int, int]], feather: int = 12):
    from PIL import Image, ImageDraw, ImageFilter
    w, h = size
    im = Image.new("L", (w, h), 0)
    d = ImageDraw.Draw(im)
    for x0, y0, x1, y1 in ellipses:
        d.ellipse([x0, y0, x1, y1], fill=255)
    if feather:
        im = im.filter(ImageFilter.GaussianBlur(feather))
    path.parent.mkdir(parents=True, exist_ok=True)
    im.save(path)


def _mask_rect(path: Path, size: tuple[int, int], rect: tuple[int, int, int, int], feather: int = 8):
    from PIL import Image, ImageDraw, ImageFilter
    w, h = size
    im = Image.new("L", (w, h), 0)
    ImageDraw.Draw(im).rounded_rectangle(rect, radius=24, fill=255)
    im = im.filter(ImageFilter.GaussianBlur(feather))
    path.parent.mkdir(parents=True, exist_ok=True)
    im.save(path)


def fig_l6():
    src = base_png()
    img_name = upload(src, "anima-course")
    # 脸部椭圆遮罩（底图 l0-prompt-tags，v1.0 权重 seed 42：脸在 x 390–700、y 250–580）
    mask_file = OUT / "l6-inpaint" / "mask-face.png"
    _mask_png(mask_file, (1024, 1024), [(390, 250, 700, 580)])
    mask_name = upload(mask_file, "anima-course")

    # before：原图 | 遮罩
    g = Graph()
    img = g.add("LoadImage", {"image": img_name}, nid=10)
    mk = g.add("LoadImageMask", {"image": mask_name, "channel": "red"}, nid=11)
    grown = g.add("GrowMask", {"mask": g.out(mk), "expand": 8, "tapered_corners": True}, nid=12)
    m2i = g.add("MaskToImage", {"mask": g.out(grown)}, nid=13)
    a = label(g, img, "original", 20)
    b = label(g, m2i, "mask (grow 8)", 21)
    save(g, stitch_right(g, [a, b], 22), "Anima_course/l6-inpaint/before", 23)
    emit("l6-inpaint-before", [("", g)], note="底图脸部椭圆遮罩，GrowMask 8")

    # after：路线 C（无 LLLite）VAEEncodeForInpaint → KSampler denoise 1
    g = Graph()
    m, c, v = loaders(g)
    img = g.add("LoadImage", {"image": img_name}, nid=30)
    mk = g.add("LoadImageMask", {"image": mask_name, "channel": "red"}, nid=31)
    grown = g.add("GrowMask", {"mask": g.out(mk), "expand": 8, "tapered_corners": True}, nid=32)
    # 路线 C 没有 LLLite 约束，提示词只写表情会把脸整个重画成别人：带上角色特征；种子 7 在这块遮罩上出的是张嘴笑
    p = g.add("CLIPTextEncode", {"text": "1girl, long black hair, amber eyes, smile, open mouth, blush, looking at viewer", "clip": g.out(c)},
              "Positive (mask only)", nid=20)
    n = g.add("CLIPTextEncode", {"text": NEG_TEMPLATE, "clip": g.out(c)}, "Negative", nid=21)
    enc = g.add("VAEEncodeForInpaint", {"pixels": g.out(img), "vae": g.out(v), "mask": g.out(grown), "grow_mask_by": 6}, nid=33)
    ks = g.add("KSampler", {"model": g.out(m), "positive": g.out(p), "negative": g.out(n), "latent_image": g.out(enc),
                            "seed": 7, "steps": 30, "cfg": 4.0, "sampler_name": SAMPLER, "scheduler": SCHEDULER,
                            "denoise": 1.0}, nid=34)
    dec = g.add("VAEDecode", {"samples": g.out(ks), "vae": g.out(v)}, nid=35)
    save(g, dec, "Anima_course/l6-inpaint/after", 36)
    emit("l6-inpaint-after", [("", g)], note="路线 C：VAEEncodeForInpaint(grow 6) → KSampler denoise 1、seed 7；提示词写新表情并带上角色特征（只写表情会重画成别人）")

    # 扩图：横图 1344×768 → 上下各补 288 → 1344×1344
    g = Graph()
    m, c, v = loaders(g)
    wide = t2i(TPL_A, seed=SEED, width=1344, height=768, prefix="Anima_course/l6-outpaint/original")
    emit("l6-outpaint", [("original", wide)], note="横图 1344×768，模板 A，同 seed")
    wide_png = next(iter(sorted((OUT / "l6-outpaint").glob("original*_*.png"))))
    wide_name = upload(wide_png, "anima-course")
    scene = TPL_A + ", cherry tree branches above, fallen petals on the ground below, detailed background, scenery"
    g = Graph()
    m, c, v = loaders(g)
    img = g.add("LoadImage", {"image": wide_name}, nid=30)
    pad = g.add("ImagePadForOutpaint", {"image": g.out(img), "left": 0, "top": 288, "right": 0, "bottom": 288, "feathering": 40}, nid=31)
    m2i = g.add("MaskToImage", {"mask": g.out(pad, 1)}, nid=32)
    a = label(g, img, "original 1344x768", 20)
    b = label(g, pad, "padded + mask", 21)
    cimg = g.add("ImageCompositeMasked", {"destination": g.out(pad), "source": g.out(m2i), "x": 0, "y": 0, "resize_source": False,
                                          "mask": g.out(pad, 1)}, nid=33)  # 遮罩区域叠白
    bb = label(g, pad, "padded (new area)", 22)
    cc = label(g, cimg, "mask: white = new", 23)
    save(g, stitch_right(g, [a, bb, cc], 24), "Anima_course/l6-outpaint/before", 26)
    p = g.add("CLIPTextEncode", {"text": scene, "clip": g.out(c)}, "Positive (whole scene)", nid=40)
    n = g.add("CLIPTextEncode", {"text": NEG_TEMPLATE, "clip": g.out(c)}, "Negative", nid=41)
    enc = g.add("VAEEncodeForInpaint", {"pixels": g.out(pad), "vae": g.out(v), "mask": g.out(pad, 1), "grow_mask_by": 6}, nid=42)
    ks = g.add("KSampler", {"model": g.out(m), "positive": g.out(p), "negative": g.out(n), "latent_image": g.out(enc),
                            "seed": SEED, "steps": 30, "cfg": 4.0, "sampler_name": SAMPLER, "scheduler": SCHEDULER,
                            "denoise": 1.0}, nid=43)
    dec = g.add("VAEDecode", {"samples": g.out(ks), "vae": g.out(v)}, nid=44)
    save(g, dec, "Anima_course/l6-outpaint/after", 45)
    emit("l6-outpaint", [("before-after", g)], note="外补画板上下各 288（feathering 40）→ 路线 C 重绘，提示词写整张画面")

    # 裁剪法修手：底图是 hands/123（双手在胸前、手指粘连），裁一块放大到 1 MP 重绘，再按遮罩贴回手部区域
    hand_src = OUT / "l6-crop-hand" / "source.png"
    if not hand_src.exists():
        raise SystemExit("缺 figures-out/l6-crop-hand/source.png：用 hands 提示词（TPL_A 换 cowboy shot, own hands together）在 seed 88 出一张放进去")
    hand_name = upload(hand_src, "anima-course")
    X, Y, W, H = 380, 330, 330, 300          # 裁剪框（v1.0 seed 88：手在 470–570 × 415–510，四周留余量）
    hand_mask = OUT / "l6-crop-hand" / "mask-hand.png"   # 裁剪框坐标系里只盖住手的区域
    _mask_rect(hand_mask, (W, H), (60, 55, 230, 215), feather=8)
    hm_name = upload(hand_mask, "anima-course")
    hand_prompt = "masterpiece, best quality, safe, 1girl, own hands together, detailed hands, fingers, white sailor dress"
    g = Graph()
    m, c, v = loaders(g)
    img = g.add("LoadImage", {"image": hand_name}, nid=30)
    hm = g.add("LoadImageMask", {"image": hm_name, "channel": "red"}, nid=35)
    crop = g.add("ImageCropV2", {"image": g.out(img), "crop_region": {"x": X, "y": Y, "width": W, "height": H}}, nid=31)
    big = g.add("ImageScaleToTotalPixels", {"image": g.out(crop), "upscale_method": "lanczos", "megapixels": 1.0,
                                            "resolution_steps": 16}, nid=32)
    enc = g.add("VAEEncode", {"pixels": g.out(big), "vae": g.out(v)}, nid=33)
    p = g.add("CLIPTextEncode", {"text": hand_prompt, "clip": g.out(c)}, "Positive (hands only)", nid=20)
    n = g.add("CLIPTextEncode", {"text": NEG_TEMPLATE + ", bad hands, missing fingers", "clip": g.out(c)}, "Negative", nid=21)
    ks = g.add("KSampler", {"model": g.out(m), "positive": g.out(p), "negative": g.out(n), "latent_image": g.out(enc),
                            "seed": SEED, "steps": 30, "cfg": 4.0, "sampler_name": SAMPLER, "scheduler": SCHEDULER,
                            "denoise": 0.85}, nid=34)
    dec = g.add("VAEDecode", {"samples": g.out(ks), "vae": g.out(v)}, nid=36)
    back = g.add("ImageScale", {"image": g.out(dec), "upscale_method": "lanczos", "width": W, "height": H, "crop": "disabled"}, nid=37)
    comp = g.add("ImageCompositeMasked", {"destination": g.out(img), "source": g.out(back), "x": X, "y": Y, "resize_source": False,
                                          "mask": g.out(hm)}, nid=38)
    a = label(g, crop, "crop (before)", 50)
    b = label(g, back, "crop -> 1 MP, redrawn", 51)
    small = g.add("ImageScale", {"image": g.out(comp), "upscale_method": "lanczos", "width": H, "height": H, "crop": "disabled"}, nid=53)
    cimg = label(g, small, "pasted back", 54)
    row = g.add("ImageStitch", {"image1": g.out(a), "image2": g.out(b), "direction": "right", "match_image_size": True,
                                "spacing_width": 0, "spacing_color": "white"}, nid=55)
    save(g, g.add("ImageStitch", {"image1": g.out(row), "image2": g.out(cimg), "direction": "right", "match_image_size": True,
                                  "spacing_width": 0, "spacing_color": "white"}, nid=56), "Anima_course/l6-crop-hand", 57)
    emit("l6-crop-hand", [("", g)], note="底图 source.png（v1.0，hands 提示词 seed 88），裁剪框 (380,330,330,300)，放大到 1 MP 重绘 denoise 0.85，按遮罩贴回手部")


# ===================================================================== 05-01 / 05-02 L7 采样器零件
def fig_l7():
    # shift 3 / 5 / 7：三张单图
    for s in (3.0, 5.0, 7.0):
        g = Graph()
        m, c, v = loaders(g)
        # Anima 的 sampling_settings 是 multiplier 1.0；ModelSamplingSD3 写死 multiplier 1000 会出噪点，要用 AuraFlow 这个变体
        ms = g.add("ModelSamplingAuraFlow", {"model": g.out(m), "shift": s}, f"shift {s:g}", nid=15)
        p, n = cond(g, c, TPL_A, NEG_TEMPLATE)
        lat = g.add("EmptyLatentImage", {"width": 1024, "height": 1024, "batch_size": 1}, nid=30)
        ks = g.add("KSampler", {"model": g.out(ms), "positive": g.out(p), "negative": g.out(n), "latent_image": g.out(lat),
                                "seed": SEED, "steps": 30, "cfg": 4.0, "sampler_name": SAMPLER, "scheduler": SCHEDULER,
                                "denoise": 1.0}, nid=31)
        dec = g.add("VAEDecode", {"samples": g.out(ks), "vae": g.out(v)}, nid=32)
        save(g, dec, f"Anima_course/l7-shift/s{int(s)}", 33)
        emit(f"l7-shift-{int(s)}", [("", g)], note=f"ModelSamplingAuraFlow shift {s:g}，其余同基线")

    # APG：cfg 12 不挂 vs 挂（7 烧得不明显，看不出 APG 的作用）
    g = Graph()
    m, c, v = loaders(g)
    apg = g.add("APG", {"model": g.out(m), "eta": 1.0, "norm_threshold": 5.0, "momentum": 0.0}, nid=16)
    p, n = cond(g, c, TPL_A, NEG_TEMPLATE)
    lat = g.add("EmptyLatentImage", {"width": 1024, "height": 1024, "batch_size": 1}, nid=30)
    imgs = []
    for i, (mdl, txt) in enumerate(((m, "cfg 12"), (apg, "cfg 12 + APG"))):   # cfg 7 在 preview3 上不烧，12 才看得出 APG
        ks = g.add("KSampler", {"model": g.out(mdl), "positive": g.out(p), "negative": g.out(n), "latent_image": g.out(lat),
                                "seed": SEED, "steps": 30, "cfg": 12.0, "sampler_name": SAMPLER, "scheduler": SCHEDULER,
                                "denoise": 1.0}, txt, nid=40 + i * 2)
        dec = g.add("VAEDecode", {"samples": g.out(ks), "vae": g.out(v)}, nid=41 + i * 2)
        imgs.append(label(g, dec, txt, 50 + i))
    save(g, grid(g, batch_all(g, imgs, 60), 70, columns=2, cell=512), "Anima_course/l7-apg", 80)
    emit("l7-apg", [("", g)], note="cfg 12（7 在 preview3 上不烧），APG eta 1 / norm 5 / momentum 0")

    # NAG：负向里放一个明确不想要的东西（cherry blossoms），cfg 4 不挂 vs 挂
    neg_tw = NEG_TEMPLATE + ", cherry blossoms"
    g = Graph()
    m, c, v = loaders(g)
    nag = g.add("NAGuidance", {"model": g.out(m), "nag_scale": 5.0, "nag_alpha": 0.5, "nag_tau": 1.5}, nid=16)
    p = g.add("CLIPTextEncode", {"text": TPL_A, "clip": g.out(c)}, "Positive", nid=20)
    n = g.add("CLIPTextEncode", {"text": neg_tw, "clip": g.out(c)}, "Negative", nid=21)
    lat = g.add("EmptyLatentImage", {"width": 1024, "height": 1024, "batch_size": 1}, nid=30)
    imgs = []
    for i, (mdl, txt) in enumerate(((m, "cfg 4, no NAG"), (nag, "cfg 4 + NAG"))):
        ks = g.add("KSampler", {"model": g.out(mdl), "positive": g.out(p), "negative": g.out(n), "latent_image": g.out(lat),
                                "seed": SEED, "steps": 30, "cfg": 4.0, "sampler_name": SAMPLER, "scheduler": SCHEDULER,
                                "denoise": 1.0}, txt, nid=40 + i * 2)
        dec = g.add("VAEDecode", {"samples": g.out(ks), "vae": g.out(v)}, nid=41 + i * 2)
        imgs.append(label(g, dec, txt + '  (neg: "cherry blossoms")', 50 + i))
    save(g, grid(g, batch_all(g, imgs, 60), 70, columns=2, cell=512), "Anima_course/l7-nag", 80)
    emit("l7-nag", [("", g)], note="cfg 4，负向追加 cherry blossoms；NAG scale 5 / alpha 0.5 / tau 1.5")

    # 基本引导器 vs K采样器 cfg 1：同 seed 应一致，耗时各跑两遍取第二遍
    def ksampler_graph():
        g = Graph()
        m, c, v = loaders(g)
        p, n = cond(g, c, TPL_A, NEG_TEMPLATE)
        lat = g.add("EmptyLatentImage", {"width": 1024, "height": 1024, "batch_size": 1}, nid=30)
        ks = g.add("KSampler", {"model": g.out(m), "positive": g.out(p), "negative": g.out(n), "latent_image": g.out(lat),
                                "seed": SEED, "steps": 30, "cfg": 1.0, "sampler_name": SAMPLER, "scheduler": SCHEDULER,
                                "denoise": 1.0}, "KSampler (cfg 1)", nid=31)
        dec = g.add("VAEDecode", {"samples": g.out(ks), "vae": g.out(v)}, nid=32)
        save(g, dec, "Anima_course/l7-guider/ksampler", 33)
        return g

    def guider_graph():
        g = Graph()
        m, c, v = loaders(g)
        p, _ = cond(g, c, TPL_A, NEG_TEMPLATE)
        lat = g.add("EmptyLatentImage", {"width": 1024, "height": 1024, "batch_size": 1}, nid=30)
        sel = g.add("KSamplerSelect", {"sampler_name": SAMPLER}, nid=40)
        sch = g.add("BasicScheduler", {"model": g.out(m), "scheduler": SCHEDULER, "steps": 30, "denoise": 1.0}, nid=41)
        noise = g.add("RandomNoise", {"noise_seed": SEED}, nid=42)
        gd = g.add("BasicGuider", {"model": g.out(m), "conditioning": g.out(p)}, nid=43)
        s = g.add("SamplerCustomAdvanced", {"noise": g.out(noise), "guider": g.out(gd), "sampler": g.out(sel), "sigmas": g.out(sch),
                                            "latent_image": g.out(lat)}, nid=44)
        dec = g.add("VAEDecode", {"samples": g.out(s), "vae": g.out(v)}, nid=45)
        save(g, dec, "Anima_course/l7-guider/basicguider", 46)
        return g

    # 同一工作流第二次提交会命中 ComfyUI 的执行缓存，计时前先清掉（模型不卸载）
    emit("l7-guider", [("ksampler-warmup", ksampler_graph()), ("guider-warmup", guider_graph())],
         note="同 seed 30 步 euler/simple：KSampler cfg 1 与 BasicGuider + SamplerCustomAdvanced；热身两遍后再各计一次")
    for tag, fn in (("ksampler", ksampler_graph), ("guider", guider_graph)):
        free_cache()
        manifest = _manifest()
        g = fn()
        (OUT / "l7-guider" / f"l7-guider.{tag}.api.json").write_text(json.dumps(g.prompt(), ensure_ascii=False, indent=1))
        t0 = time.time()
        hist, files = run(g.prompt(), OUT / "l7-guider", label=f"l7-guider/{tag}")
        manifest["l7-guider"]["runs"].append({"tag": tag, "prompt_id": hist.get("prompt_id"), "seconds": round(time.time() - t0, 1),
                                              "files": [f.name for f in files]})
        MANIFEST_PATH.write_text(json.dumps(manifest, ensure_ascii=False, indent=1))


# ===================================================================== 05-03 L8 渐进放大循环
def fig_l8():
    g = Graph()
    m, c, v = loaders(g)
    p, n = cond(g, c, TPL_A, NEG_TEMPLATE)
    lat = g.add("EmptyLatentImage", {"width": 1024, "height": 1024, "batch_size": 1}, nid=30)
    ks = g.add("KSampler", {"model": g.out(m), "positive": g.out(p), "negative": g.out(n), "latent_image": g.out(lat),
                            "seed": SEED, "steps": 30, "cfg": 4.0, "sampler_name": SAMPLER, "scheduler": SCHEDULER,
                            "denoise": 1.0}, "round 0: 1024", nid=31)
    stages = []
    cur = ks
    for i, size in enumerate((1280, 1600, 2048)):
        up = g.add("LatentUpscaleBy", {"samples": g.out(cur), "upscale_method": "bislerp", "scale_by": 1.25}, f"x1.25 -> {size}", nid=40 + i * 3)
        cur = g.add("KSampler", {"model": g.out(m), "positive": g.out(p), "negative": g.out(n), "latent_image": g.out(up),
                                 "seed": SEED, "steps": 30, "cfg": 4.0, "sampler_name": SAMPLER, "scheduler": SCHEDULER,
                                 "denoise": 0.35}, f"round {i + 1}: {size}, denoise 0.35", nid=41 + i * 3)
        stages.append((size, cur))
    imgs = []
    # 第 0 轮
    d0 = g.add("VAEDecode", {"samples": g.out(ks), "vae": g.out(v)}, nid=60)
    s0 = g.add("ImageScale", {"image": g.out(d0), "upscale_method": "lanczos", "width": 512, "height": 512, "crop": "disabled"}, nid=61)
    imgs.append(label(g, s0, "1024 (base)", 62))
    for i, (size, node) in enumerate(stages):
        d = g.add("VAEDecodeTiled", {"samples": g.out(node), "vae": g.out(v), "tile_size": 512, "overlap": 64,
                                     "temporal_size": 64, "temporal_overlap": 8}, nid=70 + i * 3)
        save(g, d, f"Anima_course/l8-loop/round{i + 1}-{size}", 100 + i)
        s = g.add("ImageScale", {"image": g.out(d), "upscale_method": "lanczos", "width": 512, "height": 512, "crop": "disabled"}, nid=71 + i * 3)
        imgs.append(label(g, s, f"{size} (x1.25, d0.35)", 72 + i * 3))
    save(g, grid(g, batch_all(g, imgs, 90), 95, columns=4, cell=512), "Anima_course/l8-loop/grid", 96)
    emit("l8-loop", [("", g)], note="渐进放大：1024 → 1280 → 1600 → 2048，每轮 LatentUpscaleBy 1.25 + denoise 0.35（手搭串联，等价于 StartLoop/EndLoop）")


GROUPS = {
    "setup": [fig_setup_first],
    "l0": [fig_l0],
    "pb": [fig_pb],
    "l2": [fig_l2],
    "pm": [fig_pm],
    "l3": [fig_l3],
    "l4": [fig_l4],
    "l4-sharpen": [fig_l4_sharpen],
    "l6": [fig_l6],
    "l7": [fig_l7],
    "l8": [fig_l8],
}


def main(argv):
    if "--list" in argv:
        for g, fns in GROUPS.items():
            print(g, "→", ", ".join(fn.__name__ for fn in fns))
        return
    todo = argv or list(GROUPS)
    for item in todo:
        for fn in GROUPS.get(item, []):
            print(f"\n=== {item} → {fn.__name__}", flush=True)
            fn()



# ===================================================================== l7 基本引导器：出完两张后拼图并标耗时
def fig_l7_composite():
    """读 manifest 里 l7-guider 的两次计时，把两张图拼在一起、各标自己的耗时。"""
    d = OUT / "l7-guider"
    ks = next(iter(sorted(d.glob("ksampler_*.png"))))
    gd = next(iter(sorted(d.glob("basicguider_*.png"))))
    secs = {r["tag"]: r["seconds"] for r in _manifest()["l7-guider"]["runs"]}
    g = Graph()
    a = g.add("LoadImage", {"image": upload(ks, "anima-course")}, nid=10)
    b = g.add("LoadImage", {"image": upload(gd, "anima-course")}, nid=11)
    la = label(g, a, f"KSampler, cfg 1: {secs['ksampler']:.1f}s", 20)
    lb = label(g, b, f"BasicGuider + SamplerCustomAdvanced: {secs['guider']:.1f}s", 21)
    save(g, grid(g, batch_all(g, [la, lb], 30), 40, columns=2, cell=512), "Anima_course/l7-basic-guider", 50)
    emit("l7-basic-guider", [("", g)], note="同 seed 30 步 euler/simple；耗时取自 manifest 的 l7-guider 第二遍")


GROUPS["l7-composite"] = [fig_l7_composite]


# ====================================================================== B 类：需要额外模型
# 这些图要在 download_models.py 把文件下齐后才跑得起来；全部用官方名的权重（见 comfy_client.UNET）。
TURBO_LORA = "anima-turbo-lora-v0.2.safetensors"
HIGHRES_LORA = "anima-highres-aesthetic-boost.safetensors"
STYLE_LORA = "anima-greg-rutkowski-style.safetensors"
AESTHETIC = "anima-aesthetic-v1.1.safetensors"
UPSCALER = "4x_IllustrationJaNai_V1_ESRGAN_135k.pth"
LLL_ANY = "anima-lllite-any-test-like-v2.safetensors"
LLL_INPAINT = "anima-lllite-inpainting-v2.safetensors"

# 成品模板 E（Aesthetic，CFG 4、30 步）：无 score 标签，背景写具体
TPL_E = ("masterpiece, best quality, safe, detailed background, 1girl, solo, long black hair, amber eyes, white sailor dress, "
         "hair ribbon, standing, looking at viewer, gentle smile, upper body, outdoors, cherry blossoms, wind, sunlight, "
         "depth of field, scenery")
NEG_E = "worst quality, low quality, blurry, jpeg artifacts, chromatic aberration"


def _lora(g: Graph, model: int, name: str, strength: float, nid: int, title: str | None = None) -> int:
    return g.add("LoraLoaderModelOnly", {"model": g.out(model), "lora_name": name, "strength_model": strength}, title, nid=nid)


def _base_model(g: Graph, m: int, nid: int) -> int:
    return m


def _branches(variants, prefix: str, columns: int, seed=SEED, *, width=1024, height=1024, batch=1):
    """通用多分支：variants = [(标签, 正向, 负向, 模型构造函数(g, m, nid) → 模型节点, KSampler 覆盖)]，共用 latent。"""
    g = Graph()
    m, c, v = loaders(g)
    lat = g.add("EmptyLatentImage", {"width": width, "height": height, "batch_size": batch}, nid=30)
    imgs = []
    for i, (txt, pos, neg, model_fn, over) in enumerate(variants):
        mdl = model_fn(g, m, 15 + i)
        p = g.add("CLIPTextEncode", {"text": pos, "clip": g.out(c)}, "Positive", nid=60 + i * 2)
        n = g.add("CLIPTextEncode", {"text": neg, "clip": g.out(c)}, "Negative", nid=61 + i * 2)
        params = {"model": g.out(mdl), "positive": g.out(p), "negative": g.out(n), "latent_image": g.out(lat),
                  "seed": seed, "steps": 30, "cfg": 4.0, "sampler_name": SAMPLER, "scheduler": SCHEDULER, "denoise": 1.0}
        params.update(over)
        ks = g.add("KSampler", params, txt, nid=100 + i * 2)
        dec = g.add("VAEDecode", {"samples": g.out(ks), "vae": g.out(v)}, nid=101 + i * 2)
        imgs.append(label(g, dec, txt, 140 + i))
    save(g, grid(g, batch_all(g, imgs, 160), 170, columns=columns, cell=512), prefix, 180)
    return g


# --------------------------------------------------------------------- 01-02 L1 开关
def fig_l1():
    g2 = _branches([("Turbo: 8 steps, cfg 1", TPL_A, NEG_TEMPLATE, lambda g, m, nid: _lora(g, m, TURBO_LORA, 1.0, nid), {"steps": 8, "cfg": 1.0}),
                    ("Full: 30 steps, cfg 4", TPL_A, NEG_TEMPLATE, _base_model, {})], "Anima_course/l1-turbo-vs-full", 2)
    emit("l1-turbo-vs-full", [("", g2)], note="同 seed 同提示词：Base + Turbo LoRA（8 步 / CFG 1）与 Base（30 步 / CFG 4）")
    # 强度三档要在同一张图里共用 latent
    gb = Graph(); mb, cb, vb = loaders(gb)
    l1 = _lora(gb, mb, TURBO_LORA, 1.0, 15); l2 = _lora(gb, mb, TURBO_LORA, 0.8, 16); l3 = _lora(gb, mb, TURBO_LORA, 0.7, 17)
    lat = gb.add("EmptyLatentImage", {"width": 1024, "height": 1024, "batch_size": 1}, nid=30)
    imgs = []
    for i, (txt, mdl) in enumerate((("Turbo LoRA 1.0", l1), ("Turbo LoRA 0.8", l2), ("Turbo LoRA 0.7", l3))):
        p = gb.add("CLIPTextEncode", {"text": TPL_A, "clip": gb.out(cb)}, "Positive", nid=60 + i * 2)
        n = gb.add("CLIPTextEncode", {"text": NEG_TEMPLATE, "clip": gb.out(cb)}, "Negative", nid=61 + i * 2)
        ks = gb.add("KSampler", {"model": gb.out(mdl), "positive": gb.out(p), "negative": gb.out(n), "latent_image": gb.out(lat),
                                 "seed": SEED, "steps": 8, "cfg": 1.0, "sampler_name": SAMPLER, "scheduler": SCHEDULER, "denoise": 1.0}, txt, nid=100 + i * 2)
        dec = gb.add("VAEDecode", {"samples": gb.out(ks), "vae": gb.out(vb)}, nid=101 + i * 2)
        imgs.append(label(gb, dec, txt, 140 + i))
    save(gb, grid(gb, batch_all(gb, imgs, 160), 170, columns=3, cell=512), "Anima_course/l1-lora-strength", 180)
    emit("l1-lora-strength", [("", gb)], note="Turbo LoRA 强度 1.0 / 0.8 / 0.7，8 步 / CFG 1，同 seed")


# --------------------------------------------------------------------- 03-01 / 03-02 两段出图与 LoRA 强度
def fig_l3b():
    g = Graph(); m, c, v = loaders(g)
    ma = g.add("UNETLoader", {"unet_name": AESTHETIC, "weight_dtype": "default"}, "Aesthetic v1.1", nid=13)
    turbo = _lora(g, m, TURBO_LORA, 1.0, 15)
    lat = g.add("EmptyLatentImage", {"width": 1024, "height": 1024, "batch_size": 1}, nid=30)
    p_t, n_t = cond(g, c, TPL_A, NEG_TEMPLATE, 20)
    p_e, n_e = cond(g, c, TPL_E, NEG_E, 22)
    # 方式 1：Turbo 试稿 → Aesthetic 同 seed 重出
    ks_t = ksampler(g, turbo, p_t, n_t, lat, 40, seed=SEED, steps=8, cfg=1.0, title="Turbo draft (8/1)")
    dec_t = g.add("VAEDecode", {"samples": g.out(ks_t), "vae": g.out(v)}, nid=41)
    save(g, dec_t, "Anima_course/l3b-turbo-draft", 42)
    ks_a = ksampler(g, ma, p_e, n_e, lat, 43, seed=SEED, title="Aesthetic final (30/4)")
    dec_a = g.add("VAEDecode", {"samples": g.out(ks_a), "vae": g.out(v)}, nid=44)
    save(g, dec_a, "Anima_course/l3b-aesthetic-final", 45)
    # 方式 2：Turbo 潜空间 → Aesthetic 以 denoise 0.4 精修
    ks_r = ksampler(g, ma, p_e, n_e, ks_t, 46, seed=SEED, denoise=0.4, title="Aesthetic refine (denoise 0.4)")
    dec_r = g.add("VAEDecode", {"samples": g.out(ks_r), "vae": g.out(v)}, nid=47)
    save(g, dec_r, "Anima_course/l3b-latent-refine", 48)
    emit("l3b-two-stage", [("", g)], note="方式 1 种子迁移（Turbo 8/1 → Aesthetic 30/4 同 seed）与方式 2 潜空间精修（denoise 0.4）；成品模板 E")
    # LoRA 强度：风格 LoRA 0.6 / 0.8 / 1.0，Aesthetic，提示词加作者前缀
    gb = Graph(); mb, cb, vb = loaders(gb)
    mae = gb.add("UNETLoader", {"unet_name": AESTHETIC, "weight_dtype": "default"}, nid=13)
    ls = [_lora(gb, mae, STYLE_LORA, s, 15 + i) for i, s in enumerate((0.6, 0.8, 1.0))]
    lat = gb.add("EmptyLatentImage", {"width": 1024, "height": 1024, "batch_size": 1}, nid=30)
    p = gb.add("CLIPTextEncode", {"text": "@greg rutkowski. " + TPL_B, "clip": gb.out(cb)}, "Positive", nid=20)
    n = gb.add("CLIPTextEncode", {"text": NEG_E, "clip": gb.out(cb)}, "Negative", nid=21)
    imgs = []
    for i, (s, mdl) in enumerate(zip((0.6, 0.8, 1.0), ls)):
        ks = gb.add("KSampler", {"model": gb.out(mdl), "positive": gb.out(p), "negative": gb.out(n), "latent_image": gb.out(lat),
                                 "seed": SEED, "steps": 30, "cfg": 4.0, "sampler_name": SAMPLER, "scheduler": SCHEDULER, "denoise": 1.0},
                    f"style LoRA {s}", nid=100 + i * 2)
        dec = gb.add("VAEDecode", {"samples": gb.out(ks), "vae": gb.out(vb)}, nid=101 + i * 2)
        imgs.append(label(gb, dec, f"style LoRA {s}", 140 + i))
    save(gb, grid(gb, batch_all(gb, imgs, 160), 170, columns=3, cell=512), "Anima_course/l3b-lora-strength", 180)
    emit("l3b-lora-strength", [("", gb)], note="风格 LoRA anima-greg-rutkowski-style 0.6 / 0.8 / 1.0，Aesthetic v1.1，提示词前缀 @greg rutkowski.")


# --------------------------------------------------------------------- 03-04 / 03-05 放大：路线 A / C、highres LoRA
def _l4_chain(g: Graph, m: int, c: int, v: int, p: int, n: int):
    lat = g.add("EmptyLatentImage", {"width": 1024, "height": 1024, "batch_size": 1}, nid=30)
    ks1 = ksampler(g, m, p, n, lat, 31, seed=SEED, title="KSampler 1 (1024)")
    dec1 = g.add("VAEDecode", {"samples": g.out(ks1), "vae": g.out(v)}, nid=32)
    return ks1, dec1


def fig_l4b():
    g = Graph(); m, c, v = loaders(g)
    p, n = cond(g, c, TPL_A, NEG_TEMPLATE)
    ks1, dec1 = _l4_chain(g, m, c, v, p, n)
    # 路线 A：像素放大模型 → 缩到 2.36 MP，不重画
    upm = g.add("UpscaleModelLoader", {"model_name": UPSCALER}, nid=40)
    up = g.add("ImageUpscaleWithModel", {"upscale_model": g.out(upm), "image": g.out(dec1)}, nid=41)
    rs = g.add("ImageScaleToTotalPixels", {"image": g.out(up), "upscale_method": "lanczos", "megapixels": 2.36, "resolution_steps": 16}, nid=42)
    save(g, rs, "Anima_course/l4b-route-a", 43)
    # 路线 C：像素放大 → 缩到 2.36 MP → 图生图 denoise 0.4
    enc = g.add("VAEEncode", {"pixels": g.out(rs), "vae": g.out(v)}, nid=44)
    ks2 = ksampler(g, m, p, n, enc, 45, seed=SEED, denoise=0.4, title="KSampler 2 (route C, denoise 0.4)")
    dec2 = g.add("VAEDecode", {"samples": g.out(ks2), "vae": g.out(v)}, nid=46)
    save(g, dec2, "Anima_course/l4b-route-c", 47)
    # 两段放大（第二段挂 highres LoRA）
    up1 = g.add("LatentUpscaleBy", {"samples": g.out(ks1), "upscale_method": "bislerp", "scale_by": 1.5}, nid=50)
    ksA = ksampler(g, m, p, n, up1, 51, seed=SEED, denoise=0.4, title="KSampler 2 (1536, denoise 0.4)")
    up2 = g.add("LatentUpscale", {"samples": g.out(ksA), "upscale_method": "bislerp", "width": 2048, "height": 2048, "crop": "disabled"}, nid=52)
    hr = _lora(g, m, HIGHRES_LORA, 1.0, 53, "highres-aesthetic-boost 1.0")
    ks3 = ksampler(g, hr, p, n, up2, 54, seed=SEED, steps=25, denoise=0.3, title="KSampler 3 (2048, denoise 0.3, highres LoRA)")
    dec3 = g.add("VAEDecodeTiled", {"samples": g.out(ks3), "vae": g.out(v), "tile_size": 512, "overlap": 64, "temporal_size": 64, "temporal_overlap": 8}, nid=55)
    save(g, dec3, "Anima_course/l4b-two-stage", 56)
    emit("l4b", [("", g)], note="路线 A（4x IllustrationJaNai → 2.36 MP）、路线 C（同上 + 图生图 denoise 0.4）、两段放大第二段挂 highres LoRA")
    # highres LoRA：直接出 1536²，不挂 vs 挂
    gb = Graph(); mb, cb, vb = loaders(gb)
    hb = _lora(gb, mb, HIGHRES_LORA, 1.0, 15)
    lat = gb.add("EmptyLatentImage", {"width": 1536, "height": 1536, "batch_size": 1}, nid=30)
    pb, nb = cond(gb, cb, TPL_A, NEG_TEMPLATE)
    imgs = []
    for i, (txt, mdl) in enumerate((("1536, no LoRA", mb), ("1536 + highres LoRA", hb))):
        ks = gb.add("KSampler", {"model": gb.out(mdl), "positive": gb.out(pb), "negative": gb.out(nb), "latent_image": gb.out(lat),
                                 "seed": SEED, "steps": 30, "cfg": 4.0, "sampler_name": SAMPLER, "scheduler": SCHEDULER, "denoise": 1.0}, txt, nid=100 + i * 2)
        dec = gb.add("VAEDecode", {"samples": gb.out(ks), "vae": gb.out(vb)}, nid=101 + i * 2)
        imgs.append(label(gb, dec, txt, 140 + i))
    save(gb, grid(gb, batch_all(gb, imgs, 160), 170, columns=2, cell=512), "Anima_course/l4b-highres-lora", 180)
    emit("l4b-highres-lora", [("", gb)], note="同 seed 直接出 1536²：不挂 / 挂 anima-highres-aesthetic-boost（strength 1.0）")


# --------------------------------------------------------------------- 04-01 L5 Canny 控制
def fig_l5():
    src = base_png()
    name = upload(src, "anima-course")
    g = Graph(); m, c, v = loaders(g)
    img = g.add("LoadImage", {"image": name}, "control source", nid=30)
    canny = g.add("Canny", {"image": g.out(img), "low_threshold": 0.17, "high_threshold": 0.45}, nid=31)
    ctrl = g.add("ImageInvert", {"image": g.out(canny)}, "white bg, black lines", nid=32)
    save(g, ctrl, "Anima_course/l5b-canny-control", 33)
    p, n = cond(g, c, TPL_A, NEG_TEMPLATE)
    patch = g.add("ModelPatchLoader", {"name": LLL_ANY}, nid=34)
    lat = g.add("EmptyLatentImage", {"width": 1024, "height": 1024, "batch_size": 1}, nid=35)
    imgs = []
    for i, s in enumerate((0.8, 1.0, 1.2)):
        ap = g.add("AnimaLLLiteApply", {"model": g.out(m), "model_patch": g.out(patch), "image": g.out(ctrl),
                                        "strength": s, "start_percent": 0.0, "end_percent": 1.0}, f"strength {s}", nid=40 + i * 3)
        ks = ksampler(g, ap, p, n, lat, 41 + i * 3, seed=SEED, title=f"KSampler (strength {s})")
        dec = g.add("VAEDecode", {"samples": g.out(ks), "vae": g.out(v)}, nid=42 + i * 3)
        imgs.append(label(g, dec, f"strength {s}", 140 + i))
        if s == 1.0:
            save(g, dec, "Anima_course/l5b-canny-result", 60)
    a = label(g, ctrl, "Canny control (inverted)", 150)
    b = label(g, 140, "any-test-like-v2, strength 1.0", 151)
    save(g, stitch_right(g, [a, b], 152), "Anima_course/l5b-canny-compare", 153)
    save(g, grid(g, batch_all(g, imgs, 160), 170, columns=3, cell=512), "Anima_course/l5b-strength", 180)
    emit("l5b", [("", g)], note="控制图 = 底图 Canny(0.17, 0.45) 取反；any-test-like-v2，Base 30/4；strength 0.8 / 1.0 / 1.2")


# --------------------------------------------------------------------- 04-02 L6 路线 A / B（LLLite inpainting）
def fig_l6b():
    src = base_png()
    img_name = upload(src, "anima-course")
    mask_face = upload(OUT / "l6-inpaint" / "mask-face.png", "anima-course")
    # 路线 B：保色重绘，LLLite 约束未遮罩区域
    g = Graph(); m, c, v = loaders(g)
    img = g.add("LoadImage", {"image": img_name}, nid=30)
    mk = g.add("LoadImageMask", {"image": mask_face, "channel": "red"}, nid=31)
    grown = g.add("GrowMask", {"mask": g.out(mk), "expand": 8, "tapered_corners": True}, nid=32)
    p = g.add("CLIPTextEncode", {"text": "1girl, long black hair, amber eyes, smile, open mouth, blush, looking at viewer", "clip": g.out(c)}, nid=20)
    n = g.add("CLIPTextEncode", {"text": NEG_TEMPLATE, "clip": g.out(c)}, nid=21)
    patch = g.add("ModelPatchLoader", {"name": LLL_INPAINT}, nid=33)
    ap = g.add("AnimaLLLiteApply", {"model": g.out(m), "model_patch": g.out(patch), "image": g.out(img), "mask": g.out(grown),
                                    "strength": 1.0, "start_percent": 0.0, "end_percent": 1.0}, nid=34)
    enc = g.add("VAEEncodeForInpaint", {"pixels": g.out(img), "vae": g.out(v), "mask": g.out(grown), "grow_mask_by": 6}, nid=35)
    ks = g.add("KSampler", {"model": g.out(ap), "positive": g.out(p), "negative": g.out(n), "latent_image": g.out(enc),
                            "seed": 7, "steps": 30, "cfg": 4.0, "sampler_name": SAMPLER, "scheduler": SCHEDULER, "denoise": 1.0}, nid=36)
    dec = g.add("VAEDecode", {"samples": g.out(ks), "vae": g.out(v)}, nid=37)
    save(g, dec, "Anima_course/l6b-b-after", 38)
    emit("l6b-b-after", [("", g)], note="路线 B：LLLite inpainting-v2 约束 + VAEEncodeForInpaint，提示词写新表情并带角色特征，seed 7")
    # 路线 A：加物件，从纯噪声重生成整图，未涂区域靠控制图照抄
    mask_file = OUT / "l6b-inpaint" / "mask-umbrella.png"
    _mask_rect(mask_file, (1024, 1024), (60, 40, 560, 420), feather=0)
    mask_um = upload(mask_file, "anima-course")
    g = Graph(); m, c, v = loaders(g)
    img = g.add("LoadImage", {"image": img_name}, nid=30)
    mk = g.add("LoadImageMask", {"image": mask_um, "channel": "red"}, nid=31)
    patch = g.add("ModelPatchLoader", {"name": LLL_INPAINT}, nid=33)
    turbo = _lora(g, m, TURBO_LORA, 1.0, 15)
    # 路线 A 的控制图里，被涂的区域要涂黑（画板节点就是这么输出的），否则模型照抄原图
    black = g.add("EmptyImage", {"width": 1024, "height": 1024, "batch_size": 1, "color": 0}, nid=14)
    ctrl = g.add("ImageCompositeMasked", {"destination": g.out(img), "source": g.out(black), "x": 0, "y": 0, "resize_source": False,
                                          "mask": g.out(mk)}, "control (masked area blacked out)", nid=17)
    ap = g.add("AnimaLLLiteApply", {"model": g.out(turbo), "model_patch": g.out(patch), "image": g.out(ctrl), "mask": g.out(mk),
                                    "strength": 1.0, "start_percent": 0.0, "end_percent": 1.0}, nid=34)
    p = g.add("CLIPTextEncode", {"text": "a red paper umbrella", "clip": g.out(c)}, nid=20)
    n = g.add("CLIPTextEncode", {"text": NEG_TEMPLATE, "clip": g.out(c)}, nid=21)
    lat = g.add("EmptyLatentImage", {"width": 1024, "height": 1024, "batch_size": 1}, nid=35)
    ks = g.add("KSampler", {"model": g.out(ap), "positive": g.out(p), "negative": g.out(n), "latent_image": g.out(lat),
                            "seed": SEED, "steps": 8, "cfg": 1.0, "sampler_name": SAMPLER, "scheduler": SCHEDULER, "denoise": 1.0}, nid=36)
    dec = g.add("VAEDecode", {"samples": g.out(ks), "vae": g.out(v)}, nid=37)
    save(g, dec, "Anima_course/l6b-a-after", 38)
    m2i = g.add("MaskToImage", {"mask": g.out(mk)}, nid=39)
    a = label(g, img, "original", 50); b = label(g, m2i, "mask: where the umbrella goes", 51)
    save(g, stitch_right(g, [a, b], 52), "Anima_course/l6b-a-before", 53)
    emit("l6b-a", [("", g)], note="路线 A：控制图在遮罩处涂黑 + LLLite inpainting-v2 + 纯噪声画布，Turbo 8/1，提示词只写 a red paper umbrella")


# --------------------------------------------------------------------- 05-01 L7 两段采样
def fig_l7b():
    g = Graph(); m, c, v = loaders(g)
    turbo = _lora(g, m, TURBO_LORA, 1.0, 15)
    cfo = g.add("CFGOverride", {"model": g.out(turbo), "cfg": 1.0, "start_percent": 0.0, "end_percent": 0.5}, nid=16)
    p, n = cond(g, c, TPL_A, NEG_TEMPLATE)
    lat = g.add("EmptyLatentImage", {"width": 1024, "height": 1024, "batch_size": 1}, nid=30)
    ks1 = g.add("KSamplerAdvanced", {"model": g.out(cfo), "add_noise": "enable", "noise_seed": SEED, "steps": 30, "cfg": 1.0,
                                     "sampler_name": SAMPLER, "scheduler": SCHEDULER, "positive": g.out(p), "negative": g.out(n),
                                     "latent_image": g.out(lat), "start_at_step": 0, "end_at_step": 15,
                                     "return_with_leftover_noise": "enable"}, "stage 1: Turbo LoRA, steps 0-15, cfg 1", nid=31)
    ks2 = g.add("KSamplerAdvanced", {"model": g.out(m), "add_noise": "disable", "noise_seed": SEED, "steps": 30, "cfg": 4.0,
                                     "sampler_name": SAMPLER, "scheduler": SCHEDULER, "positive": g.out(p), "negative": g.out(n),
                                     "latent_image": g.out(ks1), "start_at_step": 15, "end_at_step": 30,
                                     "return_with_leftover_noise": "disable"}, "stage 2: Base, steps 15-30, cfg 4", nid=32)
    dec2 = g.add("VAEDecode", {"samples": g.out(ks2), "vae": g.out(v)}, nid=33)
    save(g, dec2, "Anima_course/l7b-two-stage", 34)
    ks1s = ksampler(g, m, p, n, lat, 36, seed=SEED, title="Base 30 steps (one shot)")
    dec1 = g.add("VAEDecode", {"samples": g.out(ks1s), "vae": g.out(v)}, nid=37)
    a = label(g, dec2, "two-stage: Turbo 0-15 + Base 15-30", 50)
    b = label(g, dec1, "one shot: Base 30 steps", 51)
    save(g, grid(g, batch_all(g, [a, b], 52), 53, columns=2, cell=512), "Anima_course/l7b-vs-oneshot", 54)
    emit("l7b", [("", g)], note="两段采样：KSamplerAdvanced ①Turbo LoRA + CFG 覆盖（cfg 1，0–0.5）0–15 步；②Base cfg 4，15–30 步；对照单段 Base 30 步")


# --------------------------------------------------------------------- 05-03 L8 三模型 × 四种子
def fig_l8b():
    g = Graph(); m, c, v = loaders(g)
    ma = g.add("UNETLoader", {"unet_name": AESTHETIC, "weight_dtype": "default"}, nid=13)
    turbo = _lora(g, m, TURBO_LORA, 1.0, 15)
    p, n = cond(g, c, TPL_A, NEG_TEMPLATE)
    lat = g.add("EmptyLatentImage", {"width": 832, "height": 1248, "batch_size": 4}, nid=30)
    cols = []
    for i, (txt, mdl, over) in enumerate((("Base", m, {}), ("Aesthetic", ma, {}), ("Turbo LoRA", turbo, {"steps": 8, "cfg": 1.0}))):
        ms = g.add("ModelSamplingAuraFlow", {"model": g.out(mdl), "shift": 3.0}, nid=40 + i * 4)
        params = {"model": g.out(ms), "positive": g.out(p), "negative": g.out(n), "latent_image": g.out(lat),
                  "seed": SEED, "steps": 30, "cfg": 4.0, "sampler_name": "er_sde", "scheduler": SCHEDULER, "denoise": 1.0}
        params.update(over)
        ks = g.add("KSampler", params, txt, nid=41 + i * 4)
        dec = g.add("VAEDecode", {"samples": g.out(ks), "vae": g.out(v)}, nid=42 + i * 4)
        cols.append(label(g, dec, txt, 43 + i * 4))
    row = g.add("ImageStitch", {"image1": g.out(cols[0]), "image2": g.out(cols[1]), "direction": "right", "match_image_size": True,
                                "spacing_width": 0, "spacing_color": "white"}, nid=60)
    row = g.add("ImageStitch", {"image1": g.out(row), "image2": g.out(cols[2]), "direction": "right", "match_image_size": True,
                                "spacing_width": 0, "spacing_color": "white"}, nid=61)
    # 每行是 3 张 832×1248 拼成的 2496×1248（2:1）；格子按同比例给（上限 2048），ImageGrid 不会拉伸
    big = g.add("ImageGrid", {"images": g.out(row), "columns": 1, "cell_width": 2048, "cell_height": 1024, "padding": 4}, nid=62)
    save(g, g.add("ImageScale", {"image": g.out(big), "upscale_method": "lanczos", "width": 1600, "height": 3212, "crop": "disabled"}, nid=64), "Anima_course/l8b-grid", 63)
    emit("l8b-grid", [("", g)], note="3 模型（列）× batch 4 当 4 个种子（行），832×1248，er_sde/simple，30/4（Turbo 8/1），照搬 anima_comparison.json")


GROUPS.update({
    "l1": [fig_l1],
    "l3b": [fig_l3b],
    "l4b": [fig_l4b],
    "l5": [fig_l5],
    "l6b": [fig_l6b],
    "l7b": [fig_l7b],
    "l8b": [fig_l8b],
})


if __name__ == "__main__":
    main(sys.argv[1:])
