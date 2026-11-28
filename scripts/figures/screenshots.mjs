#!/usr/bin/env node
/**
 * 界面截图：用 Windows 上的 Chrome（无头模式）打开本机 ComfyUI 前端，把画面摆成课程需要的样子再截。
 *
 *   node scripts/figures/screenshots.mjs                         # 全部能拍的
 *   node scripts/figures/screenshots.mjs --only setup-ui,l0-pipeline
 *   node scripts/figures/screenshots.mjs --list
 *   DESKTOP_CDP=9222 node scripts/figures/screenshots.mjs --only setup-missing
 *
 * 前提：Comfy Desktop 已开着（127.0.0.1:8188，WSL 镜像网络下直连），Windows 装了 Chrome。
 * 通用的小工具（看一眼界面、执行一段页面脚本、连 Desktop 窗口）在 comfyui skill 里：
 * ~/.agents/skills/comfyui/scripts/ui.mjs；接口与守则见该 skill 的 §8。
 * 零依赖：Node 22+ 自带 WebSocket / fetch，走 Chrome DevTools Protocol。摆位都在页面里用 ComfyUI
 * 前端自己的接口做（app.loadGraphData / app.graph.unpackSubgraph / convertToSubgraph / 发布子图），
 * 所以截出来的就是学习者照课程操作会看到的画面。
 *
 * 环境变量：
 *   CHROME_EXE    Windows 上 Chrome 的路径（默认 C:\Program Files\Google\Chrome）
 *   COMFYUI_URL   默认 http://127.0.0.1:8188
 *   DESKTOP_CDP   设了就不另起 Chrome，改连 Comfy Desktop 的调试端口（Electron 带
 *                 --remote-debugging-port=<端口> 启动）。只有 setup-missing 用它：那张要的是 Desktop 自己的窗口。
 *                 实测 Desktop 和浏览器的界面几乎一样（见 comfyui skill §6 第 19 条）。
 *
 * Chrome 用独立的临时配置目录（Windows 的 %TEMP% 下），跑完即删：不碰平时用的浏览器，也不改
 * ComfyUI 的服务端状态。唯一的例外是 review-library：它把子图发布到节点库，会在 ComfyUI 的用户
 * 数据里留下一个 Anima T2T 蓝图（不想要就在 Desktop 的节点库里删掉）。
 * l8-filenames 会真的跑 3 次放大（每次约 1 分钟），产物在 ComfyUI 的 output/Anima/ 下。
 *
 * 输出：figures-out/screens/<图 id>.png 与同目录 manifest.json（视口、前端版本、时间）。
 * 之后由 prepare-site.mjs 转 WebP 并把 src 写进 frontmatter。
 */
import { spawn, spawnSync, execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, 'figures-out', 'screens');
const COMFY = process.env.COMFYUI_URL || 'http://127.0.0.1:8188';
const CHROME = process.env.CHROME_EXE || '/mnt/c/Program Files/Google/Chrome/Application/chrome.exe';
const DESKTOP_CDP = process.env.DESKTOP_CDP ? Number(process.env.DESKTOP_CDP) : null;
/** SHOT_DEBUG=1：裁剪的图额外存一份整屏 <id>.full.png 并画出裁剪框；=2 再把藏面板时看到的 DOM 链打到输出。排坐标问题用 */
const DEBUG_LEVEL = Number(process.env.SHOT_DEBUG || 0);
const DEBUG = DEBUG_LEVEL > 0;
/** --dry：只做摆位和序列化、不提交出图（l8-filenames 用来看前端解析后的保存前缀） */
const DRY = process.argv.includes('--dry');
const DPR = 2;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const die = (msg) => { console.error(msg); process.exit(1); };

// ---------- Chrome / CDP ----------
const winToWsl = (p) => {
  const m = /^([A-Za-z]):\\?(.*)$/.exec(p.trim());
  return m ? `/mnt/${m[1].toLowerCase()}/${m[2].replace(/\\/g, '/')}` : p;
};
let PROFILE_WSL = null;

async function freePort(start) {
  for (let p = start; p < start + 50; p++) {
    try { await fetch(`http://127.0.0.1:${p}/json/version`, { signal: AbortSignal.timeout(400) }); } catch { return p; }
  }
  die(`找不到空闲端口（${start} 起）`);
}

async function launchChrome(port, width, height) {
  if (!existsSync(CHROME)) die(`找不到 Chrome：${CHROME}（用 CHROME_EXE 指定）`);
  const winTemp = execSync('cmd.exe /c echo %TEMP%', { encoding: 'utf8', cwd: '/mnt/c' }).trim();
  const profileWin = `${winTemp}\\anima-course-shots`;
  PROFILE_WSL = winToWsl(profileWin);
  // 上次没退干净的无头 Chrome 会占着这个目录：按命令行参数只杀用这个临时目录的（-EncodedCommand 免去引号转义）
  const ps = `Get-CimInstance Win32_Process -Filter "name='chrome.exe'" | Where-Object { \$_.CommandLine -match 'anima-course-shots' } | ForEach-Object { Stop-Process -Id \$_.ProcessId -Force -ErrorAction SilentlyContinue }`;
  spawnSync('powershell.exe', ['-NoProfile', '-EncodedCommand', Buffer.from(ps, 'utf16le').toString('base64')], { stdio: 'ignore', cwd: '/mnt/c' });
  await sleep(500);
  rmSync(PROFILE_WSL, { recursive: true, force: true });
  const args = [
    '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profileWin}`,
    `--window-size=${width},${height}`, '--no-first-run', '--no-default-browser-check',
    '--disable-gpu', '--hide-scrollbars', '--force-color-profile=srgb', 'about:blank',
  ];
  const child = spawn(CHROME, args, { detached: true, stdio: 'ignore' });
  child.on('error', (e) => die(`启动 Chrome 失败：${e.message}`));
  child.unref();
  for (let i = 0; i < 40; i++) {
    try { return (await (await fetch(`http://127.0.0.1:${port}/json/version`)).json()).webSocketDebuggerUrl; } catch { await sleep(500); }
  }
  die('Chrome 没在 20 秒内起来');
}

class Page {
  constructor(wsUrl) { this.wsUrl = wsUrl; this.id = 0; this.pending = new Map(); }
  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((res, rej) => {
      this.ws.addEventListener('open', res, { once: true });
      this.ws.addEventListener('error', () => rej(new Error('CDP 连接失败')), { once: true });
    });
    this.ws.addEventListener('message', (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && this.pending.has(m.id)) {
        const { res, rej } = this.pending.get(m.id);
        this.pending.delete(m.id);
        m.error ? rej(new Error(`${m.error.message} ${m.error.data || ''}`)) : res(m.result);
      }
    });
  }
  send(method, params = {}) {
    return new Promise((res, rej) => {
      const i = ++this.id;
      this.pending.set(i, { res, rej });
      this.ws.send(JSON.stringify({ id: i, method, params }));
    });
  }
  async evaluate(expr) {
    const r = await this.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error('页面脚本出错：' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
    return r.result.value;
  }
  /** 调页面里的辅助函数（见 P）：window.__shot.<name>(...args) */
  call(name, ...args) { return this.evaluate(`window.__shot[${JSON.stringify(name)}](${args.map((a) => JSON.stringify(a)).join(',')})`); }
  async viewport(width, height) {
    await this.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: DPR, mobile: false });
    await sleep(700);
  }
  /**
   * 截图；clip 是视口内的 CSS 像素矩形，省略则整屏。返回 PNG Buffer。
   * 必须带 captureBeyondViewport: false：否则 Chrome 会把视口临时缩成裁剪尺寸，前端跟着重排，截到的就不是摆好的画面。
   */
  async capture(clip, debugId) {
    if (clip && DEBUG && debugId) {
      const c = JSON.stringify(clip);
      await this.evaluate(`(() => {
        const c = ${c};
        const d = document.createElement('div'); d.id = '__shot_clip';
        d.style.cssText = 'position:fixed;z-index:2147483600;pointer-events:none;box-sizing:border-box;border:3px dashed #ff3366;';
        Object.assign(d.style, { left: c.x + 'px', top: c.y + 'px', width: c.width + 'px', height: c.height + 'px' });
        document.body.appendChild(d);
        const r = app.canvas.canvas.getBoundingClientRect();
        const i = document.createElement('div'); i.id = '__shot_info';
        i.style.cssText = 'position:fixed;z-index:2147483600;left:8px;top:300px;color:#0f0;font:600 18px monospace;background:#000c;padding:8px;';
        i.textContent = 'canvas ' + JSON.stringify([r.left, r.top, r.width, r.height]) + ' ds ' + JSON.stringify([app.canvas.ds.scale, app.canvas.ds.offset]) + ' win ' + innerWidth + 'x' + innerHeight;
        document.body.appendChild(i);
        return true;
      })()`);
      const full = await this.send('Page.captureScreenshot', { format: 'png' });
      writeFileSync(join(OUT, `${debugId}.full.png`), Buffer.from(full.data, 'base64'));
      await this.evaluate(`(() => { document.getElementById('__shot_clip')?.remove(); document.getElementById('__shot_info')?.remove(); return true; })()`);
    }
    const r = await this.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false, ...(clip ? { clip: { ...clip, scale: 1 } } : {}) });
    return Buffer.from(r.data, 'base64');
  }
  /** 调试：把页面 console.log 里带 __shot 前缀的行转到本进程 stdout */
  pipeConsole() {
    this.ws.addEventListener('message', (ev) => {
      const m = JSON.parse(ev.data);
      if (m.method !== 'Runtime.consoleAPICalled') return;
      const text = (m.params.args || []).map((a) => a.value ?? a.description ?? '').join(' ');
      if (String(text).startsWith('__shot')) console.log('  [page]', String(text).replace('__shot ', ''));
    });
  }
  close() { this.ws.close(); }
}

async function connectPage(port, url = 'about:blank') {
  const t = await (await fetch(`http://127.0.0.1:${port}/json/new?${url}`, { method: 'PUT' })).json();
  const page = new Page(t.webSocketDebuggerUrl);
  await page.connect();
  await page.send('Page.enable');
  await page.send('Runtime.enable');
  return page;
}

async function closeBrowser(port) {
  try {
    const v = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
    const ws = new WebSocket(v.webSocketDebuggerUrl);
    await new Promise((res) => { ws.addEventListener('open', res, { once: true }); ws.addEventListener('error', res, { once: true }); });
    ws.send(JSON.stringify({ id: 1, method: 'Browser.close' }));
    await sleep(1500);
  } catch { /* 已经退了 */ }
  if (PROFILE_WSL) rmSync(PROFILE_WSL, { recursive: true, force: true });
}

// ---------- 页面里的辅助函数（整块注入为 window.__shot；只引用 app / LiteGraph / document） ----------
const P = {
  waitApp() {
    return new Promise((res, rej) => {
      const t0 = Date.now();
      const tick = () => {
        if (typeof app !== 'undefined' && app.graph && app.vueAppReady && document.querySelector('canvas')) return res(true);
        if (Date.now() - t0 > 30000) return rej(new Error('ComfyUI 前端 30 秒没就绪'));
        setTimeout(tick, 250);
      };
      tick();
    });
  },
  async load(json, name) {
    await app.loadGraphData(json, true, true, null, { showMissingNodesDialog: false, showMissingModelsDialog: false });
    await P.wait(800);
    const ws = app.extensionManager.workflow;
    const act = ws.activeWorkflow;
    for (const w of [...ws.workflows]) {
      if (w !== act && String(w.path || w.name || '').startsWith('workflows/')) await ws.closeWorkflow(w, true);
    }
    if (name && act) { try { ws.renameWorkflow(act, name); } catch { /* 改不了标签名不影响截图 */ } }
    await P.wait(400);
    return { nodes: app.graph._nodes.length, name: act?.path || act?.name };
  },
  wait: (ms) => new Promise((r) => setTimeout(r, ms)),
  /** 关掉挡画布的东西：任务队列浮层、小地图、提示条。返回浮层是否还在。
   *  只改页面里的样式，不点界面上的开关：那些开关会把设置写到服务端（comfy.settings.json），连带改掉 Desktop 里的界面。 */
  async cleanUi() {
    const label = (b) => (b.getAttribute('aria-label') || '') + ' ' + b.title;
    const buttons = () => [...document.querySelectorAll('button')];
    const clear = buttons().find((b) => /清除已执行|clear executed|清理队列|clear queue/i.test(label(b)));
    let queueOpen = !!clear;
    if (clear) {
      // 从“清除已执行”往上找到浮层的根：覆盖层本身 pointer-events:none，浮层是里面唯一可点的岛，
      // 所以走到父级变成 none 为止。保险：绝不藏含画布的元素（之前按定位方式找，一路走到了画布容器）
      let el = clear;
      while (el.parentElement && el.parentElement !== document.body) {
        const parent = el.parentElement;
        if (getComputedStyle(parent).pointerEvents === 'none' || parent.contains(app.canvas.canvas)) break;
        el = parent;
      }
      P.hide(el);
      if (window.__shotDebug >= 2) console.log('__shot queue panel chain ' + JSON.stringify((() => { const out = []; let e = clear; while (e && e !== document.documentElement) { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); out.push([e.tagName, String(e.className).slice(0, 50), cs.position, Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)]); e = e.parentElement; } return out; })()));
      queueOpen = !!buttons().find((b) => /清除已执行|clear executed|清理队列|clear queue/i.test(label(b)) && b.getBoundingClientRect().width > 0);
    }
    P.hide(document.querySelector('.litegraph-minimap'));
    document.querySelectorAll('.p-toast').forEach((e) => e.remove());
    await P.wait(400);
    return { queueOpen };
  },
  /** 临时藏掉一个元素（记下来，resetUi 时恢复） */
  hide(el) {
    if (!el || !el.style) return false;
    if (!window.__shotHidden) window.__shotHidden = [];
    if (!window.__shotHidden.includes(el)) window.__shotHidden.push(el);
    el.style.setProperty('display', 'none', 'important');
    return true;
  },
  resetUi() {
    for (const el of window.__shotHidden || []) el.style.removeProperty('display');
    window.__shotHidden = [];
    P.clearAnnotate();
    document.getElementById('__shot_clip')?.remove();
    document.getElementById('__shot_info')?.remove();
    return true;
  },
  /** 右侧属性面板：show=false 时在页面里藏掉（不写设置）。返回操作后是否可见 */
  rightPanel(show) {
    // 多选节点时面板的标签叫“节点 / 设置”而不是“参数”，所以用面板头部那个固定的“开关属性面板”按钮做锚点
    const label = (b) => (b.getAttribute('aria-label') || '') + ' ' + b.title;
    const anchor = [...document.querySelectorAll('button')].find((b) => /开关属性面板|toggle properties/i.test(label(b)))
      || [...document.querySelectorAll('[role=tab]')].find((e) => /^(参数|节点|Properties)$/.test(e.innerText.trim()));
    if (!anchor) return false;
    let panel = anchor;
    while (panel && panel.getBoundingClientRect().height < 500) panel = panel.parentElement;
    if (!panel) return false;
    // 外面可能还套着同尺寸的容器（带底色），只藏里层会留一条深色带：一直走到尺寸变了为止
    for (let guard = 0; guard < 4 && panel.parentElement; guard++) {
      const a = panel.getBoundingClientRect(), b = panel.parentElement.getBoundingClientRect();
      if (Math.abs(a.width - b.width) > 2 || Math.abs(a.height - b.height) > 2 || b.width > 700) break;
      panel = panel.parentElement;
    }
    if (show) { (window.__shotHidden || []).filter((e) => e === panel).forEach((e) => e.style.removeProperty('display')); return true; }
    P.hide(panel);
    return false;
    // （调试信息在 Node 侧打印：藏完之后最右边还露着什么）
  },
  deselect() { app.canvas.deselectAllNodes(); app.canvas.selected_group = null; app.canvas.setDirty(true, true); },
  byType(t) { return P.activeGraph()._nodes.filter((n) => n.type === t); },
  node(id) { return P.activeGraph()._nodes.find((n) => n.id === id); },
  /** 当前画布显示的图：进了子图就是子图本身 */
  activeGraph() { const ws = app.extensionManager.workflow; return ws.isSubgraphActive ? ws.activeSubgraph : app.graph; },
  /** 图坐标包围盒（不含标题栏那 30）；negative id 是子图的输入 / 输出虚拟节点，不算 */
  bbox(includeGroups, includeVirtual) {
    const g = P.activeGraph();
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const n of g._nodes) {
      if (n.id < 0 && !includeVirtual) continue;
      x0 = Math.min(x0, n.pos[0]); y0 = Math.min(y0, n.pos[1]); x1 = Math.max(x1, n.pos[0] + n.size[0]); y1 = Math.max(y1, n.pos[1] + n.size[1]);
    }
    if (includeGroups) for (const gr of g.groups || []) { const p = gr._pos || gr.pos; x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0] + gr.size[0]); y1 = Math.max(y1, p[1] + gr.size[1]); }
    // 子图的输入 / 输出插槽节点不在 _nodes 里，挂在子图对象的 inputNode / outputNode 上
    if (includeVirtual) for (const n of [g.inputNode, g.outputNode]) {
      if (!n) continue;
      const p = n._pos || n.pos;
      const sz = n.size || [75, 100];
      x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0] + sz[0]); y1 = Math.max(y1, p[1] + sz[1]);
    }
    return { x0, y0, x1, y1 };
  },
  /** 把当前图的节点放进视口里的 area（CSS 像素），四周留 pad；返回节点包围盒（含标题栏）在视口里的矩形。
   *  这版的方位换算是 像素 = (图坐标 + ds.offset) × ds.scale（app.canvas.convertOffsetToCanvas 同义），标题栏画在 pos 上方 30。 */
  fit(area, pad, maxScale, includeGroups, includeVirtual) {
    const T = LiteGraph.NODE_TITLE_HEIGHT || 30;
    const b = P.bbox(includeGroups, includeVirtual);
    b.y0 -= T;
    const s = Math.min((area.w - pad * 2) / (b.x1 - b.x0), (area.h - pad * 2) / (b.y1 - b.y0), maxScale);
    const r = app.canvas.canvas.getBoundingClientRect();
    const px = area.x + pad + (area.w - pad * 2 - (b.x1 - b.x0) * s) / 2;
    const py = area.y + pad + (area.h - pad * 2 - (b.y1 - b.y0) * s) / 2;
    app.canvas.ds.scale = s;
    app.canvas.ds.offset = [(px - r.left) / s - b.x0, (py - r.top) / s - b.y0];
    app.canvas.setDirty(true, true);
    return P.rectOf(b);
  },
  /** 图坐标矩形 → 视口矩形 */
  rectOf(b) {
    const r = app.canvas.canvas.getBoundingClientRect();
    const { scale: s, offset: o } = app.canvas.ds;
    return { x: r.left + (b.x0 + o[0]) * s, y: r.top + (b.y0 + o[1]) * s, w: (b.x1 - b.x0) * s, h: (b.y1 - b.y0) * s, scale: s };
  },
  /** 图坐标点 → 视口点 */
  toScreen(gx, gy) {
    const r = app.canvas.canvas.getBoundingClientRect();
    const { scale: s, offset: o } = app.canvas.ds;
    return { x: r.left + (gx + o[0]) * s, y: r.top + (gy + o[1]) * s };
  },
  nodesRect(types, margin = 14) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const n of P.activeGraph()._nodes) if (types.includes(n.type)) {
      x0 = Math.min(x0, n.pos[0] - margin); y0 = Math.min(y0, n.pos[1] - margin);
      x1 = Math.max(x1, n.pos[0] + n.size[0] + margin); y1 = Math.max(y1, n.pos[1] + n.size[1] + margin);
    }
    return { x0, y0, x1, y1 };
  },
  /** 每种连线类型的第一条，给出它中点在视口里的位置 */
  linkMidpoints() {
    const out = {};
    const g = P.activeGraph();
    for (const l of g.links.values()) {
      if (out[l.type]) continue;
      const a = g._nodes.find((n) => n.id === l.origin_id), b = g._nodes.find((n) => n.id === l.target_id);
      if (!a || !b) continue;
      const p1 = a.getConnectionPos(true, l.origin_slot), p2 = b.getConnectionPos(false, l.target_slot);
      out[l.type] = P.toScreen((p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2);
    }
    return out;
  },
  /** 节点左上角（含标题栏）在视口里的位置 */
  corners(types) {
    const T = LiteGraph.NODE_TITLE_HEIGHT || 30;
    return P.activeGraph()._nodes.filter((n) => types.includes(n.type)).map((n) => ({ type: n.type, id: n.id, ...P.toScreen(n.pos[0], n.pos[1] - T), w: n.size[0] * app.canvas.ds.scale }));
  },
  typeColor(type) {
    const c = app.canvas.link_type_colors || {};
    return c[type] || { MODEL: '#b39ddd', CLIP: '#ffd500', VAE: '#ff6d6d', CONDITIONING: '#ffa931', LATENT: '#ff9cf9', IMAGE: '#64b5f6' }[type] || '#cccccc';
  },
  /** 叠标注：kind = label（文字块，可带副标题和色点）/ box（半透明框）/ pin（带数字的圆点） */
  annotate(items) {
    P.clearAnnotate();
    const root = document.createElement('div');
    root.id = '__shot_annot';
    root.style.cssText = 'position:fixed;inset:0;z-index:2147483000;pointer-events:none;font-family:"Microsoft YaHei","PingFang SC",system-ui,sans-serif;';
    for (const it of items) {
      const el = document.createElement('div');
      const pos = `${it.x != null ? `left:${it.x}px;` : ''}${it.right != null ? `right:${it.right}px;` : ''}top:${it.y ?? 0}px;${it.center ? 'transform:translate(-50%,0);' : ''}`;
      if (it.kind === 'box') {
        el.style.cssText = `position:fixed;${pos}width:${it.w}px;height:${it.h}px;border:3px solid ${it.color};background:${it.color}24;border-radius:14px;box-sizing:border-box;`;
      } else if (it.kind === 'pin') {
        el.style.cssText = `position:fixed;${pos}width:36px;height:36px;border-radius:50%;background:${it.color};color:#141414;font-size:22px;font-weight:800;line-height:36px;text-align:center;border:3px solid #fff;box-shadow:0 3px 10px rgba(0,0,0,.6);box-sizing:border-box;`;
        el.textContent = it.text;
      } else {
        el.style.cssText = `position:fixed;${pos}max-width:${it.maxW || 460}px;font-size:${it.size || 19}px;font-weight:700;line-height:1.35;color:#fff;background:rgba(24,24,28,.96);border:2px solid ${it.color};border-radius:10px;padding:6px 13px;white-space:pre;box-shadow:0 4px 14px rgba(0,0,0,.55);box-sizing:border-box;`;
        const main = document.createElement('div');
        if (it.dot) {
          const d = document.createElement('i');
          d.style.cssText = `display:inline-block;width:14px;height:14px;border-radius:50%;background:${it.dot};border:2px solid #fff;box-sizing:border-box;vertical-align:-1px;margin-right:9px;`;
          main.appendChild(d);
        }
        main.appendChild(document.createTextNode(it.text));
        el.appendChild(main);
        if (it.sub) { const s = document.createElement('div'); s.style.cssText = 'font-size:14px;font-weight:400;line-height:1.4;margin-top:3px;color:#d6d6dd;'; s.textContent = it.sub; el.appendChild(s); }
      }
      root.appendChild(el);
    }
    document.body.appendChild(root);
  },
  clearAnnotate() { document.getElementById('__shot_annot')?.remove(); },
  nextFrame() { return new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); },

  // ---- 工作流摆位 ----
  /** 官方模板 → 把子图解开成普通节点，删便签，保存节点挪到最右、分辨率选择器挪到左下。得到课里的 L1（19 节点）。 */
  async unpackTemplate(json) {
    await app.loadGraphData(json, true, true, null, { showMissingNodesDialog: false, showMissingModelsDialog: false });
    await P.wait(1200);
    const sg = app.graph._nodes.find((n) => n.isSubgraphNode && n.isSubgraphNode());
    if (!sg) throw new Error('模板里没有子图节点');
    app.graph.unpackSubgraph(sg);
    await P.wait(900);
    const note = app.graph._nodes.find((n) => n.type === 'MarkdownNote');
    if (note) app.graph.remove(note);
    const save = app.graph._nodes.find((n) => n.type === 'SaveImage');
    if (save) { save.pos[0] = 1450; save.pos[1] = 100; save.size[1] = 430; }
    const res = app.graph._nodes.find((n) => n.type === 'ResolutionSelector');
    if (res) { res.pos[0] = -890; res.pos[1] = 965; }
    app.canvas.setDirty(true, true);
    await P.wait(400);
    return app.graph._nodes.length;
  },
  /** 双击进入子图看到的就是这个视图 */
  async enterSubgraph(tidy) {
    const n = app.graph._nodes.find((n) => n.isSubgraphNode && n.isSubgraphNode());
    app.canvas.openSubgraph(n.subgraph);
    await P.wait(1000);
    if (tidy) {
      // 输入 / 输出插槽节点默认离节点很远，截图时挑到节点两侧；只改画面里的位置
      const g = P.activeGraph();
      const real = P.bbox(false, false);
      if (g.inputNode) { g.inputNode.pos[0] = real.x0 - 330; g.inputNode.pos[1] = real.y0 + 60; }
      if (g.outputNode) { g.outputNode.pos[0] = real.x1 + 220; g.outputNode.pos[1] = real.y0 + 60; }
      app.canvas.setDirty(true, true);
      await P.wait(300);
    }
    return app.extensionManager.workflow.activeSubgraph?.name;
  },
  /** 三个切换节点各接到哪：{ id, target, slot, from[] } */
  switches() {
    return P.byType('ComfySwitchNode').map((n) => {
      const g = P.activeGraph();
      const out = (n.outputs[0].links || []).map((id) => g.links.get(id)).find(Boolean);
      const t = out ? g._nodes.find((x) => x.id === out.target_id) : null;
      const ins = n.inputs.map((i) => i.link).filter((v) => v != null).map((id) => g._nodes.find((x) => x.id === g.links.get(id).origin_id)?.type);
      return { id: n.id, target: t?.type, slot: out && t ? t.inputs[out.target_slot]?.name : null, from: [...new Set(ins)] };
    });
  },
  setPos(types, x, y) {
    for (const n of app.graph._nodes) if (types.includes(n.type)) { n.pos[0] = x; n.pos[1] = y; }
    app.canvas.setDirty(true, true);
  },
  setSize(type, w, h) {
    for (const n of app.graph._nodes) if (n.type === type) n.setSize([w, h]);
    app.canvas.setDirty(true, true);
  },

  // ---- 子图 / 发布 ----
  /** 官方模板里那个子图改名为 name（内层就是 L1 的 17 个节点，对外暴露的控件也和课里要求的一致），删掉模板自带的便签。
   *  不用 convertToSubgraph 现场收：它默认只提升 text / seed，再往里提升控件要用的内部接口各版本不一，截个图不值得冒这个险。 */
  async useSubgraph(name) {
    const sgNode = app.graph._nodes.find((n) => n.isSubgraphNode && n.isSubgraphNode());
    if (!sgNode) throw new Error('画布上没有子图节点');
    sgNode.title = name;
    if (sgNode.subgraph) sgNode.subgraph.name = name;
    const note = app.graph._nodes.find((n) => n.type === 'MarkdownNote');
    if (note) app.graph.remove(note);
    app.canvas.setDirty(true, true);
    await P.wait(400);
    return { inputs: sgNode.inputs.map((i) => i.name), widgets: sgNode.widgets.map((w) => w.name), pos: [...sgNode.pos], size: [...sgNode.size] };
  },
  addNote(text, x, y, w, h) {
    const note = LiteGraph.createNode('MarkdownNote');
    note.title = 'Markdown 便签';
    app.graph.add(note);
    note.widgets[0].value = text;
    note.pos[0] = x; note.pos[1] = y;
    note.setSize([w, h]);
    app.canvas.setDirty(true, true);
    return note.id;
  },
  /** 工具箱的“发布子图”→ 对话框 → 确认 */
  async publish(name) {
    const n = app.graph._nodes.find((n) => n.isSubgraphNode && n.isSubgraphNode());
    app.canvas.selectNodes([n]);
    await P.wait(800);
    const b = [...document.querySelectorAll('button')].find((b) => (b.getAttribute('aria-label') || b.title) === '发布子图');
    if (!b) throw new Error('工具箱上没有“发布子图”按钮（前端 < 1.27.7？）');
    b.click();
    await P.wait(900);
    const input = [...document.querySelectorAll('[role=dialog] input, .p-dialog input, .comfy-modal input')].find((i) => i.type === 'text');
    if (!input) throw new Error('没弹出“保存子工作流到节点库”对话框');
    input.value = name;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await P.wait(300);
    const ok = [...document.querySelectorAll('[role=dialog] button, .p-dialog button, .comfy-modal button')].find((b) => b.innerText.trim() === '确认');
    ok.click();
    await P.wait(1500);
    // 同名蓝图已存在时会再问一次是否覆盖：把剩下的确认类按钮点掉；还关不掉的就报错，免得截到一层遮罩
    for (let i = 0; i < 3; i++) {
      const dialogs = [...document.querySelectorAll('[role=dialog], .p-dialog, .comfy-modal')].filter((d) => d.getBoundingClientRect().width > 0);
      if (!dialogs.length) break;
      const btn = dialogs.flatMap((d) => [...d.querySelectorAll('button')]).find((b) => /^(确认|确定|覆盖|是|OK|Yes|Overwrite|Replace|覆盖保存)$/i.test(b.innerText.trim()));
      if (!btn) throw new Error(`发布后有个对话框没处理：${dialogs.map((d) => d.innerText.trim().slice(0, 120)).join(' / ')}`);
      btn.click();
      await P.wait(1000);
    }
    P.deselect();
    return true;
  },
  /** 打开左侧节点库面板，展开标题匹配的文件夹；返回面板矩形和面板文字。
   *  “我的蓝图”这类文件夹行是“文字 + 折叠箭头”，按文本节点找最稳 */
  async openLibrary(expand, mustContain) {
    const b = [...document.querySelectorAll('button')].find((b) => (b.getAttribute('aria-label') || '') === '节点库（n）');
    const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let open = false;
    for (let n = tw.nextNode(); n; n = tw.nextNode()) if (n.nodeValue.trim() === '子图蓝图') { open = true; break; }
    if (!open) b?.click();
    await P.wait(1500);
    const owner = (text, scope = document.body) => {
      const tw = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
      for (let n = tw.nextNode(); n; n = tw.nextNode()) if (n.nodeValue.trim() === text) return n.parentElement;
      return null;
    };
    let panel = owner('子图蓝图');
    // 面板很高（占满一侧），“子图蓝图”那一小节只有几十像素高，所以要求高度也够
    while (panel && (panel.getBoundingClientRect().width < 300 || panel.getBoundingClientRect().height < 400)) panel = panel.parentElement;
    if (!panel) throw new Error('节点库面板里没找到“子图蓝图”这一节');
    const names = [].concat(expand || []);
    // 要找的名字只认面板里面的（画布上的子图节点也叫 Anima T2T，不能算）
    const hit = () => !!owner(mustContain || '', panel)?.getBoundingClientRect().width;
    for (const [i, name] of [].concat(expand || []).entries()) {
      // 点一次是展开、再点是折叠：下一层已经看得见就别点
      const deeperVisible = names.slice(i + 1).concat(mustContain || []).some((n) => owner(n, panel)?.getBoundingClientRect().width);
      if (deeperVisible) continue;
      let row = owner(name, panel);
      while (row && row.getBoundingClientRect().width < 60) row = row.parentElement;
      row?.click();
      await P.wait(800);
    }
    const r = panel.getBoundingClientRect();
    // 内容比面板短时，按最后一行文字裁
    let bottom = r.top;
    for (const el of panel.querySelectorAll('*')) { const b = el.getBoundingClientRect(); if (b.width > 0 && b.height > 0 && b.height < 60 && el.children.length === 0) bottom = Math.max(bottom, b.bottom); }
    return { x: r.left, y: r.top, w: r.width, h: Math.min(r.height, bottom - r.top + 28), text: panel.innerText.slice(0, 900), hit: hit() };
  },

  // ---- 出图 ----
  setWidgets(title, values) {
    const n = app.graph._nodes.find((n) => n.title === title);
    if (!n) throw new Error(`没有标题为 ${title} 的节点`);
    for (const [k, v] of Object.entries(values)) { const w = n.widgets.find((w) => w.name === k); if (!w) throw new Error(`${title} 上没有控件 ${k}`); w.value = v; }
    return true;
  },
  async queue() {
    // 和点“运行”提交的内容一样：graphToPrompt() 已经把保存前缀里的 %变量% 解析成了实际值。
    // 不走 app.queuePrompt / api.queuePrompt：前者有一串静默返回的前置条件，后者把服务端的报错揉成一句笼统的话。
    const { output, workflow } = await app.graphToPrompt();
    const body = { client_id: app.api.clientId ?? '', prompt: output, extra_data: { extra_pnginfo: { workflow } } };
    const res = await app.api.fetchApi('/prompt', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const text = await res.text();
    if (!res.ok) throw new Error(`POST /prompt → HTTP ${res.status}：${text.slice(0, 400)}`);
    const r = JSON.parse(text);
    if (!r.prompt_id) throw new Error(`POST /prompt 没返回 prompt_id：${text.slice(0, 300)}`);
    return { prompt_id: r.prompt_id };
  },
};

/** 把 P 注入页面：简写方法 toString() 自带名字，拼成 `key: function name(...) {}`；箭头函数原样 */
const fnSource = (f) => f.toString().replace(/^(async\s+)?([A-Za-z_$][\w$]*)\s*\(/, (_, a, n) => `${a || ''}function ${n}(`);
const pageSource = () => `{ ${Object.entries(P).map(([k, f]) => `${k}: ${fnSource(f)}`).join(',\n')} }`;

// ---------- Node 侧小工具 ----------
const readJson = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));
async function fetchTemplate(name = 'image_anima_base_v1.json') {
  const r = await fetch(`${COMFY}/templates/${name}`);
  if (!r.ok) die(`取不到官方模板 ${name}：HTTP ${r.status}`);
  return r.json();
}
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
/** 视口矩形外扩 margin，夹在 [min, 视口] 内；min 用来避开左侧栏（x: 56）和顶栏 / Run 栏（y: 90） */
function padRect(rect, margin, vw, vh, min = { x: 0, y: 0 }) {
  const x = clamp(rect.x - margin, min.x, vw), y = clamp(rect.y - margin, min.y, vh);
  return { x, y, width: clamp(rect.x + rect.w + margin, 0, vw) - x, height: clamp(rect.y + rect.h + margin, 0, vh) - y };
}
/** 把一段 HTML 排成一页再整页截掉（拼对照图、目录树这类） */
async function compose(page, html, width) {
  await page.send('Page.navigate', { url: 'about:blank' });
  await sleep(300);
  await page.evaluate(`(() => { document.open(); document.write(${JSON.stringify(html)}); document.close(); return true; })()`);
  await sleep(800);
  const h = await page.evaluate(`document.getElementById('root').getBoundingClientRect().height`);
  await page.viewport(width, Math.ceil(h));
  await sleep(600);
  return page.capture();
}
const COMPOSE_CSS = `margin:0;background:#141414;color:#fff;font-family:'Microsoft YaHei','PingFang SC',system-ui,sans-serif;`;
const block = (title, png, cssWidth) => `<section><h2 style="font-size:28px;margin:0 0 14px 4px;font-weight:700;">${title}</h2><img src="data:image/png;base64,${png.toString('base64')}" style="display:block;${cssWidth ? `width:${cssWidth}px;` : 'width:100%;'}height:auto;border-radius:10px;border:1px solid #333;"></section>`;
/** PNG 的像素尺寸（文件头第 16–23 字节）：拼图时想让几张图保持同一缩放就用得上 */
const pngSize = (buf) => ({ width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) });
const C = { blue: '#6ea8fe', green: '#7ee2a8', amber: '#ffc46b', pink: '#ff9cf9' };

/** 拼图（compose）会把页面导航到 about:blank；下一张图开始前确认还在 ComfyUI 里，不在就重新打开并注入 */
async function ensureApp(page) {
  const ok = await page.evaluate(`location.href.startsWith(${JSON.stringify(COMFY + '/')}) && typeof app !== 'undefined' && typeof window.__shot !== 'undefined'`);
  if (ok) return;
  await page.send('Page.navigate', { url: `${COMFY}/` });
  await page.evaluate(`(${fnSource(P.waitApp)})()`);
  await page.evaluate(`(() => { const P = ${pageSource()}; window.__shot = P; return true; })()`);
}

/** L0 的 9 节点；compact = 为了截图摆成四列（加载器 / 提示词 / 采样 / 解码保存），列间留出放标签的空隙 */
const L0_POS = { 10: [0, 10], 11: [0, 170], 12: [0, 380], 30: [0, 510], 20: [400, 10], 21: [400, 250], 31: [880, 60], 32: [1260, 110], 33: [1540, 60] };
const L0 = (compact) => {
  const wf = readJson('public/workflows/L0-minimal.json');
  if (compact) for (const n of wf.nodes) if (L0_POS[n.id]) n.pos = L0_POS[n.id];
  return wf;
};

/** 文件名变量那张用的放大工作流：L0 的 9 节点 + 潜空间放大 + 第二个采样器。ks、up 是节点标题，保存前缀用变量引用它们 */
function hiresWorkflow() {
  const l0 = L0(false);
  // 连线是数组格式 [id, 源节点, 源槽, 目标节点, 目标槽, 类型]（官方模板也是这个格式）
  const by = (id) => l0.nodes.find((n) => n.id === id);
  const ks1 = by(31), dec = by(32), save = by(33);
  ks1.pos = [1000, 60]; ks1.title = 'ks1'; dec.pos = [1900, 110]; save.pos = [2300, 60];
  for (const n of [by(10), by(11), by(12), by(20), by(21), by(30)]) n.pos = [n.pos[0], n.pos[1] + 20];
  const up = { id: 80, type: 'LatentUpscaleBy', title: 'up', pos: [1400, 110], size: [300, 130], inputs: [{ name: 'samples', type: 'LATENT', link: 100 }, { name: 'upscale_method', type: 'COMBO', widget: { name: 'upscale_method' }, link: null }, { name: 'scale_by', type: 'FLOAT', widget: { name: 'scale_by' }, link: null }], outputs: [{ name: 'LATENT', type: 'LATENT', links: [101] }], widgets_values: ['bislerp', 1.5] };
  const ks2 = { id: 81, type: 'KSampler', title: 'ks', pos: [1780, 60], size: [320, 270], inputs: [{ name: 'model', type: 'MODEL', link: 102 }, { name: 'positive', type: 'CONDITIONING', link: 103 }, { name: 'negative', type: 'CONDITIONING', link: 104 }, { name: 'latent_image', type: 'LATENT', link: 101 }, ...ks1.inputs.slice(4).map((i) => ({ ...i, link: null }))], outputs: [{ name: 'LATENT', type: 'LATENT', links: [105] }], widgets_values: [42, 'fixed', 30, 4, 'euler', 'simple', 0.4], properties: {} };
  // ks1.LATENT 原来直连 VAEDecode，现在经 up → ks2
  ks1.outputs[0].links = [100];
  dec.inputs[0].link = 105;
  // 前缀的最后一段是文件名开头，要分目录就得让最后一段是目录名（末尾斜杠不算：os.path.basename('a/b/') 还是 b）
  save.widgets_values[0] = 'Anima/L4_hires_d%ks.denoise%_s%up.scale_by%/img';
  const src = (id) => l0.nodes.find((n) => n.id === id);
  const links = [
    [100, 'LATENT', 31, 0, 80, 0],
    [101, 'LATENT', 80, 0, 81, 3],
    [102, 'MODEL', 10, 0, 81, 0],
    [103, 'CONDITIONING', 20, 0, 81, 1],
    [104, 'CONDITIONING', 21, 0, 81, 2],
    [105, 'LATENT', 81, 0, 32, 0],
  ].map(([id, type, o, os, t, ts]) => [id, o, os, t, ts, type]);
  for (const [oid, slot, linkId] of [[10, 0, 102], [20, 0, 103], [21, 0, 104]]) src(oid).outputs[slot].links.push(linkId);
  // 原来 KSampler → VAEDecode 那条线要从 links 里删掉：只从采样器输出口上摘、数组里还留着，前端加载时两条线争同一个输入口
  return { ...l0, last_node_id: 81, last_link_id: 105, nodes: [...l0.nodes, up, ks2], links: [...l0.links.filter((l) => !(l[1] === 31 && l[3] === 32)), ...links] };
}

async function historyIds() {
  const h = await (await fetch(`${COMFY}/history?max_items=50`)).json();
  return new Set(Object.keys(h));
}
/** 等这次提交出现在 /history 里；提交被拒或执行出错就立刻报错，不要干等 */
async function waitHistory(before, timeoutMs) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const h = await (await fetch(`${COMFY}/history?max_items=50`)).json();
    const fresh = Object.entries(h).filter(([id]) => !before.has(id));
    const failed = fresh.find(([, e]) => e.status?.status_str === 'error');
    if (failed) {
      const msg = (failed[1].status.messages || []).filter(([k]) => /error|execution/i.test(k)).map(([, v]) => JSON.stringify(v)).join(' ');
      throw new Error(`ComfyUI 执行出错：${msg.slice(0, 400)}`);
    }
    const done = fresh.find(([, e]) => e.outputs && Object.keys(e.outputs).length);
    if (done) return done[1];
    // 队列空了、历史上也没新增，说明前端压根没提交上去（多半是有对话框拦着）
    const q = await (await fetch(`${COMFY}/queue`)).json();
    if (!fresh.length && !q.queue_running.length && !q.queue_pending.length && Date.now() - t0 > 20000) {
      const dlg = await lastPage?.evaluate(`[...document.querySelectorAll('[role=dialog], .p-dialog, .comfy-modal')].filter((d) => d.getBoundingClientRect().width > 0).map((d) => d.innerText.trim().slice(0, 200)).join(' / ')`);
      throw new Error(`工作流没提交上去${dlg ? `，页面上的对话框：${dlg}` : ''}`);
    }
    await sleep(3000);
  }
  throw new Error('等出图超时');
}
let lastPage = null;

// ---------- 各张图 ----------
const FIGURES = {
  /** 00-01 界面地图：左侧栏、顶栏、Run 栏、右侧面板 */
  'setup-ui': { viewport: [1600, 1000], async run(page) {
    await page.call('load', L0(true), 'L0 · 9 节点');
    await page.call('cleanUi');
    await page.call('rightPanel', true);
    // 选中 K采样器，右侧面板才有内容可看（取消选中面板会清空，所以保留选中）
    await page.evaluate(`(() => { const n = app.graph._nodes.find((n) => n.type === 'KSampler'); app.canvas.selectNodes([n]); return n.id; })()`);
    await page.call('fit', { x: 56, y: 130, w: 1600 - 56 - 309, h: 1000 - 130 - 80 }, 80, 0.7, false);
    await sleep(1200);
    // 任务队列浮层是延迟挂载的，开头那次不一定扑得到，截图前再清一遍
    const cleaned = await page.call('cleanUi');
    if (DEBUG) console.log(`  [cleanUi before capture] ${JSON.stringify(cleaned)}`);
    await page.call('rightPanel', true);
    const a = await page.evaluate(`(() => {
      // DOMRect 经 JSON 会变成空对象，先转成普通对象
      const rect = (el) => { const b = el.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height, right: b.right, bottom: b.bottom }; };
      const up = (el, minH) => { let p = el; while (p && p.getBoundingClientRect().height < minH) p = p.parentElement; return p; };
      const tab = [...document.querySelectorAll('[role=tab]')].find((e) => /^(参数|Properties)$/.test(e.innerText.trim()));
      return {
        left: rect(document.querySelector('nav.side-tool-bar-container')),
        tabs: rect(document.querySelector('.workflow-tabs')),
        run: rect(document.querySelector('.actionbar')),
        right: rect(up(tab, 500)),
      };
    })()`);
    await page.call('annotate', [
      { kind: 'label', x: a.left.right + 14, y: a.left.bottom - 150, text: '① 左侧栏', sub: '主菜单 · 节点库 · 模型库 · 工作流', color: C.blue },
      { kind: 'label', x: a.tabs.right + 96, y: 2, text: '② 顶栏', sub: '工作流标签页；旁边 + 新建', color: C.green },
      { kind: 'label', x: a.run.x, y: a.run.bottom + 14, text: '③ Run 栏', sub: '批量次数 · 运行 · 队列模式', color: C.amber },
      { kind: 'label', right: 1600 - a.right.x + 14, y: 1000 - 34 - 150, text: '④ 右侧面板', sub: '选中节点的参数 / 信息 / 设置', color: C.pink },
    ]);
    await page.call('nextFrame');
    return page.capture(null, 'setup-ui');
  } },

  /** 00-01 官方模板加载后的画布 */
  'setup-template': { viewport: [1600, 1000], async run(page) {
    await page.call('load', await fetchTemplate(), 'Anima Base v1');
    await page.call('cleanUi');
    await page.call('rightPanel', false);
    // 模板里保存图像节点有 690 宽（出图后放预览），截图时收窄，整张图能放大些
    await page.call('setSize', 'SaveImage', 330, 430);
    const [vw, vh] = [1600, 1000];
    const r = await page.call('fit', { x: 30, y: 50, w: vw - 60, h: vh - 50 - 70 }, 40, 1, true);
    await page.call('nextFrame');
    return page.capture(padRect(r, 20, vw, vh), 'setup-template');
  } },

  /** 00-01 问题页（要 Desktop） */
  'setup-missing': { needsDesktop: true, viewport: [1600, 1000], async run(page) {
    const missing = {
      last_node_id: 4, last_link_id: 3, nodes: [
        { id: 1, type: 'UNETLoader', pos: [80, 80], size: [340, 130], inputs: [], outputs: [{ name: 'MODEL', type: 'MODEL', links: [1] }], widgets_values: ['anima-turbo-v1.1.safetensors', 'default'] },
        { id: 2, type: 'CLIPLoader', pos: [80, 250], size: [340, 170], inputs: [], outputs: [{ name: 'CLIP', type: 'CLIP', links: [2] }], widgets_values: ['qwen_3_06b_base.safetensors', 'stable_diffusion'] },
        { id: 3, type: 'CLIPTextEncode', pos: [500, 120], size: [400, 200], inputs: [{ name: 'clip', type: 'CLIP', link: 2 }], outputs: [{ name: 'CONDITIONING', type: 'CONDITIONING', links: null }], title: 'Positive', widgets_values: ['masterpiece, best quality, newest, highres, safe, 1girl, long hair, cherry blossoms'] },
        { id: 4, type: 'KSampler', pos: [1000, 80], size: [320, 270], inputs: [{ name: 'model', type: 'MODEL', link: 1 }, { name: 'positive', type: 'CONDITIONING', link: null }, { name: 'negative', type: 'CONDITIONING', link: null }, { name: 'latent_image', type: 'LATENT', link: null }], outputs: [{ name: 'LATENT', type: 'LATENT', links: null }], widgets_values: [42, 'fixed', 30, 4, 'euler', 'simple', 1] },
      ], links: [{ id: 1, type: 'MODEL', origin_id: 1, origin_slot: 0, target_id: 4, target_slot: 0 }, { id: 2, type: 'CLIP', origin_id: 2, origin_slot: 0, target_id: 3, target_slot: 0 }], groups: [], config: {}, extra: {}, version: 0.4,
    };
    const wsBefore = await page.evaluate(`(() => { window.__shotHidden = []; return app.extensionManager.workflow.workflows.map((w) => w.path || w.name); })()`);
    await page.evaluate(`app.loadGraphData(${JSON.stringify(missing)}, true, true, null, { showMissingNodesDialog: false, showMissingModelsDialog: true }).then(() => true)`);
    await sleep(2500);
    await page.call('cleanUi');
    await page.evaluate(`(() => { const t = Array.from(document.querySelectorAll('[role=tab]')).find((e) => e.innerText.trim() === '问题'); t?.click(); return !!t; })()`);
    await sleep(1200);
    const a = await page.evaluate(`(() => {
      // DOMRect 经 JSON 会变成空对象，先转成普通对象
      const rect = (el) => { const b = el.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; };
      const up = (el, minH) => { let p = el; while (p && p.getBoundingClientRect().height < minH) p = p.parentElement; return p; };
      const tab = [...document.querySelectorAll('[role=tab]')].find((e) => e.innerText.trim() === '问题');
      const right = rect(up(tab, 300));
      return { right, vw: innerWidth, vh: innerHeight, hasDownload: /Download|下载/.test(document.body.innerText) };
    })()`);
    console.log(`\n  问题页矩形 ${JSON.stringify(a.right)}，页面上有 Download/下载 字样：${a.hasDownload} `);
    const png = await page.capture(null, 'setup-missing');
    // 只关自己新开的那个标签页，用户原来开着的不动
    await page.evaluate(`(() => { const ws = app.extensionManager.workflow; const before = ${JSON.stringify(wsBefore)}; for (const w of [...ws.workflows]) if (!before.includes(w.path || w.name)) ws.closeWorkflow(w, true); return ws.workflows.length; })()`);
    return png;
  } },

  /** 01-01 L0 连线，标注端口颜色与数据类型 */
  'l0-pipeline': { viewport: [2100, 1000], async run(page) {
    await page.call('load', L0(true), 'L0 · 9 节点');
    await page.call('cleanUi');
    await page.call('rightPanel', false);
    const [vw, vh] = [2100, 1000];
    const area = { x: 70, y: 50, w: vw - 90, h: vh - 110 };
    const r = await page.call('fit', area, 60, 1, false);
    const mids = await page.call('linkMidpoints');
    const chips = [];
    for (const type of ['MODEL', 'CLIP', 'VAE', 'CONDITIONING', 'LATENT', 'IMAGE']) {
      if (mids[type]) chips.push([type, await page.call('typeColor', type)]);
    }
    await page.call('nextFrame');
    const img = await page.capture({ ...padRect(r, 50, vw, vh), width: Math.min(r.x + r.w + 50, area.x + area.w) - Math.max(r.x - 50, 0) }, 'l0-pipeline');
    const legend = `<div style="display:flex;flex-wrap:wrap;gap:14px 34px;align-items:center;">${chips.map(([type, col]) => `<span style="display:inline-flex;align-items:center;gap:12px;font-size:24px;font-weight:700;font-family:Consolas,'Cascadia Mono',monospace;"><i style="width:22px;height:22px;border-radius:50%;background:${col};border:3px solid #fff;box-sizing:border-box;"></i>${type}</span>`).join('')}<span style="font-size:21px;color:#c9c9d2;font-weight:400;margin-left:10px;">端口和连线的颜色表示它传的数据类型，同一种颜色才能相连</span></div>`;
    return compose(page, `<!doctype html><html><body style="${COMPOSE_CSS}"><div id="root" style="display:flex;flex-direction:column;gap:28px;padding:36px;width:${Math.round(r.w + 100)}px;box-sizing:border-box;">${block('L0 基线管线：9 个节点、9 条线', img)}${legend}</div></body></html>`, Math.round(r.w + 100));
  } },

  /** 01-02 L1 连线全图：三处改动 */
  'l1-wiring': { viewport: [2800, 1100], async run(page) {
    await page.call('unpackTemplate', await fetchTemplate());
    await page.evaluate(`(() => { const ws = app.extensionManager.workflow; try { ws.renameWorkflow(ws.activeWorkflow, 'L1 · 19 节点'); } catch {} return true; })()`);
    await page.call('cleanUi');
    await page.call('deselect');
    await page.call('rightPanel', false);
    const [vw, vh] = [2800, 1100];
    const r = await page.call('fit', { x: 70, y: 50, w: vw - 100, h: vh - 50 - 60 }, 110, 1, true);
    const sw = await page.call('switches');
    const modelSwitch = sw.find((s) => s.slot === 'model')?.id;
    const corners = await page.call('corners', ['ResolutionSelector', 'EmptyLatentImage', 'LoraLoaderModelOnly', 'PrimitiveBoolean', 'PrimitiveInt', 'PrimitiveFloat', 'ComfySwitchNode']);
    const pin = (x, y, text, color) => ({ kind: 'pin', x: x - 16, y: y - 16, text, color });
    const pins = [];
    for (const c of corners) {
      if (c.type === 'ResolutionSelector' || c.type === 'EmptyLatentImage') pins.push(pin(c.x, c.y, '①', C.blue));
      else if (c.type === 'LoraLoaderModelOnly' || (c.type === 'ComfySwitchNode' && c.id === modelSwitch)) pins.push(pin(c.x, c.y, '②', C.green));
      else if (c.type === 'PrimitiveBoolean') { pins.push(pin(c.x, c.y, '②', C.green)); pins.push(pin(c.x + 40, c.y, '③', C.amber)); }
      else pins.push(pin(c.x, c.y, '③', C.amber));
    }
    await page.call('annotate', pins);
    await page.call('nextFrame');
    const img = await page.capture(padRect(r, 60, vw, vh), 'l1-wiring');
    const legend = `<section style="display:grid;grid-template-columns:repeat(3,1fr);gap:18px;">
      ${[['①', C.blue, '画布尺寸', '空Latent图像的 width / height 改成输入口，由分辨率选择器驱动'],
        ['②', C.green, '模型开关', 'UNETLoader 一路直连、一路经 Turbo LoRA，进切换节点；由同一个布尔值选'],
        ['③', C.amber, '步数与 CFG 开关', '两套整数（30 / 8）与两套浮点（4 / 1）各进一个切换节点，也由那个布尔值选']]
        .map(([n, col, t, d]) => `<div style="border:2px solid ${col};border-radius:12px;padding:16px 20px;background:#1b1b1f;"><div style="font-size:24px;font-weight:700;margin-bottom:8px;"><span style="display:inline-block;width:34px;height:34px;border-radius:50%;background:${col};color:#141414;text-align:center;line-height:34px;margin-right:10px;font-weight:800;">${n}</span>${t}</div><div style="font-size:20px;line-height:1.5;color:#d6d6dd;">${d}</div></div>`).join('')}
    </section>`;
    return compose(page, `<!doctype html><html><body style="${COMPOSE_CSS}"><div id="root" style="display:flex;flex-direction:column;gap:30px;padding:36px;width:${Math.round(r.w + 120)}px;box-sizing:border-box;">${block('L1 = 官方模板子图展开后的 19 个节点（与 L0 相比改了三处）', img)}${legend}</div></body></html>`, Math.round(r.w + 120));
  } },

  /** 01-02 官方模板子图内部 17 节点 vs 自搭 L1 */
  'l1-subgraph-compare': { viewport: [2800, 1100], async run(page) {
    const tpl = await fetchTemplate();
    const [vw, vh] = [2800, 1100];
    // 上半：双击进入官方子图看到的 17 个节点。区域从顶栏下面开始，把顶部的面包屑（工作流名 / 子图名）也截进来；
    // 左右两侧负 id 的输入 / 输出插槽节点是子图视图的一部分，也算进包围盒
    const area = { x: 70, y: 44, w: vw - 100, h: vh - 44 - 60 };
    await page.call('load', tpl, 'Anima Base v1');
    await page.call('cleanUi');
    await page.call('rightPanel', false);
    const subName = await page.call('enterSubgraph', true);
    await page.call('cleanUi');
    const r1 = await page.call('fit', { ...area, y: 120, h: vh - 120 - 60 }, 50, 1, true, true);
    await page.call('nextFrame');
    // 整条面包屑栏从左侧栏右缘开始截，节点四周留 24
    const top = await page.capture({ x: 56, y: 40, width: Math.min(r1.x + r1.w + 24, vw) - 56, height: r1.y + r1.h + 24 - 40 }, 'l1-subgraph-compare.top');
    // 下半：解开成普通节点、补上分辨率选择器与保存图像的自搭 L1
    await page.call('unpackTemplate', tpl);
    await page.call('cleanUi');
    await page.call('deselect');
    await page.evaluate(`(() => { const ws = app.extensionManager.workflow; try { ws.renameWorkflow(ws.activeWorkflow, 'L1 · 19 节点'); } catch {} return true; })()`);
    const r2 = await page.call('fit', { ...area, y: 120, h: vh - 120 - 60 }, 50, 1, true);
    await page.call('nextFrame');
    const mine = await page.capture(padRect(r2, 50, vw, vh), 'l1-subgraph-compare.bottom');
    // 两半各按原始缩放（CSS 像素 = 像素 / DPR）排，不拉伸成同宽
    const wTop = pngSize(top).width / DPR, wBottom = pngSize(mine).width / DPR;
    const w = Math.round(Math.max(wTop, wBottom) + 72);
    return compose(page, `<!doctype html><html><body style="${COMPOSE_CSS}"><div id="root" style="display:flex;flex-direction:column;align-items:flex-start;gap:34px;padding:36px;width:${w}px;box-sizing:border-box;">${block(`双击官方子图「${subName}」看到的内部：17 个节点（顶栏多了一层面包屑）`, top, wTop)}${block('自搭的 L1：同一批 17 个节点，外面加分辨率选择器与保存图像，共 19 个', mine, wBottom)}</div></body></html>`, w);
  } },

  /** 03-03 收成子图后的画布 */
  'review-subgraph': { viewport: [1600, 1100], async run(page) {
    await page.call('load', await fetchTemplate(), 'L1_subgraph');
    await page.call('cleanUi');
    await page.call('rightPanel', false);
    const info = await page.call('useSubgraph', 'Anima T2T');
    console.log(`\n  子图对外暴露：${info.inputs.join(', ')} `);
    await page.call('setSize', 'SaveImage', 330, 430);
    // 便签在左，子图居中，分辨率选择器在子图下方，保存图像在右
    await page.evaluate(`(() => { const g = app.graph; const sg = g._nodes.find((n) => n.isSubgraphNode && n.isSubgraphNode());
      const save = g._nodes.find((n) => n.type === 'SaveImage'); const res = g._nodes.find((n) => n.type === 'ResolutionSelector');
      sg.pos[0] = -420; sg.pos[1] = 100; save.pos[0] = sg.pos[0] + sg.size[0] + 180; save.pos[1] = 140; res.pos[0] = sg.pos[0]; res.pos[1] = sg.pos[1] + sg.size[1] + 70; res.size = res.computeSize();
      app.canvas.setDirty(true, true); return true; })()`);
    // 课里要求便签写三样：当前参数基线表、四条纪律、文件放哪（便签节点会渲染 Markdown，表格能用）
    const note = [
      '## 当前参数基线（起点值）',
      '',
      '| | Full | Turbo |',
      '|---|---|---|',
      '| steps | 30 | 8 |',
      '| cfg | 4 | 1（负向无效） |',
      '| sampler / scheduler | euler / simple | 同左 |',
      '| 分辨率 | 1024²，16 的倍数 | 同左 |',
      '',
      '模型：anima-base-v1.0 · qwen_3_06b_base · qwen_image_vae · anima-turbo-lora-v0.2',
      '',
      '## 四条纪律',
      '',
      '1. 固定种子（K采样器 seed 设 fixed）',
      '2. 一次只改一个变量，改完拼图对比',
      '3. Turbo 试稿，Base 出成品',
      '4. 固定分辨率，调参时画幅不动',
      '',
      '## 文件放哪',
      '',
      '`ComfyUI-Shared/models/` 下：`diffusion_models`、`text_encoders`、`vae`、`loras`',
    ].join('\n');
    await page.call('addNote', note, -1030, 100, 560, 560);
    await page.call('deselect');
    const [vw, vh] = [1600, 1100];
    const r = await page.call('fit', { x: 70, y: 100, w: vw - 100, h: vh - 100 - 60 }, 40, 1, false);
    await page.call('nextFrame');
    return page.capture(padRect(r, 40, vw, vh, { x: 56, y: 90 }), 'review-subgraph');
  } },

  /** 03-03 节点库里自己的蓝图 */
  'review-library': { viewport: [1600, 1000], async run(page) {
    await page.call('load', await fetchTemplate(), 'L1_subgraph');
    await page.call('cleanUi');
    await page.call('useSubgraph', 'Anima T2T');
    await page.call('publish', 'Anima T2T');
    // 发布后的蓝图在“子图蓝图”下自己的文件夹里（我的蓝图 › User）；文件夹的叫法不确定，中英文各试一次，以面板里看得到 Anima T2T 为准
    let panel = await page.call('openLibrary', ['我的蓝图', 'User'], 'Anima T2T');
    if (!panel.hit) {
      console.log(`\n  面板文字：${panel.text.replace(/\n+/g, ' | ').slice(0, 400)} `);
      panel = await page.call('openLibrary', ['My Blueprints', 'User'], 'Anima T2T');
    }
    if (!panel.hit) throw new Error(`节点库面板里没看到 Anima T2T：${panel.text.replace(/\n+/g, ' | ').slice(0, 300)}`);
    await page.call('nextFrame');
    const x = Math.max(0, panel.x - 56);
    return page.capture({ x, y: panel.y, width: Math.min(panel.x + panel.w, 1600) - x, height: panel.h }, 'review-library');
  } },
  /** 05-03 输出目录按参数分目录：走前端跑 3 次放大，保存前缀用变量。历史里已有这三组参数的产物就直接复用，--regen 才重新出图 */
  'l8-filenames': { viewport: [1600, 1000], async run(page) {
    const combos = [[0.4, 1.5], [0.35, 1.5], [0.4, 1.25]];
    const isOurs = (f) => /^Anima[\\/]L4_hires_d([\d.]+)_s([\d.]+)[\\/]/.exec(`${f.subfolder}/${f.filename}`);
    let runs = [];
    if (!process.argv.includes('--regen')) {
      const h = await (await fetch(`${COMFY}/history?max_items=40`)).json();
      const seen = new Map();
      for (const e of Object.values(h)) for (const f of Object.values(e.outputs || {}).flatMap((o) => o.images || [])) {
        const m = isOurs(f);
        if (m) seen.set(`${m[1]}_${m[2]}`, [{ subfolder: f.subfolder, filename: f.filename }]);
      }
      runs = combos.filter(([d, s]) => seen.has(`${d}_${s}`)).map(([d, s]) => ({ d, s, files: seen.get(`${d}_${s}`) }));
      if (runs.length < combos.length) runs = [];
      else console.log('\n  历史里已有三组参数的产物，直接复用（要重新出图加 --regen）');
    }
    if (!runs.length) {
      await page.call('load', hiresWorkflow(), 'L4 · 文件名变量');
      await page.call('cleanUi');
      if (DEBUG) {
        const probe = await page.evaluate(`(async () => { const r = await app.graphToPrompt(); return { nodes: Object.keys(r.output).length, errors: r.errors ?? null, save: Object.values(r.output).find((n) => n.class_type === 'SaveImage')?.inputs?.filename_prefix }; })()`);
        console.log(`\n  [graphToPrompt] ${JSON.stringify(probe)}`);
      }
      if (DRY) throw new Error('--dry：只看上面的序列化结果');
      for (const [d, s] of combos) {
        await page.call('setWidgets', 'ks', { denoise: d });
        await page.call('setWidgets', 'up', { scale_by: s });
        const before = await historyIds();
        process.stdout.write(`\n  跑 denoise ${d} / ×${s} … `);
        const q = await page.call('queue');
        lastPage = page;
        if (DEBUG) console.log(`\n  [queue] ${JSON.stringify(q)}`);
        const entry = await waitHistory(before, 8 * 60 * 1000);
        const files = Object.values(entry.outputs).flatMap((o) => o.images || []);
        runs.push({ d, s, files });
        console.log(files.map((f) => `${f.subfolder}/${f.filename}`).join(', ') || '（没有产物）');
      }
      if (runs.some((r) => r.files.some((f) => /%/.test(`${f.subfolder}/${f.filename}`)))) throw new Error('保存前缀里的 %变量% 没被解析，原样进了文件名——这一版前端不支持，先别出这张图');
    }
    // 按子目录归组
    const tree = new Map();
    for (const r of runs) for (const f of r.files) {
      const k = `${f.subfolder}/${f.filename}`.replace(/\\/g, '/').split('/').slice(0, -1).join('/');
      if (!tree.has(k)) tree.set(k, []);
      tree.get(k).push(f);
    }
    const rows = [...tree.entries()].sort().map(([dir, files]) => `<div style="display:flex;align-items:center;gap:16px;padding:14px 22px;border-bottom:1px solid #2a2a2e;">
        <svg width="32" height="32" viewBox="0 0 24 24" style="flex:none;"><path fill="#ffc46b" d="M10 4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/></svg><span style="font-size:24px;font-weight:700;min-width:640px;font-family:Consolas,'Cascadia Mono',monospace;">${dir}/</span>
        <span style="color:#a9a9b4;font-size:19px;">${files.length} 张</span>
        <span style="color:#8f8f99;font-size:18px;font-family:Consolas,monospace;margin-left:auto;">${files.map((f) => f.filename).join('  ')}</span></div>`).join('');
    const html = `<!doctype html><html><body style="${COMPOSE_CSS}"><div id="root" style="padding:40px;width:1560px;box-sizing:border-box;">
      <div style="font-size:30px;font-weight:700;margin:0 0 8px;">output/Anima/ —— 每个参数组合一个子目录</div>
      <div style="font-size:20px;color:#b5b5c0;margin:0 0 26px;line-height:1.6;">保存图像的前缀写的是 <code style="font-family:Consolas,monospace;color:#ffd479;">Anima/L4_hires_d%ks.denoise%_s%up.scale_by%/img</code>（ks、up 是两个节点的标题）。前缀的最后一段 img 是文件名开头，前面每一段是一个目录，所以同一工作流跑 3 组参数，图就按参数自动分进 3 个子目录，不会混在一起。</div>
      <div style="border:1px solid #333;border-radius:12px;overflow:hidden;background:#1b1b1f;">${rows}</div></div></body></html>`;
    return compose(page, html, 1560);
  } },
};

// ---------- 主流程 ----------
const args = process.argv.slice(2);
if (args.includes('--dump-wf')) { console.log(JSON.stringify(hiresWorkflow(), null, 1)); process.exit(0); }
if (args.includes('--list')) {
  for (const id of Object.keys(FIGURES)) console.log(`${id.padEnd(22)} ${FIGURES[id].needsDesktop ? '（要 Desktop 调试端口）' : ''}`);
  process.exit(0);
}
const onlyArg = args.find((a) => a === '--only' || a.startsWith('--only='));
const only = new Set((onlyArg ? (onlyArg === '--only' ? args[args.indexOf(onlyArg) + 1] : onlyArg.slice(7)) : '').split(',').filter(Boolean));
for (const id of only) if (!FIGURES[id]) die(`没有这张图：${id}（--list 看有哪些）`);
const ids = Object.keys(FIGURES).filter((id) => !only.size || only.has(id));
if (!ids.length) die('没有要拍的图');

mkdirSync(OUT, { recursive: true });
const manifest = { generatedAt: new Date().toISOString(), comfyui: COMFY, dpr: DPR, figures: {} };

async function shoot(id, page) {
  process.stdout.write(`${id.padEnd(22)} … `);
  const t0 = Date.now();
  try {
    await page.viewport(...FIGURES[id].viewport);
    await page.call('resetUi');
    const png = await FIGURES[id].run(page);
    writeFileSync(join(OUT, `${id}.png`), png);
    manifest.figures[id] = { viewport: FIGURES[id].viewport, bytes: png.length, seconds: +((Date.now() - t0) / 1000).toFixed(1) };
    console.log(`✅ ${(png.length / 1024).toFixed(0)} KB，${((Date.now() - t0) / 1000).toFixed(1)} s`);
  } catch (e) {
    console.log(`❌ ${e.message}`);
    manifest.figures[id] = { error: e.message };
    process.exitCode = 1;
  }
}

const browserIds = ids.filter((id) => !FIGURES[id].needsDesktop);
const desktopIds = ids.filter((id) => FIGURES[id].needsDesktop);

// 1) 无头 Chrome 里的那些
if (browserIds.length) {
  const vp0 = FIGURES[browserIds[0]].viewport;
  const port = await freePort(9333);
  await launchChrome(port, ...vp0);
  const page = await connectPage(port);
  try {
    await page.viewport(...vp0);
    await ensureApp(page);
    if (DEBUG) { page.pipeConsole(); await page.evaluate(`window.__shotDebug = ${DEBUG_LEVEL}`); }
    const frontend = await page.evaluate(`window.__COMFYUI_FRONTEND_VERSION__`);
    console.log(`前端 ${frontend}，Chrome 调试端口 ${port}`);
    manifest.frontend = frontend;
    for (const id of browserIds) { await ensureApp(page); await shoot(id, page); }
  } finally {
    page.close();
    await closeBrowser(port);
  }
}

// 2) Desktop 里的那些：连已有的调试端口，用 Desktop 当前窗口
for (const id of desktopIds) {
  if (!DESKTOP_CDP) {
    console.log(`${id.padEnd(22)} … 跳过：需要 DESKTOP_CDP=<端口>（Comfy Desktop 带 --remote-debugging-port=<端口> 启动）`);
    manifest.figures[id] = { skipped: 'no DESKTOP_CDP' };
    continue;
  }
  let page;
  try {
    const list = await (await fetch(`http://127.0.0.1:${DESKTOP_CDP}/json/list`)).json();
    const target = list.find((t) => t.type === 'page' && /8188|127\.0\.0\.1|localhost|index\.html/i.test(t.url));
    if (!target) throw new Error(`端口 ${DESKTOP_CDP} 上没有 ComfyUI 页面：${list.map((t) => t.url).join(' | ')}`);
    page = new Page(target.webSocketDebuggerUrl);
    await page.connect();
    await page.send('Page.enable');
    await page.send('Runtime.enable');
    // 每次都重新注入：上一次没跑完留下的可能是坏的
    await page.evaluate(`(() => { const P = ${pageSource()}; window.__shot = P; return true; })()`);
    await page.call('resetUi');
    await shoot(id, page);
  } catch (e) {
    console.log(`${id.padEnd(22)} … ❌ ${e.message}`);
    manifest.figures[id] = { error: e.message };
    process.exitCode = 1;
  } finally {
    // 这是用户自己的窗口：把临时藏掉的面板恢复、撤掉视口仿真，再断开
    try { await page?.call('resetUi'); } catch { /* 页面已经不在了就算了 */ }
    try { await page?.send('Emulation.clearDeviceMetricsOverride'); } catch { /* 同上 */ }
    page?.close();
  }
}
const prev = existsSync(join(OUT, 'manifest.json')) ? JSON.parse(readFileSync(join(OUT, 'manifest.json'), 'utf8')) : { figures: {} };
writeFileSync(join(OUT, 'manifest.json'), JSON.stringify({ ...manifest, figures: { ...prev.figures, ...manifest.figures } }, null, 2));
