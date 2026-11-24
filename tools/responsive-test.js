/* Palletizer 自适应回归：iPhone / iPad / Desktop */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'tests');
const PORT = 9341;
const PROFILE = path.join(OUT, 'edge-responsive-profile');
const PAGE = 'http://127.0.0.1:8765/';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

class CDP {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.id = 0;
    this.pending = new Map();
    this.ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && this.pending.has(m.id)) {
        const p = this.pending.get(m.id);
        this.pending.delete(m.id);
        m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result);
      }
    };
  }
  open() { return new Promise((res, rej) => { this.ws.onopen = res; this.ws.onerror = rej; }); }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((res, rej) => { this.pending.set(id, { resolve: res, reject: rej }); this.ws.send(JSON.stringify({ id, method, params })); });
  }
}

async function waitPort() {
  for (let i = 0; i < 80; i++) {
    try {
      const list = await fetch(`http://127.0.0.1:${PORT}/json/list`).then(r => r.json());
      const page = list.find(t => t.type === 'page' && !/^chrome-extension:/.test(t.url));
      if (page) return page.webSocketDebuggerUrl;
    } catch (e) {}
    await sleep(150);
  }
  throw new Error('Edge CDP 未启动');
}

async function ev(cdp, expression) {
  const r = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text);
  return r.result.value;
}

async function metrics(cdp, width, height) {
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width, height, deviceScaleFactor: 1, mobile: width < 700,
    screenWidth: width, screenHeight: height
  });
  await sleep(350);
}

async function shot(cdp, name) {
  const r = await cdp.send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(OUT, name), Buffer.from(r.data, 'base64'));
  console.log('screenshot:', name);
}

(async () => {
  try {
    if (fs.existsSync(PROFILE)) fs.rmSync(PROFILE, { recursive: true, force: true });
    fs.mkdirSync(OUT, { recursive: true });
    const edge = spawn(EDGE, [
      '--headless=new', '--disable-gpu', `--remote-debugging-port=${PORT}`,
      `--user-data-dir=${PROFILE}`, '--no-first-run', '--no-default-browser-check', 'about:blank'
    ], { stdio: 'ignore' });
    const ws = await waitPort();
    const cdp = new CDP(ws);
    await cdp.open();
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('DOM.enable');

    await metrics(cdp, 390, 844);
    await cdp.send('Page.navigate', { url: PAGE });
    await sleep(1500);
    const phone = await ev(cdp, `({
      inputDisplay: getComputedStyle(document.querySelector('#view-input')).display,
      overflow: document.documentElement.scrollWidth <= innerWidth + 1,
      tabWidth: Math.round(document.querySelector('.tabbar').getBoundingClientRect().width)
    })`);
    console.log('phone:', phone);
    if (phone.inputDisplay !== 'block') throw new Error('iPhone 不应变成两列');
    if (!phone.overflow) throw new Error('iPhone 横向溢出');

    await metrics(cdp, 820, 1180);
    await sleep(600);
    const ipad = await ev(cdp, `({
      inputDisplay: getComputedStyle(document.querySelector('#view-input')).display,
      cols: getComputedStyle(document.querySelector('#view-input')).gridTemplateColumns,
      overflow: document.documentElement.scrollWidth <= innerWidth + 1,
      tabWidth: Math.round(document.querySelector('.tabbar').getBoundingClientRect().width),
      brandSub: document.querySelector('.brand-text p').textContent.trim()
    })`);
    console.log('ipad:', ipad);
    if (ipad.brandSub.includes('手机版')) throw new Error('iPad 仍显示手机版');
    if (ipad.inputDisplay !== 'grid') throw new Error('iPad 录入页应为两列');
    if (!ipad.cols.split(' ').length || ipad.cols.split(' ').length < 2) throw new Error('iPad 列数不正确');
    if (ipad.tabWidth > 460) throw new Error('iPad 底部导航过宽');
    await shot(cdp, 'resp-ipad-input.png');

    await ev(cdp, "document.querySelector('.tab[data-tab=plan]').click()");
    await sleep(500);
    const ipadPlan = await ev(cdp, `({
      display: getComputedStyle(document.querySelector('#planContent')).display,
      cols: getComputedStyle(document.querySelector('#planContent')).gridTemplateColumns,
      cards: getComputedStyle(document.querySelector('#palletList')).gridTemplateColumns
    })`);
    console.log('ipad plan:', ipadPlan);
    if (ipadPlan.display !== 'grid') throw new Error('iPad 方案页应为网格');
    await shot(cdp, 'resp-ipad-plan.png');

    await metrics(cdp, 1440, 900);
    await sleep(600);
    await ev(cdp, "document.querySelector('.tab[data-tab=input]').click()");
    await sleep(250);
    const desktop = await ev(cdp, `({
      inputDisplay: getComputedStyle(document.querySelector('#view-input')).display,
      viewWidth: Math.round(document.querySelector('#view-input').getBoundingClientRect().width),
      overflow: document.documentElement.scrollWidth <= innerWidth + 1,
      tabWidth: Math.round(document.querySelector('.tabbar').getBoundingClientRect().width)
    })`);
    console.log('desktop:', desktop);
    if (desktop.inputDisplay !== 'grid') throw new Error('桌面录入页应为两列');
    if (desktop.viewWidth < 900) throw new Error('桌面内容宽度不足');
    if (!desktop.overflow) throw new Error('桌面横向溢出');

    await ev(cdp, "document.querySelector('.tab[data-tab=plan]').click()");
    await sleep(400);
    await ev(cdp, "document.querySelectorAll('.pallet-card')[11].click()");
    await sleep(800);
    const detail = await ev(cdp, `({
      display: getComputedStyle(document.querySelector('.detail-scroll')).display,
      cols: getComputedStyle(document.querySelector('.detail-scroll')).gridTemplateColumns,
      sceneW: Math.round(document.querySelector('.scene-wrap').getBoundingClientRect().width),
      sceneH: Math.round(document.querySelector('.scene-wrap').getBoundingClientRect().height)
    })`);
    console.log('desktop detail:', detail);
    if (detail.display !== 'grid') throw new Error('桌面 3D 详情应为左右分栏');
    if (detail.sceneW < 500) throw new Error('桌面 3D 画布过窄');
    await shot(cdp, 'resp-desktop-detail.png');

    console.log('RESPONSIVE CHECKS PASSED');
    cdp.ws.close();
    edge.kill();
  } catch (e) {
    console.error('RESPONSIVE TEST FAILED:', e.message);
    process.exit(1);
  }
})();
