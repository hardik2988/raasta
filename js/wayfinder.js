/*
  Route finder page.
  Features:
  - Accessible ARIA 1.2 Combobox search with autocomplete & aliases
  - Map pan and zoom (buttons, wheel, touch pinch/drag, keyboard)
  - Route actions (Copy directions, Share link, Print)
  - Last route persistence via localStorage (with try/catch fallback)
  - Interactive Gestalt principles (figure-ground, continuity, closure, common fate)
*/
(() => {
  const C = CAMPUS;
  const R = RouteCore;
  const $ = id => document.getElementById(id);

  const mapEl = $('map');
  const stageEl = $('map-stage');
  const markersEl = $('markers');
  const fromSel = $('from');
  const toSel = $('to');
  const result = $('result');

  // State
  const state = {
    from: '',
    to: '',
    filter: 'all',
    done: new Set(),
    route: null,
    stepFree: false
  };

  // Toast notification for user actions (Copy, Share, Errors)
  function showToast(msg) {
    const existing = document.querySelector('.toast-msg');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'toast-msg';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    toast.innerHTML = `${Site.icon('check', 18)}<span>${msg}</span>`;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 2800);
  }

  // Live region for screen-reader announcements
  const live = document.createElement('p');
  live.className = 'sr-only';
  live.setAttribute('aria-live', 'polite');
  document.body.appendChild(live);
  result.removeAttribute('aria-live');

  /* ---------- Optional Notices & Step-free Hook Setup ---------- */
  const noticeContainer = $('notice-container');
  if (noticeContainer && Array.isArray(C.notices) && C.notices.length > 0) {
    noticeContainer.innerHTML = C.notices.map(n =>
      `<div class="notice-banner" role="alert">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <span>${n.text}</span>
      </div>`
    ).join('');
  }

  const stepFreeWrap = $('step-free-wrap');
  if (stepFreeWrap && R.hasStepFreeData && R.hasStepFreeData()) {
    stepFreeWrap.hidden = false;
    const sfCheckbox = $('step-free');
    if (sfCheckbox) {
      sfCheckbox.addEventListener('change', e => {
        state.stepFree = e.target.checked;
        update({ force: true });
      });
    }
  }

  /* ---------- Populate Select Fallbacks & Map Markers ---------- */
  const optionsMarkup = placeholder => `<option value="">${placeholder}</option>` +
    Object.entries(C.categories).map(([k, c]) =>
      `<optgroup label="${c.label}">` +
      C.places.filter(p => p.cat === k).map(p => `<option value="${p.id}">${p.name}</option>`).join('') +
      '</optgroup>').join('');

  fromSel.innerHTML = optionsMarkup('Choose your starting point');
  toSel.innerHTML = optionsMarkup('Choose a destination');

  const keyPlaceIds = new Set(['library', 'foodcourt', 'boys', 'girls', 'b1', 'playground', 'mdc', 'b9']);

  markersEl.innerHTML = C.places.map(p => {
    const isKey = keyPlaceIds.has(p.id) ? ' is-key-place' : '';
    return `<button type="button" class="marker${isKey}" data-id="${p.id}" data-cat="${p.cat}" style="${Site.posStyle(p)}" ` +
      `aria-label="${p.name}, ${C.categories[p.cat].label}">${Site.pinHTML(p.cat)}<span class="label ${p.side}" aria-hidden="true">${p.name}</span></button>`;
  }).join('');

  $('filters').innerHTML =
    `<button class="chip" type="button" data-cat="all" aria-pressed="true">All places</button>` +
    Object.entries(C.categories).map(([k, c]) =>
      `<button class="chip" type="button" data-cat="${k}" aria-pressed="false">${Site.pinHTML(k)}${c.label}</button>`).join('');

  if ($('road-layer')) $('road-layer').innerHTML = Site.roadsMarkup();
  $('zone-layer').innerHTML = Site.zonesMarkup();

  const markerEls = [...markersEl.querySelectorAll('.marker')];
  const stepperLis = [...document.querySelectorAll('#stepper li[data-step]')];
  const stepperBars = [...document.querySelectorAll('#stepper .bar')];

  /* ==========================================================
     PRIORITY 2.1: Accessible ARIA Combobox Autocomplete Pattern
     ========================================================== */
  function setupCombobox(type) {
    const inputWrap = $(`${type}-input-wrap`);
    const input = $(`${type}-input`);
    const listbox = $(`${type}-listbox`);
    const clearBtn = $(`${type}-clear-btn`);
    const toggleBtn = $(`${type}-toggle-btn`);
    const fallbackSel = $(type);

    let activeIndex = -1;
    let filteredPlaces = [];

    function findMatches(query) {
      const q = query.trim().toLowerCase();
      if (!q) return C.places.map(p => ({ place: p, matchAlias: null }));

      const results = [];
      C.places.forEach(p => {
        const nameLower = p.name.toLowerCase();
        const catLower = C.categories[p.cat].label.toLowerCase();

        // Exact or substring match on place name
        if (nameLower.includes(q)) {
          results.push({ place: p, matchAlias: null });
          return;
        }

        // Match on category
        if (catLower.includes(q)) {
          results.push({ place: p, matchAlias: null });
          return;
        }

        // Match on aliases
        if (Array.isArray(p.aliases)) {
          const matchedAlias = p.aliases.find(a => a.toLowerCase().includes(q));
          if (matchedAlias) {
            results.push({ place: p, matchAlias: matchedAlias });
          }
        }
      });
      return results;
    }

    function renderListbox(items) {
      filteredPlaces = items;
      activeIndex = -1;
      input.setAttribute('aria-activedescendant', '');

      if (items.length === 0) {
        listbox.innerHTML = `<li class="combobox-no-results" role="status">No matching campus places found</li>`;
        return;
      }

      // Group by category for clear Gestalt grouping
      const grouped = {};
      items.forEach(item => {
        const cat = item.place.cat;
        (grouped[cat] = grouped[cat] || []).push(item);
      });

      let optIndex = 0;
      let html = '';
      Object.keys(grouped).forEach(catKey => {
        const cat = C.categories[catKey];
        html += `<li class="combobox-optgroup" role="presentation"><div class="combobox-optgroup-label">${cat.label}</div><ul role="presentation" style="list-style:none;padding:0;margin:0;">`;
        grouped[catKey].forEach(item => {
          const isSelected = item.place.id === state[type];
          const aliasBadge = item.matchAlias ? `<span class="opt-alias">matches "${item.matchAlias}"</span>` : '';
          html += `<li id="${type}-opt-${optIndex}"
                       class="combobox-option"
                       role="option"
                       data-id="${item.place.id}"
                       data-index="${optIndex}"
                       aria-selected="${isSelected}">
                     <span class="opt-left">${Site.pinHTML(item.place.cat)}<span>${item.place.name}</span></span>
                     ${aliasBadge}
                   </li>`;
          optIndex++;
        });
        html += `</ul></li>`;
      });

      listbox.innerHTML = html;
    }

    function openListbox() {
      const q = input.value;
      const matches = findMatches(q);
      renderListbox(matches);
      listbox.hidden = false;
      input.setAttribute('aria-expanded', 'true');
      inputWrap.classList.add('is-open');

      const count = matches.length;
      live.textContent = `${count} ${count === 1 ? 'place' : 'places'} found. Use up and down arrow keys to choose.`;
    }

    function closeListbox() {
      listbox.hidden = true;
      input.setAttribute('aria-expanded', 'false');
      inputWrap.classList.remove('is-open');
      activeIndex = -1;
      input.setAttribute('aria-activedescendant', '');
    }

    function selectPlace(placeId) {
      const p = R.placeById[placeId];
      if (p) {
        input.value = p.name;
        clearBtn.hidden = false;
      } else {
        input.value = '';
        clearBtn.hidden = true;
      }
      state[type] = placeId || '';
      fallbackSel.value = placeId || '';
      closeListbox();
      update();
    }

    function setActive(index) {
      const options = listbox.querySelectorAll('.combobox-option');
      options.forEach(opt => opt.classList.remove('is-active'));

      if (index >= 0 && index < options.length) {
        activeIndex = index;
        const opt = options[index];
        opt.classList.add('is-active');
        input.setAttribute('aria-activedescendant', opt.id);
        opt.scrollIntoView({ block: 'nearest' });
      } else {
        activeIndex = -1;
        input.setAttribute('aria-activedescendant', '');
      }
    }

    // Input events
    input.addEventListener('input', () => {
      clearBtn.hidden = !input.value;
      openListbox();
    });

    input.addEventListener('focus', () => {
      inputWrap.classList.add('is-focused');
      openListbox();
    });

    input.addEventListener('blur', () => {
      inputWrap.classList.remove('is-focused');
      // Delay closing listbox to allow click selection
      setTimeout(() => {
        closeListbox();
        // If input does not match current state, restore it
        const currentPlace = R.placeById[state[type]];
        input.value = currentPlace ? currentPlace.name : '';
        clearBtn.hidden = !input.value;
      }, 200);
    });

    input.addEventListener('keydown', e => {
      const options = listbox.querySelectorAll('.combobox-option');
      const count = options.length;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          if (listbox.hidden) {
            openListbox();
          } else if (count > 0) {
            setActive((activeIndex + 1) % count);
          }
          break;
        case 'ArrowUp':
          e.preventDefault();
          if (!listbox.hidden && count > 0) {
            setActive((activeIndex - 1 + count) % count);
          }
          break;
        case 'Enter':
          if (!listbox.hidden && activeIndex >= 0 && activeIndex < count) {
            e.preventDefault();
            const chosenId = options[activeIndex].dataset.id;
            selectPlace(chosenId);
          }
          break;
        case 'Escape':
          e.preventDefault();
          closeListbox();
          break;
        case 'Tab':
          if (!listbox.hidden && activeIndex >= 0 && activeIndex < count) {
            selectPlace(options[activeIndex].dataset.id);
          }
          closeListbox();
          break;
      }
    });

    // Listbox click selection
    listbox.addEventListener('mousedown', e => {
      const opt = e.target.closest('.combobox-option');
      if (opt) {
        e.preventDefault();
        selectPlace(opt.dataset.id);
      }
    });

    // Clear button
    clearBtn.addEventListener('click', () => {
      input.value = '';
      clearBtn.hidden = true;
      selectPlace('');
      input.focus();
    });

    // Toggle button
    toggleBtn.addEventListener('click', () => {
      if (listbox.hidden) {
        input.focus();
        openListbox();
      } else {
        closeListbox();
      }
    });

    // Fallback sync
    fallbackSel.addEventListener('change', () => {
      selectPlace(fallbackSel.value);
    });

    return {
      setValue: id => {
        const p = R.placeById[id];
        input.value = p ? p.name : '';
        clearBtn.hidden = !input.value;
      }
    };
  }

  const fromCombobox = setupCombobox('from');
  const toCombobox = setupCombobox('to');

  /* ==========================================================
     PRIORITY 2.2: Map Pan and Zoom Controls
     ========================================================== */
  const MapViewer = (() => {
    let scale = 1.0;
    let panX = 0;
    let panY = 0;
    const minScale = 1.0;
    const maxScale = 3.5;

    const zoomBadge = $('zoom-badge');

    function clampPan() {
      if (!mapEl || !stageEl) return;
      const rect = mapEl.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;

      const minX = w * (1 - scale);
      const minY = h * (1 - scale);

      panX = Math.min(0, Math.max(minX, panX));
      panY = Math.min(0, Math.max(minY, panY));
    }

    function applyTransform(animated = false) {
      clampPan();
      stageEl.style.transition = animated ? 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)' : 'none';
      stageEl.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
      mapEl.style.setProperty('--map-zoom', scale);
      mapEl.classList.toggle('is-zoomed', scale > 1.2);
      scheduleLabels(animated ? 520 : 60);
      if (zoomBadge) {
        zoomBadge.textContent = `${Math.round(scale * 100)}%`;
      }
    }

    function zoomTo(targetScale, focalX, focalY, animated = true) {
      if (!mapEl) return;
      const rect = mapEl.getBoundingClientRect();
      focalX = focalX !== undefined ? focalX : rect.width / 2;
      focalY = focalY !== undefined ? focalY : rect.height / 2;

      const newScale = Math.min(maxScale, Math.max(minScale, targetScale));
      if (newScale === scale && newScale === minScale) {
        panX = 0;
        panY = 0;
        applyTransform(animated);
        return;
      }

      // Zoom towards focal point
      const scaleRatio = newScale / scale;
      panX = focalX - (focalX - panX) * scaleRatio;
      panY = focalY - (focalY - panY) * scaleRatio;
      scale = newScale;

      applyTransform(animated);
    }

    function zoomIn() { zoomTo(scale * 1.35); }
    function zoomOut() { zoomTo(scale / 1.35); }
    function reset() {
      scale = 1.0;
      panX = 0;
      panY = 0;
      applyTransform(true);
    }

    // Buttons
    $('zoom-in')?.addEventListener('click', zoomIn);
    $('zoom-out')?.addEventListener('click', zoomOut);
    $('zoom-reset')?.addEventListener('click', reset);

    // Mouse wheel zoom
    mapEl.addEventListener('wheel', e => {
      e.preventDefault();
      const rect = mapEl.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const factor = e.deltaY < 0 ? 1.2 : 0.833;
      zoomTo(scale * factor, mouseX, mouseY, true);
    }, { passive: false });

    // Drag to pan (with distinction between drag and click)
    let isPointerDown = false;
    let startX = 0;
    let startY = 0;
    let initialPanX = 0;
    let initialPanY = 0;
    let hasDragged = false;

    mapEl.addEventListener('pointerdown', e => {
      // Allow marker interactions if pointer doesn't drag
      isPointerDown = true;
      hasDragged = false;
      startX = e.clientX;
      startY = e.clientY;
      initialPanX = panX;
      initialPanY = panY;
      // No pointer capture here: capturing on pointerdown retargets the
      // click to the map, so pins would never receive taps.
    });

    mapEl.addEventListener('pointermove', e => {
      if (!isPointerDown) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (!hasDragged && Math.hypot(dx, dy) > 5) {
        hasDragged = true;
        // Real drag started: now capture so panning continues outside the map
        mapEl.classList.add('is-panning');
        try { mapEl.setPointerCapture(e.pointerId); } catch (_) {}
      }
      if (scale > 1.0) {
        panX = initialPanX + dx;
        panY = initialPanY + dy;
        applyTransform(false);
      }
    });

    const endPointer = e => {
      if (!isPointerDown) return;
      isPointerDown = false;
      mapEl.classList.remove('is-panning');
      try { mapEl.releasePointerCapture(e.pointerId); } catch (_) {}
    };
    mapEl.addEventListener('pointerup', endPointer);
    mapEl.addEventListener('pointercancel', endPointer);

    // Multi-touch pinch-to-zoom
    let activeTouches = {};
    let initialDistance = 0;
    let initialScaleOnPinch = 1;

    mapEl.addEventListener('touchstart', e => {
      if (e.touches.length === 2) {
        initialDistance = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        initialScaleOnPinch = scale;
      }
    }, { passive: true });

    mapEl.addEventListener('touchmove', e => {
      if (e.touches.length === 2 && initialDistance > 0) {
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const factor = dist / initialDistance;
        zoomTo(initialScaleOnPinch * factor, undefined, undefined, false);
      }
    }, { passive: true });

    // Keyboard support when map is focused (+, -, Arrow keys, 0, R)
    mapEl.addEventListener('keydown', e => {
      const step = 45;
      switch (e.key) {
        case '+':
        case '=':
          e.preventDefault();
          zoomIn();
          break;
        case '-':
        case '_':
          e.preventDefault();
          zoomOut();
          break;
        case '0':
        case 'r':
        case 'R':
          e.preventDefault();
          reset();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          panX += step;
          applyTransform(true);
          break;
        case 'ArrowRight':
          e.preventDefault();
          panX -= step;
          applyTransform(true);
          break;
        case 'ArrowUp':
          e.preventDefault();
          panY += step;
          applyTransform(true);
          break;
        case 'ArrowDown':
          e.preventDefault();
          panY -= step;
          applyTransform(true);
          break;
      }
    });

    // Resize handling to keep pan within bounds
    window.addEventListener('resize', () => applyTransform(false));

    return {
      zoomIn,
      zoomOut,
      reset,
      wasDragged: () => hasDragged
    };
  })();

  /* ==========================================================
     PRIORITY 2.4 & 2.5: Route Actions, Clipboard & Storage
     ========================================================== */
  const circ = 2 * Math.PI * 30;

  function syncUrl() {
    const q = new URLSearchParams();
    if (state.from) q.set('from', state.from);
    if (state.to) q.set('to', state.to);
    const s = q.toString();
    // Keep any #hash (e.g. #add-places edit mode) when updating the address
    history.replaceState(null, '', (s ? `?${s}` : location.pathname) + location.hash);
  }

  // Persistent last route in localStorage (inside try/catch)
  function persistLastRoute() {
    try {
      if (state.from && state.to && state.from !== state.to) {
        localStorage.setItem('raasta_last_route', JSON.stringify({ from: state.from, to: state.to }));
      }
    } catch (_) {
      // Storage unavailable or blocked; fail gracefully
    }
  }

  function getDirectionsText(r) {
    if (!r) return '';
    let text = `Raasta Campus Directions\n`;
    text += `Route: ${r.from.name} to ${r.to.name}\n`;
    text += `Distance: ${r.meters} m · Estimated walking time: about ${r.minutes} min\n\n`;
    text += `Turn-by-turn directions:\n`;
    r.steps.forEach((s, i) => {
      text += `${i + 1}. ${s.text}${s.meters ? ' (' + s.meters + ' m)' : ''}\n`;
    });
    text += `\nGenerated by Raasta · UPES Bidholi Campus Wayfinder`;
    return text;
  }

  function copyDirections() {
    const r = state.route;
    if (!r) return;
    const txt = getDirectionsText(r);
    navigator.clipboard.writeText(txt).then(() => {
      showToast('Directions copied to clipboard!');
    }).catch(() => {
      showToast('Could not copy automatically. Please copy from screen.');
    });
  }

  function shareRoute() {
    const r = state.route;
    if (!r) return;
    const url = window.location.href;
    const title = `Raasta Route: ${r.from.name} to ${r.to.name}`;
    const text = `Walking directions from ${r.from.name} to ${r.to.name} on the UPES Bidholi campus: about ${r.minutes} min walk (${r.meters} m).`;

    if (navigator.share) {
      navigator.share({ title, text, url }).catch(err => {
        if (err.name !== 'AbortError') {
          copyRouteLink(url);
        }
      });
    } else {
      copyRouteLink(url);
    }
  }

  function copyRouteLink(url) {
    navigator.clipboard.writeText(url).then(() => {
      showToast('Route link copied to clipboard!');
    }).catch(() => {
      showToast('Link copied!');
    });
  }

  function printRoute() {
    window.print();
  }

  function updateProgress() {
    const r = state.route;
    if (!r) return;
    const total = r.steps.length;
    const n = state.done.size;
    const ring = $('ring');
    if (!ring) return;
    $('ring-prog').style.strokeDashoffset = String(circ * (1 - n / total));
    $('ring-txt').textContent = n === total ? '✓' : `${n}/${total}`;
    ring.classList.toggle('complete', n === total);
    $('arrived').hidden = n !== total;
    document.querySelectorAll('.step').forEach(b => b.setAttribute('aria-pressed', String(state.done.has(Number(b.dataset.i)))));
  }

  function renderResult() {
    const r = state.route;
    if (!r) {
      const same = state.from && state.to && state.from === state.to;
      let msg = 'Choose a start and a destination to see your route.';
      if (same) {
        msg = 'Your start and destination are the same place. Please choose a different destination.';
      } else if (state.from && !state.to) {
        const fromPlace = R.placeById[state.from];
        msg = `Starting from <strong>${fromPlace ? fromPlace.name : state.from}</strong>. Choose a destination to see your route.`;
      } else if (!state.from && state.to) {
        const toPlace = R.placeById[state.to];
        msg = `Heading to <strong>${toPlace ? toPlace.name : state.to}</strong>. Choose your starting point to see your route.`;
      }
      result.innerHTML = `<p class="empty-state">${msg}</p>`;
      return;
    }

    result.innerHTML = `
      <!-- Accessible text summary for screen readers -->
      <div class="sr-only" role="region" aria-label="Route summary for screen readers">
        Route from ${r.from.name} to ${r.to.name}. Walking distance is ${r.meters} metres, estimated walking time is ${r.minutes} minutes. ${r.steps.length} steps in total.
      </div>

      <div class="summary">
        <div class="ring" id="ring" aria-hidden="true">
          <svg viewBox="0 0 76 76"><circle class="track" cx="38" cy="38" r="30"/><circle class="prog" id="ring-prog" cx="38" cy="38" r="30"/></svg>
          <span class="txt tabular" id="ring-txt">0/${r.steps.length}</span>
        </div>
        <div>
          <div class="time tabular" id="summary-time">0 min walk</div>
          <div class="meta tabular"><span id="summary-meters">0 m</span> · ${r.from.name} to ${r.to.name}</div>
        </div>
      </div>

      <!-- Route Action Buttons -->
      <div class="result-actions" style="margin-bottom: 16px;">
        <button class="route-action-btn" id="act-copy" type="button" aria-label="Copy plain text directions">
          ${Site.icon('copy', 18)}
          Copy directions
        </button>
        <button class="route-action-btn" id="act-share" type="button" aria-label="Share route link">
          ${Site.icon('share', 18)}
          Share link
        </button>
        <button class="route-action-btn" id="act-print" type="button" aria-label="Print route sheet">
          ${Site.icon('print', 18)}
          Print
        </button>
      </div>

      <!-- Turn by Turn Steps — Airport Signage Style -->
      <ol class="steps" aria-label="Turn by turn steps">
        ${r.steps.map((s, i) => `
          <li>
            <button type="button" class="step${s.final ? ' final' : ''}" data-i="${i}" aria-pressed="false" aria-label="Step ${i + 1}: ${s.text}${s.meters ? ' (' + s.meters + ' metres)' : ''}">
              <span class="step-icon-wrap" aria-hidden="true">
                ${Site.directionIcon(s.turn)}
                <span class="step-num tabular">${i + 1}</span>
              </span>
              <span class="step-text">${s.text}</span>
              <span class="step-dist tabular">${s.meters ? s.meters + ' m' : ''}</span>
            </button>
          </li>`).join('')}
      </ol>

      <div class="arrived" id="arrived" hidden role="status">
        ${Site.icon('check', 22)}
        <span>You have arrived at ${r.to.name}. The ring is closed.</span>
      </div>

      <div class="result-actions">
        <button class="btn btn-primary btn-small" id="arrive" type="button">I have arrived</button>
      </div>`;

    updateProgress();
    animateCountUp(r.meters, r.minutes);

    // Bind action buttons
    $('act-copy')?.addEventListener('click', copyDirections);
    $('act-share')?.addEventListener('click', shareRoute);
    $('act-print')?.addEventListener('click', printRoute);
  }

  function animateCountUp(targetMeters, targetMinutes) {
    const timeEl = $('summary-time');
    const metersEl = $('summary-meters');
    if (!timeEl || !metersEl) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      timeEl.textContent = `${targetMinutes} min walk`;
      metersEl.textContent = `${targetMeters} m`;
      return;
    }

    const duration = 460;
    const startTime = performance.now();

    function frame(now) {
      const progress = Math.min(1, (now - startTime) / duration);
      const ease = 1 - Math.pow(1 - progress, 3);
      const curM = Math.round(targetMeters * ease);
      const curMin = Math.max(1, Math.round(targetMinutes * ease));

      timeEl.textContent = `${curMin} min walk`;
      metersEl.textContent = `${curM} m`;

      if (progress < 1) {
        requestAnimationFrame(frame);
      } else {
        timeEl.textContent = `${targetMinutes} min walk`;
        metersEl.textContent = `${targetMeters} m`;
      }
    }
    requestAnimationFrame(frame);
  }

  function drawRoute() {
    const r = state.route;
    mapEl.classList.remove('has-route');
    if (!r) {
      ['route-halo', 'route-line', 'route-flow'].forEach(id => $(id).setAttribute('d', ''));
      $('turn-layer').innerHTML = '';
      return;
    }
    const d = Site.pathD(r.points);
    ['route-halo', 'route-line', 'route-flow'].forEach(id => $(id).setAttribute('d', d));
    $('turn-layer').innerHTML = Site.turnsMarkup(r);
    void mapEl.offsetWidth; // restart draw animation
    mapEl.classList.add('has-route');
  }

  function applyFilter() {
    const f = state.filter;
    mapEl.classList.toggle('filtering', f !== 'all');
    markerEls.forEach(m => m.classList.toggle('match', f !== 'all' && m.dataset.cat === f));
    document.querySelectorAll('#filters .chip').forEach(c => c.setAttribute('aria-pressed', String(c.dataset.cat === f)));
    const n = C.places.filter(p => p.cat === f).length;
    $('filter-status').textContent = f === 'all' ? '' : `Highlighting ${n} ${C.categories[f].label.toLowerCase()} ${n === 1 ? 'place' : 'places'}.`;
  }

  /* ---------- Main Redraw Cycle ---------- */
  function update(opts = {}) {
    fromCombobox.setValue(state.from);
    toCombobox.setValue(state.to);

    const same = state.from && state.to && state.from === state.to;
    const prevKey = state.route ? state.route.from.id + '>' + state.route.to.id : '';
    state.route = state.from && state.to && !same
      ? R.route(state.from, state.to, { stepFree: state.stepFree })
      : null;
    const key = state.route ? state.route.from.id + '>' + state.route.to.id : '';
    if (key !== prevKey) state.done = new Set();

    // Stepper continuity
    const step = !state.from ? 1 : !state.to || same ? 2 : 3;
    stepperLis.forEach((li, i) => {
      li.classList.toggle('is-current', i + 1 === step);
      li.classList.toggle('is-done', i + 1 < step);
    });
    stepperBars.forEach((b, i) => b.classList.toggle('is-done', step > i + 1));

    // Marker highlights
    const passing = new Set(state.route ? state.route.nodeIds : []);
    markerEls.forEach(m => {
      const p = R.placeById[m.dataset.id];
      m.classList.toggle('is-from', m.dataset.id === state.from);
      m.classList.toggle('is-to', m.dataset.id === state.to);
      m.classList.toggle('on-route', !!state.route && passing.has(p.node) && m.dataset.id !== state.from && m.dataset.id !== state.to);
    });

    if (key !== prevKey || opts.force) {
      drawRoute();
      renderResult();
    }
    applyFilter();
    scheduleLabels(80);
    syncUrl();
    persistLastRoute();

    if (state.route && key !== prevKey) {
      live.textContent = `Route from ${state.route.from.name} to ${state.route.to.name}: about ${state.route.minutes} minutes, ${state.route.meters} metres, ${state.route.steps.length} steps.`;
    }
  }

  /* ---------- Feature 1: Popular Routes Setup ---------- */
  const plannerPopularEl = $('planner-popular-chips');
  if (plannerPopularEl && Array.isArray(C.popularRoutes)) {
    plannerPopularEl.innerHTML = C.popularRoutes.map(r =>
      `<button type="button" class="popular-chip" data-from="${r.from}" data-to="${r.to}">${r.label}</button>`
    ).join('');

    plannerPopularEl.addEventListener('click', e => {
      const btn = e.target.closest('.popular-chip');
      if (!btn) return;
      state.from = btn.dataset.from;
      state.to = btn.dataset.to;
      update({ force: true });
    });
  }

  /* ---------- Feature 2: Nearest-Place Finder Setup ---------- */
  const nearestChipsEl = $('nearest-chips');
  const nearestResultsEl = $('nearest-results');

  if (nearestChipsEl && nearestResultsEl) {
    nearestChipsEl.innerHTML = Object.entries(C.categories).map(([k, c]) =>
      `<button type="button" class="nearest-chip-btn" data-cat="${k}">${Site.pinHTML(k)}<span>${c.label}</span></button>`
    ).join('');

    let activeNearestCat = null;

    nearestChipsEl.addEventListener('click', e => {
      const btn = e.target.closest('.nearest-chip-btn');
      if (!btn) return;
      const cat = btn.dataset.cat;

      if (!state.from) {
        nearestResultsEl.hidden = false;
        nearestResultsEl.innerHTML = `<p class="nearest-hint">Choose where you are first (select a starting point A above).</p>`;
        live.textContent = 'Choose where you are first before finding the nearest place.';
        return;
      }

      // If clicked again on the active category, toggle closed
      if (activeNearestCat === cat && !nearestResultsEl.hidden) {
        nearestResultsEl.hidden = true;
        activeNearestCat = null;
        nearestChipsEl.querySelectorAll('.nearest-chip-btn').forEach(b => b.classList.remove('is-active'));
        return;
      }

      activeNearestCat = cat;
      nearestChipsEl.querySelectorAll('.nearest-chip-btn').forEach(b => {
        b.classList.toggle('is-active', b.dataset.cat === cat);
      });

      const results = R.nearest(state.from, cat, 3);
      const catLabel = C.categories[cat] ? C.categories[cat].label.toLowerCase() : cat;

      if (results.length === 0) {
        nearestResultsEl.hidden = false;
        nearestResultsEl.innerHTML = `<p class="nearest-hint">No other ${catLabel} places found nearby.</p>`;
        live.textContent = `No other ${catLabel} places found nearby.`;
        return;
      }

      nearestResultsEl.hidden = false;
      nearestResultsEl.innerHTML = `
        <div class="nearest-list" style="display:grid; gap:6px;">
          ${results.map(r => `
            <button type="button" class="nearest-item-btn" data-id="${r.place.id}" aria-label="${r.place.name}, ${r.route.minutes} minute walk">
              <span class="nearest-item-left">${Site.pinHTML(r.place.cat)} <span>${r.place.name}</span></span>
              <span class="nearest-item-meta tabular">${r.route.minutes} min walk (${r.route.meters} m)</span>
            </button>
          `).join('')}
        </div>
      `;

      live.textContent = `Nearest ${catLabel} is ${results[0].place.name}, about ${results[0].route.minutes} minutes walk.`;
    });

    nearestResultsEl.addEventListener('click', e => {
      const itemBtn = e.target.closest('.nearest-item-btn');
      if (!itemBtn) return;
      state.to = itemBtn.dataset.id;
      nearestResultsEl.hidden = true;
      activeNearestCat = null;
      nearestChipsEl.querySelectorAll('.nearest-chip-btn').forEach(b => b.classList.remove('is-active'));
      update({ force: true });
    });
  }

  /* ---------- Feature 4: Place Detail Panel (Figure-Ground Modal) ---------- */
  const placeDialog = $('place-dialog');
  const dialogBody = $('dialog-body');
  const dialogClose = $('dialog-close');
  let lastFocusedMarker = null;

  function openPlaceDetail(id, triggerEl) {
    const p = R.placeById[id];
    if (!p || !placeDialog) return;

    lastFocusedMarker = triggerEl || null;

    // Up to 3 closest places of ANY category
    const nearestPlaces = R.nearest(id, null, 3);

    const isFrom = state.from === id;
    const isTo = state.to === id;
    let reason = '';
    if (isFrom) {
      reason = 'This place is currently chosen as your starting point (A).';
    } else if (isTo) {
      reason = 'This place is currently chosen as your destination (B).';
    }

    dialogBody.innerHTML = `
      <div class="dialog-header">
        ${Site.pinHTML(p.cat)}
        <div>
          <h2 id="dialog-title" style="margin:0 0 2px; font-size:1.35rem;">${p.name}</h2>
          <span class="place-cat-badge">${C.categories[p.cat].label}</span>
          ${Array.isArray(p.aliases) && p.aliases.length > 0 ? `<span class="place-aliases">Also known as: ${p.aliases.join(', ')}</span>` : ''}
        </div>
      </div>

      <div class="dialog-nearest-title">Nearest places:</div>
      <ul class="dialog-nearest-list">
        ${nearestPlaces.map(np => `
          <li>
            <span class="n-left">${Site.pinHTML(np.place.cat)} <span>${np.place.name}</span></span>
            <span class="tabular">${np.route.minutes} min (${np.route.meters} m)</span>
          </li>
        `).join('')}
      </ul>

      <div class="dialog-actions">
        <button type="button" class="btn ${isFrom ? 'btn-secondary' : 'btn-primary'}" id="dialog-set-a" ${isFrom ? 'disabled aria-disabled="true"' : ''} title="${isFrom ? 'Already chosen as start (A)' : 'Set as start (A)'}">
          ${isFrom ? 'Already start (A)' : 'Set as A'}
        </button>
        <button type="button" class="btn ${isTo ? 'btn-secondary' : 'btn-primary'}" id="dialog-set-b" ${isTo ? 'disabled aria-disabled="true"' : ''} title="${isTo ? 'Already chosen as destination (B)' : 'Set as destination (B)'}">
          ${isTo ? 'Already destination (B)' : 'Set as B'}
        </button>
        <button type="button" class="btn btn-secondary" id="dialog-cancel" style="grid-column: 1 / -1;">Close</button>
        ${reason ? `<div class="dialog-reason">${reason}</div>` : ''}
      </div>
    `;

    // Button event listeners
    const setABtn = $('dialog-set-a');
    const setBBtn = $('dialog-set-b');
    const cancelBtn = $('dialog-cancel');

    if (setABtn && !isFrom) {
      setABtn.addEventListener('click', () => {
        state.from = id;
        if (state.to === id) state.to = '';
        placeDialog.close();
        update({ force: true });
      });
    }

    if (setBBtn && !isTo) {
      setBBtn.addEventListener('click', () => {
        state.to = id;
        if (state.from === id) state.from = '';
        placeDialog.close();
        update({ force: true });
      });
    }

    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        placeDialog.close();
      });
    }

    // Open modal dialog
    if (typeof placeDialog.showModal === 'function') {
      placeDialog.showModal();
    } else {
      placeDialog.setAttribute('open', '');
    }
  }

  // Close handlers
  if (placeDialog) {
    dialogClose?.addEventListener('click', () => placeDialog.close());

    // Click on backdrop
    placeDialog.addEventListener('click', e => {
      if (e.target === placeDialog) {
        placeDialog.close();
      }
    });

    // Return focus to marker when dialog closes
    placeDialog.addEventListener('close', () => {
      if (lastFocusedMarker && typeof lastFocusedMarker.focus === 'function') {
        lastFocusedMarker.focus();
      }
    });
  }

  /* ---------- Event Handlers ---------- */
  $('swap').addEventListener('click', () => {
    [state.from, state.to] = [state.to, state.from];
    update();
  });

  $('clear').addEventListener('click', () => {
    state.from = '';
    state.to = '';
    update({ force: true });
  });

  /* ---------- Smart label placement ----------
     Each visible name tries its preferred side, then right, left, below, above,
     and takes the first spot that does not overlap another name or pin.
     If nothing fits it hides (hover or focus still shows it). */
  var labelTimer = null; // var: may be used before this line runs
  function scheduleLabels(delay = 60) {
    clearTimeout(labelTimer);
    labelTimer = setTimeout(placeLabels, delay);
  }
  function placeLabels() {
    if (!mapEl || !markerEls || !markerEls.length) return;
    const wrap = mapEl.getBoundingClientRect();
    if (!wrap.width) return;
    const showAll = mapEl.classList.contains('show-all-labels') || mapEl.classList.contains('is-zoomed');
    const hasRoute = mapEl.classList.contains('has-route');
    const filtering = mapEl.classList.contains('filtering');

    const rank = m => m.classList.contains('is-from') || m.classList.contains('is-to') ? 100
      : m.classList.contains('on-route') ? 60
      : (filtering && m.classList.contains('match')) ? 50
      : m.classList.contains('is-key-place') ? 30 : 0;
    const eligible = m => {
      const r = rank(m);
      if (r >= 60) return true;
      if (filtering) return m.classList.contains('match');
      if (showAll) return true;
      return !hasRoute && r >= 30;
    };

    // Pins are obstacles for every label
    const pins = markerEls.map(m => {
      const r = m.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2, h = 12;
      return { m, cx, cy, box: [cx - h, cy - h, cx + h, cy + h] };
    });
    const hit = (a, b) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
    const placed = [];
    const order = pins.slice().sort((a, b) => rank(b.m) - rank(a.m));

    order.forEach(({ m, cx, cy }) => {
      const lab = m.querySelector('.label');
      if (!lab) return;
      if (!eligible(m) || cx < wrap.left || cx > wrap.right || cy < wrap.top || cy > wrap.bottom) {
        lab.classList.add('label-off'); lab.classList.remove('label-on');
        return;
      }
      const pref = lab.dataset.side || (lab.dataset.side = ['r', 'l', 't', 'b'].find(k => lab.classList.contains(k)) || 'r');
      const w = lab.offsetWidth + 4, h = lab.offsetHeight + 2, g = 15;
      const boxFor = side => side === 'r' ? [cx + g, cy - h / 2, cx + g + w, cy + h / 2]
        : side === 'l' ? [cx - g - w, cy - h / 2, cx - g, cy + h / 2]
        : side === 't' ? [cx - w / 2, cy - g - h, cx + w / 2, cy - g]
        : [cx - w / 2, cy + g, cx + w / 2, cy + g + h];
      const sides = [pref, 'r', 'l', 'b', 't'].filter((v, i, a) => a.indexOf(v) === i);
      const fits = side => {
        const b = boxFor(side);
        if (b[0] < wrap.left + 2 || b[2] > wrap.right - 2 || b[1] < wrap.top + 2 || b[3] > wrap.bottom - 2) return false;
        if (placed.some(p => hit(p, b))) return false;
        return !pins.some(p => p.m !== m && hit(p.box, b));
      };
      // chosen A/B pins: the badge sits above, so never put their label on top
      const choice = sides.filter(sd => !(sd === 't' && rank(m) === 100)).find(fits);
      if (choice) {
        ['r', 'l', 't', 'b'].forEach(k => lab.classList.toggle(k, k === choice));
        placed.push(boxFor(choice));
        lab.classList.add('label-on'); lab.classList.remove('label-off');
      } else if (rank(m) === 100) {
        placed.push(boxFor(pref)); // start and end always keep their name
        lab.classList.add('label-on'); lab.classList.remove('label-off');
      } else {
        lab.classList.add('label-off'); lab.classList.remove('label-on');
      }
    });
  }
  window.addEventListener('resize', () => scheduleLabels(150));
  document.fonts && document.fonts.ready.then(() => scheduleLabels(0));

  /* ---------- Map furniture: north arrow + scale bar (inside the map, so they zoom with it) ---------- */
  if ($('map-furniture')) {
    const m = C.metersPerPx || 1;
    const len = Math.round(100 / m);          // 100 m in map units
    const x = 34, y = C.mapSize.h - 34;
    $('map-furniture').innerHTML =
      `<g class="compass" transform="translate(${C.mapSize.w - 120} 52)">
         <circle r="20"/><path d="M0 -14 L6 4 L0 0 L-6 4 Z" class="needle"/><path d="M0 14 L6 4 L0 0 L-6 4 Z" class="needle-s"/>
         <text y="-25" text-anchor="middle">N</text></g>
       <g class="scalebar" transform="translate(${x} ${y})">
         <rect x="-8" y="-20" width="${len + 16}" height="30" rx="6" class="scale-bg"/>
         <rect x="0" y="0" width="${len / 2}" height="5" class="scale-a"/><rect x="${len / 2}" y="0" width="${len / 2}" height="5" class="scale-b"/>
         <text x="0" y="-6">0</text><text x="${len / 2}" y="-6" text-anchor="middle">50</text><text x="${len}" y="-6" text-anchor="end">100 m</text></g>`;
  }

  /* ---------- Show all place names ---------- */
  const labelsBtn = $('toggle-labels');
  const setLabels = on => {
    mapEl.classList.toggle('show-all-labels', on);
    scheduleLabels(0);
    if (labelsBtn) {
      labelsBtn.setAttribute('aria-pressed', String(on));
      labelsBtn.setAttribute('aria-label', on ? 'Hide extra place names' : 'Show all place names');
    }
  };
  labelsBtn?.addEventListener('click', () => setLabels(!mapEl.classList.contains('show-all-labels')));

  /* ---------- Full-screen map ---------- */
  const mapCard = mapEl.closest('.map-card');
  const expandBtn = $('map-expand');
  let labelsBeforeExpand = false;
  const setExpanded = on => {
    if (!mapCard) return;
    if (on === mapCard.classList.contains('is-expanded')) return;
    if (on) labelsBeforeExpand = mapEl.classList.contains('show-all-labels');
    mapCard.classList.toggle('is-expanded', on);
    document.documentElement.classList.toggle('map-expanded', on);
    expandBtn?.setAttribute('aria-pressed', String(on));
    expandBtn?.setAttribute('aria-label', on ? 'Exit full screen map' : 'Show map full screen');
    // Big screens: show every name. Phones: too crowded, so zoom in instead.
    const narrow = window.innerWidth < 720;
    setLabels(on ? (!narrow || labelsBeforeExpand) : labelsBeforeExpand);
    requestAnimationFrame(() => {
      MapViewer.reset();
      if (on && narrow) setTimeout(() => { MapViewer.zoomIn(); MapViewer.zoomIn(); }, 350);
    });
    if (on) mapEl.focus({ preventScroll: true });
  };
  expandBtn?.addEventListener('click', () => setExpanded(!mapCard.classList.contains('is-expanded')));
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && mapCard?.classList.contains('is-expanded')) setExpanded(false);
  });
  mapEl.addEventListener('keydown', e => {
    if (e.key === 'f' || e.key === 'F') { e.preventDefault(); setExpanded(!mapCard.classList.contains('is-expanded')); }
    if (e.key === 'n' || e.key === 'N') { e.preventDefault(); setLabels(!mapEl.classList.contains('show-all-labels')); }
  });

  // Map marker clicks pick the route directly (ignores drag-to-pan):
  //   1st click = start (A), 2nd click = destination (B).
  //   Clicking A again un-picks it. Once a route is shown, the next click starts a new one.
  markersEl.addEventListener('click', e => {
    if (MapViewer.wasDragged()) return;
    const m = e.target.closest('.marker');
    if (!m || !R.placeById[m.dataset.id]) return; // ignore editor preview pins
    const id = m.dataset.id;
    const name = R.placeById[id].name;

    if (state.from && state.to) {
      // A route is already shown: begin a new one from this place
      state.from = id;
      state.to = '';
      showToast(`New route. Start (A): ${name}. Now tap where you are going.`);
    } else if (!state.from) {
      // Keep a destination picked from the list, unless it is this same place
      state.from = id;
      if (state.to === id) state.to = '';
      showToast(state.to ? `Start (A): ${name}` : `Start (A): ${name}. Now tap where you are going.`);
    } else if (state.from === id) {
      state.from = '';
      showToast('Start cleared. Tap a place to choose your start.');
    } else {
      state.to = id;
      showToast(`Destination (B): ${name}`);
    }
    update({ force: true });
  });

  $('filters').addEventListener('click', e => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    state.filter = state.filter === chip.dataset.cat ? 'all' : chip.dataset.cat;
    applyFilter();
  });

  $('zones').addEventListener('change', e => mapEl.classList.toggle('show-zones', e.target.checked));

  result.addEventListener('click', e => {
    const step = e.target.closest('.step');
    if (step) {
      const i = Number(step.dataset.i);
      state.done.has(i) ? state.done.delete(i) : state.done.add(i);
      updateProgress();
      return;
    }
    if (e.target.closest('#arrive') && state.route) {
      state.route.steps.forEach((_, i) => state.done.add(i));
      updateProgress();
      live.textContent = `You have arrived at ${state.route.to.name}.`;
    }
  });

  /* ---------- Startup Initialization & Persistence ---------- */
  const q = new URLSearchParams(location.search);
  const qFrom = q.get('from');
  const qTo = q.get('to');

  if (R.placeById[qFrom]) state.from = qFrom;
  if (R.placeById[qTo]) state.to = qTo;

  // If no URL parameters were provided, restore last route from localStorage if available
  if (!qFrom && !qTo && !state.from && !state.to) {
    try {
      const saved = localStorage.getItem('raasta_last_route');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (R.placeById[parsed.from] && R.placeById[parsed.to] && parsed.from !== parsed.to) {
          state.from = parsed.from;
          state.to = parsed.to;
        }
      }
    } catch (_) {
      // LocalStorage unavailable, proceed with empty defaults
    }
  }

  update({ force: true });
})();
