/*
  Raasta place editor: a hidden tool for adding new places to the map.

  Open the route page with #add-places at the end of the address:
    wayfinder.html#add-places
  Click an empty spot on the map, fill in the name and type, press "Add place".
  New places are saved in this browser, show on the map and work for routes
  straight away. Press "Copy code" and paste the lines into the `places`
  list in js/data.js (or send them to whoever maintains the site) to make
  them permanent for everyone.

  Must load after data.js and before route-core.js.
*/
(() => {
  if (typeof CAMPUS === 'undefined') return;
  if (!/^#add-places$/i.test(location.hash) && !/[?&]edit\b/.test(location.search)) return;

  const C = CAMPUS;
  const STORE = 'raasta-draft-places';
  const SIDES = { r: 'Right', l: 'Left', t: 'Above', b: 'Below' };

  const load = () => { try { return JSON.parse(localStorage.getItem(STORE)) || []; } catch (_) { return []; } };
  const save = list => { try { localStorage.setItem(STORE, JSON.stringify(list)); } catch (_) {} };
  let drafts = load().filter(d => d && d.id && C.nodes[d.node] && C.categories[d.cat]);

  // Add saved drafts to the campus data before the route engine reads it
  const known = new Set(C.places.map(p => p.id));
  drafts.forEach(d => { if (!known.has(d.id)) { C.places.push(Object.assign({ draft: true }, d)); known.add(d.id); } });

  const slug = name => {
    let base = name.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 24) || 'place';
    let id = base, n = 2;
    while (known.has(id)) id = `${base}_${n++}`;
    return id;
  };

  const nearestNode = (x, y) => {
    let best = null, bestD = Infinity;
    for (const [id, [nx, ny]] of Object.entries(C.nodes)) {
      const d = Math.hypot(nx - x, ny - y);
      if (d < bestD) { bestD = d; best = id; }
    }
    return { id: best, dist: Math.round(bestD) };
  };

  const roadName = nodeId => {
    const e = C.edges.find(e => e[0] === nodeId || e[1] === nodeId);
    return e ? e[2] : 'road';
  };

  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const q = s => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

  const codeFor = list => list.map(d =>
    `    { id: ${q(d.id)}, name: ${q(d.name)}, cat: ${q(d.cat)}, x: ${d.x}, y: ${d.y}, node: ${q(d.node)}, side: ${q(d.side)}, aliases: [${d.aliases.map(q).join(', ')}] },`
  ).join('\n');

  document.addEventListener('DOMContentLoaded', () => {
    const mapEl = document.getElementById('map');
    const stageEl = document.getElementById('map-stage');
    const markersEl = document.getElementById('markers');
    if (!mapEl || !stageEl || !markersEl) return;

    document.body.classList.add('editing-places');

    /* ---------- panel ---------- */
    const panel = document.createElement('aside');
    panel.className = 'place-editor';
    panel.setAttribute('aria-label', 'Add places to the map');
    panel.innerHTML = `
      <div class="pe-head">
        <span class="micro">Edit mode</span>
        <h2>Add places</h2>
        <button type="button" class="pe-min" aria-expanded="true" aria-label="Minimise editor">–</button>
      </div>
      <div class="pe-body">
        <p class="pe-step" id="pe-hint"><strong>1.</strong> Click an empty spot on the map where the building is. Zoom in first for accuracy.</p>
        <form class="pe-form" id="pe-form" hidden>
          <p class="pe-pos" id="pe-pos"></p>
          <label>Name <input id="pe-name" required maxlength="60" placeholder="e.g. Medical Centre" autocomplete="off"></label>
          <label>Type
            <select id="pe-cat">${Object.entries(C.categories).map(([k, c]) => `<option value="${k}">${esc(c.label)} (${esc(c.code)})</option>`).join('')}</select>
          </label>
          <label>Label position
            <select id="pe-side">${Object.entries(SIDES).map(([k, v]) => `<option value="${k}">${v} of pin</option>`).join('')}</select>
          </label>
          <label>Other names people search for <input id="pe-aliases" placeholder="e.g. hospital, doctor, clinic" autocomplete="off"></label>
          <div class="pe-row">
            <button type="submit" class="btn btn-primary btn-small">Add place</button>
            <button type="button" class="btn btn-ghost btn-small" id="pe-cancel">Cancel</button>
          </div>
        </form>
        <div class="pe-list-wrap">
          <p class="micro pe-count" id="pe-count"></p>
          <ul class="pe-list" id="pe-list"></ul>
        </div>
        <div class="pe-out" id="pe-out" hidden>
          <p class="pe-step"><strong>2.</strong> Copy this code and paste it into the <code>places</code> list in <code>js/data.js</code> to make the places permanent.</p>
          <textarea id="pe-code" rows="5" readonly spellcheck="false" aria-label="Code for the new places"></textarea>
          <div class="pe-row">
            <button type="button" class="btn btn-primary btn-small" id="pe-copy">Copy code</button>
            <button type="button" class="btn btn-ghost btn-small" id="pe-reload">Reload to test routes</button>
            <button type="button" class="btn btn-ghost btn-small" id="pe-clear">Remove all</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(panel);

    const $ = id => panel.querySelector('#' + id);
    const form = $('pe-form');
    let pending = null;

    /* ---------- pins ---------- */
    const ghost = document.createElement('span');
    ghost.className = 'marker pe-ghost';
    ghost.hidden = true;
    ghost.innerHTML = '<span class="pe-crosshair" aria-hidden="true"></span>';
    markersEl.appendChild(ghost);

    const renderDraftPins = () => {
      // Drafts already in CAMPUS.places (from a previous visit) are drawn by the
      // route page itself. Only draw the ones added since this page loaded.
      markersEl.querySelectorAll('.pe-pin').forEach(el => el.remove());
      drafts.filter(d => !d.loaded).forEach(d => {
        const el = document.createElement('span');
        el.className = 'marker pe-pin';
        el.setAttribute('style', Site.posStyle(d));
        el.innerHTML = `${Site.pinHTML(d.cat)}<span class="label ${d.side}">${esc(d.name)}</span>`;
        markersEl.appendChild(el);
      });
    };
    drafts.forEach(d => { d.loaded = true; });

    const render = () => {
      const list = $('pe-list');
      list.innerHTML = drafts.map((d, i) => `
        <li>${Site.pinHTML(d.cat)}
          <span><strong>${esc(d.name)}</strong><small>${esc(C.categories[d.cat].label)} · near ${esc(roadName(d.node))}${d.loaded ? '' : ' · reload to route'}</small></span>
          <button type="button" class="pe-del" data-i="${i}" aria-label="Remove ${esc(d.name)}">×</button>
        </li>`).join('');
      $('pe-count').textContent = drafts.length ? `${drafts.length} new place${drafts.length === 1 ? '' : 's'}` : 'No new places yet';
      $('pe-out').hidden = !drafts.length;
      $('pe-code').value = codeFor(drafts);
      renderDraftPins();
    };

    /* ---------- map clicks ---------- */
    let down = null;
    mapEl.addEventListener('pointerdown', e => { down = [e.clientX, e.clientY]; }, true);
    mapEl.addEventListener('click', e => {
      if (e.target.closest('.marker:not(.pe-ghost), .map-controls')) return;
      if (down && Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5) return; // was a drag
      const r = stageEl.getBoundingClientRect();
      const x = Math.round((e.clientX - r.left) / r.width * C.mapSize.w);
      const y = Math.round((e.clientY - r.top) / r.height * C.mapSize.h);
      if (x < 0 || y < 0 || x > C.mapSize.w || y > C.mapSize.h) return;
      const near = nearestNode(x, y);
      pending = { x, y, node: near.id };
      ghost.setAttribute('style', Site.posStyle(pending));
      ghost.hidden = false;
      $('pe-pos').innerHTML = `Position <strong>${x}, ${y}</strong> · joins <strong>${esc(roadName(near.id))}</strong> (${near.dist} px away)` +
        (near.dist > 60 ? '<br><span class="pe-warn">This is far from any road, so the route will end at the nearest junction.</span>' : '');
      form.hidden = false;
      $('pe-hint').hidden = true;
      panel.classList.remove('is-min');
      $('pe-name').focus();
    });

    form.addEventListener('submit', e => {
      e.preventDefault();
      if (!pending) return;
      const name = $('pe-name').value.trim();
      if (!name) { $('pe-name').focus(); return; }
      const id = slug(name);
      known.add(id);
      const aliases = $('pe-aliases').value.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
      drafts.push({ id, name, cat: $('pe-cat').value, x: pending.x, y: pending.y, node: pending.node, side: $('pe-side').value, aliases });
      save(drafts.map(({ loaded, draft, ...d }) => d));
      form.reset();
      cancel();
      render();
    });

    const cancel = () => {
      pending = null;
      ghost.hidden = true;
      form.hidden = true;
      $('pe-hint').hidden = false;
    };
    $('pe-cancel').addEventListener('click', cancel);

    $('pe-list').addEventListener('click', e => {
      const b = e.target.closest('.pe-del');
      if (!b) return;
      const [removed] = drafts.splice(Number(b.dataset.i), 1);
      save(drafts.map(({ loaded, draft, ...d }) => d));
      render();
      if (removed && removed.loaded) location.reload(); // it is drawn by the route page
    });

    $('pe-copy').addEventListener('click', async () => {
      const ta = $('pe-code');
      try { await navigator.clipboard.writeText(ta.value); $('pe-copy').textContent = 'Copied'; }
      catch (_) { ta.focus(); ta.select(); $('pe-copy').textContent = 'Press Ctrl+C'; }
      setTimeout(() => { $('pe-copy').textContent = 'Copy code'; }, 1800);
    });
    $('pe-reload').addEventListener('click', () => location.reload());
    $('pe-clear').addEventListener('click', () => {
      if (!drafts.length) return;
      drafts = [];
      save([]);
      location.reload();
    });

    panel.querySelector('.pe-min').addEventListener('click', () => {
      const min = panel.classList.toggle('is-min');
      panel.querySelector('.pe-min').setAttribute('aria-expanded', String(!min));
      panel.querySelector('.pe-min').textContent = min ? '+' : '–';
    });

    render();
  });
})();
