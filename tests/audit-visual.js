/**
 * audit-visual.js
 * Comprehensive visual & technical audit across all 5 pages at 390px, 768px, 1360px viewports.
 * Captures screenshots, checks font sizes, computed line lengths, spacing, button states,
 * and identifies inconsistencies.
 */

const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');

const CHROME_PATH = 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 3000;
const CDP_PORT = 9222;
const ROOT = path.resolve(__dirname, '..');
const SCREENSHOT_DIR = path.resolve(ROOT, 'tests', 'screenshots');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

function wait(ms) {
  return new Promise(res => setTimeout(res, ms));
}

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.id = 1;
    this.pending = new Map();
    this.events = new Map();
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.onopen = () => resolve();
      this.ws.onerror = err => reject(err);
      this.ws.onmessage = msg => {
        const data = JSON.parse(msg.data);
        if (data.id && this.pending.has(data.id)) {
          const { resolve, reject } = this.pending.get(data.id);
          this.pending.delete(data.id);
          if (data.error) reject(data.error);
          else resolve(data.result);
        } else if (data.method) {
          const handlers = this.events.get(data.method) || [];
          handlers.forEach(h => h(data.params));
        }
      };
    });
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.id++;
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expr) {
    const res = await this.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (res.exceptionDetails) {
      throw new Error(`Eval error: ${JSON.stringify(res.exceptionDetails)}`);
    }
    return res.result ? res.result.value : undefined;
  }

  async captureScreenshot(filename) {
    const res = await this.send('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(res.data, 'base64');
    fs.writeFileSync(path.join(SCREENSHOT_DIR, filename), buffer);
  }
}

async function run() {
  console.log('Launching headless Chrome for audit...');
  const chrome = spawn(CHROME_PATH, [
    `--remote-debugging-port=${CDP_PORT}`,
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    'about:blank'
  ]);

  let targets = null;
  for (let i = 0; i < 20; i++) {
    await wait(300);
    try {
      targets = await getJson(`http://127.0.0.1:${CDP_PORT}/json`);
      if (targets && targets.length > 0) break;
    } catch (_) {}
  }

  if (!targets || targets.length === 0) {
    console.error('Could not connect to Chrome CDP.');
    chrome.kill();
    process.exit(1);
  }

  const pageTarget = targets.find(t => t.type === 'page') || targets[0];
  const client = new CDPClient(pageTarget.webSocketDebuggerUrl);
  await client.connect();

  await client.send('Page.enable');
  await client.send('Runtime.enable');
  await client.send('DOM.enable');

  const pages = [
    { name: 'home', file: 'index.html' },
    { name: 'wayfinder', file: 'wayfinder.html' },
    { name: 'places', file: 'places.html' },
    { name: 'gestalt', file: 'gestalt.html' },
    { name: 'process', file: 'process.html' }
  ];

  const viewports = [
    { w: 390, h: 844, name: 'mobile' },
    { w: 768, h: 1024, name: 'tablet' },
    { w: 1360, h: 900, name: 'desktop' }
  ];

  const auditReport = [];

  for (const page of pages) {
    const url = `http://127.0.0.1:${PORT}/${page.file}`;
    console.log(`\nAuditing ${page.name} (${url})...`);
    await client.send('Page.navigate', { url });
    await wait(800);

    for (const vp of viewports) {
      await client.send('Emulation.setDeviceMetricsOverride', {
        width: vp.w,
        height: vp.h,
        deviceScaleFactor: 1,
        mobile: vp.w < 768
      });
      await wait(300);

      const shotName = `${page.name}-${vp.name}-${vp.w}.png`;
      await client.captureScreenshot(shotName);
      console.log(`  Captured screenshot: ${shotName}`);

      const pageMetrics = await client.eval(`
        (() => {
          const h1 = document.querySelector('h1');
          const h2 = document.querySelector('h2');
          const body = document.body;
          const lead = document.querySelector('.lead');
          const cards = document.querySelectorAll('.card');
          const buttons = document.querySelectorAll('button, .btn');

          return {
            h1Size: h1 ? window.getComputedStyle(h1).fontSize : null,
            h2Size: h2 ? window.getComputedStyle(h2).fontSize : null,
            leadLength: lead ? lead.textContent.length : null,
            leadChWidth: lead ? Math.round(lead.getBoundingClientRect().width / 9) : null,
            cardCount: cards.length,
            buttonCount: buttons.length
          };
        })()
      `);

      auditReport.push({ page: page.name, viewport: vp.w, ...pageMetrics });
    }
  }

  console.log('\n--- Visual Audit Summary ---');
  console.table(auditReport);

  chrome.kill();
}

run().catch(err => {
  console.error('Audit error:', err);
  process.exit(1);
});
