/**
 * generate-brand-assets.js
 * Generates assets/favicon.png and assets/og-image.png using Chrome CDP
 * based purely on real Raasta branding and campus map visuals.
 */

const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');

const CHROME_PATH = 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';
const CDP_PORT = 9222;
const ROOT = path.resolve(__dirname, '..');
const ASSETS_DIR = path.resolve(ROOT, 'assets');

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
}

async function run() {
  console.log('Generating favicon.png and og-image.png...');

  // 1. Create HTML template for social preview image (1200 x 630)
  const ogHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Outfit:wght@600;700&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      width: 1200px;
      height: 630px;
      overflow: hidden;
      background: #14213d;
      color: #ffffff;
      font-family: 'Inter', system-ui, sans-serif;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 64px 72px;
      position: relative;
    }
    .bg-grid {
      position: absolute;
      inset: 0;
      opacity: 0.08;
      background-image: linear-gradient(#ffffff 1px, transparent 1px), linear-gradient(90deg, #ffffff 1px, transparent 1px);
      background-size: 40px 40px;
      pointer-events: none;
    }
    .top {
      position: relative;
      z-index: 2;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 16px;
      font-family: 'Outfit', sans-serif;
      font-size: 32px;
      font-weight: 700;
      color: #ffffff;
      letter-spacing: -0.02em;
    }
    .pill {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 18px;
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.16);
      border-radius: 9999px;
      font-size: 14px;
      font-weight: 500;
      color: #dbe3f2;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    .middle {
      position: relative;
      z-index: 2;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 48px;
      margin-top: 10px;
    }
    .left-col {
      max-width: 580px;
    }
    h1 {
      font-family: 'Outfit', sans-serif;
      font-size: 56px;
      font-weight: 700;
      line-height: 1.1;
      letter-spacing: -0.03em;
      margin-bottom: 20px;
      color: #ffffff;
    }
    h1 span {
      color: #ff5a36;
    }
    p.lead {
      font-size: 20px;
      line-height: 1.5;
      color: #cbd5e1;
      margin-bottom: 28px;
    }
    .badges {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 6px 14px;
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 8px;
      font-size: 14px;
      color: #e2e8f0;
      font-weight: 500;
    }
    .dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
    }
    .map-preview-card {
      width: 440px;
      height: 310px;
      background: #f3f8f2;
      border-radius: 20px;
      border: 4px solid rgba(255, 255, 255, 0.15);
      box-shadow: 0 24px 48px rgba(0, 0, 0, 0.4);
      position: relative;
      overflow: hidden;
      flex-shrink: 0;
    }
    .map-img {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .map-overlay {
      position: absolute;
      inset: 0;
      background: rgba(238, 245, 235, 0.4);
    }
    .route-svg {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
    }
    .bottom {
      position: relative;
      z-index: 2;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-top: 1px solid rgba(255, 255, 255, 0.12);
      padding-top: 20px;
      font-size: 14px;
      color: #94a3b8;
    }
  </style>
</head>
<body>
  <div class="bg-grid"></div>

  <div class="top">
    <div class="brand">
      <svg viewBox="0 0 32 32" width="40" height="40">
        <path d="M16 4a12 12 0 1 0 12 12" fill="none" stroke="#ffffff" stroke-width="3.2" stroke-linecap="round"/>
        <circle cx="16" cy="16" r="3.4" fill="#f24822"/>
      </svg>
      Raasta
    </div>
    <div class="pill">Gestalt Perception Wayfinder</div>
  </div>

  <div class="middle">
    <div class="left-col">
      <h1>Campus Navigation, <span>Designed for Perception.</span></h1>
      <p class="lead">Walk anywhere on UPES Bidholi campus with clear turn-by-turn guidance, distance estimates, and Gestalt clarity.</p>
      <div class="badges">
        <span class="badge"><span class="dot" style="background:#2f6fed"></span>Academic Blocks</span>
        <span class="badge"><span class="dot" style="background:#d96a00"></span>Hostels</span>
        <span class="badge"><span class="dot" style="background:#d6336c"></span>Food &amp; Services</span>
        <span class="badge"><span class="dot" style="background:#0f8a5f"></span>Sports</span>
        <span class="badge"><span class="dot" style="background:#7a4fd6"></span>Administration</span>
      </div>
    </div>

    <div class="map-preview-card">
      <img src="campus-map.webp" class="map-img" alt="Campus map preview">
      <div class="map-overlay"></div>
      <svg class="route-svg" viewBox="0 0 1045 756">
        <!-- Sample real route from Library to Food Court -->
        <path d="M 436 414 L 436 427 L 468 450 L 526 448 L 565 425 L 565 373" fill="none" stroke="#ffffff" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M 436 414 L 436 427 L 468 450 L 526 448 L 565 425 L 565 373" fill="none" stroke="#f24822" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="436" cy="414" r="14" fill="#14213d" stroke="#ffffff" stroke-width="3"/>
        <circle cx="565" cy="373" r="14" fill="#f24822" stroke="#ffffff" stroke-width="3"/>
      </svg>
    </div>
  </div>

  <div class="bottom">
    <div>UPES Bidholi Campus · 21 Places · Turn-by-Turn Wayfinding</div>
    <div>Not an official UPES product · Educational Assignment</div>
  </div>
</body>
</html>`;

  const ogHtmlPath = path.join(ASSETS_DIR, 'og-preview-temp.html');
  fs.writeFileSync(ogHtmlPath, ogHtml);

  // 2. Launch Chrome
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

  // Render and capture og-image.png (1200 x 630)
  console.log('Rendering og-image.png...');
  await client.send('Emulation.setDeviceMetricsOverride', {
    width: 1200,
    height: 630,
    deviceScaleFactor: 1,
    mobile: false
  });

  const fileUrl = 'file:///' + ogHtmlPath.replace(/\\/g, '/');
  await client.send('Page.navigate', { url: fileUrl });
  await wait(1200);

  const ogScreenshot = await client.send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ASSETS_DIR, 'og-image.png'), Buffer.from(ogScreenshot.data, 'base64'));
  console.log('✓ Saved assets/og-image.png (1200x630)');

  // Clean up temp file
  fs.unlinkSync(ogHtmlPath);

  // Render and capture favicon.png (64x64 rendered at high density)
  console.log('Rendering favicon.png...');
  const faviconSvgPath = path.join(ASSETS_DIR, 'favicon.svg');
  const favUrl = 'file:///' + faviconSvgPath.replace(/\\/g, '/');
  await client.send('Emulation.setDeviceMetricsOverride', {
    width: 32,
    height: 32,
    deviceScaleFactor: 2,
    mobile: false
  });
  await client.send('Page.navigate', { url: favUrl });
  await wait(400);

  const favScreenshot = await client.send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ASSETS_DIR, 'favicon.png'), Buffer.from(favScreenshot.data, 'base64'));
  console.log('✓ Saved assets/favicon.png (32x32)');

  chrome.kill();
  console.log('✓ All brand assets generated successfully!');
}

run().catch(err => {
  console.error('Asset generation error:', err);
  process.exit(1);
});
