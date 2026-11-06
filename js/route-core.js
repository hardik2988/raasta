/*
  Route finding for the campus graph.
  Shortest path (Dijkstra) over the road graph, then turned into
  human-readable steps like an airport signage trail.
*/
const RouteCore = (() => {
  const C = (typeof CAMPUS !== 'undefined') ? CAMPUS : require('./data.js');
  const WALK_M_PER_MIN = 80;

  const nodes = C.nodes;
  const placeById = Object.fromEntries(C.places.map(p => [p.id, p]));
  const adj = {};
  const roadOf = {};
  const edgeOpts = {};
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

  C.edges.forEach(([a, b, road, opts]) => {
    const w = dist(nodes[a], nodes[b]);
    (adj[a] = adj[a] || []).push([b, w]);
    (adj[b] = adj[b] || []).push([a, w]);
    roadOf[a + '|' + b] = roadOf[b + '|' + a] = road;
    if (opts) {
      edgeOpts[a + '|' + b] = edgeOpts[b + '|' + a] = opts;
    }
  });

  // Get set of currently blocked edges from CAMPUS.notices (if any)
  function getBlockedEdgeSet() {
    const blocked = new Set();
    if (Array.isArray(C.notices)) {
      C.notices.forEach(n => {
        if (Array.isArray(n.blockedEdges)) {
          n.blockedEdges.forEach(([u, v]) => {
            blocked.add(u + '|' + v);
            blocked.add(v + '|' + u);
          });
        }
      });
    }
    return blocked;
  }

  function shortestPath(start, goal, options = {}) {
    const blocked = getBlockedEdgeSet();
    const requireStepFree = !!options.stepFree;
    const d = {};
    const prev = {};
    const done = new Set();
    Object.keys(nodes).forEach(n => { d[n] = Infinity; });
    d[start] = 0;
    for (;;) {
      let u = null;
      let best = Infinity;
      for (const n in d) if (!done.has(n) && d[n] < best) { best = d[n]; u = n; }
      if (u === null || u === goal) break;
      done.add(u);
      for (const [v, w] of (adj[u] || [])) {
        const edgeKey = u + '|' + v;
        if (blocked.has(edgeKey)) continue;
        if (requireStepFree && edgeOpts[edgeKey]?.stepFree === false) continue;
        if (d[u] + w < d[v]) { d[v] = d[u] + w; prev[v] = u; }
      }
    }
    if (d[goal] === Infinity) return null;
    const path = [goal];
    while (path[0] !== start) path.unshift(prev[path[0]]);
    return path;
  }

  const round10 = m => Math.max(10, Math.round(m / 10) * 10);

  function compass(dx, dy) {
    const a = (Math.atan2(-dy, dx) * 180 / Math.PI + 360) % 360;   // 0 = east, 90 = north
    const names = ['east', 'north-east', 'north', 'north-west', 'west', 'south-west', 'south', 'south-east'];
    return names[Math.round(a / 45) % 8];
  }

  function turnBetween(prev, cur) {
    const cross = prev.x * cur.y - prev.y * cur.x;     // y points down, so positive = right turn
    const dot = prev.x * cur.x + prev.y * cur.y;
    const angle = Math.atan2(cross, dot) * 180 / Math.PI;
    if (Math.abs(angle) < 25) return { straight: true };
    return { straight: false, side: angle > 0 ? 'right' : 'left', sharp: Math.abs(angle) > 110 };
  }

  function route(fromId, toId, options = {}) {
    const A = placeById[fromId];
    const B = placeById[toId];
    if (!A || !B || fromId === toId) return null;
    const nodePath = shortestPath(A.node, B.node, options);
    if (!nodePath) return null;

    const pts = [[A.x, A.y], ...nodePath.map(n => nodes[n]), [B.x, B.y]];

    // segments: entrance connector, road segments, exit connector
    const segs = [{ a: pts[0], b: pts[1], road: null }];
    for (let i = 0; i < nodePath.length - 1; i++) {
      segs.push({ a: nodes[nodePath[i]], b: nodes[nodePath[i + 1]], road: roadOf[nodePath[i] + '|' + nodePath[i + 1]] });
    }
    segs.push({ a: nodes[nodePath[nodePath.length - 1]], b: pts[pts.length - 1], road: null });
    segs.forEach(s => { s.len = dist(s.a, s.b); });

    const total = segs.reduce((sum, s) => sum + s.len, 0) * C.metersPerPx;

    // group consecutive segments on the same road into one step
    const groups = [];
    segs.filter(s => s.road).forEach(s => {
      const g = groups[groups.length - 1];
      if (g && g.road === s.road) { g.end = s.b; g.len += s.len; }
      else groups.push({ road: s.road, start: s.a, end: s.b, len: s.len });
    });

    const steps = [];
    if (!groups.length) {
      steps.push({ text: `Walk straight from ${A.name} to ${B.name}`, turn: 'straight', meters: round10(total), point: pts[0] });
    } else {
      groups[0].start = pts[0];
      groups[0].len += segs[0].len;
      groups[groups.length - 1].end = pts[pts.length - 1];
      groups[groups.length - 1].len += segs[segs.length - 1].len;

      let prevVec = null;
      groups.forEach((g, i) => {
        const vec = { x: g.end[0] - g.start[0], y: g.end[1] - g.start[1] };
        const dir = compass(vec.x, vec.y);
        let text;
        let turn = 'straight';
        if (i === 0) {
          text = `Leave ${A.name} and head ${dir} on the ${g.road}`;
          turn = 'start';
        } else {
          const t = turnBetween(prevVec, vec);
          if (t.straight) {
            turn = 'straight';
            text = `Keep going ${dir} on the ${g.road}`;
          } else if (t.sharp) {
            turn = t.side === 'right' ? 'sharp-right' : 'sharp-left';
            text = `Turn sharp ${t.side} onto the ${g.road}, heading ${dir}`;
          } else {
            turn = t.side === 'right' ? 'right' : 'left';
            text = `Turn ${t.side} onto the ${g.road}, heading ${dir}`;
          }
        }
        steps.push({ text, turn, meters: round10(g.len * C.metersPerPx), point: g.start });
        prevVec = vec;
      });
    }
    steps.push({ text: `Arrive at ${B.name}`, turn: 'arrive', meters: 0, final: true, point: pts[pts.length - 1] });

    return {
      from: A,
      to: B,
      points: pts,
      nodeIds: nodePath,
      steps,
      meters: round10(total),
      minutes: Math.max(1, Math.round(total / WALK_M_PER_MIN))
    };
  }

  // Find places of a given category closest to fromId, sorted by walking distance
  function nearest(fromId, cat, limit = 3) {
    const startPlace = placeById[fromId];
    if (!startPlace) return [];

    const candidates = C.places.filter(p => {
      if (p.id === fromId) return false;
      if (cat && cat !== 'all' && p.cat !== cat) return false;
      return true;
    });

    const results = [];
    for (const place of candidates) {
      const r = route(fromId, place.id);
      if (r) {
        results.push({ place, route: r });
      }
    }

    // Sort ascending by calculated walking meters
    results.sort((a, b) => a.route.meters - b.route.meters);

    return typeof limit === 'number' && limit > 0 ? results.slice(0, limit) : results;
  }

  // Check if any edge has a stepFree flag
  function hasStepFreeData() {
    return C.edges.some(e => e[3] && typeof e[3].stepFree === 'boolean');
  }

  return { route, nearest, placeById, WALK_M_PER_MIN, hasStepFreeData };
})();

if (typeof module !== 'undefined') module.exports = RouteCore;
