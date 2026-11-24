/* Palletizer iPhone 尺寸浏览器回归：录入 / 方案 / 3D / 导入 / PWA */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'tests');
const PORT = 9334;
const PROFILE = path.join(OUT, 'edge-mobile-profile');
const PAGE_URL = 'http://127.0.0.1:8765/';
const XLSX = path.resolve(ROOT, '..', '托盘码放测算台', '示例数据.xlsx');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

class CDP {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.id = 0;
    this.pending = new Map();
    this.listeners = new Map();
    this.ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(JSON.stringify(msg.error)));
        else resolve(msg.result);
      } else if (msg.method) {
        (this.listeners.get(msg.method) || []).forEach(fn => fn(msg.params));
      }
    };
  }
  open() { return new Promise((resolve, reject) => { this.ws.onopen = resolve; this.ws.onerror = reject; }); }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  on(method, fn) {
    if (!this.listeners.has(method)) this.listeners.set(method, []);
    this.listeners.get(method).push(fn);
  }
  close() { try { this.ws.close(); } catch (e) {} }
}

async function waitPort() {
  for (let i = 0; i < 80; i++) {
    try {
      const list = await fetch(`http://127.0.0.1:${PORT}/json/list`).then(r => r.json());
      const page = list.find(t => t.type === 'page' && !/^chrome-extension:/.test(t.url));
      if (page) return page.webSocketDebuggerUrl;
    } catch (e) { /* retry */ }
    await sleep(150);
  }
  throw new Error('Edge CDP 未启动');
}

async function evaluate(cdp, expression) {
  const res = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (res.exceptionDetails) throw new Error(res.exceptionDetails.text + ' ' + (res.exceptionDetails.exception && res.exceptionDetails.exception.description || ''));
  return res.result.value;
}

async function waitUntil(cdp, expression, label, timeout = 6000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    if (await evaluate(cdp, expression)) return;
    await sleep(150);
  }
  throw new Error('等待超时：' + label);
}

async function shot(cdp, name) {
  const res = await cdp.send('Page.captureScreenshot', { format: 'png' });
  const file = path.join(OUT, name);
  fs.writeFileSync(file, Buffer.from(res.data, 'base64'));
  console.log('screenshot:', name);
}

(async () => {
  try {
    if (fs.existsSync(PROFILE)) fs.rmSync(PROFILE, { recursive: true, force: true });
    fs.mkdirSync(OUT, { recursive: true });
    const edge = spawn(EDGE, [
      '--headless=new',
      '--disable-gpu',
      `--remote-debugging-port=${PORT}`,
      `--user-data-dir=${PROFILE}`,
      '--no-first-run',
      '--no-default-browser-check',
      'about:blank'
    ], { stdio: 'ignore' });

    const wsUrl = await waitPort();
    const cdp = new CDP(wsUrl);
    await cdp.open();
    const errors = [];
    cdp.on('Runtime.exceptionThrown', p => errors.push('EXCEPTION ' + (p.exceptionDetails && p.exceptionDetails.text)));
    cdp.on('Log.entryAdded', p => { if (p.entry.level === 'error') errors.push('LOG ' + p.entry.text); });
    cdp.on('Runtime.consoleAPICalled', p => {
      if (p.type === 'error') errors.push('CONSOLE ' + p.args.map(a => a.value || a.description).join(' '));
    });

    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Log.enable');
    await cdp.send('DOM.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 390, height: 844, deviceScaleFactor: 3, mobile: true,
      screenWidth: 390, screenHeight: 844
    });
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    await cdp.send('Emulation.setUserAgentOverride', {
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
    });

    await cdp.send('Page.navigate', { url: PAGE_URL });
    await sleep(1800);

    const init = await evaluate(cdp, `({
      title: document.title,
      cartons: document.querySelectorAll('.carton-card').length,
      hint: document.querySelector('#inputHint').textContent.trim(),
      usable: document.querySelector('#usableH').textContent.trim(),
      tab: document.querySelector('.tab.active').dataset.tab
    })`);
    console.log('initial:', init);
    if (!init.title.includes('Palletizer')) throw new Error('标题不正确');
    if (init.cartons !== 3) throw new Error('默认应有 3 种纸箱');
    if (!init.hint.includes('12 托')) throw new Error('初始方案应为 12 托：' + init.hint);
    if (!init.usable.includes('1100')) throw new Error('可用高应扣除托盘高度');
    await shot(cdp, 'mobile-01-input.png');

    // 方案 tab
    await evaluate(cdp, "document.querySelector('.tab[data-tab=plan]').click()");
    await sleep(500);
    const planInfo = await evaluate(cdp, `({
      total: document.querySelector('#planTotal').textContent.trim(),
      pallets: document.querySelectorAll('.pallet-card').length,
      listCards: document.querySelectorAll('#palletList .pallet-card').length,
      listChildren: document.querySelector('#palletList').children.length,
      ids: Array.from(document.querySelectorAll('#palletList .pallet-card')).map(x=>x.dataset.pallet),
      note: document.querySelector('#planNote').textContent.trim()
    })`);
    console.log('plan:', planInfo);
    if (planInfo.total !== '12') throw new Error('方案应为 12 托');
    if (planInfo.pallets !== 12) throw new Error('应列出 12 托');
    await shot(cdp, 'mobile-02-plan.png');

    // 打开最后混托
    await evaluate(cdp, "document.querySelectorAll('.pallet-card')[11].click()");
    await sleep(900);
    const detail = await evaluate(cdp, `({
      open: document.querySelector('#detail').classList.contains('open'),
      title: document.querySelector('#detailTitle').textContent.trim(),
      layers: document.querySelectorAll('.layer-row').length,
      canvasW: document.querySelector('#scene').width,
      canvasH: document.querySelector('#scene').height
    })`);
    console.log('detail:', detail);
    if (!detail.open) throw new Error('详情未打开');
    if (detail.layers !== 2) throw new Error('1072 最后混托应为 2 层');
    if (!(detail.canvasW > 100 && detail.canvasH > 100)) throw new Error('3D canvas 未初始化');
    const pinch = await evaluate(cdp, `(() => {
      const c = document.querySelector('#scene');
      const s = window.__palletizerScene;
      const z0 = s.cam.zoom;
      const ev = (type, id, x, y) => c.dispatchEvent(new PointerEvent(type, {
        pointerId: id, clientX: x, clientY: y, bubbles: true, button: 0, pointerType: 'touch'
      }));
      ev('pointerdown', 1, 100, 100);
      ev('pointerdown', 2, 200, 200);
      ev('pointermove', 2, 320, 320);
      const z1 = s.cam.zoom;
      ev('pointerup', 1, 100, 100);
      ev('pointerup', 2, 320, 320);
      return { z0, z1 };
    })()`);
    console.log('pinch zoom:', pinch);
    if (!(pinch.z1 > pinch.z0 + 0.05)) throw new Error('双指缩放未改变 3D 缩放：' + JSON.stringify(pinch));

    const exp0 = await evaluate(cdp, "({ value: document.querySelector('#explodeRange').value, mm: window.__palletizerScene.explode })");
    await evaluate(cdp, `(() => {
      const el = document.querySelector('#explodeRange');
      el.value = 50;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    })()`);
    await sleep(300);
    const exp1 = await evaluate(cdp, "({ value: document.querySelector('#explodeRange').value, label: document.querySelector('#explodeValue').textContent, mm: window.__palletizerScene.explode })");
    console.log('explode:', exp0, exp1);
    if (exp1.value !== '50' || exp1.label !== '50%') throw new Error('拆层间距滑块未更新');
    if (!(exp1.mm > exp0.mm + 1)) throw new Error('拆层间距没有作用于 3D');
    await shot(cdp, 'mobile-03-detail.png');
    await evaluate(cdp, "document.querySelector('#detailBack').click()");
    await sleep(300);

    // 手工添加纸箱
    await evaluate(cdp, "document.querySelector('.tab[data-tab=input]').click()");
    await evaluate(cdp, "document.querySelector('#btnAddCarton').click()");
    await sleep(300);
    await evaluate(cdp, `(() => {
      const set = (id, v) => { const el = document.querySelector('#' + id); el.value = v; };
      set('cartonName', '测试纸箱'); set('cartonL', 300); set('cartonW', 200); set('cartonH', 150);
      set('cartonQty', 20); set('cartonWeight', 5);
    })()`);
    await evaluate(cdp, "document.querySelector('#cartonSave').click()");
    await sleep(900);
    const cartonsAfter = await evaluate(cdp, "document.querySelectorAll('.carton-card').length");
    console.log('cartons after add:', cartonsAfter);
    if (cartonsAfter !== 4) throw new Error('添加纸箱后应有 4 种');

    // 导入示例 Excel
    const root = await cdp.send('DOM.getDocument', { depth: -1 });
    const input = await cdp.send('DOM.querySelector', { nodeId: root.root.nodeId, selector: '#fileInput' });
    await cdp.send('DOM.setFileInputFiles', { files: [XLSX], nodeId: input.nodeId });
    await sleep(1800);
    const imported = await evaluate(cdp, `({
      cartons: document.querySelectorAll('.carton-card').length,
      tab: document.querySelector('.tab.active').dataset.tab,
      total: document.querySelector('#planTotal').textContent.trim()
    })`);
    console.log('imported:', imported);
    if (imported.cartons !== 3) throw new Error('导入后应有 3 种纸箱');
    if (imported.tab !== 'plan') throw new Error('导入后应切到方案页');

    // 设置页和 PWA
    await evaluate(cdp, "document.querySelector('.tab[data-tab=settings]').click()");
    await sleep(400);
    const pwa = await evaluate(cdp, `(async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      const manifest = document.querySelector('link[rel=manifest]');
      return { sw: !!reg, manifest: !!manifest, badge: document.querySelector('#installBadge').textContent.trim() };
    })()`);
    console.log('pwa:', pwa);
    if (!pwa.manifest) throw new Error('缺少 manifest');
    if (!pwa.sw) throw new Error('Service Worker 未注册');
    await shot(cdp, 'mobile-04-settings.png');

    if (errors.length) throw new Error('浏览器错误：' + errors.join(' | '));
    console.log('MOBILE CHECKS PASSED');
    cdp.close();
    edge.kill();
  } catch (e) {
    console.error('MOBILE TEST FAILED:', e.message);
    try { edge.kill(); } catch (e2) {}
    process.exit(1);
  }
})();
