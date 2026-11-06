/**
 * browser-test.js
 * End-to-end testing with Chrome via Chrome DevTools Protocol (CDP)
 * Tests all 5 pages at 320px, 390px, 768px, 1360px viewports,
 * verifies 0 console errors, checks touch targets, checks horizontal overflow,
 * and executes end-to-end tests for all 4 new features:
 * 1. Popular routes (Home & Planner)
 * 2. Nearest-place finder
 * 3. Places directory page & partial URL pre-filling
 * 4. Place detail modal panel (figure-ground modal & bottom sheet)
 */

const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');

const CHROME_PATH = 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 3000;
const CDP_PORT = 9222;
const ROOT = path.resolve(__dirname, '..');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

// Check if server is already running, or start local static server
function ensureServer() {
  return new Promise((resolve) => {
    http.get(`http://127.0.0.1:${PORT}/index.html`, res => {
      console.log(`Server already running on port ${PORT}`);
      resolve(null);
    }).on('error', () => {
      const server = http.createServer((req, res) => {
        let reqPath = decodeURI(req.url.split('?')[0]);
        if (reqPath === '/' || reqPath === '') reqPath = '/index.html';
        const filePath = path.join(ROOT, reqPath);

        fs.stat(filePath, (err, stats) => {
          if (err || !stats.isFile()) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('404 Not Found');
            return;
          }
          const ext = path.extname(filePath).toLowerCase();
          res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
          fs.createReadStream(filePath).pipe(res);
        });
      });

      server.listen(PORT, '127.0.0.1', () => {
        console.log(`Test server started at http://127.0.0.1:${PORT}`);
        resolve(server);
      });
    });
  });
}

function wait(ms) {
  return new Promise(res => setTimeout(res, ms));
}

// Fetch helper
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

  on(event, handler) {
    const list = this.events.get(event) || [];
    list.push(handler);
    this.events.set(event, list);
  }

  async eval(expr) {
    const res = await this.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (res.exceptionDetails) {
      throw new Error(`Eval error: ${JSON.stringify(res.exceptionDetails)}`);
    }
    return res.result ? res.result.value : undefined;
  }
}

async function run() {
  const server = await ensureServer();

  console.log('Launching headless Chrome...');
  const chrome = spawn(CHROME_PATH, [
    `--remote-debugging-port=${CDP_PORT}`,
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--disable-extensions',
    'about:blank'
  ]);

  let targets = null;
  for (let i = 0; i < 25; i++) {
    await wait(300);
    try {
      targets = await getJson(`http://127.0.0.1:${CDP_PORT}/json`);
      if (targets && targets.length > 0) break;
    } catch (_) {}
  }

  if (!targets || targets.length === 0) {
    console.error('Could not connect to Chrome CDP.');
    chrome.kill();
    if (server) server.close();
    process.exit(1);
  }

  const pageTarget = targets.find(t => t.type === 'page') || targets[0];
  const client = new CDPClient(pageTarget.webSocketDebuggerUrl);
  await client.connect();

  console.log('Connected to Chrome via CDP!');
  await client.send('Page.enable');
  await client.send('Runtime.enable');
  await client.send('DOM.enable');

  const consoleErrors = [];
  client.on('Runtime.consoleAPICalled', params => {
    if (params.type === 'error') {
      const text = params.args.map(a => a.value || a.description || '').join(' ');
      consoleErrors.push(text);
      console.error(`[Console Error]:`, text);
    }
  });

  client.on('Runtime.exceptionThrown', params => {
    const desc = params.exceptionDetails.text || params.exceptionDetails.exception.description;
    consoleErrors.push(desc);
    console.error(`[Runtime Exception]:`, desc);
  });

  const pages = [
    { name: 'Home', url: `http://127.0.0.1:${PORT}/index.html` },
    { name: 'Places Directory', url: `http://127.0.0.1:${PORT}/places.html` },
    { name: 'Wayfinder', url: `http://127.0.0.1:${PORT}/wayfinder.html` },
    { name: 'Gestalt', url: `http://127.0.0.1:${PORT}/gestalt.html` },
    { name: 'Process', url: `http://127.0.0.1:${PORT}/process.html` }
  ];

  const viewports = [320, 390, 768, 1360];

  console.log('\n--- 1. Testing Page Responsiveness & Overflow Across All 5 Pages ---');
  for (const page of pages) {
    console.log(`\nTesting page: ${page.name} (${page.url})`);
    await client.send('Page.navigate', { url: page.url });
    await wait(600);

    for (const w of viewports) {
      await client.send('Emulation.setDeviceMetricsOverride', {
        width: w,
        height: 800,
        deviceScaleFactor: 1,
        mobile: w < 768
      });
      await wait(150);

      const overflow = await client.eval(`
        (() => {
          const docW = document.documentElement.scrollWidth;
          const winW = window.innerWidth;
          return { docW, winW, hasOverflow: docW > winW };
        })()
      `);

      if (overflow.hasOverflow) {
        console.error(`❌ Overflow at ${w}px on ${page.name}: docW=${overflow.docW}, winW=${overflow.winW}`);
      } else {
        console.log(`  ✓ ${w}px: No horizontal scroll (doc: ${overflow.docW}px, win: ${overflow.winW}px)`);
      }
    }
  }

  console.log('\n--- 2. Testing Feature 1: Popular Routes ---');
  // 2a. Home page chips
  await client.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/index.html` });
  await wait(600);
  const homePopular = await client.eval(`
    (() => {
      const chips = document.querySelectorAll('#home-popular-chips .popular-chip');
      return { count: chips.length, firstHref: chips[0]?.getAttribute('href') };
    })()
  `);
  console.log(`  Home popular chips rendered: ${homePopular.count}, first link: "${homePopular.firstHref}"`);
  if (homePopular.count !== 5) console.error(`❌ Expected 5 home chips, found ${homePopular.count}`);

  // 2b. Planner chips on Wayfinder
  await client.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/wayfinder.html` });
  await wait(600);
  const plannerPopular = await client.eval(`
    (() => {
      const chips = document.querySelectorAll('#planner-popular-chips .popular-chip');
      return { count: chips.length, firstLabel: chips[0]?.textContent };
    })()
  `);
  console.log(`  Planner popular chips rendered: ${plannerPopular.count}, first label: "${plannerPopular.firstLabel}"`);
  if (plannerPopular.count !== 5) console.error(`❌ Expected 5 planner chips, found ${plannerPopular.count}`);

  // Click first chip: Library to Food Court
  await client.eval(`document.querySelector('#planner-popular-chips .popular-chip').click();`);
  await wait(300);
  const routeState1 = await client.eval(`
    (() => {
      const fromVal = document.getElementById('from-input').value;
      const toVal = document.getElementById('to-input').value;
      const hasRoute = document.getElementById('map').classList.contains('has-route');
      const time = document.querySelector('.summary .time')?.textContent;
      return { fromVal, toVal, hasRoute, time };
    })()
  `);
  console.log(`  Popular chip clicked: from="${routeState1.fromVal}", to="${routeState1.toVal}", hasRoute=${routeState1.hasRoute}, time="${routeState1.time}"`);

  console.log('\n--- 3. Testing Feature 2: Nearest-Place Finder ---');
  // Clear route
  await client.eval(`document.getElementById('clear').click();`);
  await wait(200);

  // Click "Food" without A chosen
  const foodChip = await client.eval(`
    (() => {
      const btn = document.querySelector('#nearest-chips [data-cat="food"]');
      if (btn) btn.click();
      const res = document.getElementById('nearest-results');
      return { hidden: res?.hidden, text: res?.textContent };
    })()
  `);
  console.log(`  Nearest food without start A: hidden=${foodChip.hidden}, msg="${foodChip.text?.trim()}"`);

  // Choose starting point A = Library
  await client.eval(`
    (() => {
      const input = document.getElementById('from-input');
      input.focus();
      input.value = 'library';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      const opt = document.querySelector('#from-listbox .combobox-option');
      if (opt) opt.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    })()
  `);
  await wait(200);

  // Now click "Food & services" nearest chip
  await client.eval(`document.querySelector('#nearest-chips [data-cat="food"]').click();`);
  await wait(300);
  const nearestResults = await client.eval(`
    (() => {
      const items = document.querySelectorAll('.nearest-item-btn');
      return {
        count: items.length,
        firstText: items[0]?.textContent?.replace(/\\s+/g, ' ').trim()
      };
    })()
  `);
  console.log(`  Nearest food places from Library: count=${nearestResults.count}, first="${nearestResults.firstText}"`);

  // Click first nearest result -> sets B to Food Court and draws route
  await client.eval(`document.querySelector('.nearest-item-btn').click();`);
  await wait(300);
  const routeState2 = await client.eval(`
    (() => {
      const toVal = document.getElementById('to-input').value;
      const hasRoute = document.getElementById('map').classList.contains('has-route');
      const time = document.querySelector('.summary .time')?.textContent;
      return { toVal, hasRoute, time };
    })()
  `);
  console.log(`  Clicked nearest place: to="${routeState2.toVal}", hasRoute=${routeState2.hasRoute}, time="${routeState2.time}"`);

  console.log('\n--- 4. Testing Feature 3: Places Directory Page ---');
  await client.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/places.html` });
  await wait(600);

  const dirInitial = await client.eval(`
    (() => {
      const cards = document.querySelectorAll('.place-card');
      const count = document.getElementById('dir-count')?.textContent;
      return { cards: cards.length, count };
    })()
  `);
  console.log(`  Directory initial state: ${dirInitial.cards} cards, text="${dirInitial.count}"`);
  if (dirInitial.cards !== 21) console.error(`❌ Expected 21 place cards, found ${dirInitial.cards}`);

  // Test alias search: "canteen" -> should match Food Court
  await client.eval(`
    (() => {
      const input = document.getElementById('dir-search');
      input.value = 'canteen';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    })()
  `);
  await wait(200);
  const searchCanteen = await client.eval(`
    (() => {
      const cards = document.querySelectorAll('.place-card');
      const count = document.getElementById('dir-count')?.textContent;
      const title = cards[0]?.querySelector('h3')?.textContent;
      return { cards: cards.length, count, title };
    })()
  `);
  console.log(`  Search "canteen": cards=${searchCanteen.cards}, count="${searchCanteen.count}", name="${searchCanteen.title}"`);

  // Test category filter chip: "Academic"
  await client.eval(`
    (() => {
      document.getElementById('dir-search').value = '';
      document.getElementById('dir-search').dispatchEvent(new Event('input', { bubbles: true }));
      const academicChip = document.querySelector('#dir-filters [data-cat="academic"]');
      if (academicChip) academicChip.click();
    })()
  `);
  await wait(200);
  const filterAcademic = await client.eval(`
    (() => {
      const cards = document.querySelectorAll('.place-card');
      const count = document.getElementById('dir-count')?.textContent;
      return { cards: cards.length, count };
    })()
  `);
  console.log(`  Filter "Academic": cards=${filterAcademic.cards}, count="${filterAcademic.count}"`);

  // Test empty state
  await client.eval(`
    (() => {
      const input = document.getElementById('dir-search');
      input.value = 'nonexistentplace999';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    })()
  `);
  await wait(200);
  const emptyState = await client.eval(`
    (() => {
      const cards = document.querySelectorAll('.place-card');
      const count = document.getElementById('dir-count')?.textContent;
      const emptyHidden = document.getElementById('dir-empty')?.hidden;
      return { cards: cards.length, count, emptyHidden };
    })()
  `);
  console.log(`  Search nonexistent: cards=${emptyState.cards}, count="${emptyState.count}", emptyHidden=${emptyState.emptyHidden}`);

  // Test single ?to=ID prefill handling on Wayfinder
  console.log('Testing single ?to=foodcourt prefill on wayfinder.html...');
  await client.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/wayfinder.html?to=foodcourt` });
  await wait(600);
  const singleTo = await client.eval(`
    (() => {
      const fromVal = document.getElementById('from-input').value;
      const toVal = document.getElementById('to-input').value;
      const emptyText = document.querySelector('.empty-state')?.textContent;
      return { fromVal, toVal, emptyText };
    })()
  `);
  console.log(`  Single ?to=foodcourt: from="${singleTo.fromVal}", to="${singleTo.toVal}", prompt="${singleTo.emptyText}"`);

  // Test single ?from=library prefill handling on Wayfinder
  console.log('Testing single ?from=library prefill on wayfinder.html...');
  await client.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/wayfinder.html?from=library` });
  await wait(600);
  const singleFrom = await client.eval(`
    (() => {
      const fromVal = document.getElementById('from-input').value;
      const toVal = document.getElementById('to-input').value;
      const emptyText = document.querySelector('.empty-state')?.textContent;
      return { fromVal, toVal, emptyText };
    })()
  `);
  console.log(`  Single ?from=library: from="${singleFrom.fromVal}", to="${singleFrom.toVal}", prompt="${singleFrom.emptyText}"`);

  console.log('\n--- 5. Testing Feature 4: Place Detail Panel (Native Dialog) ---');
  // Click on Central Library marker
  await client.eval(`
    (() => {
      const marker = document.querySelector('.marker[data-id="library"]');
      if (marker) marker.click();
    })()
  `);
  await wait(300);
  const dialogState = await client.eval(`
    (() => {
      const dlg = document.getElementById('place-dialog');
      const title = document.getElementById('dialog-title')?.textContent;
      const nearestItems = document.querySelectorAll('.dialog-nearest-list li').length;
      const setA = document.getElementById('dialog-set-a');
      const setB = document.getElementById('dialog-set-b');
      const reason = document.querySelector('.dialog-reason')?.textContent;
      return {
        isOpen: dlg?.hasAttribute('open'),
        title,
        nearestItems,
        setADisabled: setA?.disabled,
        setBDisabled: setB?.disabled,
        reason
      };
    })()
  `);
  console.log(`  Place Detail Dialog: open=${dialogState.isOpen}, title="${dialogState.title}", nearestCount=${dialogState.nearestItems}`);
  console.log(`  Buttons: SetA disabled=${dialogState.setADisabled}, SetB disabled=${dialogState.setBDisabled}, reason="${dialogState.reason}"`);

  // Close dialog via Close button
  await client.eval(`document.getElementById('dialog-cancel')?.click();`);
  await wait(200);
  const dialogClosed = await client.eval(`document.getElementById('place-dialog')?.hasAttribute('open')`);
  console.log(`  Dialog closed after click: stillOpen=${dialogClosed}`);

  // Test map panning does NOT open dialog
  console.log('Testing that dragging/panning the map does NOT trigger dialog...');
  await client.eval(`
    (() => {
      const map = document.getElementById('map');
      // Dispatch drag sequence
      map.dispatchEvent(new PointerEvent('pointerdown', { clientX: 200, clientY: 200, pointerId: 1 }));
      map.dispatchEvent(new PointerEvent('pointermove', { clientX: 250, clientY: 250, pointerId: 1 }));
      map.dispatchEvent(new PointerEvent('pointerup', { clientX: 250, clientY: 250, pointerId: 1 }));
      // Click event following drag
      const marker = document.querySelector('.marker');
      if (marker) marker.click();
    })()
  `);
  await wait(200);
  const dialogAfterPan = await client.eval(`document.getElementById('place-dialog')?.hasAttribute('open')`);
  console.log(`  Dialog after pan gesture: opened=${dialogAfterPan}`);
  if (dialogAfterPan) console.error(`❌ Dialog should not open after a drag gesture!`);

  console.log('\n--- 6. Testing Touch Targets on Mobile Places Directory (390px) ---');
  await client.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await client.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/places.html` });
  await wait(600);

  const dirTouchTargets = await client.eval(`
    (() => {
      const results = [];
      const selectors = ['button', '.chip', 'input', 'a.btn'];
      document.querySelectorAll(selectors.join(',')).forEach(el => {
        if (el.offsetParent === null) return;
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) return;
        results.push({
          tag: el.tagName,
          id: el.id,
          cls: el.className,
          w: Math.round(rect.width),
          h: Math.round(rect.height)
        });
      });
      return results;
    })()
  `);
  let dirTouchFails = 0;
  dirTouchTargets.forEach(t => {
    if (t.w < 44 || t.h < 44) {
      console.warn(`  ⚠️ Small target on places.html: ${t.tag}#${t.id}.${t.cls} (${t.w}x${t.h})`);
      dirTouchFails++;
    }
  });
  if (dirTouchFails === 0) {
    console.log(`  ✓ All ${dirTouchTargets.length} checked interactive elements on places.html meet or exceed 44x44px touch targets!`);
  }

  console.log('\n=======================================');
  console.log(`Total Console Errors across all tests: ${consoleErrors.length}`);
  if (consoleErrors.length > 0) {
    console.error('Errors encountered:', consoleErrors);
  } else {
    console.log('✓ 0 Console errors detected across all tested pages and features!');
  }
  console.log('=======================================');

  chrome.kill();
  if (server) server.close();
}

run().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
