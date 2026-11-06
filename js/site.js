/* Cursor trail: one smooth, tapered ribbon (a filled outline, so there are
   no visible joints or beads), fading from the head to the tip. */
function drawTrailRibbon(ctx, pts, maxW, r, g, b, alpha) {
  const L = [], R = [];
  const n = pts.length;
  let len = 0;
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], c = pts[Math.min(n - 1, i + 1)];
    let dx = c.x - a.x, dy = c.y - a.y;
    const d = Math.hypot(dx, dy);
    if (i) len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    if (d < 0.001) { dx = 1; dy = 0; } else { dx /= d; dy /= d; }
    const t = i / (n - 1);
    const w = maxW * 0.5 * Math.pow(1 - t, 1.15);
    L.push({ x: pts[i].x - dy * w, y: pts[i].y + dx * w });
    R.push({ x: pts[i].x + dy * w, y: pts[i].y - dx * w });
  }
  if (len < 1.5) return;
  // safety: never draw a shape that is not finite or far larger than a trail can be
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pts) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return;
    if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x; if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
  }
  if (maxX - minX > 1600 || maxY - minY > 1600) return;
  const head = pts[0], tip = pts[n - 1];
  const grad = ctx.createLinearGradient(head.x, head.y, tip.x, tip.y);
  grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${(alpha * 0.92).toFixed(3)})`);
  grad.addColorStop(0.55, `rgba(${r}, ${g}, ${b}, ${(alpha * 0.4).toFixed(3)})`);
  grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
  const curve = (arr, start) => {
    for (let i = start; i < arr.length - 1; i++) {
      const m = { x: (arr[i].x + arr[i + 1].x) / 2, y: (arr[i].y + arr[i + 1].y) / 2 };
      ctx.quadraticCurveTo(arr[i].x, arr[i].y, m.x, m.y);
    }
    ctx.lineTo(arr[arr.length - 1].x, arr[arr.length - 1].y);
  };
  ctx.beginPath();
  ctx.moveTo(L[0].x, L[0].y);
  curve(L, 1);
  const Rr = R.slice().reverse();
  curve(Rr, 0);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();
}

/*
  Shared helpers + small page scripts:
  - mobile menu & scroll effects
  - home page: legend and the live example route
  - gestalt page: interactive demos
*/
const Site = (() => {
  const C = CAMPUS;

  // Render a category pin with shape, color, and inner category letter (C, H, F, S, M, L, G, K)
  /* Category badges: each type keeps its own shape (similarity), drawn as a
     designed badge with a white rim, soft top light and a line icon. */
  const PIN_SHAPES = {
    circle:   'M16 3a13 13 0 1 1 0 26a13 13 0 1 1 0-26z',
    square:   'M9.5 3.5h13a6 6 0 0 1 6 6v13a6 6 0 0 1-6 6h-13a6 6 0 0 1-6-6v-13a6 6 0 0 1 6-6z',
    diamond:  'M16 2.6c.85 0 1.66.34 2.26.94l10.2 10.2a3.2 3.2 0 0 1 0 4.52l-10.2 10.2a3.2 3.2 0 0 1-4.52 0L3.54 18.26a3.2 3.2 0 0 1 0-4.52L13.74 3.54A3.2 3.2 0 0 1 16 2.6z',
    triangle: 'M13.4 4.9a3 3 0 0 1 5.2 0l10.4 18.2a3 3 0 0 1-2.6 4.5H5.6a3 3 0 0 1-2.6-4.5z',
    hexagon:  'M10.4 3.6h11.2a3 3 0 0 1 2.6 1.5l5.6 9.4a3 3 0 0 1 0 3l-5.6 9.4a3 3 0 0 1-2.6 1.5H10.4a3 3 0 0 1-2.6-1.5L2.2 17.5a3 3 0 0 1 0-3l5.6-9.4a3 3 0 0 1 2.6-1.5z',
    shield:   'M6.2 3.5h19.6a2.7 2.7 0 0 1 2.7 2.7v8.9c0 6.4-5.2 11.1-11.7 13.5a2.5 2.5 0 0 1-1.6 0C8.7 26.2 3.5 21.5 3.5 15.1V6.2a2.7 2.7 0 0 1 2.7-2.7z',
    arch:     'M16 3.2c-6.3 0-11.5 5.1-11.5 11.4V26a2.6 2.6 0 0 0 2.6 2.6h17.8a2.6 2.6 0 0 0 2.6-2.6V14.6C27.5 8.3 22.3 3.2 16 3.2z',
    star:     'M17.4 3.9l2.9 6.1 6.6.9c1.3.2 1.8 1.8.9 2.7l-4.8 4.6 1.2 6.6c.2 1.3-1.1 2.3-2.3 1.7L16 23.3l-5.9 3.2c-1.2.6-2.5-.4-2.3-1.7l1.2-6.6-4.8-4.6c-.9-.9-.4-2.5.9-2.7l6.6-.9 2.9-6.1c.6-1.2 2.2-1.2 2.8 0z'
  };
  // icon, plus its scale and vertical nudge inside each shape
  const PIN_ICONS = {
    academic: ['M2 9.5 12 4.5l10 5-10 5z M6.5 12v4.3c0 1.5 2.5 2.9 5.5 2.9s5.5-1.4 5.5-2.9V12 M22 9.5v5'],
    hostel:   ['M3 19V6 M3 15h18v4 M21 15v-2.6a2.6 2.6 0 0 0-2.6-2.6H11V15 M7 9.6a1.9 1.9 0 1 1 0 3.8 1.9 1.9 0 0 1 0-3.8z'],
    food:     ['M6 3v5.5a3 3 0 0 0 6 0V3 M9 3v18 M18 21V3c-2.2 1.4-3.3 4-3.3 7.2V14H18'],
    sports:   ['M12 3.5a8.5 8.5 0 1 1 0 17 8.5 8.5 0 0 1 0-17z M12 3.5c2.4 2.4 3.4 5.2 3.4 8.5s-1 6.1-3.4 8.5 M12 3.5C9.6 5.9 8.6 8.7 8.6 12s1 6.1 3.4 8.5 M3.5 12h17'],
    admin:    ['M4 20V8.5L12 4l8 4.5V20 M9.5 20v-5.5h5V20 M3 20h18 M8 10.5h.01 M12 10.5h.01 M16 10.5h.01'],
    landmark: ['M6 21V3.5 M6 4h11.5l-2.3 4.2 2.3 4.3H6'],
    gate:     ['M4.5 20V11a7.5 7.5 0 0 1 15 0v9 M9 20v-7.5a3 3 0 0 1 6 0V20 M3 20h18'],
    children: ['M12 19.5s-7-4.3-7-9.3a3.9 3.9 0 0 1 7-2.4 3.9 3.9 0 0 1 7 2.4c0 5-7 9.3-7 9.3z']
  };
  const PIN_FIT = { circle: [.66, 0], square: [.68, 0], triangle: [.52, 3.2], shield: [.6, -1], star: [.42, 1.4], arch: [.62, 1.6], diamond: [.58, 0], hexagon: [.62, 0] };
  if (!document.getElementById('raasta-pin-defs')) {
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    defs.id = 'raasta-pin-defs';
    defs.setAttribute('aria-hidden', 'true');
    defs.setAttribute('width', '0'); defs.setAttribute('height', '0');
    defs.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
    defs.innerHTML = `<defs>
      <linearGradient id="pinShade" x1="0" y1="0" x2="0" y2="1"><stop offset=".35" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".26"/></linearGradient>
      <linearGradient id="pinGloss" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".42"/><stop offset=".5" stop-color="#fff" stop-opacity=".06"/><stop offset=".51" stop-color="#fff" stop-opacity="0"/></linearGradient>
    </defs>`;
    (document.body || document.documentElement).appendChild(defs);
  }
  const pinHTML = cat => {
    const c = C.categories[cat] || { shape: 'circle', color: '#24628f', code: 'C' };
    const d = PIN_SHAPES[c.shape] || PIN_SHAPES.circle;
    const icon = (PIN_ICONS[cat] || [''])[0];
    const [k, dy] = PIN_FIT[c.shape] || [.64, 0];
    const t = `translate(16 ${16 + dy}) scale(${k}) translate(-12 -12)`;
    return `<span class="pin shape-${c.shape}" style="--c:${c.color}" data-cat="${cat}"><svg class="pin-svg" viewBox="0 0 32 32" aria-hidden="true" focusable="false">` +
      `<path class="pin-rim" d="${d}"/><path class="pin-base" d="${d}" style="fill:${c.color}"/><path d="${d}" fill="url(#pinShade)"/><path d="${d}" fill="url(#pinGloss)"/>` +
      `<path class="pin-edge" d="${d}"/>` +
      (icon ? `<path class="pin-ico" d="${icon}" transform="${t}" stroke-width="${(1.75 / k).toFixed(2)}"/>` : '') +
      `</svg></span>`;
  };

  const pathD = pts => pts.map((p, i) => (i ? 'L' : 'M') + p[0] + ' ' + p[1]).join(' ');

  const zonesMarkup = () => C.zones.map(z =>
    `<ellipse class="zone" cx="${z.cx}" cy="${z.cy}" rx="${z.rx}" ry="${z.ry}" transform="rotate(${z.rot} ${z.cx} ${z.cy})"/>` +
    `<text class="zone-label" x="${z.cx}" y="${z.labelAt === 'bottom' ? z.cy + z.ry - 8 : z.cy - z.ry + 22}" text-anchor="middle">${z.label}</text>`
  ).join('');

  const turnsMarkup = r => r.steps.slice(1, -1).map((s, i) =>
    `<circle class="turn" r="7" cx="${s.point[0]}" cy="${s.point[1]}" style="animation-delay:${0.25 + i * 0.18}s"/>`
  ).join('');

  const posStyle = p => `left:${(p.x / C.mapSize.w * 100).toFixed(3)}%;top:${(p.y / C.mapSize.h * 100).toFixed(3)}%`;

  // Standard line-icon set on a 24px grid with consistent 2px stroke width and round caps
  const directionIcon = turn => {
    switch (turn) {
      case 'start':
        return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 7v10M8 11l4-4 4 4"/></svg>`;
      case 'left':
        return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 19v-6a4 4 0 0 0-4-4H5"/><polyline points="9 5 5 9 9 13"/></svg>`;
      case 'right':
        return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 19v-6a4 4 0 0 1 4-4h10"/><polyline points="15 5 19 9 15 13"/></svg>`;
      case 'sharp-left':
        return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 19l-4-9-8 2"/><polyline points="6 6 6 12 12 11"/></svg>`;
      case 'sharp-right':
        return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 19l4-9 8 2"/><polyline points="18 6 18 12 12 11"/></svg>`;
      case 'arrive':
        return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`;
      case 'straight':
      default:
        return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>`;
    }
  };

  const icon = (name, size = 18) => {
    const s = size;
    const paths = {
      search: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
      copy: '<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
      share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>',
      print: '<polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
      'zoom-in': '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
      'zoom-out': '<line x1="5" y1="12" x2="19" y2="12"/>',
      'zoom-reset': '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><polyline points="3 3 3 8 8 8"/>',
      swap: '<path d="M7 16V4M7 4L3 8M7 4l4 4M17 8v12M17 20l4-4M17 20l-4-4"/>',
      chevronDown: '<polyline points="6 9 12 15 18 9"/>',
      close: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
      check: '<polyline points="20 6 9 17 4 12"/>',
      info: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>'
    };
    const body = paths[name] || '';
    return `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
  };

  // Crisp vector roads drawn from the road data (sharp at any zoom level).
  // One path per road name: a soft outline ("casing") under a light fill,
  // plus the road's name along its longest straight piece.
  let roadsCache = null;
  const roadsMarkup = () => {
    if (roadsCache) return roadsCache;
    const N = C.nodes;
    const byRoad = {};
    C.edges.forEach(([a, b, name]) => {
      if (!N[a] || !N[b]) return;
      (byRoad[name] = byRoad[name] || []).push([N[a], N[b]]);
    });
    let defs = '', casing = '', fill = '', labels = '';
    Object.entries(byRoad).forEach(([name, segs], i) => {
      const d = segs.map(([p, q]) => `M${p[0]} ${p[1]}L${q[0]} ${q[1]}`).join('');
      const minor = /lane|walk/i.test(name);
      casing += `<path class="road-casing${minor ? ' minor' : ''}" d="${d}"/>`;
      fill += `<path class="road-fill${minor ? ' minor' : ''}" d="${d}"/>`;
      // label on the longest piece, written left-to-right so it is never upside down
      let [p, q] = segs.reduce((best, s) =>
        Math.hypot(s[1][0] - s[0][0], s[1][1] - s[0][1]) > Math.hypot(best[1][0] - best[0][0], best[1][1] - best[0][1]) ? s : best);
      const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
      if (len < 46) return;
      if (q[0] < p[0]) [p, q] = [q, p];
      const id = `road-lbl-${i}`;
      defs += `<path id="${id}" d="M${p[0]} ${p[1]}L${q[0]} ${q[1]}"/>`;
      labels += `<text class="road-label${minor ? ' minor' : ''}" dy="2.6"><textPath href="#${id}" startOffset="50%" text-anchor="middle">${name}</textPath></text>`;
    });
    roadsCache = `<g class="roads" aria-hidden="true"><defs>${defs}</defs>${casing}${fill}${labels}</g>`;
    return roadsCache;
  };

  return { C, pinHTML, pathD, zonesMarkup, roadsMarkup, turnsMarkup, posStyle, directionIcon, icon };
})();

/* ---------- Shared: image cache + idle scheduling ----------
   Heavy, deterministic renders (the 3D campus map and its soft-focus copy)
   are saved in IndexedDB, so they are built once per browser instead of on
   every page visit. New renders wait until the page has settled. */
window.RaastaCache = (() => {
  let dbp = null;
  const open = () => dbp || (dbp = new Promise((res, rej) => {
    if (!('indexedDB' in window)) return rej(new Error('no idb'));
    const r = indexedDB.open('raasta-cache', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('img');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  }));
  const get = key => open().then(db => new Promise(res => {
    try { const q = db.transaction('img').objectStore('img').get(key); q.onsuccess = () => res(q.result || null); q.onerror = () => res(null); }
    catch (e) { res(null); }
  })).catch(() => null);
  const put = (key, blob) => open().then(db => {
    try { db.transaction('img', 'readwrite').objectStore('img').put(blob, key); } catch (e) { /* storage full: skip */ }
  }).catch(() => {});
  // run after load, after the page transition, when the browser is idle
  const idle = () => new Promise(res => {
    const go = () => setTimeout(() => (window.requestIdleCallback ? requestIdleCallback(() => res(), { timeout: 1500 }) : res()), 650);
    if (document.readyState === 'complete') go(); else window.addEventListener('load', go, { once: true });
  });
  const hash = str => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); };
  return { get, put, idle, hash };
})();

/* ---------- Shared: realistic 3D campus render (built once per page) ----------
   Turns the campus image into a lit 3D-style map (roads under extruded
   buildings with shaded walls, lit roof edges and soft shadows) and returns a
   blob URL. Used by the home hero and the Gestalt page demos. */
window.RaastaBaseMap = (() => {
  let job = null;
  const C0 = (typeof CAMPUS !== 'undefined') ? CAMPUS : null;
  const KEY = C0 ? `basemap-v4-${RaastaCache.hash(JSON.stringify([C0.mapSize, C0.edges, C0.nodes]))}` : 'basemap-none';
  window.RaastaBaseMapKey = KEY;
  const render = () => new Promise((resolve, reject) => {
    const C = C0;
    if (!C) return reject(new Error('no campus data'));
    const img = new Image();
    img.onload = () => {
      try {
        const W = img.naturalWidth, H = img.naturalHeight, N = W * H;
        const S = W / C.mapSize.w;                       // map units -> image pixels
        const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
        const srcC = mk(), sx = srcC.getContext('2d', { willReadFrequently: true });
        sx.drawImage(img, 0, 0);
        const d = sx.getImageData(0, 0, W, H).data;

        // 1. classify pixels: 1 building, 2 green, 3 water/path
        const cls = new Uint8Array(N);
        for (let p = 0, i = 0; p < N; p++, i += 4) {
          const R = d[i] / 255, G = d[i + 1] / 255, B = d[i + 2] / 255;
          const field = -8 * R + 8 * G - 1.3, bld = 1 + 12 * R - 6 * G - 6 * B, water = -3 * R - 4 * G + 7 * B - 0.25;
          cls[p] = field > 0.45 ? 2 : bld > 0.5 ? 1 : water > 0.3 ? 3 : 0;
        }
        let seed = 7;
        const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

        // 2. ground, grass and water with fine texture
        const out = mk(), ox = out.getContext('2d');
        const base = ox.createImageData(W, H), b = base.data;
        for (let p = 0, i = 0; p < N; p++, i += 4) {
          const n = (rnd() - 0.5) * 8;
          let r, g, bl;
          if (cls[p] === 2) { const m = (rnd() - 0.5) * 12; r = 196 + m; g = 211 + m; bl = 172 + m * 0.6; }
          else if (cls[p] === 3) { r = 204 + n; g = 219 + n; bl = 226 + n; }
          else { r = 234 + n; g = 229 + n; bl = 217 + n; }
          b[i] = r; b[i + 1] = g; b[i + 2] = bl; b[i + 3] = 255;
        }
        ox.putImageData(base, 0, 0);

        // 3. roads on the ground (so buildings can stand in front of them)
        ox.lineCap = 'round'; ox.lineJoin = 'round';
        const roadSet = C.edges.filter(e => C.nodes[e[0]] && C.nodes[e[1]]).map(([a, z, name]) => [C.nodes[a], C.nodes[z], /lane|walk/i.test(name)]);
        const stroke = (minor, width, colour) => {
          ox.strokeStyle = colour; ox.lineWidth = width;
          ox.beginPath();
          roadSet.filter(r => r[2] === minor).forEach(([p, q]) => { ox.moveTo(p[0] * S, p[1] * S); ox.lineTo(q[0] * S, q[1] * S); });
          ox.stroke();
        };
        stroke(true, 13, 'rgba(60, 52, 40, .22)'); stroke(false, 19, 'rgba(60, 52, 40, .24)');   // kerbs
        stroke(true, 9.5, '#fbfaf6'); stroke(false, 14.5, '#fdfcf9');                             // surface

        // building footprint mask, tinted in any colour
        const maskC = mk(), mx = maskC.getContext('2d');
        const md = mx.createImageData(W, H), m = md.data;
        for (let p = 0, i = 0; p < N; p++, i += 4) if (cls[p] === 1) m[i + 3] = 255;
        mx.putImageData(md, 0, 0);
        const tint = colour => {
          const c = mk(), x = c.getContext('2d');
          x.drawImage(maskC, 0, 0);
          x.globalCompositeOperation = 'source-in';
          x.fillStyle = colour; x.fillRect(0, 0, W, H);
          return c;
        };

        // 4. buildings
        const HGT = 26;                       // extrusion height (image px)
        const LEAN = 0.32;                    // walls lean slightly left (camera from the south-east)
        const dark = tint('rgb(28, 32, 38)');
        // long soft cast shadow (sun in the top-left)
        ox.save(); ox.globalAlpha = 0.30; ox.filter = 'blur(12px)';
        ox.drawImage(dark, HGT * 1.15, HGT * 0.95);
        ox.restore();
        // tight contact shadow where walls meet the ground
        ox.save(); ox.globalAlpha = 0.45; ox.filter = 'blur(3px)';
        ox.drawImage(dark, 2, 3);
        ox.restore();
        // walls: darker near the ground, lighter towards the roof
        const STEPS = 13, wallTints = [];
        for (let k = 0; k < STEPS; k++) {
          const t = k / (STEPS - 1);
          const r = Math.round(150 + t * 58), g = Math.round(138 + t * 56), bl = Math.round(122 + t * 52);
          wallTints.push(tint(`rgb(${r}, ${g}, ${bl})`));
        }
        for (let s = 0; s <= HGT; s++) {
          const k = Math.min(STEPS - 1, Math.floor(s / HGT * STEPS));
          ox.drawImage(wallTints[k], -s * LEAN, -s);
        }
        // roof
        const roof = tint('#f6f2ea');
        const rx = -HGT * LEAN, ry = -HGT;
        ox.drawImage(roof, rx, ry);
        // roof edges: bright on the sunny (top/left) side, shaded on the bottom/right
        const edgeC = mk(), ex = edgeC.getContext('2d'), ed = ex.createImageData(W, H), e = ed.data;
        for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
          const p = y * W + x;
          if (cls[p] !== 1) continue;
          const lit = cls[p - W] !== 1 || cls[p - 1] !== 1;
          const shade = cls[p + W] !== 1 || cls[p + 1] !== 1;
          if (!lit && !shade) continue;
          const i = p * 4;
          if (lit) { e[i] = 255; e[i + 1] = 255; e[i + 2] = 252; e[i + 3] = 255; }
          else { e[i] = 196; e[i + 1] = 184; e[i + 2] = 165; e[i + 3] = 255; }
        }
        ex.putImageData(ed, 0, 0);
        ox.drawImage(edgeC, rx, ry);
        // gentle roof texture: very light gradient from the sun corner
        ox.save();
        ox.globalCompositeOperation = 'multiply';
        const sun = ox.createLinearGradient(0, 0, W, H);
        sun.addColorStop(0, 'rgba(255, 255, 255, 1)'); sun.addColorStop(1, 'rgba(236, 228, 214, 1)');
        ox.fillStyle = sun; ox.fillRect(0, 0, W, H);
        ox.restore();

        out.toBlob(bl => {
          if (!bl) return reject(new Error('render failed'));
          RaastaCache.put(KEY, bl);
          resolve(URL.createObjectURL(bl));
        }, 'image/png');
      } catch (e) { reject(e); }
    };
    img.onerror = reject;
    img.src = 'assets/campus-map.webp';
  });
  return () => job || (job = RaastaCache.get(KEY).then(blob => blob
    ? URL.createObjectURL(blob)                     // instant on every visit after the first
    : RaastaCache.idle().then(render)));            // first visit: build once the page has settled
})();

/* ---------- mobile menu & header scroll shadow ---------- */
(() => {
  const btn = document.querySelector('.menu-btn');
  const nav = document.getElementById('nav');
  const header = document.querySelector('.site-header');

  if (btn && nav) {
    btn.addEventListener('click', () => {
      const open = nav.classList.toggle('open');
      btn.setAttribute('aria-expanded', String(open));
      btn.setAttribute('aria-label', open ? 'Close navigation menu' : 'Open navigation menu');
    });

    // Close menu when clicking outside or pressing Escape
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && nav.classList.contains('open')) {
        nav.classList.remove('open');
        btn.setAttribute('aria-expanded', 'false');
        btn.focus();
      }
    });

    document.addEventListener('click', e => {
      if (nav.classList.contains('open') && !nav.contains(e.target) && !btn.contains(e.target)) {
        nav.classList.remove('open');
        btn.setAttribute('aria-expanded', 'false');
      }
    });
  }

  // Header elevation shadow on scroll
  if (header) {
    // On pages with a full-screen dark hero, the header floats over it in
    // light text until the hero has scrolled away.
    const darkHero = document.querySelector('.hero-full');
    let heroH = darkHero ? darkHero.offsetHeight : 0, queued = false;
    const apply = () => {
      queued = false;
      const y = window.scrollY;
      header.classList.toggle('is-scrolled', y > 12);
      if (darkHero) header.classList.toggle('on-dark', y < heroH - 72);
    };
    const checkScroll = () => { if (!queued) { queued = true; requestAnimationFrame(apply); } };
    window.addEventListener('resize', () => { heroH = darkHero ? darkHero.offsetHeight : 0; checkScroll(); }, { passive: true });
    window.addEventListener('scroll', checkScroll, { passive: true });
    apply();
  }
})();

/* ---------- place counts in page text follow js/data.js ---------- */
(() => {
  const n = Site.C.places.filter(p => !p.draft).length;
  document.querySelectorAll('[data-place-count]').forEach(el => { el.textContent = n; });
  document.querySelectorAll('[data-pair-count]').forEach(el => { el.textContent = n * (n - 1); });
  document.querySelectorAll('[data-type-count]').forEach(el => { el.textContent = Object.keys(Site.C.categories).length; });
})();

/* ---------- giant footer wordmark + scroll reveal (every page) ---------- */
(() => {
  const footer = document.querySelector('.site-footer');
  if (footer && !footer.querySelector('.footer-wordmark')) {
    const mark = document.createElement('span');
    mark.className = 'footer-wordmark';
    mark.setAttribute('aria-hidden', 'true');
    mark.textContent = 'RAASTA';
    footer.appendChild(mark);
  }

  // Fade sections in as they scroll into view (skipped for reduced motion)
  if (!('IntersectionObserver' in window)) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const targets = document.querySelectorAll('main section.block .wrap > *, .p-section, .principle');
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  targets.forEach(el => {
    // Only hide things that start below the fold, so nothing flashes on load
    if (el.getBoundingClientRect().top > window.innerHeight) {
      el.classList.add('reveal');
      io.observe(el);
    }
  });
})();

/* ---------- home page ---------- */
(() => {
  const homePopular = document.getElementById('home-popular-chips');
  if (homePopular && Site.C.popularRoutes) {
    const C = Site.C;
    // Light road network for the small card maps (no labels)
    const roads = C.edges.filter(e => C.nodes[e[0]] && C.nodes[e[1]]).map(([a, b, name]) => {
      const [p, q] = [C.nodes[a], C.nodes[b]];
      return `<path class="${/lane|walk/i.test(name) ? 'minor' : ''}" d="M${p[0]} ${p[1]}L${q[0]} ${q[1]}"/>`;
    }).join('');
    const cardFor = (r, i) => {
      const route = typeof RouteCore !== 'undefined' ? RouteCore.route(r.from, r.to) : null;
      const href = `wayfinder.html?from=${r.from}&to=${r.to}`;
      if (!route) {
        return `<a class="route-card" href="${href}"><span class="rc-body"><span class="micro">${String(i + 1).padStart(2, '0')}</span><strong class="rc-title">${r.label}</strong></span></a>`;
      }
      // Frame each mini map around its own route (16:10)
      const pts = route.points.concat([[route.from.x, route.from.y], [route.to.x, route.to.y]]);
      const pad = 70;
      let x0 = Math.min(...pts.map(p => p[0])) - pad, x1 = Math.max(...pts.map(p => p[0])) + pad;
      let y0 = Math.min(...pts.map(p => p[1])) - pad, y1 = Math.max(...pts.map(p => p[1])) + pad;
      let w = x1 - x0, h = y1 - y0;
      if (w / h > 1.6) { const nh = w / 1.6; y0 -= (nh - h) / 2; h = nh; } else { const nw = h * 1.6; x0 -= (nw - w) / 2; w = nw; }
      // never zoom in further than ~480 map units wide, so short walks keep context
      if (w < 480) { const k = 480 / w; x0 -= (w * k - w) / 2; y0 -= (h * k - h) / 2; w *= k; h *= k; }
      const d = Site.pathD(route.points);
      const steps = Math.max(1, route.steps.length - 1);
      return `<a class="route-card" href="${href}" aria-label="Route: ${route.from.name} to ${route.to.name}, about ${route.minutes} minutes, ${route.meters} metres">
        <span class="rc-map" aria-hidden="true">
          <svg viewBox="${Math.round(x0)} ${Math.round(y0)} ${Math.round(w)} ${Math.round(h)}" preserveAspectRatio="xMidYMid slice">
            <g class="rc-roads">${roads}</g>
            <path class="rc-halo" d="${d}"/>
            <path class="rc-line" d="${d}" pathLength="1"/>
            <circle class="rc-a" cx="${route.from.x}" cy="${route.from.y}" r="${(w * 0.02).toFixed(1)}"/>
            <circle class="rc-b" cx="${route.to.x}" cy="${route.to.y}" r="${(w * 0.02).toFixed(1)}"/>
          </svg>
          <span class="rc-time"><strong>${route.minutes}</strong> min</span>
        </span>
        <span class="rc-body">
          <span class="micro">Walk ${String(i + 1).padStart(2, '0')}</span>
          <span class="rc-title"><span>${route.from.name}</span><span class="rc-to">to ${route.to.name}</span></span>
          <span class="rc-meta"><span>${route.meters} m</span><span>${steps} ${steps === 1 ? 'step' : 'steps'}</span><span class="rc-go">Start</span></span>
        </span>
      </a>`;
    };
    homePopular.innerHTML = C.popularRoutes.map(cardFor).join('');
  }

  const legend = document.getElementById('legend-list');
  if (legend) {
    legend.innerHTML = Object.entries(Site.C.categories).map(([key, c]) => {
      const n = Site.C.places.filter(p => p.cat === key).length;
      return `<li>${Site.pinHTML(key)}<span><strong>${c.label}</strong> <small>· ${n} ${n === 1 ? 'place' : 'places'} (key: ${c.code})</small></span></li>`;
    }).join('');
  }

  /* ---------- Hero: interactive live-route showcase ----------
     Autoplays the popular routes (camera glide, route draw, walking dot).
     Visitors can take over: tap a place for A, another for B, hover places
     for their names, or pick a route tab. Autoplay resumes after a pause. */
  const hsvg = document.getElementById('hp-svg');
  if (!hsvg || typeof RouteCore === 'undefined') return;
  const C = Site.C;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const device = hsvg.closest('.hp-device');
  const mapBox = hsvg.closest('.hp-map');
  const $id = id => document.getElementById(id);

  const popular = (C.popularRoutes || []).map(r => RouteCore.route(r.from, r.to)).filter(Boolean);
  if (!popular.length) return;

  // ---- static layers ----
  const roadPaths = C.edges.filter(e => C.nodes[e[0]] && C.nodes[e[1]]).map(([a, b, name]) => {
    const [p, q] = [C.nodes[a], C.nodes[b]];
    return { d: `M${p[0]} ${p[1]}L${q[0]} ${q[1]}`, minor: /lane|walk/i.test(name) };
  });
  const roadsOf = (cls, minorOnly) => roadPaths.filter(r => r.minor === minorOnly).map(r => `<path class="${cls}" d="${r.d}"/>`).join('');
  hsvg.innerHTML = `
    <defs>
      <radialGradient id="hp-paper" cx="40%" cy="30%" r="90%">
        <stop offset="0" stop-color="#f8f3ea"/><stop offset="1" stop-color="#efe7d8"/>
      </radialGradient>
      <filter id="hp-soft" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="2" stdDeviation="2.5" flood-color="#00253a" flood-opacity=".28"/></filter>
    </defs>
    <rect x="-600" y="-600" width="2245" height="1956" fill="url(#hp-paper)"/>
    <image class="hp-basemap" id="hp-basemap" x="0" y="0" width="1045" height="756" preserveAspectRatio="none"/>
    <g class="hp-roads">
      <g class="casing">${roadsOf('m', false)}${roadsOf('n', true)}</g>
      <g class="fill">${roadsOf('m', false)}${roadsOf('n', true)}</g>
    </g>
    <path class="hp-halo" id="hp-halo"/>
    <path class="hp-route-edge" id="hp-route-edge" pathLength="1"/>
    <path class="hp-route" id="hp-route" pathLength="1"/>
    <path class="hp-sheen" id="hp-sheen"/>
    <g class="hp-dots" id="hp-dots">${C.places.map(p =>
      `<g class="hp-place" data-id="${p.id}" transform="translate(${p.x} ${p.y})" tabindex="0" role="button" aria-label="${p.name}">
         <circle class="hit" r="16"/><circle class="pt" r="4.2" style="--pc:${C.categories[p.cat].color}"/>
       </g>`).join('')}</g>
    <g id="hp-pins"></g>
    <g class="hp-walker" id="hp-walker"><circle class="ring" r="15"/><circle class="core" r="7"/></g>`;

  const halo = $id('hp-halo'), line = $id('hp-route'), pinsG = $id('hp-pins'), walker = $id('hp-walker');
  const edge = $id('hp-route-edge'), sheen = $id('hp-sheen');
  // mirror the main route line onto its outline and sheen layers
  const syncRoute = () => {
    edge.setAttribute('d', line.getAttribute('d') || '');
    sheen.setAttribute('d', line.getAttribute('d') || '');
    edge.style.strokeDashoffset = line.style.strokeDashoffset;
    edge.style.opacity = line.style.opacity;
    sheen.style.opacity = (parseFloat(line.style.strokeDashoffset || 1) < 0.02 && line.style.opacity !== '0') ? 1 : 0;
  };
  new MutationObserver(syncRoute).observe(line, { attributes: true, attributeFilter: ['d', 'style'] });

  /* Base map: the shared realistic 3D campus render (see RaastaBaseMap) */
  window.RaastaBaseMap().then(url => {
    const baseImg = $id('hp-basemap');
    baseImg.setAttribute('href', url);
    baseImg.classList.add('ready');
    const bg = $id('hp-bgmap-img');
    if (bg) {
      // bake the soft focus into a half-size copy once, so the drifting
      // backdrop never has to be re-blurred while it animates
      const show = (u, baked) => { bg.style.backgroundImage = `url("${u}")`; bg.classList.toggle('baked', baked); bg.classList.add('ready'); };
      const SOFT = `${window.RaastaBaseMapKey || 'basemap'}-soft`;
      RaastaCache.get(SOFT).then(blob => {
        if (blob) return show(URL.createObjectURL(blob), true);
        RaastaCache.idle().then(() => { im.src = url; });
      });
      const im = new Image();
      im.onload = () => {
        try {
          const c = document.createElement('canvas');
          c.width = Math.max(1, Math.round(im.naturalWidth * 0.5));
          c.height = Math.max(1, Math.round(im.naturalHeight * 0.5));
          const x = c.getContext('2d');
          x.filter = 'blur(1.75px) saturate(.95) contrast(1.02)';
          if (!/blur/.test(x.filter)) return show(url, false);   // no canvas filters: CSS blur fallback
          x.drawImage(im, 0, 0, c.width, c.height);
          c.toBlob(b => { if (b) RaastaCache.put(SOFT, b); show(b ? URL.createObjectURL(b) : url, !!b); }, 'image/jpeg', 0.86);
        } catch (e) { show(url, false); }
      };
      im.onerror = () => show(url, false);
    }
    hsvg.classList.add('baked-roads');            // vector roads no longer needed on top
  }).catch(() => { /* the vector map still works on its own */ });
  const dotsG = $id('hp-dots'), tip = $id('hp-tip'), hint = $id('hp-hint'), hintTxt = $id('hp-hint-txt');
  const bar = $id('hp-progress-bar'), tabs = $id('hp-tabs');
  const fFrom = $id('preview-from'), fTo = $id('preview-to'), fTitle = $id('preview-title'),
        fMeta = $id('preview-meta'), fStep = $id('preview-step'), fStepN = $id('preview-step-n'), go = $id('hp-go');

  // ---- route tabs ----
  tabs.innerHTML = popular.map((r, k) =>
    `<button type="button" class="hp-tab" role="tab" data-k="${k}" aria-selected="false">
       <span class="fill" aria-hidden="true"></span><span class="lbl">${r.from.name} <i>→</i> ${r.to.name}</span>
     </button>`).join('');
  const tabEls = [...tabs.querySelectorAll('.hp-tab')];
  const setActiveTab = k => tabEls.forEach((t, j) => {
    t.setAttribute('aria-selected', String(j === k));
    t.classList.toggle('on', j === k);
    if (j !== k) t.style.setProperty('--p', 0);
  });

  // ---- camera ----
  const AR = 1045 / 756;
  const frameFor = (pts) => {
    let x0 = Math.min(...pts.map(p => p[0])), x1 = Math.max(...pts.map(p => p[0]));
    let y0 = Math.min(...pts.map(p => p[1])), y1 = Math.max(...pts.map(p => p[1]));
    let w = Math.max(x1 - x0 + 220, 560), h = Math.max(y1 - y0 + 200, 560 / AR);
    if (w / h > AR) h = w / AR; else w = h * AR;
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    return [cx - w / 2, cy - h / 2, w, h];
  };
  const routePts = r => r.points.concat([[r.from.x, r.from.y], [r.to.x, r.to.y]]);
  let vb = frameFor(routePts(popular[0]));
  const setVB = v => hsvg.setAttribute('viewBox', v.map(n => n.toFixed(1)).join(' '));
  const k0 = () => vb[2] / 1045;                     // map units per screen-ish unit
  const scaleMarks = () => {
    const k = k0() * 1.55;
    pinsG.querySelectorAll('.hp-pin').forEach(g => g.setAttribute('transform', `translate(${g.dataset.x} ${g.dataset.y}) scale(${k.toFixed(3)})`));
    dotsG.style.setProperty('--k', (k0() * 1.25).toFixed(3));
    walker.style.setProperty('--k', k.toFixed(3));
  };
  setVB(vb); scaleMarks();

  // ---- timing helpers that can be interrupted ----
  let token = 0;
  const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const nextFrame = cb => {
    let fired = false;
    const id = requestAnimationFrame(t => { fired = true; cb(t); });
    setTimeout(() => { if (!fired) { cancelAnimationFrame(id); cb(performance.now()); } }, 60);
  };
  const tween = (ms, fn, my) => new Promise(res => {
    if (reduce) { fn(1); return res(); }
    const t0 = performance.now();
    const step = now => {
      if (my !== token) return res();
      const t = Math.min(1, (now - t0) / ms);
      fn(t);
      t < 1 ? nextFrame(step) : res();
    };
    nextFrame(step);
  });
  const wait = (ms, my) => new Promise(r => {
    if (reduce) return r();
    const t0 = Date.now();
    const iv = setInterval(() => { if (my !== token || Date.now() - t0 >= ms) { clearInterval(iv); r(); } }, 50);
  });
  const glideTo = (target, ms, my) => {
    const from = vb.slice();
    return tween(ms, t => { const e = ease(t); vb = from.map((v, k) => v + (target[k] - v) * e); setVB(vb); scaleMarks(); }, my);
  };

  // ---- pins and text ----
  const pinMarkup = (p, letter, cls) =>
    `<g class="hp-pin ${cls}" data-x="${p.x}" data-y="${p.y}">
       <circle class="pulse" r="16"/><circle class="dot" r="13" filter="url(#hp-soft)"/>
       <text class="ltr" dy="4.6" text-anchor="middle">${letter}</text>
       <g class="tag"><rect class="tagbg" x="20" y="-12" height="24" rx="12"/><text class="tagtx" x="31" dy="4.4">${p.name}</text></g>
     </g>`;
  const drawPins = (a, b) => {
    pinsG.innerHTML = (a ? pinMarkup(a, 'A', 'from') : '') + (b ? pinMarkup(b, 'B', 'to') : '');
    pinsG.querySelectorAll('.hp-pin').forEach(g => {
      const t = g.querySelector('.tagtx'), bg = g.querySelector('.tagbg');
      bg.setAttribute('width', Math.ceil(t.getComputedTextLength() + 22));
    });
    scaleMarks();
  };
  const firstTurnOf = r => {
    const st = r.steps.slice(1).find(s => s && s.text && !/^arrive/i.test(s.text)) || r.steps[0];
    return st && st.text ? st.text.replace(/,? heading .*$/i, '') : '';
  };
  const setText = (el, v) => { if (el) el.textContent = v; };
  const setHint = (txt, mode) => { setText(hintTxt, txt); hint.dataset.mode = mode || ''; };

  // ---- play one route (auto or chosen) ----
  const play = async (r, opts = {}) => {
    const my = ++token;
    device.classList.add('is-swapping');
    line.style.opacity = 0; halo.style.opacity = 0; walker.style.opacity = 0;
    pinsG.classList.add('out');
    await wait(opts.quick ? 200 : 420, my);
    if (my !== token) return;

    const d = Site.pathD(r.points);
    line.setAttribute('d', d); halo.setAttribute('d', d);
    line.style.strokeDashoffset = 1;
    drawPins(r.from, r.to);
    setText(fFrom, r.from.name); setText(fTo, r.to.name);
    setText(fTitle, `${r.from.name} to ${r.to.name}`);
    setText(fMeta, `about ${r.minutes} min · ${r.meters} m · ${Math.max(1, r.steps.length - 1)} steps`);
    setText(fStep, firstTurnOf(r)); setText(fStepN, 'Next turn');
    if (go) go.href = `wayfinder.html?from=${r.from.id}&to=${r.to.id}`;
    device.classList.remove('is-swapping');
    if (opts.tab != null) setActiveTab(opts.tab); else setActiveTab(-1);

    await glideTo(frameFor(routePts(r)), opts.quick ? 900 : 1300, my);
    if (my !== token) return;
    pinsG.classList.remove('out');
    halo.style.opacity = 1; line.style.opacity = 1;

    const L = line.getTotalLength();
    walker.style.opacity = 1;
    const tabEl = opts.tab != null ? tabEls[opts.tab] : null;
    await tween(2600, t => {
      const e = ease(t);
      line.style.strokeDashoffset = 1 - e;
      const pt = line.getPointAtLength(L * e);
      walker.setAttribute('transform', `translate(${pt.x} ${pt.y})`);
      bar.style.transform = `scaleX(${e})`;
      if (tabEl) tabEl.style.setProperty('--p', (e * 0.6).toFixed(3));
    }, my);
    if (my !== token) return;
    walker.style.opacity = 0;
    pinsG.querySelector('.to')?.classList.add('arrived');
    // hold, while the tab finishes filling
    await tween(opts.hold || 2600, t => { if (tabEl) tabEl.style.setProperty('--p', (0.6 + t * 0.4).toFixed(3)); }, my);
  };

  // ---- autoplay ----
  let auto = 0, autoOn = true, resumeTimer = null, running = false, visible = true;
  const autoplay = async () => {
    if (running || reduce) return;
    running = true;
    while (autoOn && visible) {
      const my = token + 1;
      await play(popular[auto % popular.length], { tab: auto % popular.length });
      if (token !== my || !autoOn) break;   // user took over
      auto++;
    }
    running = false;
  };
  const pauseAuto = (ms = 9000) => {
    autoOn = false;
    clearTimeout(resumeTimer);
    resumeTimer = setTimeout(() => { autoOn = true; setHint('Tap any dot to plan your own route'); autoplay(); }, ms);
  };

  // ---- tabs ----
  tabs.addEventListener('click', e => {
    const t = e.target.closest('.hp-tab'); if (!t) return;
    const k = +t.dataset.k;
    auto = k;
    pauseAuto(12000);
    picking = null;
    setHint('Tap any dot to plan your own route');
    play(popular[k], { tab: k, quick: true, hold: 99999 });
  });

  // ---- tap places: first = A, second = B ----
  let picking = null;
  const choose = id => {
    const p = RouteCore.placeById[id]; if (!p) return;
    pauseAuto(14000);
    if (!picking || picking === id) {
      picking = id;
      ++token;                                  // stop whatever is playing
      line.style.opacity = 0; halo.style.opacity = 0; walker.style.opacity = 0;
      bar.style.transform = 'scaleX(0)';
      setActiveTab(-1);
      drawPins(p, null); pinsG.classList.remove('out');
      device.classList.add('is-swapping');
      setTimeout(() => {
        setText(fFrom, p.name); setText(fTo, 'Tap a destination');
        setText(fTitle, `Starting at ${p.name}`); setText(fMeta, 'Now tap where you want to go');
        setText(fStepN, 'Step 2 of 2'); setText(fStep, 'Tap a second place on the map');
        device.classList.remove('is-swapping');
      }, 200);
      setHint(`Start: ${p.name}. Now tap a destination`, 'picking');
      return;
    }
    const r = RouteCore.route(picking, id);
    picking = null;
    if (!r) return;
    setHint('Your route. Tap another dot to start again', 'done');
    play(r, { quick: true, hold: 99999 });
  };
  dotsG.addEventListener('click', e => { const g = e.target.closest('.hp-place'); if (g) choose(g.dataset.id); });
  dotsG.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const g = e.target.closest('.hp-place'); if (g) { e.preventDefault(); choose(g.dataset.id); }
  });

  // ---- hover: name tag follows the cursor ----
  dotsG.addEventListener('pointerover', e => {
    const g = e.target.closest('.hp-place'); if (!g) return;
    const p = RouteCore.placeById[g.dataset.id];
    tip.innerHTML = `<b>${p.name}</b><span>${C.categories[p.cat].label}</span>`;
    tip.style.setProperty('--c', C.categories[p.cat].color);
    tip.classList.add('on');
    g.classList.add('hot');
  });
  dotsG.addEventListener('pointerout', e => {
    const g = e.target.closest('.hp-place'); if (!g) return;
    tip.classList.remove('on'); g.classList.remove('hot');
  });
  mapBox.addEventListener('pointermove', e => {
    const r = mapBox.getBoundingClientRect();
    tip.style.transform = `translate(${e.clientX - r.left + 14}px, ${e.clientY - r.top - 12}px)`;
  });

  // ---- start ----
  setActiveTab(0);
  if (reduce) { play(popular[0], { tab: 0 }); }
  else autoplay();
  if ('IntersectionObserver' in window && !reduce) {
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible && autoOn) autoplay(); }, { threshold: 0.15 }).observe(hsvg);
  }
  document.addEventListener('visibilitychange', () => { visible = !document.hidden; if (visible && autoOn) autoplay(); });

  /* ---------- Hero: 3D tilt, glare, magnetic buttons, spotlight ---------- */
  if (!reduce && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    const hero = device.closest('.hero-pro');
    const glare = device.querySelector('.hp-glare');
    let tx = 0, ty = 0, cx = 0, cy = 0, raf = null;
    const BASE_Y = -7, BASE_X = 3;
    const render = () => {
      cx += (tx - cx) * 0.12; cy += (ty - cy) * 0.12;
      device.style.transform = `perspective(1600px) rotateY(${(BASE_Y + cx * 9).toFixed(2)}deg) rotateX(${(BASE_X - cy * 7).toFixed(2)}deg)`;
      if (glare) { glare.style.setProperty('--gx', `${50 + cx * 50}%`); glare.style.setProperty('--gy', `${50 + cy * 50}%`); }
      raf = (Math.abs(tx - cx) > .001 || Math.abs(ty - cy) > .001) ? requestAnimationFrame(render) : null;
    };
    const kick = () => { if (!raf) raf = requestAnimationFrame(render); };
    device.addEventListener('pointermove', e => {
      const r = device.getBoundingClientRect();
      tx = (e.clientX - r.left) / r.width - .5;
      ty = (e.clientY - r.top) / r.height - .5;
      device.classList.add('tilting'); kick();
    });
    device.addEventListener('pointerleave', () => { tx = 0; ty = 0; device.classList.remove('tilting'); kick(); });

    // spotlight + backdrop parallax: move layers directly (transform only),
    // never restyle the hero, so nothing has to be repainted
    const spot = hero.querySelector('.hp-spot'), bgm = hero.querySelector('.hp-bgmap');
    let pmx = 0, pmy = 0, pw = 1, ph = 1, sx = 0, sy = 0, bx = 0, by = 0, pRaf = null, pLast = 0;
    const pFrame = now => {
      const dt = Math.min(48, now - pLast) / 16.667; pLast = now;
      const k = b => 1 - Math.pow(1 - b, dt);
      sx += (pmx - sx) * k(0.22); sy += (pmy - sy) * k(0.22);
      const tbx = (pmx / pw - .5) * -22, tby = (pmy / ph - .5) * -14;
      bx += (tbx - bx) * k(0.06); by += (tby - by) * k(0.06);
      if (spot) spot.style.transform = `translate3d(${sx.toFixed(1)}px, ${sy.toFixed(1)}px, 0)`;
      if (bgm) bgm.style.transform = `translate3d(${bx.toFixed(2)}px, ${by.toFixed(2)}px, 0)`;
      const moving = Math.abs(pmx - sx) > .2 || Math.abs(pmy - sy) > .2 || Math.abs(tbx - bx) > .02 || Math.abs(tby - by) > .02;
      pRaf = moving ? requestAnimationFrame(pFrame) : null;
    };
    let heroRect = hero.getBoundingClientRect();
    const refreshHero = () => { heroRect = hero.getBoundingClientRect(); };
    window.addEventListener('scroll', refreshHero, { passive: true });
    window.addEventListener('resize', refreshHero, { passive: true });
    hero.addEventListener('pointerenter', e => {
      refreshHero();
      sx = pmx = e.clientX - heroRect.left; sy = pmy = e.clientY - heroRect.top;
    });
    hero.addEventListener('pointermove', e => {
      pmx = e.clientX - heroRect.left; pmy = e.clientY - heroRect.top; pw = heroRect.width; ph = heroRect.height;
      if (!pRaf) { pLast = performance.now(); pRaf = requestAnimationFrame(pFrame); }
    }, { passive: true });

    hero.querySelectorAll('.hp-btn, .hp-go').forEach(btn => {
      btn.addEventListener('pointermove', e => {
        const r = btn.getBoundingClientRect();
        const dx = (e.clientX - r.left - r.width / 2) / r.width, dy = (e.clientY - r.top - r.height / 2) / r.height;
        btn.style.transform = `translate(${dx * 10}px, ${dy * 8}px)`;
      });
      btn.addEventListener('pointerleave', () => { btn.style.transform = ''; });
    });
  }
})();

/* ---------- gestalt page demos ---------- */
(() => {
  if (!document.querySelector('[data-demo]')) return;
  const C = Site.C;

  // Map crops used by the figure-ground and continuity demos
  document.querySelectorAll('.crop').forEach(el => {
    const from = el.dataset.from;
    const to = el.dataset.to;
    const r = RouteCore.route(from, to);
    if (!r) return;
    const d = Site.pathD(r.points);
    // frame the crop around the route (16:10), padded and kept inside the map
    const xs = r.points.map(p => p[0]);
    const ys = r.points.map(p => p[1]);
    const pad = 60;
    let w = Math.max(...xs) - Math.min(...xs) + pad * 2;
    let h = Math.max(...ys) - Math.min(...ys) + pad * 2;
    if (w / h < 1.6) w = h * 1.6; else h = w / 1.6;
    w = Math.min(w, C.mapSize.w); h = Math.min(h, C.mapSize.h);
    const cx = (Math.max(...xs) + Math.min(...xs)) / 2;
    const cy = (Math.max(...ys) + Math.min(...ys)) / 2;
    const x0 = Math.max(0, Math.min(C.mapSize.w - w, cx - w / 2));
    const y0 = Math.max(0, Math.min(C.mapSize.h - h, cy - h / 2));
    el.innerHTML = `<svg viewBox="${x0.toFixed(1)} ${y0.toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <image href="assets/campus-map.webp" width="${C.mapSize.w}" height="${C.mapSize.h}" preserveAspectRatio="none"/>
        <rect class="veil-rect" x="0" y="0" width="${C.mapSize.w}" height="${C.mapSize.h}"/>
        <path class="route-halo" d="${d}"/><path class="route-line" d="${d}" pathLength="1"/><path class="route-flow" d="${d}"/>
        <circle cx="${r.from.x}" cy="${r.from.y}" r="9" fill="#003049" stroke="#fff" stroke-width="3"/>
        <circle cx="${r.to.x}" cy="${r.to.y}" r="9" fill="#c1121f" stroke="#fff" stroke-width="3"/>
      </svg>`;
  });

  const bind = (id, fn) => { const b = document.getElementById(id); if (b) b.addEventListener('click', () => fn(b)); };

  // 1. Proximity
  // Grouping <-> ungrouping, animated with FLIP: measure where each card is,
  // switch the layout, then glide every card from its old spot to its new one.
  let proxBusy = false;
  bind('prox-btn', b => {
    const el = document.getElementById('prox');
    if (!el || proxBusy) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const tiles = [...el.querySelectorAll('.tile')];
    const first = tiles.map(t => t.getBoundingClientRect());
    const even = el.classList.toggle('is-even');
    b.textContent = even ? 'Restore grouping' : 'Remove grouping';
    if (reduce || !tiles[0] || !tiles[0].animate) return;
    proxBusy = true;
    const last = tiles.map(t => t.getBoundingClientRect());
    const stage = el.closest('.demo-stage');
    stage && stage.classList.add('prox-moving');
    const order = even ? tiles.map((_, i) => i) : tiles.map((_, i) => tiles.length - 1 - i);
    let done = 0;
    tiles.forEach((t, i) => {
      const dx = first[i].left - last[i].left, dy = first[i].top - last[i].top;
      const arc = Math.min(10, 3 + Math.hypot(dx, dy) * 0.05);          // a small lift, a little more for longer trips
      const delay = order.indexOf(i) * 28;
      t.classList.add('in-flight');
      const anim = t.animate([
        { transform: `translate(${dx}px, ${dy}px) scale(1)` },
        { transform: `translate(${dx * 0.4}px, ${dy * 0.4 - arc}px) scale(1.025)`, offset: 0.38 },
        { transform: 'translate(0px, 0px) scale(1)' }
      ], { duration: 560, delay, easing: 'cubic-bezier(0.32, 0.72, 0, 1)', fill: 'backwards' });
      anim.onfinish = anim.oncancel = () => {
        t.classList.remove('in-flight');
        if (++done === tiles.length) { proxBusy = false; stage && stage.classList.remove('prox-moving'); }
      };
    });
    // grouping: each group lights up as it forms
    if (!even) {
      [...el.querySelectorAll('.grp')].forEach((g, gi) => g.animate([
        { boxShadow: '0 0 0 0 rgba(102, 155, 188, 0)', backgroundColor: 'rgba(169, 205, 227, 0)' },
        { boxShadow: '0 0 0 1.5px rgba(102, 155, 188, .5), 0 18px 34px -22px rgba(0, 37, 58, .45)', backgroundColor: 'rgba(169, 205, 227, .16)', offset: 0.35 },
        { boxShadow: '0 0 0 0 rgba(102, 155, 188, 0)', backgroundColor: 'rgba(169, 205, 227, 0)' }
      ], { duration: 900, delay: 360 + gi * 90, easing: 'cubic-bezier(0.4, 0, 0.2, 1)' }));
    }
  });

  // 2 & 7. Similarity and common fate: category buttons light up matching pins
  const cats = Object.keys(C.categories);
  const pinsFor = (container, list) => {
    container.innerHTML = list.map(k => Site.pinHTML(k)).join('');
  };
  const buildFilter = (btnWrap, row, onClass) => {
    if (!btnWrap || !row) return;
    btnWrap.innerHTML = cats.map(k => `<button class="chip" type="button" aria-pressed="false" data-cat="${k}">${Site.pinHTML(k)}${C.categories[k].label}</button>`).join('');
    btnWrap.addEventListener('click', e => {
      const chip = e.target.closest('.chip');
      if (!chip) return;
      const on = chip.getAttribute('aria-pressed') !== 'true';
      btnWrap.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-pressed', 'false'));
      row.querySelectorAll('.pin').forEach(p => p.classList.remove('hit'));
      row.classList.toggle(onClass, on);
      if (on) {
        chip.setAttribute('aria-pressed', 'true');
        row.querySelectorAll(`.pin[data-cat="${chip.dataset.cat}"]`).forEach(p => p.classList.add('hit'));
      }
    });
  };
  const simGrid = document.getElementById('sim-grid');
  if (simGrid) {
    pinsFor(simGrid, ['academic', 'hostel', 'food', 'academic', 'sports', 'admin', 'academic', 'hostel', 'academic', 'food', 'academic', 'academic', 'hostel', 'academic', 'food']);
    buildFilter(document.getElementById('sim-chips'), simGrid, 'dim');
  }
  const fateRow = document.getElementById('fate-row');
  if (fateRow) {
    pinsFor(fateRow, ['academic', 'food', 'academic', 'hostel', 'academic', 'admin', 'sports', 'academic', 'hostel', 'food']);
    buildFilter(document.getElementById('fate-chips'), fateRow, 'on');
  }

  // 3. Common region
  bind('region-btn', b => {
    const reg = document.getElementById('region');
    if (!reg) return;
    const flat = reg.classList.toggle('flat');
    reg.classList.remove('restoring');
    if (!flat) { void reg.offsetWidth; reg.classList.add('restoring'); setTimeout(() => reg.classList.remove('restoring'), 1700); }
    b.textContent = flat ? 'Restore containers' : 'Remove containers';
  });

  // 4. Figure-ground
  bind('fg-btn', b => {
    const crop = document.getElementById('fg-crop');
    if (!crop) return;
    const on = crop.classList.toggle('fg');
    b.textContent = on ? 'Remove the dimming' : 'Dim the background';
  });

  // 5. Continuity: replay the drawn route
  const replay = () => {
    const crop = document.getElementById('cont-crop');
    if (!crop) return;
    crop.classList.remove('anim');
    void crop.offsetWidth;
    crop.classList.add('anim');
  };
  bind('cont-btn', replay);
  if (document.getElementById('cont-crop')) replay();

  // 6. Closure
  bind('closure-btn', b => {
    const cl = document.getElementById('closure-demo');
    if (!cl) return;
    const closed = cl.classList.toggle('closed');
    b.textContent = closed ? 'Reopen the ring' : 'Complete the ring';
  });

  // 8. Focal point
  bind('focal-btn', b => {
    const foc = document.getElementById('focal');
    if (!foc) return;
    const eq = foc.classList.toggle('equal');
    foc.classList.remove('refocus');
    if (!eq) { void foc.offsetWidth; foc.classList.add('refocus'); setTimeout(() => foc.classList.remove('refocus'), 1600); }
    b.textContent = eq ? 'Restore the focal point' : 'Make every button equal';
  });
})();

/* ---------- Gestalt page: premium demo visuals ----------
   Upgrades the demo markup in place (the original toggles keep working). */
(() => {
  if (!document.querySelector('[data-demo]')) return;
  const C = Site.C;
  document.body.classList.add('demos-premium');
  const svgIcon = d => `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;

  // 1. Proximity: tiles become place cards with their category pin
  const catOf = name => /hostel/i.test(name) ? 'hostel' : 'academic';
  document.querySelectorAll('#prox .tile').forEach(t => {
    const name = t.textContent.trim();
    t.innerHTML = `${Site.pinHTML(catOf(name))}<span class="tile-txt"><b>${name}</b><small>${catOf(name) === 'hostel' ? 'Hostels' : 'Academic'}</small></span>`;
  });

  // 3. Common region: rows get icons and a value line
  const regionIcons = {
    Route: svgIcon('<circle cx="6" cy="19" r="2.5"/><circle cx="18" cy="5" r="2.5"/><path d="M8.5 19H15a3.5 3.5 0 0 0 0-7H9a3.5 3.5 0 0 1 0-7h6.5"/>'),
    Filter: svgIcon('<path d="M4 5h16l-6 8v5l-4 2v-7z"/>'),
    Time: svgIcon('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>')
  };
  document.querySelectorAll('#region .box').forEach(box => {
    const b = box.querySelector('b'); if (!b) return;
    const key = b.textContent.trim();
    const rest = box.textContent.replace(key, '').trim();
    box.innerHTML = `<span class="rg-ico">${regionIcons[key] || ''}</span><span class="rg-txt"><b>${key}</b><span>${rest}</span></span><span class="rg-chev" aria-hidden="true">›</span>`;
  });

  document.querySelectorAll('#region .box').forEach(box => {
    const sheen = document.createElement('span'); sheen.className = 'rg-sheen'; sheen.setAttribute('aria-hidden', 'true');
    box.appendChild(sheen);
  });
  // cursor glow: track the pointer inside the hovered card only
  document.querySelectorAll('#region .box, #prox .tile').forEach(el => {
    el.addEventListener('pointermove', e => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--gx', `${(e.clientX - r.left).toFixed(0)}px`);
      el.style.setProperty('--gy', `${(e.clientY - r.top).toFixed(0)}px`);
    }, { passive: true });
  });

  // 6. Closure: an activity-style ring with gradient and an arrival state
  const closure = document.getElementById('closure-demo');
  if (closure) {
    const note = closure.querySelector('p');
    closure.innerHTML = `
      <div class="ring-wrap">
        <svg viewBox="0 0 140 140" aria-hidden="true">
          <defs>
            <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e2453b"/><stop offset="1" stop-color="#780000"/></linearGradient>
            <linearGradient id="ringGradOk" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4fae84"/><stop offset="1" stop-color="#2c6650"/></linearGradient>
          </defs>
          <circle class="ring-track" cx="70" cy="70" r="54"/>
          <circle class="ring-prog" cx="70" cy="70" r="54" pathLength="100"/>
        </svg>
        <div class="ring-center"><b class="rc-open">7<small>min</small></b><b class="rc-done">Arrived</b></div>
      </div>
      <div class="ring-copy"><b>Library <i>→</i> Food Court</b><span>530 m · 5 steps</span>${note ? `<p>${note.textContent}</p>` : ''}</div>`;
  }

  // 8. Focal point: give the main action an arrow
  const mainBtn = document.querySelector('#focal .fbtn.main');
  if (mainBtn) mainBtn.innerHTML = `<span class="fb-label">${mainBtn.textContent.trim()}</span><span class="fb-arrow" aria-hidden="true"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8h10M9 4l4 4-4 4"/></svg></span><span class="fb-sheen" aria-hidden="true"></span>`;

  // Map demos (similarity, common fate, figure-ground, continuity): use the 3D campus render
  window.RaastaBaseMap && window.RaastaBaseMap().then(url => {
    document.querySelectorAll('.crop svg image').forEach(im => im.setAttribute('href', url));
    document.querySelectorAll('#sim-grid, #fate-row').forEach(el => {
      const stage = el.closest('.demo-stage');
      if (stage) { stage.classList.add('map-stage-bg'); stage.style.setProperty('--map-bg', `url("${url}")`); }
    });
  }).catch(() => {});

  // crop pins: refined A / B badges
  document.querySelectorAll('.crop svg').forEach(svg => {
    const circles = svg.querySelectorAll('circle');
    circles.forEach((c, i) => {
      const x = c.getAttribute('cx'), y = c.getAttribute('cy');
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('class', `crop-pin ${i === 0 ? 'a' : 'b'}`);
      g.setAttribute('transform', `translate(${x} ${y})`);
      g.innerHTML = `<circle r="15" class="halo"/><circle r="11"/><text dy="4" text-anchor="middle">${i === 0 ? 'A' : 'B'}</text>`;
      c.replaceWith(g);
    });
  });
})();

/* ---------- home: live mini map in the scrolling band ---------- */
(() => {
  const svg = document.getElementById('band-map');
  if (!svg || typeof RouteCore === 'undefined') return;
  const C = Site.C;
  const band = svg.closest('.marquee-band');
  const nameEl = document.getElementById('band-route-name');
  const routeBox = document.getElementById('band-route');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const routes = (C.popularRoutes || []).map(r => RouteCore.route(r.from, r.to)).filter(Boolean);
  if (!routes.length) return;

  // Frame the card around every popular route (kept at the card's 4:3 shape)
  {
    const pts = routes.flatMap(r => r.points.concat([[r.from.x, r.from.y], [r.to.x, r.to.y]]));
    const pad = 46;
    let x0 = Math.min(...pts.map(p => p[0])) - pad, x1 = Math.max(...pts.map(p => p[0])) + pad;
    let y0 = Math.min(...pts.map(p => p[1])) - pad, y1 = Math.max(...pts.map(p => p[1])) + pad;
    let w = x1 - x0, h = y1 - y0;
    if (w / h > 4 / 3) { const nh = w * 3 / 4; y0 -= (nh - h) / 2; h = nh; } else { const nw = h * 4 / 3; x0 -= (nw - w) / 2; w = nw; }
    svg.setAttribute('viewBox', `${Math.round(x0)} ${Math.round(y0)} ${Math.round(w)} ${Math.round(h)}`);
  }

  const pin = (p, letter, cls) =>
    `<g class="band-pin ${cls}" transform="translate(${p.x} ${p.y})"><circle r="13"/><text dy="4.5" text-anchor="middle">${letter}</text></g>`;

  svg.innerHTML = Site.roadsMarkup() +
    `<g class="band-places">${C.places.map(p => `<circle cx="${p.x}" cy="${p.y}" r="4.5" style="fill:${C.categories[p.cat].color}"/>`).join('')}</g>` +
    `<path class="band-halo" id="band-halo"/><path class="band-line" id="band-line" pathLength="1"/><g id="band-pins"></g>`;
  const halo = svg.querySelector('#band-halo');
  const line = svg.querySelector('#band-line');
  const pins = svg.querySelector('#band-pins');

  let i = 0, timer = null;
  const show = r => {
    const d = Site.pathD(r.points);
    svg.classList.remove('is-drawn');
    routeBox.classList.add('is-changing');
    setTimeout(() => {
      halo.setAttribute('d', d);
      line.setAttribute('d', d);
      pins.innerHTML = pin(r.from, 'A', 'from') + pin(r.to, 'B', 'to');
      nameEl.textContent = `${r.from.name} to ${r.to.name}`;
      routeBox.classList.remove('is-changing');
      // next frame so the line draws in from 0
      requestAnimationFrame(() => requestAnimationFrame(() => svg.classList.add('is-drawn')));
    }, reduce ? 0 : 450);
  };
  const next = () => { show(routes[i % routes.length]); i++; };

  next();
  if (reduce) return;

  const start = () => { if (!timer) timer = setInterval(next, 5200); };
  const stop = () => { clearInterval(timer); timer = null; };
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => (e.isIntersecting ? start() : stop()), { threshold: 0.2 }).observe(band);
  } else start();

  // Gentle parallax: the two text rows drift apart as you scroll past
  const rows = band.querySelectorAll('.marquee-row');
  const card = band.querySelector('.marquee-card');
  let ticking = false, near = true;
  // rows and card are moved one by one (no inherited variables), so the
  // band's contents never need restyling while you scroll
  const onScroll = () => {
    if (ticking || !near) return;
    ticking = true;
    requestAnimationFrame(() => {
      const r = band.getBoundingClientRect();
      const t = Math.max(-1.5, Math.min(1.5, (r.top + r.height / 2 - innerHeight / 2) / innerHeight));
      rows.forEach((row, k) => { row.style.translate = `${((k ? -1 : 1) * t * 90).toFixed(1)}px 0`; });
      if (card) card.style.rotate = `${(-t * 3).toFixed(2)}deg`;
      ticking = false;
    });
  };
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => { near = e.isIntersecting; if (near) onScroll(); }, { rootMargin: '30% 0px' }).observe(band);
  }
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();
})();

/* ---------- Home hero: premium cursor (tail + reveal lens) ----------
   - A fluid, tapered tail follows the pointer (drawn on one small canvas).
   - Over the headline/intro, a lens opens and reveals a hidden twin of the
     text (different words, reversed colours), perfectly aligned.
   - Over buttons the head becomes a soft ring; over the map card the normal
     cursor returns.
   Performance: the lens and its content only ever move with transforms
   (no repaints), the tail is one canvas path, and the loop sleeps when idle.
   Mouse only; off for touch screens and reduced motion. */
(() => {
  const hero = document.querySelector('.hero-pro');
  if (!hero) return;
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const inner = hero.querySelector('.hp-inner');
  if (!inner) return;

  /* ---- lens with the hidden twin ---- */
  const R = 160;                                    // lens radius (px)
  const lens = document.createElement('div');
  lens.className = 'hp-lens';
  lens.setAttribute('aria-hidden', 'true');
  lens.style.width = lens.style.height = `${R * 2}px`;
  const lensIn = document.createElement('div');
  lensIn.className = 'hp-lens-in';
  const twin = inner.cloneNode(true);
  twin.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));
  twin.querySelectorAll('a, button').forEach(el => el.setAttribute('tabindex', '-1'));
  const h1 = twin.querySelector('h1');
  if (h1) h1.innerHTML = 'Every block,<br><em>one clear path.</em>';
  const lead = twin.querySelector('.hp-lead');
  if (lead) lead.textContent = 'No more asking strangers where Block 9 is. Raasta turns a confusing campus into one calm line you can simply follow.';
  const badgeTxt = twin.querySelector('.hp-badge span:nth-child(2)');
  if (badgeTxt) badgeTxt.textContent = 'Made for first-years · UPES';
  lensIn.appendChild(twin);
  lens.appendChild(lensIn);
  hero.appendChild(lens);

  const sizeTwin = () => {
    lensIn.style.width = `${hero.clientWidth}px`;
    lensIn.style.height = `${hero.clientHeight}px`;
  };
  sizeTwin();

  /* ---- tail canvas ---- */
  const cv = document.createElement('canvas');
  cv.className = 'hp-trail';
  hero.appendChild(cv);
  const ctx = cv.getContext('2d');
  let dpr = 1, W = 0, H = 0;
  const sizeCanvas = () => {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = hero.clientWidth; H = hero.clientHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    cv.style.width = `${W}px`; cv.style.height = `${H}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  sizeCanvas();
  window.addEventListener('resize', () => { sizeCanvas(); sizeTwin(); kick(); }, { passive: true });

  hero.classList.add('has-cursor');

  /* ---- state ---- */
  const N = 26;                                     // tail points
  const pts = Array.from({ length: N }, () => ({ x: -200, y: -200 }));
  let mx = -200, my = -200, hx = -200, hy = -200;   // pointer / head
  let inside = false;
  // eased targets
  let lensS = 0, lensT = 0;        // lens scale 0..1
  let headR = 5, headRT = 5;       // head dot radius
  let ringA = 0, ringAT = 0;       // ring opacity (over buttons)
  let tailA = 0, tailAT = 0;       // tail opacity
  let onDark = 0, onDarkT = 0;     // 1 = tail drawn in cream (over the red lens)
  let raf = null, last = performance.now();

  // the hero text slides in on load; open the lens only once it has settled,
  // so the hidden twin always lines up exactly
  let introDone = false;
  setTimeout(() => { introDone = true; }, 1700);

  // the lens opens only over the words themselves (their line boxes), not the
  // empty width of the headline and intro blocks
  let textBoxes = null;
  const measureText = () => {
    const hr = hero.getBoundingClientRect();
    textBoxes = [];
    hero.querySelectorAll('.hp-copy h1, .hp-copy .hp-lead').forEach(el => {
      if (el.closest('.hp-lens')) return;
      const range = document.createRange();
      range.selectNodeContents(el);
      [...range.getClientRects()].forEach(r => {
        if (r.width < 2 || r.height < 2) return;
        textBoxes.push({ l: r.left - hr.left - 12, t: r.top - hr.top - 6, r: r.right - hr.left + 12, b: r.bottom - hr.top + 6 });
      });
    });
  };
  window.addEventListener('resize', () => { textBoxes = null; }, { passive: true });
  setTimeout(() => { textBoxes = null; }, 1750);
  const overWords = () => {
    if (!textBoxes) measureText();
    return textBoxes.some(b => mx >= b.l && mx <= b.r && my >= b.t && my <= b.b);
  };

  const zone = el => {
    if (!el || !el.closest) return 'none';
    if (el.closest('.hp-device')) return 'card';
    if (el.closest('a, button')) return 'action';
    if (overWords()) return 'text';
    if (el.closest('a, button')) return 'action';
    return 'free';
  };
  const decide = el => {
    const z = inside ? zone(el) : 'none';
    // the site-wide trail now draws the tail and manages the system cursor
    lensT = (z === 'text' && introDone) ? 1 : 0;
    hero.dataset.lens = lensT ? 'on' : '';
    tailAT = 0;   // tail is drawn by the site-wide trail
    headRT = z === 'text' ? 0 : z === 'action' ? 3 : 5;
    ringAT = z === 'action' ? 1 : 0;
    onDarkT = z === 'text' ? 1 : 0;
  };

  const mix = (a, b, t) => Math.round(a + (b - a) * t);

  const frame = now => {
    const dt = Math.max(0, Math.min(48, now - last)) / 16.667;   // 1 = one 60fps frame
    last = now;
    const k = (base) => 1 - Math.pow(1 - base, dt);  // frame-rate independent easing

    hx += (mx - hx) * k(0.42); hy += (my - hy) * k(0.42);
    pts[0].x = hx; pts[0].y = hy;
    for (let i = 1; i < N; i++) {
      const p = pts[i], q = pts[i - 1];
      p.x += (q.x - p.x) * k(0.5); p.y += (q.y - p.y) * k(0.5);
    }
    // self-heal: if anything ever throws the trail far off, snap it back to the pointer
    if (!Number.isFinite(hx) || !Number.isFinite(hy) || Math.abs(hx - mx) > 4000 || Math.abs(hy - my) > 4000) { hx = mx; hy = my; }
    if (pts.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y) || Math.abs(p.x - hx) > 1600 || Math.abs(p.y - hy) > 1600)) pts.forEach(p => { p.x = hx; p.y = hy; });
    lensS += (lensT - lensS) * k(0.16);
    headR += (headRT - headR) * k(0.25);
    ringA += (ringAT - ringA) * k(0.2);
    tailA += (tailAT - tailA) * k(0.18);
    onDark += (onDarkT - onDark) * k(0.2);

    /* lens: outer moves + scales, inner counter-moves so text stays aligned */
    if (lensS > 0.003) {
      const s = Math.max(lensS, 0.003);
      lens.style.visibility = 'visible';
      lens.style.transform = `translate3d(${(hx - R).toFixed(2)}px, ${(hy - R).toFixed(2)}px, 0) scale(${s.toFixed(4)})`;
      lensIn.style.transform = `translate3d(${(R - hx / s).toFixed(2)}px, ${(R - hy / s).toFixed(2)}px, 0) scale(${(1 / s).toFixed(4)})`;
    } else {
      lens.style.visibility = 'hidden';
    }

    /* tail: tapered ribbon, fades along its length */
    ctx.clearRect(0, 0, W, H);
    if (tailA > 0.01) {
      const r = mix(120, 253, onDark), g = mix(0, 240, onDark), b = mix(0, 213, onDark);
      drawTrailRibbon(ctx, pts, 10, r, g, b, tailA);
      // head
      if (headR > 0.3) {
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${tailA.toFixed(3)})`;
        ctx.beginPath(); ctx.arc(hx, hy, headR, 0, Math.PI * 2); ctx.fill();
      }
      // soft ring over buttons
      if (ringA > 0.01) {
        ctx.strokeStyle = `rgba(0, 48, 73, ${(ringA * 0.55).toFixed(3)})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(hx, hy, 18 + ringA * 6, 0, Math.PI * 2); ctx.stroke();
      }
    }

    // sleep when everything has settled
    const tail = pts[N - 1];
    const still = Math.abs(mx - tail.x) < 0.15 && Math.abs(my - tail.y) < 0.15 &&
      Math.abs(lensT - lensS) < 0.002 && Math.abs(headRT - headR) < 0.02 &&
      Math.abs(ringAT - ringA) < 0.005 && Math.abs(tailAT - tailA) < 0.005 && Math.abs(onDarkT - onDark) < 0.005;
    raf = still ? null : schedule(frame);
  };
  // next frame, with a timer fallback where animation frames are paused
  const schedule = fn => {
    let done = false;
    const id = requestAnimationFrame(t => { done = true; fn(t); });
    setTimeout(() => { if (!done) { cancelAnimationFrame(id); fn(performance.now()); } }, 50);
    return id || 1;
  };
  const kick = () => { if (!raf) { last = performance.now(); raf = schedule(frame); } };

  /* ---- input ---- */
  let rect = hero.getBoundingClientRect();
  const refreshRect = () => { rect = hero.getBoundingClientRect(); };
  window.addEventListener('scroll', refreshRect, { passive: true });
  window.addEventListener('resize', refreshRect, { passive: true });

  hero.addEventListener('pointermove', e => {
    mx = e.clientX - rect.left; my = e.clientY - rect.top;
    if (!inside) {
      inside = true; refreshRect();
      mx = e.clientX - rect.left; my = e.clientY - rect.top;
      hx = mx; hy = my; pts.forEach(p => { p.x = mx; p.y = my; });
    }
    decide(e.target);
    kick();
  }, { passive: true });
  hero.addEventListener('pointerleave', () => { inside = false; decide(null); kick(); });
  hero.addEventListener('pointerdown', () => { headRT = headRT * 0.6; kick(); });
  hero.addEventListener('pointerup', e => { decide(e.target); kick(); });
})();

/* ---------- Gestalt map demos: a realistic map card ----------
   Upgrades the figure-ground and continuity crops into a maps-app view:
   warm lighting and vignette, a casing + shadow route, real pins with name
   labels, an ETA card, compass and scale bar. Figure-ground dims everything
   except a soft corridor around the route; continuity sends a walker along
   the line once it has drawn itself. */
(() => {
  const crops = document.querySelectorAll('.crop');
  if (!crops.length || typeof RouteCore === 'undefined') return;
  const NS = 'http://www.w3.org/2000/svg';
  const C = Site.C;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

  crops.forEach((el, n) => {
    const svg = el.querySelector('svg');
    const line = svg && svg.querySelector('.route-line');
    if (!line) return;
    const r = RouteCore.route(el.dataset.from, el.dataset.to);
    if (!r) return;
    const [x0, y0, w, h] = svg.getAttribute('viewBox').trim().split(/\s+/).map(Number);
    const d = line.getAttribute('d');
    const id = `cm${n}`;
    const upp = w / (el.clientWidth || 640);          // map units per screen pixel
    el.classList.add('cm');

    // old circle pins are replaced by HTML pins below
    svg.querySelectorAll('.crop-pin, circle').forEach(c => c.remove());

    const defs = document.createElementNS(NS, 'defs');
    defs.innerHTML = `
      <radialGradient id="${id}-light" cx="20%" cy="10%" r="100%">
        <stop offset="0" stop-color="#fff7e6" stop-opacity=".32"/>
        <stop offset=".5" stop-color="#fff7e6" stop-opacity="0"/>
        <stop offset="1" stop-color="#3a2810" stop-opacity=".24"/>
      </radialGradient>
      <filter id="${id}-soft" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="${(18 * upp).toFixed(2)}"/></filter>
      <filter id="${id}-shadow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="${(3 * upp).toFixed(2)}"/></filter>
      <mask id="${id}-focus" maskUnits="userSpaceOnUse" x="${x0 - w}" y="${y0 - h}" width="${w * 3}" height="${h * 3}">
        <rect x="${x0 - w}" y="${y0 - h}" width="${w * 3}" height="${h * 3}" fill="#fff"/>
        <path d="${d}" fill="none" stroke="#000" stroke-width="${(70 * upp).toFixed(1)}" stroke-linecap="round" stroke-linejoin="round" filter="url(#${id}-soft)"/>
      </mask>`;
    svg.prepend(defs);

    // dimming keeps a clear corridor around the route
    const veil = svg.querySelector('.veil-rect');
    if (veil) veil.setAttribute('mask', `url(#${id}-focus)`);

    // lighting + vignette sit above the map, below the route
    const light = document.createElementNS(NS, 'rect');
    light.setAttribute('class', 'cm-light');
    ['x', 'y', 'width', 'height'].forEach((k, i) => light.setAttribute(k, [x0, y0, w, h][i]));
    light.setAttribute('fill', `url(#${id}-light)`);
    const halo = svg.querySelector('.route-halo');
    svg.insertBefore(light, halo);

    // route: soft shadow under a white casing, casing draws with the line
    const shadow = document.createElementNS(NS, 'path');
    shadow.setAttribute('class', 'route-shadow');
    shadow.setAttribute('d', d);
    shadow.setAttribute('transform', `translate(0 ${(3 * upp).toFixed(2)})`);
    shadow.setAttribute('filter', `url(#${id}-shadow)`);
    shadow.setAttribute('pathLength', '1');
    svg.insertBefore(shadow, halo);
    halo.setAttribute('pathLength', '1');
    halo.style.strokeWidth = `${(11 * upp).toFixed(2)}`;
    line.style.strokeWidth = `${(5.5 * upp).toFixed(2)}`;
    shadow.style.strokeWidth = `${(13 * upp).toFixed(2)}`;
    const flow = svg.querySelector('.route-flow');
    if (flow) { flow.style.strokeWidth = `${(1.8 * upp).toFixed(2)}`; flow.style.strokeDasharray = `${(2 * upp).toFixed(2)} ${(10 * upp).toFixed(2)}`; }

    // the svg and the pins move together when the cursor pans the map
    const world = document.createElement('div');
    world.className = 'crop-world';
    el.insertBefore(world, svg);
    world.appendChild(svg);

    const pos = p => `left:${((p.x - x0) / w * 100).toFixed(2)}%;top:${((p.y - y0) / h * 100).toFixed(2)}%`;
    const side = p => ((p.x - x0) / w > 0.66 ? ' left' : '');
    world.insertAdjacentHTML('beforeend', `
      <div class="cm-pin a${side(r.from)}" style="${pos(r.from)}"><span class="cm-dot"><i>A</i></span><span class="cm-label">${esc(r.from.name)}</span></div>
      <div class="cm-pin b${side(r.to)}" style="${pos(r.to)}">
        <span class="cm-ground"></span>
        <span class="cm-drop"><svg viewBox="0 0 28 38" aria-hidden="true"><path d="M14 36.5s12-12.3 12-22.3A12 12 0 0 0 2 14.2c0 10 12 22.3 12 22.3z"/><circle cx="14" cy="14" r="5"/></svg></span>
        <span class="cm-label">${esc(r.to.name)}</span>
      </div>`);

    // map furniture
    const scalePx = Math.round(100 / (C.metersPerPx || 1) / upp);
    el.insertAdjacentHTML('beforeend', `
      <div class="cm-hud" aria-hidden="true">
        <div class="cm-eta">
          <span class="cm-walk"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13" cy="4" r="2"/><path d="M10.5 21l2-6.5 3 3V22M8 12l2.5-4.5L14 9l2 3.5 2.5 1M10.5 7.5 9 14"/></svg></span>
          <span class="cm-eta-txt"><b>${r.minutes} min walk</b><small>${r.meters} m · ${r.steps.length} steps</small></span>
        </div>
        <div class="cm-compass"><svg viewBox="0 0 24 24"><path d="M12 3l3.2 9H8.8z" fill="#c1121f"/><path d="M12 21l-3.2-9h6.4z" fill="rgba(0,48,73,.35)"/></svg><b>N</b></div>
        <div class="cm-scale"><i style="width:${Math.max(24, Math.min(120, scalePx))}px"></i><span>100 m</span></div>
        <div class="cm-attr">Raasta Maps · UPES Bidholi</div>
      </div>`);

    // continuity: a walker follows the line after it has drawn
    if (el.id === 'cont-crop') {
      const tmp = document.createElementNS(NS, 'path');
      tmp.setAttribute('d', d);
      const len = tmp.getTotalLength ? (svg.appendChild(tmp), tmp.getTotalLength()) : w;
      tmp.remove();
      const dur = Math.max(3.5, Math.min(7, len / (w / 4.2)));
      const g = document.createElementNS(NS, 'g');
      g.setAttribute('class', 'crop-walker');
      g.innerHTML = `
        <circle class="wk-pulse" r="${(13 * upp).toFixed(2)}"/>
        <circle class="wk-dot" r="${(6 * upp).toFixed(2)}" stroke-width="${(2.5 * upp).toFixed(2)}"/>
        <animateMotion dur="${dur.toFixed(2)}s" begin="indefinite" repeatCount="indefinite" path="${d}" calcMode="spline" keyTimes="0;1" keySplines="0.45 0 0.55 1"/>`;
      svg.appendChild(g);
      const motion = g.querySelector('animateMotion');
      let timer = null;
      const startWalk = () => {
        el.classList.remove('walking');
        clearTimeout(timer);
        if (reduce || !motion.beginElement) return;
        timer = setTimeout(() => { el.classList.add('walking'); motion.beginElement(); }, 1850);
      };
      startWalk();
      const btn = document.getElementById('cont-btn');
      if (btn) btn.addEventListener('click', startWalk);
    }
  });
})();

/* ---------- Gestalt page: cursor-driven demo interactions ----------
   Inside each demo canvas:
   - a soft light follows the cursor;
   - nearby items lean towards the cursor, lift and gain shadow, fading with
     distance (magnetic depth);
   - in the Proximity demo, the whole group nearest the cursor lifts together;
   - map demos pan gently, the closure ring tilts in 3D.
   Transforms only (no repaints), eased every frame, sleeps when idle.
   Mouse only; off for touch screens and reduced motion. */
(() => {
  if (!document.querySelector('[data-demo]')) return;
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const stages = [...document.querySelectorAll('.demo-stage')];
  const items = new Map();            // element -> state
  const stageState = new Map();

  const itemsOf = stage =>
    [...stage.querySelectorAll('.prox .tile, .sim-grid .pin, .fate-row .pin, .region-demo .box, .focal-demo .fbtn, .ring-wrap')];

  stages.forEach(stage => {
    const light = document.createElement('div');
    light.className = 'stage-light';
    stage.appendChild(light);
    stageState.set(stage, { light, x: 0, y: 0, tx: 0, ty: 0, on: 0, onT: 0, w: 1, h: 1 });
    const crop = stage.querySelector('.crop .crop-world, .crop svg');
    if (crop) stageState.get(stage).crop = crop;
  });

  // items are (re)collected lazily, because some demos build their content in script
  const collect = stage => itemsOf(stage).forEach(el => {
    if (!items.has(el)) items.set(el, { stage, x: 0, y: 0, s: 0, rx: 0, ry: 0, tx: 0, ty: 0, ts: 0, trx: 0, try_: 0, usesIndividual: el.classList.contains('pin') });
  });

  let mouse = { x: 0, y: 0 }, active = null, raf = null, last = performance.now();

  const target = () => {
    items.forEach(st => { st.tx = 0; st.ty = 0; st.ts = 0; st.trx = 0; st.try_ = 0; });
    stageState.forEach(ss => { ss.onT = 0; });
    document.querySelectorAll('.prox .grp.grp-hot').forEach(g => g.classList.remove('grp-hot'));
    if (!active) return;
    const ss = stageState.get(active);
    const b = active.getBoundingClientRect();
    ss.w = b.width; ss.h = b.height;
    ss.tx = mouse.x - b.left; ss.ty = mouse.y - b.top; ss.onT = 1;
    let nearest = null, nd = Infinity;
    items.forEach((st, el) => {
      if (st.stage !== active) return;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const dx = mouse.x - cx, dy = mouse.y - cy;
      const d = Math.hypot(dx, dy);
      const reach = Math.max(120, Math.max(r.width, r.height) * 1.6);
      const f = Math.max(0, 1 - d / reach);                   // 0 far .. 1 on top
      const isBtn = el.classList.contains('fbtn');
      const pull = el.classList.contains('ring-wrap') ? 0 : isBtn ? 4 : 7;
      st.tx = (dx / (d || 1)) * pull * f * Math.min(1, d / 30);
      st.ty = (dy / (d || 1)) * pull * f * Math.min(1, d / 30);
      st.ts = f;
      const tilt = el.classList.contains('ring-wrap') ? 16 : isBtn ? 2.5 : 8;
      st.try_ = Math.max(-1, Math.min(1, dx / (r.width / 2 + 40))) * tilt * Math.max(f, el.classList.contains('ring-wrap') ? 0.6 : 0);
      st.trx = -Math.max(-1, Math.min(1, dy / (r.height / 2 + 40))) * tilt * Math.max(f, el.classList.contains('ring-wrap') ? 0.6 : 0);
      if (d < nd) { nd = d; nearest = el; }
    });
    // Proximity: the group nearest the cursor lifts together
    if (nearest && nearest.classList.contains('tile') && nd < 160) nearest.closest('.grp')?.classList.add('grp-hot');
  };

  const frame = now => {
    const dt = Math.max(0, Math.min(48, now - last)) / 16.667; last = now;
    const k = b => 1 - Math.pow(1 - b, dt);
    let moving = false;
    stageState.forEach(ss => {
      ss.x += (ss.tx - ss.x) * k(0.2); ss.y += (ss.ty - ss.y) * k(0.2);
      ss.on += (ss.onT - ss.on) * k(0.12);
      ss.light.style.transform = `translate3d(${ss.x.toFixed(1)}px, ${ss.y.toFixed(1)}px, 0)`;
      ss.light.style.opacity = ss.on.toFixed(3);
      if (ss.crop) {
        const px = ss.w ? (ss.x / ss.w - .5) : 0, py = ss.h ? (ss.y / ss.h - .5) : 0;
        ss.crop.style.transform = `scale(${(1 + 0.06 * ss.on).toFixed(4)}) translate3d(${(-px * 14 * ss.on).toFixed(2)}px, ${(-py * 10 * ss.on).toFixed(2)}px, 0)`;
      }
      if (Math.abs(ss.tx - ss.x) > .1 || Math.abs(ss.ty - ss.y) > .1 || Math.abs(ss.onT - ss.on) > .002) moving = true;
    });
    items.forEach((st, el) => {
      st.x += (st.tx - st.x) * k(0.16); st.y += (st.ty - st.y) * k(0.16);
      st.s += (st.ts - st.s) * k(0.14);
      st.rx += (st.trx - st.rx) * k(0.14); st.ry += (st.try_ - st.ry) * k(0.14);
      if (st.usesIndividual) {
        // pins already use transform for their own effects; compose via individual properties
        el.style.translate = `${st.x.toFixed(2)}px ${(st.y - st.s * 5).toFixed(2)}px`;
        el.style.scale = (1 + st.s * 0.14).toFixed(4);
      } else {
        el.style.transform = `perspective(700px) translate3d(${st.x.toFixed(2)}px, ${(st.y - st.s * 4).toFixed(2)}px, 0) rotateX(${st.rx.toFixed(2)}deg) rotateY(${st.ry.toFixed(2)}deg) scale(${(1 + st.s * 0.035).toFixed(4)})`;
      }
      el.style.setProperty('--lift', st.s.toFixed(3));
      if (Math.abs(st.tx - st.x) > .05 || Math.abs(st.ty - st.y) > .05 || Math.abs(st.ts - st.s) > .003 ||
          Math.abs(st.trx - st.rx) > .05 || Math.abs(st.try_ - st.ry) > .05) moving = true;
    });
    raf = moving ? schedule(frame) : null;
  };
  const schedule = fn => {
    let done = false;
    const id = requestAnimationFrame(t => { done = true; fn(t); });
    setTimeout(() => { if (!done) { cancelAnimationFrame(id); fn(performance.now()); } }, 50);
    return id || 1;
  };
  const kick = () => { if (!raf) { last = performance.now(); raf = schedule(frame); } };

  let queued = false;
  stages.forEach(stage => {
    stage.addEventListener('pointerenter', () => { collect(stage); active = stage; });
    stage.addEventListener('pointermove', e => {
      mouse.x = e.clientX; mouse.y = e.clientY; active = stage;
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => { queued = false; target(); kick(); });
      setTimeout(() => { if (queued) { queued = false; target(); kick(); } }, 60);
    }, { passive: true });
    stage.addEventListener('pointerleave', () => { if (active === stage) active = null; target(); kick(); });
  });
  let scrollQ = false;
  window.addEventListener('scroll', () => {
    if (!active || scrollQ) return;
    scrollQ = true;
    requestAnimationFrame(() => { scrollQ = false; if (active) { target(); kick(); } });
  }, { passive: true });
})();

/* ---------- Site-wide cursor trail ----------
   One fixed canvas draws a tapered ribbon that follows the pointer on every
   page. It replaces the system cursor over text and empty space, becomes a
   soft ring over links and buttons, turns cream over dark areas and the hero
   lens, and hands the normal cursor back over maps, fields and dialogs.
   Mouse only; off for touch screens and reduced motion. Sleeps when idle. */
(() => {
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const root = document.documentElement;

  const cv = document.createElement('canvas');
  cv.className = 'site-trail';
  cv.setAttribute('aria-hidden', 'true');
  document.body.appendChild(cv);
  const ctx = cv.getContext('2d');
  let dpr = 1, W = 0, H = 0;
  const size = () => {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    cv.style.width = `${W}px`; cv.style.height = `${H}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  size();
  window.addEventListener('resize', () => { size(); kick(); }, { passive: true });
  root.classList.add('trail-on');

  const N = 26;
  const pts = Array.from({ length: N }, () => ({ x: -200, y: -200 }));
  let mx = -200, my = -200, hx = -200, hy = -200, inside = false;
  let headR = 5, headRT = 5, ringA = 0, ringAT = 0, tailA = 0, tailAT = 0, cream = 0, creamT = 0;
  let raf = null, last = performance.now();
  const lens = () => document.querySelector('.hp-lens');

  const NATIVE = 'input, textarea, select, [contenteditable="true"], .map-wrap, .hp-device, .place-editor, .combobox-listbox, dialog, .nav.open';
  const ACTION = 'a, button, [role="button"], [role="tab"], label, summary, .chip, .popular-chip, .route-card';
  const DARK = '.site-footer, .block.dark, .cta-band, .toast-msg, .hp-lens';

  const decide = el => {
    if (!inside || !el || !el.closest) { tailAT = 0; ringAT = 0; root.classList.remove('cursor-none'); return; }
    if (el.closest(NATIVE)) { tailAT = 0; ringAT = 0; root.classList.remove('cursor-none'); return; }
    root.classList.add('cursor-none');
    tailAT = 1;
    const overLensText = !!el.closest('.hero-pro[data-lens="on"]');
    const isAction = !!el.closest(ACTION);
    headRT = overLensText ? 0 : isAction ? 3 : 5;
    ringAT = isAction && !overLensText ? 1 : 0;
    creamT = (el.closest(DARK) || overLensText) ? 1 : 0;
  };

  const mix = (a, b, t) => Math.round(a + (b - a) * t);
  const frame = now => {
    const dt = Math.max(0, Math.min(48, now - last)) / 16.667; last = now;
    const k = base => 1 - Math.pow(1 - base, dt);
    hx += (mx - hx) * k(0.42); hy += (my - hy) * k(0.42);
    pts[0].x = hx; pts[0].y = hy;
    for (let i = 1; i < N; i++) { const p = pts[i], q = pts[i - 1]; p.x += (q.x - p.x) * k(0.5); p.y += (q.y - p.y) * k(0.5); }
    // self-heal: if anything ever throws the trail far off, snap it back to the pointer
    if (!Number.isFinite(hx) || !Number.isFinite(hy) || Math.abs(hx - mx) > 4000 || Math.abs(hy - my) > 4000) { hx = mx; hy = my; }
    if (pts.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y) || Math.abs(p.x - hx) > 1600 || Math.abs(p.y - hy) > 1600)) pts.forEach(p => { p.x = hx; p.y = hy; });
    headR += (headRT - headR) * k(0.25);
    ringA += (ringAT - ringA) * k(0.2);
    tailA += (tailAT - tailA) * k(0.18);
    // over the hero lens the tail follows the lens colour
    const L = lens();
    const lensOpen = L && L.style.visibility === 'visible' ? 1 : 0;
    cream += (Math.max(creamT, lensOpen) - cream) * k(0.2);

    ctx.clearRect(0, 0, W, H);
    if (tailA > 0.01) {
      const r = mix(120, 253, cream), g = mix(0, 240, cream), b = mix(0, 213, cream);
      drawTrailRibbon(ctx, pts, 10, r, g, b, tailA);
      if (headR > 0.3) {
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${tailA.toFixed(3)})`;
        ctx.beginPath(); ctx.arc(hx, hy, headR, 0, Math.PI * 2); ctx.fill();
      }
      if (ringA > 0.01) {
        const rr = mix(0, 253, cream), rg = mix(48, 240, cream), rb = mix(73, 213, cream);
        ctx.strokeStyle = `rgba(${rr}, ${rg}, ${rb}, ${(ringA * tailA * 0.6).toFixed(3)})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(hx, hy, 18 + ringA * 6, 0, Math.PI * 2); ctx.stroke();
      }
    }
    const tail = pts[N - 1];
    const still = Math.abs(mx - tail.x) < 0.15 && Math.abs(my - tail.y) < 0.15 &&
      Math.abs(headRT - headR) < 0.02 && Math.abs(ringAT - ringA) < 0.005 && Math.abs(tailAT - tailA) < 0.005 &&
      Math.abs(Math.max(creamT, lensOpen) - cream) < 0.005;
    raf = still ? null : schedule(frame);
  };
  const schedule = fn => {
    let done = false;
    const id = requestAnimationFrame(t => { done = true; fn(t); });
    setTimeout(() => { if (!done) { cancelAnimationFrame(id); fn(performance.now()); } }, 50);
    return id || 1;
  };
  const kick = () => { if (!raf) { last = performance.now(); raf = schedule(frame); } };

  document.addEventListener('pointermove', e => {
    if (e.pointerType && e.pointerType !== 'mouse') return;
    mx = e.clientX; my = e.clientY;
    if (!inside) { inside = true; hx = mx; hy = my; pts.forEach(p => { p.x = mx; p.y = my; }); }
    decide(e.target);
    kick();
  }, { passive: true });
  document.addEventListener('pointerdown', () => { headRT *= 0.6; kick(); }, { passive: true });
  document.addEventListener('pointerup', e => { decide(e.target); kick(); }, { passive: true });
  document.documentElement.addEventListener('mouseleave', () => { inside = false; decide(null); kick(); });
  window.addEventListener('blur', () => { inside = false; decide(null); kick(); });
  // scrolling moves content under a still pointer: re-check what is underneath
  let scrollQ = false;
  window.addEventListener('scroll', () => {
    if (!inside || scrollQ) return;
    scrollQ = true;
    requestAnimationFrame(() => { scrollQ = false; if (inside) { decide(document.elementFromPoint(mx, my)); kick(); } });
  }, { passive: true });
})();

/* ---------- Gestalt demo action buttons: premium press + label roll ----------
   Each demo button keeps its own click handler, which simply swaps the text.
   We watch for that swap and turn it into a choreographed change: the old
   label rolls up and out, the new one rolls in from below, a sheen passes,
   and a soft cream ripple spreads from the exact point you pressed. */
(() => {
  const btns = document.querySelectorAll('.demo-actions .btn');
  if (!btns.length) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

  btns.forEach(b => {
    let current = b.textContent.trim();
    let cleanup = null;
    const ripples = new Set();                         // kept alive across label swaps
    const mo = new MutationObserver(() => {
      if (b.querySelector('.ab-roll')) return;            // our own markup
      const next = b.textContent.trim();
      render(next, next !== current && !reduce ? current : null);
      current = next;
    });
    const render = (txt, prev) => {
      mo.disconnect();
      clearTimeout(cleanup);
      b.setAttribute('aria-label', txt);
      b.innerHTML = `<span class="ab-roll" aria-hidden="true">${prev ? `<span class="ab-old">${esc(prev)}</span>` : ''}<span class="ab-new">${esc(txt)}</span></span><span class="ab-shine" aria-hidden="true"></span>`;
      ripples.forEach(dot => b.prepend(dot));
      if (prev) {
        b.classList.remove('ab-swap');
        void b.offsetWidth;
        b.classList.add('ab-swap');
        cleanup = setTimeout(() => {
          mo.disconnect();
          const old = b.querySelector('.ab-old');
          if (old) old.remove();
          b.classList.remove('ab-swap');
          mo.observe(b, { childList: true });
        }, 900);
      }
      mo.observe(b, { childList: true });
    };
    render(current, null);

    // ripple from the press point
    b.addEventListener('pointerdown', e => {
      if (reduce || !b.animate) return;
      const r = b.getBoundingClientRect();
      const size = Math.hypot(r.width, r.height) * 2;
      const dot = document.createElement('span');
      dot.className = 'ab-ripple';
      dot.setAttribute('aria-hidden', 'true');
      dot.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - r.left - size / 2}px;top:${e.clientY - r.top - size / 2}px`;
      b.prepend(dot);
      ripples.add(dot);
      dot.animate([
        { transform: 'scale(0)', opacity: 0.55 },
        { transform: 'scale(1)', opacity: 0 }
      ], { duration: 900, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'forwards' }).onfinish = () => { ripples.delete(dot); dot.remove(); };
    });
  });
})();

/* ---------- Gestalt closure demo: premium arrival ring ----------
   A watch-style ring: engraved track, bezel ticks, a gradient arc with a
   polished end cap. Completing it counts the minutes down, sweeps the arc
   closed, blends it to navy and draws an "Arrived" check. It draws itself
   in the first time it scrolls into view. */
(() => {
  const host = document.getElementById('closure-demo');
  if (!host) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const OPEN = 78, MIN = 7, R = 62, CX = 90;

  const ticks = Array.from({ length: 60 }, (_, i) => {
    const a = i / 60 * Math.PI * 2, major = i % 5 === 0;
    const r1 = major ? 79 : 80.5, r2 = 84;
    const p = (r, f) => (CX + Math.cos(a) * r).toFixed(2) + ' ' + (CX + Math.sin(a) * r).toFixed(2);
    return `<path class="${major ? 'maj' : ''}" d="M${p(r1)}L${p(r2)}"/>`;
  }).join('');
  const steps = Array.from({ length: 5 }, (_, i) => `<i style="--i:${i}"></i>`).join('');

  host.classList.add('ar');
  host.innerHTML = `
    <div class="ar-dial">
      <span class="ar-glow" aria-hidden="true"></span>
      <svg viewBox="0 0 180 180" aria-hidden="true">
        <defs>
          <linearGradient id="arOpen" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e0433b"/><stop offset=".55" stop-color="#b3141f"/><stop offset="1" stop-color="#780000"/></linearGradient>
          <linearGradient id="arDone" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#003049"/><stop offset=".6" stop-color="#1f5f84"/><stop offset="1" stop-color="#669bbc"/></linearGradient>
          <filter id="arCapShadow" x="-60%" y="-60%" width="220%" height="220%"><feDropShadow dx="0" dy="1.5" stdDeviation="1.6" flood-color="#3a0a0a" flood-opacity=".45"/></filter>
        </defs>
        <g class="ar-ticks">${ticks}</g>
        <circle class="ar-groove" cx="${CX}" cy="${CX}" r="${R}"/>
        <circle class="ar-groove-in" cx="${CX}" cy="${CX}" r="${R - 7.5}"/>
        <circle class="ar-groove-out" cx="${CX}" cy="${CX}" r="${R + 7.5}"/>
        <g class="ar-rot">
          <circle class="ar-arc open" cx="${CX}" cy="${CX}" r="${R}" pathLength="100"/>
          <circle class="ar-arc done" cx="${CX}" cy="${CX}" r="${R}" pathLength="100"/>
          <g class="ar-cap"><circle cx="${CX + R}" cy="${CX}" r="5.2" filter="url(#arCapShadow)"/></g>
        </g>
      </svg>
      <div class="ar-center">
        <div class="ar-open"><b class="ar-num">${MIN}</b><small>min left</small></div>
        <div class="ar-done">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10.5" pathLength="1"/><path d="M7.5 12.4l3 3 6-6.6" pathLength="1"/></svg>
          <b>Arrived</b>
        </div>
      </div>
    </div>
    <div class="ar-copy">
      <span class="ar-chip"><span class="ar-live"></span><span class="ar-chip-t">On route</span></span>
      <b class="ar-title">Library <i>→</i> Food Court</b>
      <span class="ar-meta">530 m · 5 steps</span>
      <span class="ar-steps" aria-hidden="true">${steps}</span>
      <p>The ring has a gap, but you still read it as a circle.</p>
    </div>`;

  const num = host.querySelector('.ar-num');
  const chipT = host.querySelector('.ar-chip-t');
  let raf = null;
  const count = (from, to, ms) => {
    cancelAnimationFrame(raf);
    if (reduce) { num.textContent = to; return; }
    const t0 = performance.now();
    const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    const step = now => {
      const t = Math.min(1, (now - t0) / ms);
      num.textContent = Math.round(from + (to - from) * ease(t));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  };

  // draw in on first view
  host.classList.add('ar-idle');
  const reveal = () => { host.classList.remove('ar-idle'); };
  if ('IntersectionObserver' in window && !reduce) {
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setTimeout(reveal, 150); io.disconnect(); } }, { threshold: 0.4 });
    io.observe(host);
  } else reveal();

  // the demo's own handler toggles .closed; follow it
  let wasClosed = false;
  new MutationObserver(() => {
    const closed = host.classList.contains('closed');
    if (closed === wasClosed) return;            // ignore our own class changes
    wasClosed = closed;
    if (host.classList.contains('ar-idle')) host.classList.remove('ar-idle');
    chipT.textContent = closed ? 'Arrived' : 'On route';
    if (closed) count(Number(num.textContent) || MIN, 0, 1300);
    else count(0, MIN, 900);
  }).observe(host, { attributes: true, attributeFilter: ['class'], attributeOldValue: false });
})();

/* ---------- Gestalt common fate demo: map markers that move as one ----------
   Pins become real markers placed over the campus. Picking a type lifts that
   group together in one synced float, links them with a soft dashed line and
   names the group; the rest sink back. The filter shows only the types on
   the map, each with a count. */
(() => {
  const row = document.getElementById('fate-row');
  const chips = document.getElementById('fate-chips');
  if (!row || !chips) return;
  const C = Site.C;
  const spots = [[12, 30], [27, 62], [40, 24], [55, 52], [68, 22], [82, 46], [20, 80], [47, 82], [74, 76], [90, 18]];
  const pins = [...row.querySelectorAll('.pin')];
  row.classList.add('fm-row');
  pins.forEach((p, i) => {
    const [x, y] = spots[i % spots.length];
    const m = document.createElement('span');
    m.className = 'fm';
    m.dataset.cat = p.dataset.cat;
    m.style.left = `${x}%`; m.style.top = `${y}%`;
    m.style.setProperty('--d', `${(i % 5) * 0.04}s`);
    p.replaceWith(m);
    m.innerHTML = '<span class="fm-shadow"></span><span class="fm-stem"></span>';
    m.appendChild(p);
  });
  const svgNS = 'http://www.w3.org/2000/svg';
  const link = document.createElementNS(svgNS, 'svg');
  link.setAttribute('class', 'fm-link');
  link.setAttribute('viewBox', '0 0 100 100');
  link.setAttribute('preserveAspectRatio', 'none');
  link.innerHTML = '<path vector-effect="non-scaling-stroke"/>';
  row.prepend(link);
  const tag = document.createElement('span');
  tag.className = 'fm-tag';
  tag.setAttribute('aria-live', 'polite');
  row.appendChild(tag);

  // filter: only types on the map, each with a count
  const counts = {};
  pins.forEach(p => { counts[p.dataset.cat] = (counts[p.dataset.cat] || 0) + 1; });
  chips.classList.add('fm-chips');
  chips.querySelectorAll('.chip').forEach(ch => {
    const n = counts[ch.dataset.cat] || 0;
    if (!n) { ch.remove(); return; }
    ch.insertAdjacentHTML('beforeend', `<em class="fm-count">${n}</em>`);
  });

  const update = () => {
    const pressed = chips.querySelector('.chip[aria-pressed="true"]');
    const cat = pressed ? pressed.dataset.cat : null;
    const group = cat ? [...row.querySelectorAll(`.fm[data-cat="${cat}"]`)] : [];
    row.querySelectorAll('.fm').forEach(m => m.classList.toggle('hit', group.includes(m)));
    row.classList.toggle('fm-on', !!cat);
    // dashed link through the group, left to right
    const pts = group.map(m => [parseFloat(m.style.left), parseFloat(m.style.top) - 9]).sort((a, b) => a[0] - b[0]);
    link.querySelector('path').setAttribute('d', pts.length > 1 ? pts.map((p, i) => `${i ? 'L' : 'M'}${p[0]} ${p[1]}`).join(' ') : '');
    if (cat) {
      const c = C.categories[cat];
      tag.innerHTML = `<i style="background:${c.color}"></i>${group.length} ${c.label.toLowerCase()} place${group.length === 1 ? '' : 's'}`;
    }
  };
  // the shared filter handler runs first; read its result right after
  chips.addEventListener('click', update);
  update();
})();

/* ---------- Footer: premium layout + cursor-reactive wordmark ----------
   Adds a closing call to action, link columns and a bottom bar, and turns
   the giant RAASTA into an outlined wordmark that fills with cream light
   under the cursor (a moving lens, transform only) while nearby letters
   rise. Mouse only for the light; static and solid on touch screens. */
(() => {
  const footer = document.querySelector('.site-footer');
  if (!footer || footer.classList.contains('ft')) return;
  footer.classList.add('ft');
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const arrow = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4"/></svg>';
  const up = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 13V3M4 7l4-4 4 4"/></svg>';

  // the original intro block becomes link columns
  const intro = footer.querySelector(':scope > .wrap:not(.footer-credits)');
  if (intro) intro.classList.add('ft-old');

  const cta = document.createElement('div');
  cta.className = 'wrap ft-cta ft-r';
  cta.innerHTML = `
    <div class="ft-cta-copy">
      <span class="ft-eyebrow"><i></i>Raasta · Designing for Perception</span>
    </div>
    <div class="ft-cta-act">
      <a class="ft-btn ft-mag" href="wayfinder.html"><span class="ft-btn-l">Find a route</span><b><i class="ar1">${arrow}</i><i class="ar2">${arrow}</i></b><span class="ft-sheen" aria-hidden="true"></span></a>
      <button class="ft-top ft-mag" type="button" aria-label="Back to top"><span class="ft-top-in"><i class="ar1">${up}</i><i class="ar2">${up}</i></span></button>
    </div>`;
  const cols = document.createElement('div');
  cols.className = 'wrap ft-cols ft-r';
  cols.innerHTML = `
    <nav class="ft-col" aria-label="Explore"><span class="micro">Explore</span>
      <a href="index.html">Home</a><a href="places.html">Places</a><a href="wayfinder.html">Find a route</a></nav>
    <nav class="ft-col" aria-label="Learn"><span class="micro">Learn</span>
      <a href="gestalt.html">Gestalt principles</a><a href="process.html">Design process</a></nav>
    <div class="ft-col ft-note"><span class="micro">About this project</span>
      <p>A Gestalt principles web assignment. Not an official UPES product.</p>
      <p>The map is a simplified drawing. Distances are estimates.</p></div>`;
  footer.prepend(cta);
  const credits = footer.querySelector('.footer-credits');
  if (credits) { credits.classList.add('ft-r'); credits.after(cols); }   // link columns close the footer
  else footer.appendChild(cols);

  // wordmark: a simple solid RAASTA; letters glow as the cursor trail nears them.
  let mark = footer.querySelector('.footer-wordmark');
  if (mark) mark.remove();
  const stage = document.createElement('div');
  stage.className = 'wrap fw-stage fw-aurora';
  stage.setAttribute('aria-hidden', 'true');
  // RAASTA, one <span> per letter so each can react on its own
  // drop shadow like After Effects: a soft cast shadow + a tight contact shadow,
  // each drawn once and only moved
  const sh = cls => `<div class="au-word rg-shadow ${cls}">${[...'RAASTA'].map(ch => `<span class="rg-s">${ch}</span>`).join('')}</div>`;
  stage.innerHTML = `${sh('cast')}${sh('contact')}<div class="au-word au-main rg-word">RAASTA</div>` +
    `<div class="au-word rg-hi">${[...'RAASTA'].map(ch => `<span class="rg-h">${ch}</span>`).join('')}</div>`;
  const rgWord = stage.querySelector('.rg-word');
  rgWord.innerHTML = [...rgWord.textContent].map(ch => `<span class="au-l rg-l" data-ch="${ch}">${ch}</span>`).join('');
  footer.prepend(stage);                         // the wordmark opens the footer

  const bar = document.createElement('div');
  bar.className = 'wrap ft-bar';
  bar.innerHTML = `<span>© ${new Date().getFullYear()} Hardik Kumar · Raasta</span><span class="ft-made"><i></i>Made at UPES, Dehradun</span>`;
  footer.appendChild(bar);

  // fit the word to the content width
  const words = [...stage.querySelectorAll('.au-word')];
  const fitWord = () => {
    const cs = getComputedStyle(stage);
    const target = stage.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
    const w = stage.querySelector('.au-main');
    w.style.fontSize = '100px'; w.style.display = 'inline-block';
    const natural = w.getBoundingClientRect().width || 1;
    w.style.display = '';
    const size = Math.max(48, target / natural * 100 * 0.985);
    words.forEach(el => { el.style.fontSize = `${size.toFixed(1)}px`; });
  };
  fitWord();
  window.addEventListener('resize', fitWord, { passive: true });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitWord);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => stage.classList.toggle('au-paused', !e.isIntersecting)).observe(stage);
  }

  document.querySelector('.ft-top').addEventListener('click', () => window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' }));

  // reveal in order as the footer scrolls in
  if ('IntersectionObserver' in window && !reduce) {
    footer.classList.add('ft-wait');
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { footer.classList.add('ft-in'); io.disconnect(); } }, { threshold: 0.12 });
    io.observe(footer);
  }

  if (!fine || reduce) { stage.classList.add('fw-static'); return; }

  // magnetic buttons
  footer.querySelectorAll('.ft-mag').forEach(btn => {
    btn.addEventListener('pointermove', e => {
      const r = btn.getBoundingClientRect();
      btn.style.translate = `${((e.clientX - r.left - r.width / 2) * 0.18).toFixed(1)}px ${((e.clientY - r.top - r.height / 2) * 0.24).toFixed(1)}px`;
    });
    btn.addEventListener('pointerleave', () => { btn.style.translate = ''; });
  });

  // Realistic physical letters. A trail point chases the pointer (LERP 0.08).
  // The cursor acts as a light and a viewpoint: the word tilts in 3D towards
  // it, the satin highlight on each letter face follows it, the shadows fall
  // away from it, and the letters nearest it lift off the surface.
  // Positions are measured only on enter / resize / scroll, never in the loop.
  const letters = [...stage.querySelectorAll('.rg-l')];
  const highs = [...stage.querySelectorAll('.rg-h')];
  const hiRow = stage.querySelector('.rg-hi');
  const contact = stage.querySelector('.rg-shadow.contact');
  const RADIUS = 300, EASE = 0.08;
  let centers = [], mx = 0, my = 0, tx = 0, ty = 0, active = false, raf = null, last = 0, on = 0;
  const cast = stage.querySelector('.rg-shadow.cast');
  let wordC = [0, 0, 1, 1], sx = 0, sy = 0;
  const lift = letters.map(() => 0);
  const measure = () => {
    const wr = rgWord.getBoundingClientRect();
    wordC = [wr.left + wr.width / 2 + window.scrollX, wr.top + wr.height / 2 + window.scrollY, wr.width, wr.height];
    centers = letters.map(l => {
      const r = l.getBoundingClientRect();
      return [r.left + r.width / 2 + window.scrollX, r.top + r.height / 2 + window.scrollY, r.width, r.height];
    });
  };
  const loop = now => {
    const dt = Math.max(0, Math.min(48, now - last)) / 16.667; last = now;
    const k = 1 - Math.pow(1 - EASE, dt);
    tx += (mx - tx) * k; ty += (my - ty) * k;
    on += ((active ? 1 : 0) - on) * k;
    let moving = Math.abs(mx - tx) > 0.3 || Math.abs(my - ty) > 0.3 || Math.abs((active ? 1 : 0) - on) > .002;
    const tsx = active ? Math.max(-1, Math.min(1, (wordC[0] - tx) / (wordC[2] * 0.6))) : 0;
    const tsy = active ? Math.max(-1, Math.min(1, (wordC[1] - ty) / (wordC[3] * 1.5))) : 0;
    sx += (tsx - sx) * k; sy += (tsy - sy) * k;
    if (Math.abs(tsx - sx) > .002 || Math.abs(tsy - sy) > .002) moving = true;
    // 3D tilt towards the cursor (same transform on every layer)
    const tilt = `perspective(1800px) rotateX(${(-sy * 5).toFixed(3)}deg) rotateY(${(sx * 7).toFixed(3)}deg)`;
    rgWord.style.transform = tilt;
    hiRow.style.transform = tilt;
    contact.style.transform = `${tilt} translate3d(7px, 9px, 0)`;
    cast.style.transform = `${tilt} translate3d(${(18 + sx * 26).toFixed(2)}px, ${(24 + sy * 14).toFixed(2)}px, 0)`;
    hiRow.style.opacity = (0.25 + on * 0.75).toFixed(3);
    letters.forEach((l, i) => {
      const c = centers[i];
      let target = 0;
      if (active && c) {
        const d = Math.hypot(c[0] - tx, c[1] - ty);
        const t = Math.max(0, 1 - d / RADIUS);
        target = t * t * (3 - 2 * t);
        // the highlight sits where the light falls on this letter's face
        highs[i].style.setProperty('--lx', `${((tx - (c[0] - c[2] / 2)) / c[2] * 100).toFixed(1)}%`);
        highs[i].style.setProperty('--ly', `${((ty - (c[1] - c[3] / 2)) / c[3] * 100).toFixed(1)}%`);
      }
      lift[i] += (target - lift[i]) * (1 - Math.pow(1 - 0.14, dt));
      if (Math.abs(target - lift[i]) > 0.002) moving = true;
      const t = `translate3d(0, ${(-lift[i] * 8).toFixed(2)}px, 0)`;
      l.style.transform = t; highs[i].style.transform = t;
    });
    raf = moving ? requestAnimationFrame(loop) : null;
  };
  const kick = () => { if (!raf) { last = performance.now(); raf = requestAnimationFrame(loop); } };
  const zone = footer;                     // the glow responds anywhere near the word
  zone.addEventListener('pointerenter', e => {
    measure(); active = true;
    mx = e.pageX; my = e.pageY;
    if (!raf) { tx = mx; ty = my; }
    kick();
  });
  zone.addEventListener('pointermove', e => { mx = e.pageX; my = e.pageY; active = true; kick(); }, { passive: true });
  zone.addEventListener('pointerleave', () => { active = false; kick(); });
  window.addEventListener('resize', () => { measure(); kick(); }, { passive: true });
  window.addEventListener('scroll', () => { if (active) { measure(); kick(); } }, { passive: true });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
})();

/* ---------- Find a route: directions bar interactions ----------
   A soft light follows the cursor across the bar, the swap coin leans
   towards the cursor and turns when pressed. Transform only; mouse only. */
(() => {
  const bar = document.querySelector('.planner-bar');
  if (!bar) return;
  const swap = bar.querySelector('.pb-swap');
  if (swap) swap.addEventListener('click', () => { swap.classList.toggle('spin'); });
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const holder = bar.querySelector('.pb-light');
  const spot = document.createElement('i');
  holder.appendChild(spot);
  let mx = 0, my = 0, x = 0, y = 0, on = 0, onT = 0, raf = null, last = 0, rect = bar.getBoundingClientRect();
  const frame = now => {
    const dt = Math.max(0, Math.min(48, now - last)) / 16.667; last = now;
    const k = b => 1 - Math.pow(1 - b, dt);
    x += (mx - x) * k(0.18); y += (my - y) * k(0.18); on += (onT - on) * k(0.12);
    spot.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
    spot.style.opacity = on.toFixed(3);
    raf = (Math.abs(mx - x) > .3 || Math.abs(my - y) > .3 || Math.abs(onT - on) > .003) ? requestAnimationFrame(frame) : null;
  };
  const kick = () => { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } };
  bar.addEventListener('pointerenter', e => { rect = bar.getBoundingClientRect(); x = mx = e.clientX - rect.left; y = my = e.clientY - rect.top; onT = 1; kick(); });
  bar.addEventListener('pointermove', e => { mx = e.clientX - rect.left; my = e.clientY - rect.top; kick(); }, { passive: true });
  bar.addEventListener('pointerleave', () => { onT = 0; kick(); });
  window.addEventListener('scroll', () => { rect = bar.getBoundingClientRect(); }, { passive: true });

  if (swap) {
    swap.addEventListener('pointermove', e => {
      const r = swap.getBoundingClientRect();
      swap.style.translate = `${((e.clientX - r.left - r.width / 2) * 0.25).toFixed(1)}px ${((e.clientY - r.top - r.height / 2) * 0.25).toFixed(1)}px`;
    });
    swap.addEventListener('pointerleave', () => { swap.style.translate = ''; });
  }
})();

/* ---------- Find a route: keep the planner and the whole map on one screen ----------
   Measures where the map starts on the page and gives it exactly the height
   that is left in the window (desktop only; phones scroll naturally). */
(() => {
  const v2 = document.querySelector('.finder-v2');
  const wrap = v2 && v2.querySelector('.map-wrap');
  if (!wrap) return;
  const note = v2.querySelector('.map-note');
  const card = v2.querySelector('.map-card');
  const fit = () => {
    if (window.innerWidth <= 900 || document.documentElement.classList.contains('map-expanded')) { v2.style.removeProperty('--map-avail'); v2.style.removeProperty('--map-w'); return; }
    const top = wrap.getBoundingClientRect().top + window.scrollY;
    const below = (note ? note.offsetHeight + 8 : 0) + (card ? parseFloat(getComputedStyle(card).paddingBottom) || 0 : 0) + 16;
    const avail = Math.max(340, window.innerHeight - top - below);
    const maxW = v2.clientWidth - 2 * (card ? parseFloat(getComputedStyle(card).paddingLeft) || 0 : 0) - 2;
    v2.style.setProperty('--map-avail', `${Math.round(avail)}px`);
    v2.style.setProperty('--map-w', `${Math.round(Math.min(maxW, avail * 1.3823))}px`);
  };
  fit();
  window.addEventListener('resize', fit, { passive: true });
  window.addEventListener('load', fit);
  // full-screen map on/off (button, F key or Escape) changes the layout without a resize
  const refit = () => setTimeout(fit, 60);
  document.getElementById('map-expand')?.addEventListener('click', refit);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' || e.key === 'f' || e.key === 'F') refit(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
})();

/* ---------- Find a route: popular routes dropdown ---------- */
(() => {
  const bar = document.querySelector('.planner-bar');
  const btn = document.getElementById('pb-pop-btn');
  const pop = document.getElementById('pb-pop');
  if (!bar || !btn || !pop) return;
  const set = open => { bar.classList.toggle('pop-open', open); btn.setAttribute('aria-expanded', String(open)); };
  btn.addEventListener('click', e => { e.stopPropagation(); set(!bar.classList.contains('pop-open')); });
  pop.addEventListener('click', e => { if (e.target.closest('.popular-chip')) set(false); });
  document.addEventListener('click', e => { if (!e.target.closest('#pb-pop, #pb-pop-btn')) set(false); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && bar.classList.contains('pop-open')) { set(false); btn.focus(); } });
  // the map tip lives in the map's tooltip on desktop
  const note = document.querySelector('.finder-v2 .map-note');
  const map = document.getElementById('map');
  if (note && map) map.title = note.textContent.trim();
})();

/* ---------- Design process: wireframes draw their routes in view ---------- */
(() => {
  const cards = document.querySelectorAll('.wf');
  if (!cards.length || !('IntersectionObserver' in window)) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  cards.forEach(c => c.classList.add('wf-wait'));
  const io = new IntersectionObserver(entries => entries.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('wf-in'); e.target.classList.remove('wf-wait'); io.unobserve(e.target); }
  }), { threshold: 0.35 });
  cards.forEach(c => io.observe(c));
})();

/* ---------- Design process: sticky contents rail ----------
   Built from the existing section links. A glass pill glides (spring) to the
   section you are reading and follows the cursor while you hover the list;
   a hairline track fills with reading progress and each step's dot fills as
   it is passed. Desktop only; smaller screens keep the chip row. */
(() => {
  const nav = document.querySelector('.process-nav');
  const sections = [...document.querySelectorAll('main .p-section[id]')];
  if (!nav || sections.length < 3) return;
  const wrap = sections[0].parentElement;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // layout: rail | content
  const layout = document.createElement('div');
  layout.className = 'pn-layout';
  const content = document.createElement('div');
  content.className = 'pn-content';
  wrap.insertBefore(layout, sections[0]);
  layout.appendChild(content);
  sections.forEach(s => content.appendChild(s));
  const links = [...nav.querySelectorAll('a')];
  const items = links.map((a, i) => ({ id: a.getAttribute('href').slice(1), label: a.textContent.trim(), n: String(i + 1).padStart(2, '0') }))
    .filter(it => document.getElementById(it.id));
  const rail = document.createElement('aside');
  rail.className = 'pn-rail';
  rail.setAttribute('aria-label', 'Design process contents');
  rail.innerHTML = `
    <div class="pn-head"><span>Contents</span><b class="pn-pct">0%</b></div>
    <div class="pn-body">
      <span class="pn-track" aria-hidden="true"><i class="pn-fill"></i></span>
      <span class="pn-pill" aria-hidden="true"></span>
      <ol class="pn-list">${items.map(it => `<li><a href="#${it.id}" data-id="${it.id}"><span class="pn-dot"></span><span class="pn-n">${it.n}</span><span class="pn-t">${it.label}</span></a></li>`).join('')}</ol>
    </div>
    <div class="pn-foot">
      <a class="pn-next" href="#"><small>Up next</small><b class="pn-next-t"></b><i aria-hidden="true">→</i></a>
      <button class="pn-top" type="button" aria-label="Back to top">↑</button>
    </div>`;
  layout.prepend(rail);
  document.body.classList.add('has-pn-rail');

  const as = [...rail.querySelectorAll('.pn-list a')];
  const pill = rail.querySelector('.pn-pill'), fill = rail.querySelector('.pn-fill'), pct = rail.querySelector('.pn-pct');
  const body = rail.querySelector('.pn-body');
  const nextA = rail.querySelector('.pn-next'), nextT = rail.querySelector('.pn-next-t');
  nextA.addEventListener('click', e => { e.preventDefault(); const k = Number(nextA.dataset.idx); if (as[k]) as[k].click(); });
  rail.querySelector('.pn-top').addEventListener('click', () => window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' }));

  // spring-driven pill (position + height), frame-rate independent
  let py = 0, ph = 40, vy = 0, vh = 0, ty = 0, th = 40, raf = null, last = 0, activeIdx = 0, hoverIdx = -1;
  const target = i => { const a = as[i]; if (!a) return; ty = a.offsetTop; th = a.offsetHeight; kick(); };
  const step = now => {
    const dt = Math.max(0, Math.min(32, now - last)) / 1000; last = now;
    const K = 260, D = 26;                          // stiffness, damping
    const ay = K * (ty - py) - D * vy, ah = K * (th - ph) - D * vh;
    vy += ay * dt; vh += ah * dt; py += vy * dt; ph += vh * dt;
    pill.style.transform = `translate3d(0, ${py.toFixed(2)}px, 0)`;
    pill.style.height = `${ph.toFixed(2)}px`;
    const moving = Math.abs(ty - py) > .2 || Math.abs(vy) > .2 || Math.abs(th - ph) > .2 || Math.abs(vh) > .2;
    raf = moving ? requestAnimationFrame(step) : null;
  };
  const kick = () => {
    if (reduce) { py = ty; ph = th; pill.style.transform = `translate3d(0, ${py}px, 0)`; pill.style.height = `${ph}px`; return; }
    if (!raf) { last = performance.now(); raf = requestAnimationFrame(step); }
  };
  const setActive = i => {
    if (!as[i] || (i === activeIdx && as[i].classList.contains('on'))) return;
    activeIdx = i;
    as.forEach((a, j) => { a.classList.toggle('on', j === i); a.classList.toggle('done', j < i); a.setAttribute('aria-current', j === i ? 'true' : 'false'); });
    const nx = items[i + 1];
    nextA.classList.toggle('pn-last', !nx);
    if (nx) { nextT.textContent = nx.label; nextA.href = `#${nx.id}`; nextA.dataset.idx = i + 1; }
    else { nextT.textContent = 'You reached the end'; nextA.removeAttribute('data-idx'); }
    if (hoverIdx < 0) target(i);
  };

  // hover: the pill follows the cursor between items, then returns
  as.forEach((a, i) => {
    a.addEventListener('pointerenter', () => { hoverIdx = i; rail.classList.add('pn-hovering'); target(i); });
    a.addEventListener('click', e => {
      const el = document.getElementById(a.dataset.id);
      if (!el) return;
      e.preventDefault();
      const top = el.getBoundingClientRect().top + window.scrollY - 96;
      window.scrollTo({ top, behavior: reduce ? 'auto' : 'smooth' });
      history.replaceState(null, '', `#${a.dataset.id}`);
      setActive(i);
    });
  });
  body.addEventListener('pointerleave', () => { hoverIdx = -1; rail.classList.remove('pn-hovering'); target(activeIdx); });

  // which section is being read + reading progress (once per frame)
  let queued = false;
  const update = () => {
    queued = false;
    const mid = window.innerHeight * 0.38;
    let idx = 0;
    sections.forEach((s, i) => { if (s.getBoundingClientRect().top - mid <= 0) idx = i; });
    const map = items.findIndex(it => it.id === sections[idx].id);
    setActive(Math.max(0, map));
    const r = content.getBoundingClientRect();
    const p = Math.max(0, Math.min(1, (window.innerHeight * 0.38 - r.top) / Math.max(1, r.height - window.innerHeight * 0.4)));
    fill.style.transform = `scaleY(${p.toFixed(4)})`;
    pct.textContent = `${Math.round(p * 100)}%`;
  };
  const onScroll = () => { if (!queued) { queued = true; requestAnimationFrame(update); } };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', () => { onScroll(); target(hoverIdx >= 0 ? hoverIdx : activeIdx); }, { passive: true });
  update();
  py = ty; ph = th;                                  // start in place, no slide on load
  target(activeIdx);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => target(activeIdx));
})();

/* ---------- Smooth wheel scrolling (every page) ----------
   Mouse-wheel steps become one eased glide (like premium sites). It steps
   aside whenever something else wants the wheel: the map (zoom), dropdowns,
   dialogs, inner scroll areas, pinch/ctrl zoom, and for reduced motion and
   touch devices, which already scroll smoothly. */
(() => {
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const root = document.documentElement;
  let target = window.scrollY, current = window.scrollY, raf = null, driving = false, last = 0;
  const maxY = () => root.scrollHeight - window.innerHeight;
  const SKIP = '.map-wrap, .combobox-listbox, dialog, textarea, select, .nearest-results, [data-native-scroll]';
  const innerScrollable = (el, dy) => {
    for (let n = el; n && n !== document.body && n !== root; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (/(auto|scroll)/.test(cs.overflowY) && n.scrollHeight > n.clientHeight + 1) {
        if ((dy > 0 && n.scrollTop + n.clientHeight < n.scrollHeight - 1) || (dy < 0 && n.scrollTop > 0)) return true;
      }
    }
    return false;
  };
  const frame = now => {
    const dt = Math.max(0, Math.min(48, now - last)) / 16.667; last = now;
    current += (target - current) * (1 - Math.pow(1 - 0.12, dt));
    if (Math.abs(target - current) < 0.5) { current = target; driving = false; }
    window.scrollTo({ top: current, behavior: 'instant' });
    raf = driving ? requestAnimationFrame(frame) : null;
  };
  window.addEventListener('wheel', e => {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    if (e.target.closest && e.target.closest(SKIP)) return;
    if (innerScrollable(e.target, e.deltaY)) return;
    e.preventDefault();
    const dy = e.deltaMode === 1 ? e.deltaY * 40 : e.deltaMode === 2 ? e.deltaY * window.innerHeight : e.deltaY;
    if (!driving) { current = window.scrollY; target = current; }
    target = Math.max(0, Math.min(maxY(), target + dy));
    driving = true;
    if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
  }, { passive: false });
  // keyboard, scrollbar, links and scripts keep their own scrolling
  window.addEventListener('scroll', () => { if (!driving) { current = target = window.scrollY; } }, { passive: true });
  ['keydown', 'pointerdown'].forEach(t => window.addEventListener(t, () => { if (driving) { driving = false; target = current = window.scrollY; } }, { passive: true }));
})();

/* ---------- Find a route: cards below the map float in ---------- */
(() => {
  const cards = [...document.querySelectorAll('.finder-below .fb-result, .finder-below .fb-card')];
  if (!cards.length || !('IntersectionObserver' in window)) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  cards.forEach((c, i) => {
    if (c.getBoundingClientRect().top < window.innerHeight) return;    // already visible: leave it
    c.classList.add('fb-in-wait');
    c.style.transitionDelay = `${(i % 3) * 0.12}s`;
  });
  const io = new IntersectionObserver(entries => entries.forEach(e => {
    if (!e.isIntersecting) return;
    e.target.classList.add('fb-in-go'); e.target.classList.remove('fb-in-wait'); io.unobserve(e.target);
  }), { rootMargin: '0px 0px -10% 0px', threshold: 0.12 });
  cards.forEach(c => c.classList.contains('fb-in-wait') && io.observe(c));
})();
