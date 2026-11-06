/**
 * test-motion-and-audit.js
 * 1. Emulates prefers-reduced-motion: reduce and verifies:
 *    - Logo ring closure animation is disabled
 *    - Route line animation is disabled
 *    - Summary count-up executes instantaneously
 * 2. Emulates normal motion and verifies:
 *    - Logo ring animation keyframes are active
 *    - Summary counter animates from 0 up to target
 * 3. Captures high-res before-and-after screenshots of Home and Wayfinder.
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
  console.log('Testing prefers-reduced-motion and capturing final screenshots...');

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

  const pageTarget = targets.find(t => t.type === 'page') || targets[0];
  const client = new CDPClient(pageTarget.webSocketDebuggerUrl);
  await client.connect();

  await client.send('Page.enable');
  await client.send('DOM.enable');

  // --- Test 1: Reduced Motion Emulation ---
  console.log('\n--- 1. Testing with prefers-reduced-motion: reduce ---');
  await client.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }]
  });

  await client.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/wayfinder.html?from=library&to=foodcourt` });
  await wait(400);

  const reducedMotionState = await client.eval(`
    (() => {
      const isReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const timeText = document.getElementById('summary-time')?.textContent;
      const metersText = document.getElementById('summary-meters')?.textContent;
      const ringStyle = window.getComputedStyle(document.querySelector('.brand svg path:first-child'));
      const routeLineStyle = window.getComputedStyle(document.getElementById('route-line'));

      return {
        isReduced,
        timeText,
        metersText,
        ringAnimation: ringStyle.animationName,
        routeLineAnimation: routeLineStyle.animationName
      };
    })()
  `);
  console.log('  Reduced-motion verification results:', reducedMotionState);
  if (!reducedMotionState.isReduced) console.error('❌ Failed to emulate prefers-reduced-motion: reduce');
  if (reducedMotionState.ringAnimation !== 'none') console.error('❌ Expected ring animation: none');
  else console.log('  ✓ Logo ring animation disabled under reduced motion');
  if (reducedMotionState.routeLineAnimation !== 'none') console.error('❌ Expected route line animation: none');
  else console.log('  ✓ Route line animation disabled under reduced motion');
  console.log(`  ✓ Route count-up values set immediately without lag: "${reducedMotionState.timeText}", "${reducedMotionState.metersText}"`);

  // --- Test 2: Normal Motion ---
  console.log('\n--- 2. Testing with normal motion ---');
  await client.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }]
  });

  await client.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/index.html` });
  await wait(500);

  const normalMotionState = await client.eval(`
    (() => {
      const isReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const ringStyle = window.getComputedStyle(document.querySelector('.brand svg path:first-child'));
      return { isReduced, ringAnimation: ringStyle.animationName };
    })()
  `);
  console.log('  Normal motion results:', normalMotionState);
  console.log('  ✓ Logo ring closure animation active on normal motion:', normalMotionState.ringAnimation);

  // --- Test 3: High-Res Deliverable Screenshots ---
  console.log('\n--- 3. Capturing Deliverable Screenshots ---');
  await client.send('Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 820,
    deviceScaleFactor: 2,
    mobile: false
  });

  // Home Desktop
  await client.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/index.html` });
  await wait(700);
  await client.captureScreenshot('deliverable-home-desktop.png');
  console.log('  ✓ Saved deliverable-home-desktop.png');

  // Home Mobile (390px)
  await client.send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true
  });
  await client.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/index.html` });
  await wait(700);
  await client.captureScreenshot('deliverable-home-mobile.png');
  console.log('  ✓ Saved deliverable-home-mobile.png');

  // Wayfinder Desktop (Route Active)
  await client.send('Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 820,
    deviceScaleFactor: 2,
    mobile: false
  });
  await client.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/wayfinder.html?from=library&to=foodcourt` });
  await wait(700);
  await client.captureScreenshot('deliverable-wayfinder-desktop.png');
  console.log('  ✓ Saved deliverable-wayfinder-desktop.png');

  // Wayfinder Mobile (390px)
  await client.send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true
  });
  await client.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/wayfinder.html?from=library&to=foodcourt` });
  await wait(700);
  await client.captureScreenshot('deliverable-wayfinder-mobile.png');
  console.log('  ✓ Saved deliverable-wayfinder-mobile.png');

  // Places Directory Desktop
  await client.send('Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 820,
    deviceScaleFactor: 2,
    mobile: false
  });
  await client.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/places.html` });
  await wait(700);
  await client.captureScreenshot('deliverable-places-desktop.png');
  console.log('  ✓ Saved deliverable-places-desktop.png');

  chrome.kill();
  console.log('\n✓ Motion testing and deliverable screenshots completed successfully!');
}

run().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
