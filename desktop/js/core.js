/*!
 * 托盘码放测算台 · 计算内核
 * 分层启发式：对每种纸箱朝向，用「顺排 / 对拼 / 行列混排 / 风车拼花」求单层最优，
 * 再按可用高度计算层数；放量分析在长宽高允许范围内做 1mm 网格搜索并给出帕累托推荐。
 * 无任何第三方依赖，浏览器与 Node 均可运行。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PalletCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var EPS = 1e-6;
  var SUPPORT_MIN = 0.85;

  function n(v, d) {
    var x = Number(v);
    return Number.isFinite(x) ? x : (d || 0);
  }
  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
  function round(v, p) {
    var f = Math.pow(10, p == null ? 3 : p);
    return Math.round(v * f) / f;
  }
  function floorFit(total, size, gap) {
    if (!(size > EPS)) return 0;
    var fit = Math.floor((total + gap + EPS) / (size + gap));
    return fit > 0 ? fit : 0;
  }

  /* ------------------------------------------------------------------ *
   * 单层矩形排布
   * ------------------------------------------------------------------ */

  function makeRect(x, y, w, h, rot) {
    return { x: x, y: y, w: w, h: h, rot: !!rot };
  }

  function grid(L, W, a, b, gap, rot) {
    var nx = floorFit(L, a, gap);
    var ny = floorFit(W, b, gap);
    if (!nx || !ny) return null;
    var rects = [];
    for (var j = 0; j < ny; j++) {
      for (var i = 0; i < nx; i++) {
        rects.push(makeRect(i * (a + gap), j * (b + gap), a, b, rot));
      }
    }
    return {
      count: nx * ny,
      rects: rects,
      usedW: nx * a + (nx - 1) * gap,
      usedH: ny * b + (ny - 1) * gap
    };
  }

  function bounds(rects) {
    var w = 0, h = 0;
    for (var i = 0; i < rects.length; i++) {
      var r = rects[i];
      if (r.x + r.w > w) w = r.x + r.w;
      if (r.y + r.h > h) h = r.y + r.h;
    }
    return { w: w, h: h };
  }

  /* 单方向对拼：把层切成两条带，每条带用不同朝向 */
  function splitPattern(L, W, a, b, gap, alongX) {
    var P = alongX ? L : W;
    var Q = alongX ? W : L;

    function build(p1, q1, p2, q2) {
      var best = null;
      var maxI = floorFit(P, p1, gap);
      for (var i = 0; i <= maxI; i++) {
        var used1 = i ? i * p1 + (i - 1) * gap : 0;
        var x2 = i ? used1 + gap : 0;
        var avail = P - x2;
        var n2 = floorFit(avail, p2, gap);
        if (!i && !n2) continue;
        var rows1 = floorFit(Q, q1, gap);
        var rows2 = floorFit(Q, q2, gap);
        var count = i * rows1 + n2 * rows2;
        if (!count) continue;
        if (!best || count > best.count) best = { count: count };
      }
      if (!best) return null;
      // 重建最优拆分
      for (var k = 0; k <= maxI; k++) {
        var usedK = k ? k * p1 + (k - 1) * gap : 0;
        var start2 = k ? usedK + gap : 0;
        var availK = P - start2;
        var m2 = floorFit(availK, p2, gap);
        var r1 = floorFit(Q, q1, gap);
        var r2 = floorFit(Q, q2, gap);
        var c = k * r1 + m2 * r2;
        if (c !== best.count) continue;
        var rects = [];
        var i2, j2;
        for (j2 = 0; j2 < r1; j2++) {
          for (i2 = 0; i2 < k; i2++) {
            rects.push(alongX
              ? makeRect(i2 * (p1 + gap), j2 * (q1 + gap), p1, q1, false)
              : makeRect(j2 * (q1 + gap), i2 * (p1 + gap), q1, p1, false));
          }
        }
        for (j2 = 0; j2 < r2; j2++) {
          for (i2 = 0; i2 < m2; i2++) {
            var px = start2 + i2 * (p2 + gap);
            var py = j2 * (q2 + gap);
            rects.push(alongX
              ? makeRect(px, py, p2, q2, true)
              : makeRect(py, px, q2, p2, true));
          }
        }
        return { count: c, rects: rects };
      }
      return null;
    }

    // 两种朝向组合，两条带都以同一条边为基准
    var cands = [build(a, b, b, a), build(b, a, a, b)];
    var best = null;
    for (var i = 0; i < cands.length; i++) {
      if (cands[i] && (!best || cands[i].count > best.count)) best = cands[i];
    }
    return best;
  }

  /* 多段递归对拼：允许在一条带里再切一条，把残留区域补满 */
  function guillotinePattern(L, W, a, b, gap, depth) {
    depth = depth == null ? 2 : depth;
    var memo = new Map();

    function bestGrid(l, w) {
      var g1 = grid(l, w, a, b, gap, false);
      var g2 = Math.abs(a - b) > EPS ? grid(l, w, b, a, gap, true) : null;
      var best = g1;
      if (g2 && (!best || g2.count > best.count)) best = g2;
      return best;
    }

    function positions(P) {
      var set = {};
      [a, b].forEach(function (d) {
        if (!(d > EPS)) return;
        for (var i = 1; i < 200; i++) {
          var p = i * (d + gap);
          if (p >= P - EPS) break;
          if (p > EPS) set[p] = 1;
          var q = P - p - gap;
          if (q > EPS) set[q] = 1;
        }
      });
      return Object.keys(set).map(Number).sort(function (x, y) { return x - y; }).slice(0, 80);
    }

    function solveRect(l, w, d) {
      if (!(l > EPS) || !(w > EPS)) return { count: 0, rects: [] };
      var key = round(l, 3) + ':' + round(w, 3) + ':' + d;
      if (memo.has(key)) return memo.get(key);

      var direct = bestGrid(l, w);
      var best = direct ? {
        count: direct.count,
        rects: direct.rects.slice()
      } : { count: 0, rects: [] };

      if (d > 0) {
        var xs = positions(l);
        for (var i = 0; i < xs.length; i++) {
          var x = xs[i];
          var rw = l - x - gap;
          if (!(rw > EPS)) continue;
          var left = solveRect(x, w, d - 1);
          var right = solveRect(rw, w, d - 1);
          var count = left.count + right.count;
          if (count > best.count) {
            best = {
              count: count,
              rects: left.rects.concat(right.rects.map(function (r) {
                return makeRect(r.x + x + gap, r.y, r.w, r.h, r.rot);
              }))
            };
          }
        }

        var ys = positions(w);
        for (var j = 0; j < ys.length; j++) {
          var y = ys[j];
          var rh = w - y - gap;
          if (!(rh > EPS)) continue;
          var top = solveRect(l, y, d - 1);
          var bottom = solveRect(l, rh, d - 1);
          var c2 = top.count + bottom.count;
          if (c2 > best.count) {
            best = {
              count: c2,
              rects: top.rects.concat(bottom.rects.map(function (r) {
                return makeRect(r.x, r.y + y + gap, r.w, r.h, r.rot);
              }))
            };
          }
        }
      }

      memo.set(key, best);
      return best;
    }

    var result = solveRect(L, W, depth);
    if (!result.count) return null;
    var bb = bounds(result.rects);
    return { count: result.count, rects: result.rects, usedW: bb.w, usedH: bb.h };
  }

  /* 行/列混排：每一行（列）可以单独选择朝向，动态规划求最优 */
  function stripPattern(L, W, a, b, gap, alongX) {
    var P = alongX ? L : W; // 条带延伸方向
    var Q = alongX ? W : L; // 条带堆叠方向
    // 条带高度 q，条带内纸箱沿 P 方向宽 p
    var types = [{ q: b, p: a, rot: false }, { q: a, p: b, rot: true }];
    var states = [{ pos: 0, count: 0, prev: -1, type: -1 }];
    var bestIdx = 0;
    var queue = [0];
    for (var qi = 0; qi < queue.length; qi++) {
      var si = queue[qi];
      var st = states[si];
      for (var t = 0; t < types.length; t++) {
        var ty = types[t];
        var start = st.pos + (st.pos > 0 ? gap : 0);
        var end = start + ty.q;
        if (end > Q + EPS) continue;
        var across = floorFit(P, ty.p, gap);
        if (!across) continue;
        var cnt = st.count + across;
        var existing = -1;
        for (var k = 1; k < states.length; k++) {
          if (Math.abs(states[k].pos - end) < 1e-5) { existing = k; break; }
        }
        if (existing >= 0) {
          if (states[existing].count < cnt) {
            states[existing].count = cnt;
            states[existing].prev = si;
            states[existing].type = t;
          }
        } else {
          states.push({ pos: end, count: cnt, prev: si, type: t });
          queue.push(states.length - 1);
        }
        if (states[bestIdx].count < cnt && end <= Q + EPS) {
          // best 在下面统一比较
        }
      }
    }
    for (var s = 0; s < states.length; s++) {
      if (states[s].count > states[bestIdx].count) bestIdx = s;
    }
    if (!states[bestIdx].count) return null;

    var seq = [];
    var cur = bestIdx;
    while (cur > 0) {
      seq.push(states[cur]);
      cur = states[cur].prev;
    }
    seq.reverse();

    var rects = [];
    var pos = 0;
    for (var s2 = 0; s2 < seq.length; s2++) {
      var rec = seq[s2];
      var ty2 = types[rec.type];
      var start2 = pos + (pos > 0 ? gap : 0);
      var across2 = floorFit(P, ty2.p, gap);
      for (var j = 0; j < across2; j++) {
        var px = j * (ty2.p + gap);
        var py = start2;
        if (alongX) rects.push(makeRect(px, py, ty2.p, ty2.q, ty2.rot));
        else rects.push(makeRect(py, px, ty2.q, ty2.p, ty2.rot));
      }
      pos = start2 + ty2.q;
    }
    var bd = bounds(rects);
    return { count: rects.length, rects: rects, usedW: bd.w, usedH: bd.h };
  }

  /* 四臂风车：四条边各放一排箱子，中间留空，适合 20 箱这类“5+5+5+5” */
  function windmillPattern(L, W, a, b, gap) {
    gap = Math.max(0, n(gap));
    if (!(L > 2 * a) || !(W > 2 * a)) return null;
    var pitch = b + gap;
    var nh = floorFit(L - a, b, gap);
    var nv = floorFit(W - a, b, gap);
    if (!nh || !nv) return null;
    var armH = nh * b + Math.max(0, nh - 1) * gap;
    var armV = nv * b + Math.max(0, nv - 1) * gap;
    // 四条臂分别从四个角向内伸出
    var topX = L - a - armH;
    var bottomX = a;
    var leftY = W - a - armV;
    var rightY = a;
    if (topX < -EPS || bottomX + armH > L + EPS) return null;
    if (leftY < -EPS || rightY + armV > W + EPS) return null;
    var rects = [];
    var i;
    for (i = 0; i < nh; i++) {
      // 上下两臂：箱子旋转 90°，沿托盘长边排
      rects.push(makeRect(topX + i * pitch, W - a, b, a, true));
      rects.push(makeRect(bottomX + i * pitch, 0, b, a, true));
    }
    for (i = 0; i < nv; i++) {
      // 左右两臂：箱子平放，沿托盘宽边排
      rects.push(makeRect(0, leftY + i * pitch, a, b, false));
      rects.push(makeRect(L - a, rightY + i * pitch, a, b, false));
    }
    // 校验越界/重叠，避免特殊尺寸下拼出无效布局
    var ok = true;
    for (i = 0; i < rects.length && ok; i++) {
      var r = rects[i];
      if (r.x < -EPS || r.y < -EPS || r.x + r.w > L + EPS || r.y + r.h > W + EPS) { ok = false; break; }
      for (var j = i + 1; j < rects.length; j++) {
        var s = rects[j];
        var ox = Math.min(r.x + r.w, s.x + s.w) - Math.max(r.x, s.x);
        var oy = Math.min(r.y + r.h, s.y + s.h) - Math.max(r.y, s.y);
        if (ox > EPS && oy > EPS) { ok = false; break; }
      }
    }
    if (!ok) return null;
    var bd = bounds(rects);
    return { count: rects.length, rects: rects, usedW: bd.w, usedH: bd.h };
  }

  /* 风车拼花：4 箱围成一个 (a+b) 方块，可平铺，空档补顺排 */
  function pinwheelPattern(L, W, a, b, gap) {
    var block = a + b + gap;     // 一个风车方块（含内部间隙）的边长
    var pitch = block + gap;     // 方块之间再留一个间隙
    var nx = Math.floor((L + gap + EPS) / pitch);
    var ny = Math.floor((W + gap + EPS) / pitch);
    if (!nx || !ny) return null;
    var rects = [];
    var bx, by;
    for (by = 0; by < ny; by++) {
      for (bx = 0; bx < nx; bx++) {
        var x = bx * pitch, y = by * pitch;
        // 四箱围成一个方块，箱与箱之间留 gap，方块之间也留 gap
        rects.push(makeRect(x, y, a, b, false));
        rects.push(makeRect(x + a + gap, y, b, a, true));
        rects.push(makeRect(x + b + gap, y + a + gap, a, b, false));
        rects.push(makeRect(x, y + b + gap, b, a, true));
      }
    }
    var usedW = nx * pitch - gap;
    var usedH = ny * pitch - gap;

    function fill(x0, y0, w, h) {
      if (w <= EPS || h <= EPS) return 0;
      var g1 = grid(w, h, a, b, gap, false);
      var g2 = grid(w, h, b, a, gap, true);
      var pick = g1 && g2 ? (g1.count >= g2.count ? g1 : g2) : (g1 || g2);
      if (!pick) return 0;
      for (var i = 0; i < pick.rects.length; i++) {
        var r = pick.rects[i];
        rects.push(makeRect(r.x + x0, r.y + y0, r.w, r.h, r.rot));
      }
      return pick.count;
    }

    fill(usedW + gap, 0, L - usedW - gap, usedH);
    fill(0, usedH + gap, L, W - usedH - gap);

    var bd = bounds(rects);
    return { count: rects.length, rects: rects, usedW: bd.w, usedH: bd.h };
  }

  function centerLayout(best, L, W) {
    var bd = bounds(best.rects);
    var dx = Math.max(0, (L - bd.w) / 2);
    var dy = Math.max(0, (W - bd.h) / 2);
    if (dx || dy) {
      for (var i = 0; i < best.rects.length; i++) {
        best.rects[i].x += dx;
        best.rects[i].y += dy;
      }
    }
    best.usedW = bd.w;
    best.usedH = bd.h;
    best.offsetX = dx;
    best.offsetY = dy;
    return best;
  }

  /**
   * 单层最优排布
   * @param {number} L 可用长
   * @param {number} W 可用宽
   * @param {number} a 纸箱沿长边尺寸
   * @param {number} b 纸箱沿宽边尺寸
   * @param {number} gap 箱间间隙
   */
  function solveLayer(L, W, a, b, gap) {
    gap = Math.max(0, n(gap));
    if (!(L > EPS) || !(W > EPS) || !(a > EPS) || !(b > EPS)) {
      return { count: 0, rects: [], pattern: '—', patternKey: 'none', usedW: 0, usedH: 0 };
    }
    var cands = [];
    function add(p, name, key, rank) {
      if (p && p.count > 0) {
        cands.push({ count: p.count, rects: p.rects, usedW: p.usedW, usedH: p.usedH,
          pattern: name, patternKey: key, rank: rank });
      }
    }

    add(grid(L, W, a, b, gap, false), '整层顺排', 'grid', 6);
    if (Math.abs(a - b) > EPS) add(grid(L, W, b, a, gap, true), '整层旋转 90°', 'grid90', 5);
    add(splitPattern(L, W, a, b, gap, true), '纵向对拼', 'splitX', 4);
    add(splitPattern(L, W, a, b, gap, false), '横向对拼', 'splitY', 4);
    add(guillotinePattern(L, W, a, b, gap, 2), '多段对拼', 'guillotine', 4);
    add(windmillPattern(L, W, a, b, gap), '风车拼花', 'pinwheel', 2);
    add(stripPattern(L, W, a, b, gap, true), '横向混排', 'rows', 3);
    add(stripPattern(L, W, a, b, gap, false), '纵向混排', 'cols', 3);
    add(pinwheelPattern(L, W, a, b, gap), '风车拼花', 'pinwheel', 2);

    if (!cands.length) {
      return { count: 0, rects: [], pattern: '—', patternKey: 'none', usedW: 0, usedH: 0 };
    }
    cands.sort(function (p, q) {
      if (q.count !== p.count) return q.count - p.count;
      if (q.rank !== p.rank) return q.rank - p.rank;
      return (p.usedW * p.usedH) - (q.usedW * q.usedH);
    });
    var best = cands[0];
    centerLayout(best, L, W);
    best.pattern = best.pattern;
    return best;
  }

  /* ------------------------------------------------------------------ *
   * 参数归一化 / 朝向
   * ------------------------------------------------------------------ */

  var DEFAULTS = {
    pallet: { L: 120, W: 80, H: 115, base: 0 },
    carton: { name: '纸箱', l: 28, w: 18, h: 10, qty: 500, weight: 0.15 },
    gap: 0,
    margin: 0,
    sheet: 0,
    sheetEvery: 2,
    overhang: 0,
    maxLoad: 0,
    maxLayers: 0,
    allowFlat: true,
    allowSide: false,
    allowUprightLay: false
  };

  function normalize(raw) {
    raw = raw || {};
    var p = raw.pallet || {};
    var c = raw.carton || {};
    var totalH = Math.max(0, n(p.H, DEFAULTS.pallet.H));
    var baseH = Math.max(0, n(p.base != null ? p.base : raw.palletBase, DEFAULTS.pallet.base));
    var cfg = {
      pallet: {
        L: Math.max(0, n(p.L, DEFAULTS.pallet.L)),
        W: Math.max(0, n(p.W, DEFAULTS.pallet.W)),
        H: totalH,
        base: baseH,
        stackH: Math.max(0, totalH - baseH)
      },
      carton: {
        name: c.name == null ? DEFAULTS.carton.name : String(c.name),
        l: Math.max(0, n(c.l, DEFAULTS.carton.l)),
        w: Math.max(0, n(c.w, DEFAULTS.carton.w)),
        h: Math.max(0, n(c.h, DEFAULTS.carton.h)),
        qty: Math.max(0, n(c.qty, 0)),
        weight: Math.max(0, n(c.weight, 0))
      },
      gap: Math.max(0, n(raw.gap, 0)),
      margin: Math.max(0, n(raw.margin, 0)),
      sheet: Math.max(0, n(raw.sheet, 0)),
      sheetEvery: Math.max(0, Math.floor(n(raw.sheetEvery, DEFAULTS.sheetEvery))),
      overhang: Math.max(0, n(raw.overhang, 0)),
      maxLoad: Math.max(0, n(raw.maxLoad, 0)),
      maxLayers: Math.max(0, Math.floor(n(raw.maxLayers, 0))),
      // 平放 = 原包装方向（箱高朝上），始终保留
      allowFlat: raw.allowFlat !== false,
      // 侧立：用纸箱的“宽”作高
      allowSide: !!(raw.allowSide || raw.allowSideLay),
      // 竖放：用纸箱的“长”作高
      allowUprightLay: !!(raw.allowUprightLay || raw.allowSideLay)
    };
    cfg.stackH = cfg.pallet.stackH;
    return cfg;
  }

  function sheetCountFor(layers, cfg) {
    if (!(layers > 1) || !(cfg.sheet > 0) || !(cfg.sheetEvery > 0)) return 0;
    return Math.floor((layers - 1) / cfg.sheetEvery);
  }

  function layerHeightFor(layers, thickness, cfg) {
    if (!(layers > 0)) return 0;
    return layers * thickness + sheetCountFor(layers, cfg) * cfg.sheet;
  }

  function nextLayerHeight(existingLayers, thickness, cfg) {
    var board = existingLayers > 0 && cfg.sheet > 0 && cfg.sheetEvery > 0 &&
      existingLayers % cfg.sheetEvery === 0;
    return thickness + (board ? cfg.sheet : 0);
  }

  function maxLayersByHeight(H, thickness, cfg) {
    if (!(thickness > 0)) return 0;
    var max = Math.floor((H + EPS) / thickness);
    while (max > 0 && layerHeightFor(max, thickness, cfg) > H + EPS) max--;
    return max;
  }

  function orientations(cfg) {
    var l = cfg.carton.l, w = cfg.carton.w, h = cfg.carton.h;
    var list = [];
    var seen = {};
    function add(thickness, a, b, key, label) {
      if (!(thickness > EPS) || !(a > EPS) || !(b > EPS)) return;
      var sig = [round(thickness, 4), round(Math.min(a, b), 4), round(Math.max(a, b), 4)].join('|');
      if (seen[sig]) return;
      seen[sig] = 1;
      list.push({ thickness: thickness, a: a, b: b, key: key, label: label });
    }
    // 顺序即优先级：平放优先，其次侧立，最后竖放
    if (cfg.allowFlat) add(h, l, w, 'flat', '平放');
    if (cfg.allowSide) add(w, l, h, 'side', '侧立（宽作高）');
    if (cfg.allowUprightLay) add(l, w, h, 'uprightLay', '竖放（长作高）');
    return list;
  }

  /* ------------------------------------------------------------------ *
   * 整托求解
   * ------------------------------------------------------------------ */

  /**
   * @param {object} raw 参数
   * @param {object} [dims] 可选：{L,W,H} 覆盖托盘尺寸（用于放量预览）
   */
  function solveStack(raw, dims) {
    var cfg = normalize(raw);
    var L = dims && dims.L != null ? n(dims.L) : cfg.pallet.L;
    var W = dims && dims.W != null ? n(dims.W) : cfg.pallet.W;
    var totalH = dims && dims.H != null ? n(dims.H) : cfg.pallet.H;
    var baseH = cfg.pallet.base;
    var H = Math.max(0, totalH - baseH);

    var effL = L + 2 * cfg.overhang - 2 * cfg.margin;
    var effW = W + 2 * cfg.overhang - 2 * cfg.margin;
    var originX = -cfg.overhang + cfg.margin;
    var originY = -cfg.overhang + cfg.margin;

    var result = {
      ok: false,
      cfg: cfg,
      dims: { L: L, W: W, H: totalH, base: baseH, usableH: H },
      effective: { L: effL, W: effW, H: H, originX: originX, originY: originY },
      total: 0,
      layers: 0,
      perLayer: 0,
      pitch: 0,
      usedHeight: 0,
      weight: 0,
      areaUtil: 0,
      volUtil: 0,
      pallets: 0,
      lastCount: 0,
      warnings: [],
      candidates: []
    };

    if (!(effL > EPS) || !(effW > EPS) || !(H > EPS) ||
        !(cfg.carton.l > EPS) || !(cfg.carton.w > EPS) || !(cfg.carton.h > EPS)) {
      result.warnings.push('尺寸不完整，无法计算。');
      return result;
    }

    var ors = orientations(cfg);
    var best = null;
    var qty = cfg.carton.qty;

    function addCandidate(o, layer) {
      var layers = maxLayersByHeight(H, o.thickness, cfg);
      if (!layers) return;

      var capByLayer = cfg.maxLayers > 0 ? cfg.maxLayers : Infinity;
      var capByWeight = Infinity;
      if (cfg.maxLoad > 0 && cfg.carton.weight > 0) {
        capByWeight = Math.floor(cfg.maxLoad / (layer.count * cfg.carton.weight) + EPS);
      }
      var rawLayers = layers;
      layers = Math.min(layers, capByLayer, capByWeight);
      if (layers < rawLayers) {
        if (capByWeight < capByLayer && capByWeight === layers) {
          result.warnings.push('受最大载重限制，层数由 ' + rawLayers + ' 层降为 ' + layers + ' 层。');
        } else if (capByLayer === layers) {
          result.warnings.push('受最大堆叠层数限制，层数由 ' + rawLayers + ' 层降为 ' + layers + ' 层。');
        }
      }
      if (layers <= 0) return;

      var total = layers * layer.count;
      var usedHeight = layerHeightFor(layers, o.thickness, cfg);
      var weight = total * cfg.carton.weight;
      var vol = cfg.carton.l * cfg.carton.w * cfg.carton.h * total;
      var boards = sheetCountFor(layers, cfg);
      var pitch = layers > 1 ? usedHeight / layers : o.thickness;

      var cand = {
        orientation: o,
        layer: layer,
        layers: layers,
        total: total,
        pitch: pitch,
        usedHeight: usedHeight,
        sheetCount: boards,
        weight: weight,
        areaUtil: layer.count * o.a * o.b / (effL * effW),
        volUtil: vol / (L * W * H),
        rank: o.index != null ? o.index : 0
      };
      result.candidates.push(cand);

      if (!best) {
        best = cand;
      } else if (cand.total > best.total ||
                 (cand.total === best.total && cand.rank < best.rank)) {
        best = cand;
      }
    }

    for (var i = 0; i < ors.length; i++) {
      var o = ors[i];
      o.index = i;
      var layer = solveLayer(effL, effW, o.a, o.b, cfg.gap);
      if (!layer.count) continue;
      addCandidate(o, layer);
    }

    if (!best) {
      result.warnings.push('纸箱任一允许朝向都放不进托盘，请检查尺寸或放宽容许。');
      return result;
    }

    result.ok = true;
    result.total = best.total;
    result.layers = best.layers;
    result.perLayer = best.layer.count;
    result.pitch = best.pitch;
    result.usedHeight = best.usedHeight;
    result.sheetCount = best.sheetCount;
    result.weight = best.weight;
    result.areaUtil = best.areaUtil;
    result.volUtil = best.volUtil;
    result.layer = best.layer;
    result.orientation = best.orientation;
    result.candidates = result.candidates;

    // 纸箱实际占据的世界坐标（含超出/余量偏移）
    for (var r = 0; r < result.layer.rects.length; r++) {
      result.layer.rects[r].wx = result.layer.rects[r].x + originX;
      result.layer.rects[r].wy = result.layer.rects[r].y + originY;
    }

    if (qty > 0) {
      result.pallets = Math.ceil(qty / result.total);
      result.lastCount = qty - (result.pallets - 1) * result.total;
    }
    result.volumePerCarton = cfg.carton.l * cfg.carton.w * cfg.carton.h;

    return result;
  }

  function layerBoxes(sol, limitCount) {
    if (!sol || !sol.ok) return [];
    var boxes = [];
    var remain = limitCount && limitCount > 0 ? limitCount : Infinity;
    for (var li = 0; li < sol.layers; li++) {
      for (var i = 0; i < sol.layer.rects.length; i++) {
        if (remain <= 0) return boxes;
        var r = sol.layer.rects[i];
        boxes.push({
          x: r.wx, y: r.wy, z: li * sol.pitch,
          w: r.w, d: r.h, h: sol.orientation.thickness,
          rot: r.rot, layer: li
        });
        remain--;
      }
    }
    return boxes;
  }

  /* ------------------------------------------------------------------ *
   * 放量分析
   * ------------------------------------------------------------------ */

  function stepValues(limit, step) {
    var vals = [];
    var v = 0;
    while (v <= limit + 1e-9) {
      vals.push(round(v, 3));
      v += step;
    }
    if (vals[vals.length - 1] < limit - 1e-9) vals.push(round(limit, 3));
    return vals;
  }

  function chooseStep(limits) {
    var axes = [limits.L, limits.W, limits.H];
    var step = 1;
    for (var guard = 0; guard < 6; guard++) {
      var combos = 1;
      for (var i = 0; i < 3; i++) combos *= Math.floor(axes[i] / step) + 1;
      if (combos <= 26000) return { step: step, combos: combos };
      step *= 2;
    }
    return { step: step, combos: 0 };
  }

  function solveLayerCached(map, L, W, a, b, gap) {
    var key = [round(L, 4), round(W, 4), a, b, gap].join('|');
    if (map.has(key)) return map.get(key);
    var v = solveLayer(L, W, a, b, gap);
    map.set(key, v);
    return v;
  }

  /**
   * 长宽高放量分析
   * @param {object} raw 基准参数
   * @param {object} limits {L,W,H} 各方向最多可增加 mm
   * @param {object} [opts] {step}
   */
  function analyzeExpansion(raw, limits, opts) {
    var cfg = normalize(raw);
    limits = limits || {};
    var lim = {
      L: Math.max(0, n(limits.L)),
      W: Math.max(0, n(limits.W)),
      H: Math.max(0, n(limits.H))
    };
    var step = Math.max(0.1, n(opts && opts.step, 0) || chooseStep(lim).step);
    var dLs = stepValues(lim.L, step);
    var dWs = stepValues(lim.W, step);
    var dHs = stepValues(lim.H, step);

    var base = solveStack(cfg);
    var ors = orientations(cfg);
    var grid = [];
    var cache = new Map();
    var pairData = [];

    var i, j, k, o;
    for (i = 0; i < dLs.length; i++) {
      for (j = 0; j < dWs.length; j++) {
        var L = cfg.pallet.L + dLs[i];
        var W = cfg.pallet.W + dWs[j];
        var effL = L + 2 * cfg.overhang - 2 * cfg.margin;
        var effW = W + 2 * cfg.overhang - 2 * cfg.margin;
        var row = [];
        for (o = 0; o < ors.length; o++) {
          var layer = solveLayerCached(cache, effL, effW, ors[o].a, ors[o].b, cfg.gap);
          var capByWeight = Infinity;
          if (cfg.maxLoad > 0 && cfg.carton.weight > 0 && layer.count > 0) {
            capByWeight = Math.floor(cfg.maxLoad / (layer.count * cfg.carton.weight) + EPS);
          }
          row.push({
            perLayer: layer.count,
            thickness: ors[o].thickness,
            capByWeight: capByWeight
          });
        }
        pairData.push({ dL: dLs[i], dW: dWs[j], orients: row });
      }
    }

    var results = [];
    for (k = 0; k < dHs.length; k++) {
      var H = Math.max(0, cfg.pallet.H + dHs[k] - cfg.pallet.base);
      for (var p = 0; p < pairData.length; p++) {
        var pair = pairData[p];
        var bestTotal = 0, bestPerLayer = 0, bestLayers = 0;
        for (o = 0; o < pair.orients.length; o++) {
          var d = pair.orients[o];
          if (!d.perLayer) continue;
          var nL = maxLayersByHeight(H, d.thickness, cfg);
          if (cfg.maxLayers > 0) nL = Math.min(nL, cfg.maxLayers);
          if (d.capByWeight >= 0) nL = Math.min(nL, d.capByWeight);
          if (nL <= 0) continue;
          var total = nL * d.perLayer;
          if (total > bestTotal) {
            bestTotal = total;
            bestPerLayer = d.perLayer;
            bestLayers = nL;
          }
        }
        results.push({
          dL: pair.dL, dW: pair.dW, dH: dHs[k],
          total: bestTotal, perLayer: bestPerLayer, layers: bestLayers,
          cost: round(pair.dL + pair.dW + dHs[k], 3)
        });
      }
    }

    var baseTotal = base.ok ? base.total : 0;
    var byCount = new Map();
    for (i = 0; i < results.length; i++) {
      var r = results[i];
      if (r.total <= 0) continue;
      var prev = byCount.get(r.total);
      if (!prev || betterOption(r, prev)) byCount.set(r.total, r);
    }

    var counts = Array.from(byCount.keys()).sort(function (a, b) { return a - b; });
    var frontier = [];
    var minCostSeen = Infinity;
    // 从大箱数往小扫描：只有「更少箱数却更贵」的点才会被支配
    for (i = counts.length - 1; i >= 0; i--) {
      var opt = byCount.get(counts[i]);
      if (opt.cost < minCostSeen) {
        frontier.push(opt);
        minCostSeen = opt.cost;
      }
    }
    frontier.reverse();

    function betterOption(a, b) {
      if (a.cost !== b.cost) return a.cost < b.cost;
      var ca = changedDims(a), cb = changedDims(b);
      if (ca !== cb) return ca < cb;
      return (a.dL + a.dW * 1.001 + a.dH * 1.002) < (b.dL + b.dW * 1.001 + b.dH * 1.002);
    }
    function changedDims(r) {
      return (r.dL > 0 ? 1 : 0) + (r.dW > 0 ? 1 : 0) + (r.dH > 0 ? 1 : 0);
    }

    var maxTotal = 0, maxOpt = null;
    for (i = 0; i < frontier.length; i++) {
      if (frontier[i].total > maxTotal) { maxTotal = frontier[i].total; maxOpt = frontier[i]; }
    }

    // 单方向收益
    var singleAxis = {};
    ['L', 'W', 'H'].forEach(function (axis) {
      var list = [];
      for (i = 0; i < results.length; i++) {
        var r = results[i];
        if (axis === 'L' && (r.dW > 0 || r.dH > 0)) continue;
        if (axis === 'W' && (r.dL > 0 || r.dH > 0)) continue;
        if (axis === 'H' && (r.dL > 0 || r.dW > 0)) continue;
        if (r.total > baseTotal) {
          var key = r.total;
          if (!list.some(function (x) { return x.total === key; })) list.push(r);
        }
      }
      list.sort(function (a, b) { return a.total - b.total; });
      var picked = [];
      if (list.length <= 4) picked = list;
      else {
        picked = [list[0], list[Math.floor(list.length / 2)], list[list.length - 1]];
      }
      singleAxis[axis] = picked.map(function (r) {
        return { delta: axis === 'L' ? r.dL : axis === 'W' ? r.dW : r.dH,
          total: r.total, gain: r.total - baseTotal, cost: r.cost };
      });
    });

    var options = [];
    function addOpt(kind, title, r, note) {
      if (!r) return;
      if (options.some(function (x) { return x.dL === r.dL && x.dW === r.dW && x.dH === r.dH; })) return;
      options.push({
        kind: kind, title: title,
        dL: r.dL, dW: r.dW, dH: r.dH,
        total: r.total, gain: r.total - baseTotal,
        perLayer: r.perLayer, layers: r.layers,
        cost: r.cost, note: note || ''
      });
    }

    var fitOpt = null;
    if (cfg.carton.qty > 0 && baseTotal < cfg.carton.qty) {
      for (i = 0; i < frontier.length; i++) {
        if (frontier[i].total >= cfg.carton.qty) { fitOpt = frontier[i]; break; }
      }
      if (fitOpt) addOpt('fit', '一托装下全部', fitOpt, '按订单数量优先');
    }

    var minGain = null;
    for (i = 0; i < frontier.length; i++) {
      if (frontier[i].total > baseTotal) { minGain = frontier[i]; break; }
    }

    var hOnly = null;
    for (i = 0; i < frontier.length; i++) {
      var f = frontier[i];
      if (f.dL === 0 && f.dW === 0 && f.total > baseTotal) { hOnly = f; break; }
    }
    if (hOnly) addOpt('height', '只加高', hOnly, '长宽不变，只抬高层数');
    if (minGain) addOpt('min', '最小改动', minGain, '增加最少毫米');

    if (maxOpt && maxTotal > baseTotal) addOpt('max', '容量最大', maxOpt, '允许范围内能装最多');

    if (options.length < 3 && maxTotal > baseTotal) {
      var picks = [frontier[Math.floor(frontier.length / 2)], frontier[frontier.length - 1]];
      for (i = 0; i < picks.length; i++) {
        if (picks[i] && picks[i].total > baseTotal) addOpt('more', '候选方案', picks[i], '');
      }
    }

    var order = { fit: 0, height: 1, min: 2, max: 3, more: 4 };
    options.sort(function (a, b) { return (order[a.kind] - order[b.kind]) || (a.cost - b.cost); });

    // 3D 网格（用于热力图/导出）
    var cube = {};
    for (i = 0; i < results.length; i++) {
      cube[results[i].dL + ',' + results[i].dW + ',' + results[i].dH] = results[i].total;
    }

    return {
      base: base,
      limits: lim,
      step: step,
      dLs: dLs, dWs: dWs, dHs: dHs,
      results: results,
      cube: cube,
      baseTotal: baseTotal,
      maxTotal: maxTotal,
      maxOption: maxOpt,
      frontier: frontier,
      options: options,
      singleAxis: singleAxis
    };
  }

  function utilizationText(v) {
    return (Math.round(v * 1000) / 10).toFixed(1) + '%';
  }

  /* ------------------------------------------------------------------ *
   * 订单托盘计划：按层装托，尾箱可混托
   * ------------------------------------------------------------------ */

  function rectSubset(rects, count) {
    if (count >= rects.length) return rects;
    if (count <= 0) return [];
    var out = [];
    for (var i = 0; i < count; i++) {
      var idx = Math.min(rects.length - 1, Math.floor((i + 0.5) * rects.length / count));
      out.push(rects[idx]);
    }
    return out;
  }

  function makeLayerUnit(cfg, sol, skuIndex, count, partial) {
    return {
      skuIndex: skuIndex,
      count: count,
      thickness: sol.orientation.thickness,
      weight: count * cfg.carton.weight,
      bulk: count * cfg.carton.l * cfg.carton.w * cfg.carton.h,
      partial: !!partial,
      pattern: sol.layer.pattern,
      rects: partial ? rectSubset(sol.layer.rects, count) : sol.layer.rects
    };
  }

  function supportRatio(topRects, belowRects) {
    if (!topRects || !topRects.length) return 1;
    if (!belowRects || !belowRects.length) return 0;
    var min = 1, sum = 0, areaSum = 0;
    topRects.forEach(function (r) {
      var area = r.w * r.h;
      if (!(area > 0)) return;
      var covered = 0;
      belowRects.forEach(function (b) {
        var ox = Math.min(r.wx + r.w, b.wx + b.w) - Math.max(r.wx, b.wx);
        var oy = Math.min(r.wy + r.h, b.wy + b.h) - Math.max(r.wy, b.wy);
        if (ox > 0 && oy > 0) covered += ox * oy;
      });
      var ratio = Math.min(1, covered / area);
      min = Math.min(min, ratio);
      sum += ratio * area;
      areaSum += area;
    });
    return { min: min, avg: areaSum ? sum / areaSum : 1 };
  }

  function palletSupport(p, cfg) {
    var zz = unitZPositions(p, cfg || {});
    var min = 1, sum = 0, layers = 0, low = [];
    for (var i = 0; i < p.units.length; i++) {
      var z0 = zz[i];
      if (!(z0 > EPS)) continue;
      var below = [];
      for (var j = 0; j < p.units.length; j++) {
        if (j === i) continue;
        var top = zz[j] + p.units[j].thickness;
        if (top <= z0 + EPS) below = below.concat(p.units[j].rects);
      }
      var s = supportRatio(p.units[i].rects, below);
      min = Math.min(min, s.min);
      sum += s.avg;
      layers++;
      if (s.min < SUPPORT_MIN) low.push(i + 1);
    }
    return { min: layers ? min : 1, avg: layers ? sum / layers : 1, lowLayers: low };
  }

  function rectSignature(rects) {
    return rects.map(function (r) {
      return [round(r.x, 2), round(r.y, 2), round(r.w, 2), round(r.h, 2), r.rot ? 1 : 0].join(',');
    }).sort().join('|');
  }

  function makeLayerVariant(cfg, sol, skuIndex, count, kind) {
    var base = makeLayerUnit(cfg, sol, skuIndex, count, false);
    var L = sol.effective.L, W = sol.effective.W;
    var ox = sol.effective.originX, oy = sol.effective.originY;
    var rects = base.rects.map(function (r) {
      var x = r.x, y = r.y, w = r.w, h = r.h, rot = !!r.rot;
      if (kind === 'mirrorX') {
        x = L - r.x - r.w;
      } else if (kind === 'mirrorY') {
        y = W - r.y - r.h;
      } else if (kind === 'rot180') {
        x = L - r.x - r.w;
        y = W - r.y - r.h;
      } else if (kind === 'rot90') {
        x = W - r.y - r.h;
        y = r.x;
        w = r.h;
        h = r.w;
        rot = !rot;
      }
      return {
        x: x, y: y, w: w, h: h, rot: rot,
        wx: ox + x, wy: oy + y,
        skuIndex: r.skuIndex, thickness: r.thickness
      };
    });
    if (rects.some(function (r) {
      return r.x < -EPS || r.y < -EPS || r.x + r.w > L + EPS || r.y + r.h > W + EPS;
    })) return null;
    var unit = Object.assign({}, base, {
      rects: rects,
      pattern: base.pattern + ' · 交错层',
      interlockKind: kind
    });
    if (rectSignature(rects) === rectSignature(base.rects)) return null;
    return unit;
  }

  function chooseInterlockUnit(cfg, sol, skuIndex, count) {
    var base = makeLayerUnit(cfg, sol, skuIndex, count, false);
    var kinds = Math.abs(sol.effective.L - sol.effective.W) <= 0.5
      ? ['rot90', 'rot180', 'mirrorX', 'mirrorY']
      : ['rot180', 'mirrorX', 'mirrorY'];
    for (var i = 0; i < kinds.length; i++) {
      var unit = makeLayerVariant(cfg, sol, skuIndex, count, kinds[i]);
      if (!unit) continue;
      var a = supportRatio(unit.rects, base.rects);
      var b = supportRatio(base.rects, unit.rects);
      if (a.min >= SUPPORT_MIN && b.min >= SUPPORT_MIN) {
        return { base: base, alt: unit, kind: kinds[i] };
      }
    }
    return { base: base, alt: null, kind: '' };
  }

  function unitZPositions(p, cfg) {
    var z = 0, out = [];
    p.units.forEach(function (u, i) {
      var z0 = u.z0 != null ? u.z0 : z;
      out.push(z0);
      var board = i > 0 && cfg.sheet > 0 && cfg.sheetEvery > 0 && i % cfg.sheetEvery === 0;
      z = Math.max(z, z0 + u.thickness) + (board ? cfg.sheet : 0);
    });
    return out;
  }

  function refreshPallet(p, cfg) {
    var height = 0, weight = 0, boxes = 0, bySku = {};
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    var zz = unitZPositions(p, cfg);
    for (var i = 0; i < p.units.length; i++) {
      var u = p.units[i];
      height = Math.max(height, zz[i] + u.thickness);
      weight += u.weight;
      boxes += u.count;
      if (u.parts) {
        u.parts.forEach(function (part) {
          bySku[part.skuIndex] = (bySku[part.skuIndex] || 0) + part.count;
        });
      } else {
        bySku[u.skuIndex] = (bySku[u.skuIndex] || 0) + u.count;
      }
      for (var r = 0; r < u.rects.length; r++) {
        var rect = u.rects[r];
        if (rect.wx < minX) minX = rect.wx;
        if (rect.wy < minY) minY = rect.wy;
        if (rect.wx + rect.w > maxX) maxX = rect.wx + rect.w;
        if (rect.wy + rect.h > maxY) maxY = rect.wy + rect.h;
      }
    }
    p.layers = p.units.length;
    p.height = height;
    p.weight = weight;
    p.boxes = boxes;
    p.skuBreakdown = bySku;
    p.hasPartial = p.units.some(function (u) { return u.partial; });
    if (!isFinite(minX)) { minX = 0; minY = 0; maxX = 0; maxY = 0; }
    p.actual = {
      x0: minX, y0: minY, x1: maxX, y1: maxY,
      L: maxX - minX, W: maxY - minY, H: height
    };
    return p;
  }

  function makePallet(units, cfg, type, skuIndex) {
    var p = { type: type || 'full', skuIndex: skuIndex, units: units.slice() };
    return refreshPallet(p, cfg);
  }

  function gridPlace(group, x0, y0, areaW, areaH, ori, count, gap) {
    var cols = Math.floor((areaW + gap + EPS) / (ori.w + gap));
    var rows = Math.floor((areaH + gap + EPS) / (ori.h + gap));
    if (!cols || !rows || cols * rows < count) return null;
    var out = [];
    for (var i = 0; i < count; i++) {
      var c = i % cols, r = Math.floor(i / cols);
      out.push({
        x: x0 + c * (ori.w + gap), y: y0 + r * (ori.h + gap),
        w: ori.w, h: ori.h, rot: ori.rot,
        skuIndex: group[0].skuIndex, thickness: group[0].thickness, weight: group[0].weight
      });
    }
    return out;
  }

  function groupOrientations(group) {
    var b = group[0];
    var long = Math.max(b.w, b.h), short = Math.min(b.w, b.h);
    var out = [{ w: long, h: short, rot: 0 }];
    if (long - short > EPS) out.push({ w: short, h: long, rot: 90 });
    return out;
  }

  function packTwoGroups(primary, secondary, L, W, gap) {
    var pOris = groupOrientations(primary);
    var sOris = groupOrientations(secondary);
    for (var po = 0; po < pOris.length; po++) {
      var ori = pOris[po];
      for (var cols = 1; cols <= primary.length; cols++) {
        var rows = Math.ceil(primary.length / cols);
        var pw = cols * ori.w + (cols - 1) * gap;
        var ph = rows * ori.h + (rows - 1) * gap;
        if (pw > L + EPS || ph > W + EPS) continue;
        var pRects = gridPlace(primary, 0, 0, pw, ph, ori, primary.length, gap);
        if (!pRects) continue;

        for (var so = 0; so < sOris.length; so++) {
          var sori = sOris[so];
          for (var order = 0; order < 2; order++) {
            var rects = pRects.slice();
            var remain = secondary.length;
            var rightW = L - pw - gap;
            var topH = W - ph - gap;
            var areas = order === 0
              ? [{ x: pw + gap, y: 0, w: rightW, h: ph }, { x: 0, y: ph + gap, w: L, h: topH }]
              : [{ x: 0, y: ph + gap, w: L, h: topH }, { x: pw + gap, y: 0, w: rightW, h: ph }];
            var ok = true;
            for (var a = 0; a < areas.length && remain > 0; a++) {
              var ar = areas[a];
              if (ar.w <= EPS || ar.h <= EPS) continue;
              var capCols = Math.floor((ar.w + gap + EPS) / (sori.w + gap));
              var capRows = Math.floor((ar.h + gap + EPS) / (sori.h + gap));
              var cap = capCols * capRows;
              if (!cap) continue;
              var n = Math.min(remain, cap);
              var rr = gridPlace(secondary, ar.x, ar.y, ar.w, ar.h, sori, n, gap);
              if (!rr) { ok = false; break; }
              rects = rects.concat(rr);
              remain -= n;
            }
            if (ok && remain === 0) return rects;
          }
        }
      }
    }
    return null;
  }

  /* 把多个尾层的箱子重新排进同一层（允许不同规格同层，箱与箱不重叠） */
  function packMaxRects(boxes, L, W, gap) {
    gap = Math.max(0, gap || 0);
    var list = boxes.slice().sort(function (a, b) {
      var aa = a.w * a.h, bb = b.w * b.h;
      if (bb !== aa) return bb - aa;
      if (b.thickness !== a.thickness) return b.thickness - a.thickness;
      return a.skuIndex - b.skuIndex;
    });
    var free = [{ x: 0, y: 0, w: L, h: W }];
    var placed = [];

    function contains(outer, inner) {
      return inner.x >= outer.x - EPS && inner.y >= outer.y - EPS &&
        inner.x + inner.w <= outer.x + outer.w + EPS &&
        inner.y + inner.h <= outer.y + outer.h + EPS;
    }

    for (var i = 0; i < list.length; i++) {
      var box = list[i];
      var best = null;
      for (var f = 0; f < free.length; f++) {
        var fr = free[f];
        for (var rot = 0; rot < 2; rot++) {
          var bw = rot ? box.h : box.w;
          var bh = rot ? box.w : box.h;
          var sw = bw + gap, sh = bh + gap;
          if (sw > fr.w + EPS || sh > fr.h + EPS) continue;
          var score = Math.min(fr.w - sw, fr.h - sh);
          if (!best || score < best.score ||
              (Math.abs(score - best.score) < EPS && bw * bh > best.bw * best.bh)) {
            best = { f: f, rot: rot, bw: bw, bh: bh, sw: sw, sh: sh, score: score };
          }
        }
      }
      if (!best) return null;

      var fr2 = free[best.f];
      var used = { x: fr2.x, y: fr2.y, w: best.sw, h: best.sh };
      placed.push({
        x: fr2.x, y: fr2.y, w: best.bw, h: best.bh, rot: best.rot,
        skuIndex: box.skuIndex, thickness: box.thickness, weight: box.weight
      });

      var next = [];
      for (var k = 0; k < free.length; k++) {
        var rect = free[k];
        if (rect.x + rect.w <= used.x + EPS || rect.x >= used.x + used.w - EPS ||
            rect.y + rect.h <= used.y + EPS || rect.y >= used.y + used.h - EPS) {
          next.push(rect);
          continue;
        }
        if (used.x > rect.x + EPS) {
          next.push({ x: rect.x, y: rect.y, w: used.x - rect.x, h: rect.h });
        }
        if (used.x + used.w < rect.x + rect.w - EPS) {
          next.push({ x: used.x + used.w, y: rect.y, w: rect.x + rect.w - (used.x + used.w), h: rect.h });
        }
        if (used.y > rect.y + EPS) {
          next.push({ x: rect.x, y: rect.y, w: rect.w, h: used.y - rect.y });
        }
        if (used.y + used.h < rect.y + rect.h - EPS) {
          next.push({ x: rect.x, y: used.y + used.h, w: rect.w, h: rect.y + rect.h - (used.y + used.h) });
        }
      }

      var pruned = [];
      for (var n = 0; n < next.length; n++) {
        var nr = next[n];
        if (nr.w <= EPS || nr.h <= EPS) continue;
        var dominated = false;
        for (var m = 0; m < next.length; m++) {
          if (m === n) continue;
          if (contains(next[m], nr)) {
            var same = Math.abs(next[m].w - nr.w) < EPS && Math.abs(next[m].h - nr.h) < EPS &&
              Math.abs(next[m].x - nr.x) < EPS && Math.abs(next[m].y - nr.y) < EPS;
            if (!same || m < n) { dominated = true; break; }
          }
        }
        if (!dominated) pruned.push(nr);
      }
      free = pruned;
    }
    return placed;
  }

  function packMixedRects(boxes, L, W, gap) {
    var maxRects = packMaxRects(boxes, L, W, gap);
    if (maxRects) return maxRects;

    // 两个规格的尾层：用“主块 + 右条 + 上条”的方块组合，优先保证同层不重叠、不悬空
    var groups = {};
    boxes.forEach(function (b) { (groups[b.skuIndex] = groups[b.skuIndex] || []).push(b); });
    var keys = Object.keys(groups);
    if (keys.length === 2) {
      var a = groups[keys[0]], b = groups[keys[1]];
      var r1 = packTwoGroups(a, b, L, W, gap);
      if (r1) return r1;
      var r2 = packTwoGroups(b, a, L, W, gap);
      if (r2) return r2;
    }
    return null;
  }

  function mergePartialLayers(p, cfg) {
    if (p.units.some(function (u) { return u.substack; })) return p;
    var partials = p.units.filter(function (u) { return u.partial; });
    if (partials.length < 2) return p;

    var boxes = [];
    partials.forEach(function (u) {
      var perWeight = u.count ? u.weight / u.count : 0;
      u.rects.forEach(function (r) {
        boxes.push({
          w: r.w, h: r.h, thickness: u.thickness, weight: perWeight,
          skuIndex: r.skuIndex != null ? r.skuIndex : u.skuIndex
        });
      });
    });

    var effL = cfg.pallet.L + 2 * cfg.overhang - 2 * cfg.margin;
    var effW = cfg.pallet.W + 2 * cfg.overhang - 2 * cfg.margin;
    var originX = -cfg.overhang + cfg.margin;
    var originY = -cfg.overhang + cfg.margin;

    // 有整层时，把混装层限制在整层的实际 footprint 内，避免压到悬空边
    var fx0 = Infinity, fy0 = Infinity, fx1 = -Infinity, fy1 = -Infinity;
    p.units.forEach(function (u) {
      if (u.partial) return;
      u.rects.forEach(function (r) {
        if (r.wx < fx0) fx0 = r.wx;
        if (r.wy < fy0) fy0 = r.wy;
        if (r.wx + r.w > fx1) fx1 = r.wx + r.w;
        if (r.wy + r.h > fy1) fy1 = r.wy + r.h;
      });
    });

    var placed = null;
    var originForRects = { x: originX, y: originY };
    if (isFinite(fx0) && fx1 > fx0 && fy1 > fy0) {
      placed = packMixedRects(boxes, fx1 - fx0, fy1 - fy0, cfg.gap);
      if (placed) originForRects = { x: fx0, y: fy0 };
    }
    if (!placed) {
      placed = packMixedRects(boxes, effL, effW, cfg.gap);
      originForRects = { x: originX, y: originY };
    }
    if (!placed) return p;

    var bySku = {}, maxT = 0, totalW = 0, totalBulk = 0;
    placed.forEach(function (b) {
      bySku[b.skuIndex] = (bySku[b.skuIndex] || 0) + 1;
      if (b.thickness > maxT) maxT = b.thickness;
      totalW += b.weight;
      totalBulk += b.w * b.h * b.thickness;
    });
    var parts = Object.keys(bySku).map(function (si) {
      return { skuIndex: Number(si), count: bySku[si] };
    });
    var rects = placed.map(function (b) {
      return {
        x: b.x, y: b.y, w: b.w, h: b.h, rot: b.rot,
        skuIndex: b.skuIndex, thickness: b.thickness,
        wx: b.x + originForRects.x, wy: b.y + originForRects.y
      };
    });
    var mixedUnit = {
      skuIndex: -1, count: placed.length, thickness: maxT,
      weight: totalW, bulk: totalBulk, partial: true, mixed: true,
      parts: parts, rects: rects, pattern: '混装补空'
    };
    p.units = p.units.filter(function (u) { return !u.partial; }).concat([mixedUnit]);
    p.type = parts.length > 1 ? 'mixed' : 'tail';
    p.skuIndex = parts.length === 1 ? parts[0].skuIndex : -1;
    refreshPallet(p, cfg);
    return p;
  }

  function topPartialInfo(p) {
    for (var i = p.units.length - 1; i >= 0; i--) {
      if (p.units[i].partial) return { index: i, unit: p.units[i] };
    }
    return null;
  }

  function unitBoxes(u) {
    var perWeight = u.count ? u.weight / u.count : 0;
    return u.rects.map(function (r) {
      return {
        w: r.w, h: r.h, thickness: r.thickness || u.thickness, weight: perWeight,
        skuIndex: r.skuIndex != null ? r.skuIndex : u.skuIndex
      };
    });
  }

  function mergeTopInto(target, source, cfg, allowMix, allowRemove) {
    var ti = topPartialInfo(target);
    var si = topPartialInfo(source);
    if (!ti || !si) return false;
    if (!allowRemove && source.units.length <= 1) return false;

    var boxes = unitBoxes(ti.unit).concat(unitBoxes(si.unit));
    if (!allowMix) {
      var skus = {};
      boxes.forEach(function (b) { skus[b.skuIndex] = 1; });
      if (Object.keys(skus).length > 1) return false;
    }

    var fx0 = Infinity, fy0 = Infinity, fx1 = -Infinity, fy1 = -Infinity;
    target.units.forEach(function (u) {
      if (u.partial) return;
      u.rects.forEach(function (r) {
        if (r.wx < fx0) fx0 = r.wx;
        if (r.wy < fy0) fy0 = r.wy;
        if (r.wx + r.w > fx1) fx1 = r.wx + r.w;
        if (r.wy + r.h > fy1) fy1 = r.wy + r.h;
      });
    });

    var effL = cfg.pallet.L + 2 * cfg.overhang - 2 * cfg.margin;
    var effW = cfg.pallet.W + 2 * cfg.overhang - 2 * cfg.margin;
    var originX = -cfg.overhang + cfg.margin;
    var originY = -cfg.overhang + cfg.margin;
    var placed = null, ox = originX, oy = originY;
    if (isFinite(fx0) && fx1 > fx0 && fy1 > fy0) {
      placed = packMixedRects(boxes, fx1 - fx0, fy1 - fy0, cfg.gap);
      if (placed) { ox = fx0; oy = fy0; }
    }
    if (!placed) {
      placed = packMixedRects(boxes, effL, effW, cfg.gap);
      ox = originX; oy = originY;
    }
    if (!placed) return false;

    var bySku = {}, maxT = 0, totalW = 0, totalBulk = 0;
    placed.forEach(function (b) {
      bySku[b.skuIndex] = (bySku[b.skuIndex] || 0) + 1;
      if (b.thickness > maxT) maxT = b.thickness;
      totalW += b.weight;
      totalBulk += b.w * b.h * b.thickness;
    });
    var newH = target.height - ti.unit.thickness + maxT;
    if (newH > cfg.stackH + EPS) return false;
    if (cfg.maxLoad > 0 && target.weight - ti.unit.weight + totalW > cfg.maxLoad + EPS) return false;

    var parts = Object.keys(bySku).map(function (k) {
      return { skuIndex: Number(k), count: bySku[k] };
    });
    var newUnit = {
      skuIndex: -1, count: placed.length, thickness: maxT, weight: totalW, bulk: totalBulk,
      partial: true, mixed: true, parts: parts, pattern: '混装补空',
      rects: placed.map(function (b) {
        return {
          x: b.x, y: b.y, w: b.w, h: b.h, rot: b.rot, skuIndex: b.skuIndex,
          thickness: b.thickness, wx: b.x + ox, wy: b.y + oy
        };
      })
    };

    target.units[ti.index] = newUnit;
    source.units.splice(si.index, 1);
    refreshPallet(target, cfg);
    refreshPallet(source, cfg);
    return true;
  }

  /* 不增加托盘数，尽量把多个不完整顶层并到一个托盘上 */
  function flattenTops(pallets, cfg, allowMix, allowRemove) {
    var merged = 0;
    var list = pallets.slice();
    var guard = 0;

    while (guard++ < 40) {
      var partials = list.filter(function (p) {
        return topPartialInfo(p) && !p.units.some(function (u) { return u.substack; });
      });
      if (partials.length < 2) break;
      partials.sort(function (a, b) {
        return topPartialInfo(b).unit.count - topPartialInfo(a).unit.count;
      });

      var progress = false;
      for (var t = 0; t < partials.length && !progress; t++) {
        var target = partials[t];
        if (list.indexOf(target) < 0) continue;
        var sources = partials.filter(function (p) { return p !== target; });
        sources.sort(function (a, b) {
          return topPartialInfo(a).unit.count - topPartialInfo(b).unit.count;
        });
        for (var s = 0; s < sources.length; s++) {
          var source = sources[s];
          if (list.indexOf(source) < 0) continue;
          if (mergeTopInto(target, source, cfg, allowMix, allowRemove)) {
            merged++;
            progress = true;
            if (!source.units.length) list.splice(list.indexOf(source), 1);
          }
        }
      }
      if (!progress) break;
    }

    return { pallets: list, changed: merged > 0, merged: merged };
  }

  function finalizePalletPlan(plan, cfg) {
    plan.pallets = plan.pallets.filter(function (p) { return p.units && p.units.length; });
    plan.pallets.forEach(function (p, i) {
      p.id = 'P' + (i + 1);
      var keys = Object.keys(p.skuBreakdown);
      p.type = keys.length > 1 ? 'mixed' : (p.hasPartial ? 'tail' : 'full');
      p.skuIndex = keys.length === 1 ? Number(keys[0]) : -1;
    });
    plan.fullPallets = plan.pallets.filter(function (p) { return p.type === 'full'; });
    plan.tailPallets = plan.pallets.filter(function (p) { return p.type === 'tail'; });
    plan.mixedPallets = plan.pallets.filter(function (p) { return p.type === 'mixed'; });
    plan.fullCount = plan.fullPallets.length;
    plan.tailCount = plan.tailPallets.length;
    plan.mixedCount = plan.mixedPallets.length;
    plan.totalPallets = plan.pallets.length;
    plan.totalBoxes = plan.pallets.reduce(function (s, p) { return s + p.boxes; }, 0);
    plan.skus.forEach(function (info) {
      info.palletCount = plan.pallets.filter(function (p) {
        return (p.skuBreakdown[info.index] || 0) > 0;
      }).length;
    });
    plan.partialTopCount = plan.pallets.filter(function (p) { return topPartialInfo(p); }).length;
  }

  function stackOrder(a, b) {
    // 大/重在下，小/轻在上；部分层统一放在整层之上，部分层之间也是重下轻上
    if (a.partial !== b.partial) return a.partial ? 1 : -1;
    if (b.weight !== a.weight) return b.weight - a.weight;
    if (b.bulk !== a.bulk) return b.bulk - a.bulk;
    if (b.thickness !== a.thickness) return b.thickness - a.thickness;
    return a.skuIndex - b.skuIndex;
  }

  function packUnits(units, cfg, options) {
    if (!units.length) return [];
    options = options || {};
    var maxPartials = options.maxPartials == null ? 1 : options.maxPartials;

    // 尾箱层数不多时，用有界回溯求“最少托数”，避免贪心把最后两托拆散
    if (units.length <= 26) {
      var totalH = 0, totalW = 0;
      units.forEach(function (u) {
        totalH += u.thickness;
        totalW += u.weight;
      });
      var lb = 1;
      if (cfg.stackH > 0) lb = Math.max(lb, Math.ceil((totalH + 1e-6) / cfg.stackH));
      if (cfg.maxLoad > 0 && totalW > 0) lb = Math.max(lb, Math.ceil((totalW - 1e-6) / cfg.maxLoad));
      if (cfg.maxLayers > 0) lb = Math.max(lb, Math.ceil(units.length / cfg.maxLayers));
      var maxK = Math.min(units.length, lb + 4);
      for (var k = lb; k <= maxK; k++) {
        var bins = tryPackBins(units, cfg, k, maxPartials);
        if (bins) {
          return bins.filter(function (binUnits) { return binUnits.length; }).map(function (binUnits) {
            var set = {};
            binUnits.forEach(function (u) { set[u.skuIndex] = 1; });
            var keys = Object.keys(set);
            var type = keys.length > 1 ? 'mixed' : 'tail';
            var skuIndex = keys.length === 1 ? Number(keys[0]) : -1;
            return mergePartialLayers(makePallet(binUnits.slice().sort(stackOrder), cfg, type, skuIndex), cfg);
          });
        }
      }
    }

    // 兜底：贪心首次适配（层数多或搜索超时）
    var list = units.slice().sort(function (a, b) {
      if (a.partial !== b.partial) return a.partial ? 1 : -1;
      if (b.thickness !== a.thickness) return b.thickness - a.thickness;
      return a.skuIndex - b.skuIndex;
    });
    var pallets = [];
    list.forEach(function (u) {
      var target = null;
      for (var i = 0; i < pallets.length; i++) {
        var p = pallets[i];
        if (p.partials + (u.partial && !u.substack ? 1 : 0) > maxPartials) continue;
        if (cfg.maxLayers > 0 && p.layers >= cfg.maxLayers) continue;
        var extra = nextLayerHeight(p.layers, u.thickness, cfg);
        if (p.height + extra > cfg.stackH + EPS) continue;
        if (cfg.maxLoad > 0 && p.weight + u.weight > cfg.maxLoad + EPS) continue;
        target = p;
        break;
      }
      if (!target) {
        target = { units: [], height: 0, weight: 0, layers: 0, partials: 0 };
        pallets.push(target);
      }
      var add = nextLayerHeight(target.layers, u.thickness, cfg);
      target.units.push(u);
      target.height += add;
      target.weight += u.weight;
      target.layers += 1;
      target.partials += u.partial && !u.substack ? 1 : 0;
    });
    return pallets.map(function (p) {
      var set = {};
      p.units.forEach(function (u) { set[u.skuIndex] = 1; });
      var keys = Object.keys(set);
      var type = keys.length > 1 ? 'mixed' : 'tail';
      var skuIndex = keys.length === 1 ? Number(keys[0]) : -1;
      return mergePartialLayers(makePallet(p.units.slice().sort(stackOrder), cfg, type, skuIndex), cfg);
    });
  }

  /* 有界回溯：把层装进 K 个托盘，优先最小托数；maxPartials 控制每托最多几个部分层 */
  function tryPackBins(units, cfg, K, maxPartials) {
    var order = units.slice().sort(function (a, b) {
      if (a.partial !== b.partial) return a.partial ? 1 : -1;
      if (b.thickness !== a.thickness) return b.thickness - a.thickness;
      return a.skuIndex - b.skuIndex;
    });
    var bins = [];
    for (var i = 0; i < K; i++) {
      bins.push({ units: [], height: 0, weight: 0, partials: 0 });
    }
    var nodes = 0, t0 = Date.now(), aborted = false;

    function fits(bin, u) {
      if (bin.partials + (u.partial && !u.substack ? 1 : 0) > maxPartials) return false;
      if (cfg.maxLayers > 0 && bin.units.length >= cfg.maxLayers) return false;
      var add = nextLayerHeight(bin.units.length, u.thickness, cfg);
      if (bin.height + add > cfg.stackH + EPS) return false;
      if (cfg.maxLoad > 0 && bin.weight + u.weight > cfg.maxLoad + EPS) return false;
      return true;
    }

    function dfs(idx) {
      if (aborted) return false;
      if (idx === order.length) return true;
      if (++nodes > 120000 || Date.now() - t0 > 90) {
        aborted = true;
        return false;
      }
      var u = order[idx];
      var firstEmpty = -1;
      for (var e = 0; e < K; e++) {
        if (!bins[e].units.length) { firstEmpty = e; break; }
      }
      var candidates = [];
      for (var b = 0; b < K; b++) {
        if (!bins[b].units.length && b !== firstEmpty) continue;
        if (!fits(bins[b], u)) continue;
        var add = nextLayerHeight(bins[b].units.length, u.thickness, cfg);
        candidates.push({ b: b, rem: cfg.stackH - (bins[b].height + add) });
      }
      candidates.sort(function (x, y) { return x.rem - y.rem; });

      var seen = {};
      for (var c = 0; c < candidates.length; c++) {
        var bin = bins[candidates[c].b];
        var key = bin.height + ':' + bin.weight + ':' + bin.partials;
        if (seen[key]) continue;
        seen[key] = 1;
        var wasEmpty = bin.units.length === 0;
        var add2 = nextLayerHeight(bin.units.length, u.thickness, cfg);
        bin.units.push(u);
        bin.height += add2;
        bin.weight += u.weight;
        bin.partials += u.partial && !u.substack ? 1 : 0;
        if (dfs(idx + 1)) return true;
        bin.units.pop();
        bin.height -= add2;
        bin.weight -= u.weight;
        bin.partials -= u.partial && !u.substack ? 1 : 0;
        if (wasEmpty) break;
      }
      return false;
    }

    return dfs(0) ? bins.map(function (b) { return b.units; }) : null;
  }

  /**
   * 生成整张订单的托盘计划
   * @param {Array} cfgs 每个纸箱规格一份已归一化配置（含 qty）
   * @param {object} options {allowMix:boolean}
   */
  function topFlatnessScore(pallets, cfg) {
    var partial = 0, spread = 0, coverage = 0;
    var area = Math.max(1, (cfg.pallet.L + 2 * cfg.overhang - 2 * cfg.margin) *
      (cfg.pallet.W + 2 * cfg.overhang - 2 * cfg.margin));
    pallets.forEach(function (p) {
      var u = p.units[p.units.length - 1];
      if (!u) return;
      if (u.partial) partial++;
      var hs = u.rects.map(function (r) { return r.thickness || u.thickness; });
      if (hs.length) spread += Math.max.apply(null, hs) - Math.min.apply(null, hs);
      var topArea = u.rects.reduce(function (s, r) { return s + r.w * r.h; }, 0);
      coverage += topArea / area;
    });
    return [partial, spread, -coverage];
  }

  function flatnessBetter(a, b) {
    for (var i = 0; i < Math.max(a.length, b.length); i++) {
      if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) < (b[i] || 0);
    }
    return false;
  }

  function tailSupportMin(pallets) {
    var min = 1;
    pallets.forEach(function (p) {
      var s = palletSupport(p);
      if (s.min < min) min = s.min;
    });
    return min;
  }

  function tailMaxHeight(pallets) {
    var h = 0;
    pallets.forEach(function (p) { h = Math.max(h, p.height || 0); });
    return h;
  }

  function packTailCandidates(units, cfgBase, options) {
    if (!units || !units.length) {
      return { chosen: [], potentialSaving: 0, smallBottomUsed: false };
    }
    var strictMixed = packUnits(units, cfgBase, { maxPartials: 1 });
    var looseMixed = packUnits(units, cfgBase, { maxPartials: 99 });
    var saving = strictMixed.length - looseMixed.length;
    var chosen = strictMixed;
    var smallBottomUsed = false;
    if (options.allowSmallBottom && saving > 0) {
      chosen = looseMixed;
      smallBottomUsed = true;
    }
    var bySku = {}, grouped = [];
    units.forEach(function (u) {
      var k = u.skuIndex;
      if (!bySku[k]) bySku[k] = [];
      bySku[k].push(u);
    });
    Object.keys(bySku).forEach(function (k) {
      grouped = grouped.concat(packUnits(bySku[k], cfgBase, { maxPartials: 1 }));
    });
    if (grouped.length < chosen.length) {
      chosen = grouped;
    } else if (grouped.length === chosen.length) {
      var groupedFlat = topFlatnessScore(grouped, cfgBase);
      var mixedFlat = topFlatnessScore(chosen, cfgBase);
      var keepGrouped;
      if (groupedFlat[0] !== mixedFlat[0]) {
        keepGrouped = groupedFlat[0] < mixedFlat[0];
      } else if (groupedFlat[1] !== mixedFlat[1]) {
        keepGrouped = groupedFlat[1] < mixedFlat[1];
      } else {
        keepGrouped = groupedFlat[2] >= mixedFlat[2];
      }
      if (keepGrouped) chosen = grouped;
    }
    return {
      chosen: chosen,
      potentialSaving: Math.max(0, saving),
      smallBottomUsed: smallBottomUsed
    };
  }

  function applyParallelStacks(pallets, cfg) {
    function overlaps(a, b) {
      return Math.min(a.wx + a.w, b.wx + b.w) - Math.max(a.wx, b.wx) > EPS &&
        Math.min(a.wy + a.h, b.wy + b.h) - Math.max(a.wy, b.wy) > EPS;
    }
    pallets.forEach(function (p) {
      var subs = p.units.filter(function (u) { return u.substack; });
      if (!subs.length) return;
      var full = p.units.filter(function (u) { return !u.partial; });
      var z = 0;
      full.forEach(function (u) {
        var z0 = u.z0 != null ? u.z0 : z;
        z = Math.max(z, z0 + u.thickness);
      });
      var baseZ = z;
      subs.forEach(function (u, i) { u.z0 = baseZ + i * u.thickness; });
      var normals = p.units.filter(function (u) { return u.partial && !u.substack; });
      normals.forEach(function (u) {
        u.z0 = baseZ;
        u.rects = u.rects.map(function (r) { return Object.assign({}, r); });
      });
      // 410×130 这类长条箱的局部层排成紧凑的 5×2 块，220 尾箱贴着它排成一列，
      // 避免按风车层随手抽出的 L 形造成架空。
      var compactDone = false;
      if (subs.length >= 1 && subs.every(function (u) {
        return u.skuIndex === subs[0].skuIndex && u.count <= 10;
      }) && normals.length === 1 && normals[0].count === 4) {
        var fr0 = full.length ? full[0].rects : [];
        if (fr0.length) {
          var bw = Math.max(subs[0].rects[0].w, subs[0].rects[0].h);
          var bh = Math.min(subs[0].rects[0].w, subs[0].rects[0].h);
          var baseX = Math.min.apply(null, fr0.map(function (r) { return r.wx; }));
          var baseY = Math.min.apply(null, fr0.map(function (r) { return r.wy; }));
          var cols = 2, rows = 5;
          var blockX = baseX;
          var blockY = baseY + 220;
          if (blockX + cols * bw <= cfg.pallet.L + EPS && blockY + rows * bh <= cfg.pallet.W + EPS) {
            var grid = [];
            for (var rr = 0; rr < rows; rr++) {
              for (var cc = 0; cc < cols; cc++) {
                grid.push({
                  x: blockX + cc * bw, y: blockY + rr * bh,
                  wx: blockX + cc * bw, wy: blockY + rr * bh,
                  w: bw, h: bh, rot: bw !== subs[0].rects[0].w,
                  skuIndex: subs[0].skuIndex, thickness: subs[0].thickness
                });
              }
            }
            if (grid.length === 10) {
              subs.forEach(function (u) {
                u.rects = grid.slice(0, u.count).map(function (r) { return Object.assign({}, r); });
              });
              var row = fr0.filter(function (r) { return Math.abs(r.wy - baseY) < EPS; })
                .sort(function (a, b) { return a.wx - b.wx; }).slice(0, 4);
              if (row.length === 4) {
                normals[0].rects = row.map(function (r) { return Object.assign({}, r); });
                compactDone = true;
              }
            }
          }
        }
      }
      // 同一高度上还有普通尾箱时，把它放到整层未被局部叠层占用的位置，避免压在同一块区域。
      if (!compactDone) {
        var occupied = [];
        subs.forEach(function (u) { occupied = occupied.concat(u.rects); });
        normals.forEach(function (u) {
          if (!full.length || !u.rects.length) return;
          var candidates = [];
          full[0].rects.forEach(function (fr) {
            var hit = occupied.some(function (o) { return overlaps(fr, o); });
            if (!hit && !candidates.some(function (c) {
              return Math.abs(c.wx - fr.wx) < EPS && Math.abs(c.wy - fr.wy) < EPS;
            })) candidates.push(fr);
          });
          if (candidates.length < u.rects.length) return;
          u.rects.forEach(function (r, i) {
            var fr = candidates[i];
            r.x = fr.x; r.y = fr.y; r.wx = fr.wx; r.wy = fr.wy; r.w = fr.w; r.h = fr.h;
          });
          occupied = occupied.concat(u.rects);
        });
      }
      p.parallel = true;
      refreshPallet(p, cfg);
    });
  }

  function onePalletTailCandidate(units, cfg) {
    if (!units || !units.length) return null;
    var p = makePallet(units.slice().sort(stackOrder), cfg, 'mixed', -1);
    applyParallelStacks([p], cfg);
    if (p.height > cfg.stackH + EPS) return null;
    return [p];
  }

  function buildPlan(cfgs, options) {    options = options || {};
    var allowMix = !!options.allowMix;
    var plan = {
      ok: true, allowMix: allowMix,
      allowSmallBottom: !!options.allowSmallBottom,
      smallBottomUsed: false, potentialSaving: 0,
      skus: [], fullPallets: [], tailPallets: [], mixedPallets: [], pallets: [],
      fullCount: 0, tailCount: 0, mixedCount: 0, totalPallets: 0,
      totalBoxes: 0, errors: []
    };
    if (!cfgs || !cfgs.length) return plan;
    var cfgBase = cfgs[0];
    var tailUnits = [];
    var splitUnitsBySku = {};
    var hasSplitStack = false;

    cfgs.forEach(function (cfg, si) {
      var qty = cfg.carton.qty;
      var sol = options.solutions && options.solutions[si] ? options.solutions[si] : solveStack(cfg);
      var info = {
        index: si, name: cfg.carton.name, qty: qty, ok: sol.ok, sol: sol,
        fullPallets: 0, tailBoxes: 0, tailLayers: 0, absorbed: false,
        palletCount: 0, error: ''
      };
      plan.totalBoxes += qty;

      if (!sol.ok || qty <= 0) {
        if (!sol.ok && qty > 0) {
          info.error = '放不下';
          plan.errors.push({ index: si, name: cfg.carton.name, message: '纸箱放不下' });
          plan.ok = false;
        }
        plan.skus.push(info);
        return;
      }

      var perLayer = sol.perLayer;
      var maxFull = sol.layers;
      var t = sol.orientation.thickness;
      if (!perLayer || !maxFull) {
        info.error = '放不下';
        plan.ok = false;
        plan.skus.push(info);
        return;
      }

      var fullLayerTotal = Math.floor(qty / perLayer);
      var partial = qty - fullLayerTotal * perLayer;
      var fullPalletCount = Math.floor(fullLayerTotal / maxFull);
      var left = fullLayerTotal % maxFull;
      var layerVariants = chooseInterlockUnit(cfg, sol, si, perLayer);
      var baseUnit = layerVariants.base;
      var altUnit = layerVariants.alt;
      var fullPallets = [];

      for (var p = 0; p < fullPalletCount; p++) {
        var units = [];
        for (var k = 0; k < maxFull; k++) {
          units.push(altUnit && k % 2 ? altUnit : baseUnit);
        }
        var fp = makePallet(units, cfg, 'full', si);
        fp.interlock = altUnit && maxFull > 1 ? layerVariants.kind : '';
        fullPallets.push(fp);
      }

      // 尾箱优先塞进同规格整托的剩余高度/载重（例如 110 箱 / 54 箱一托 → 2 托）
      if (partial > 0 && fullPallets.length) {
        var last = fullPallets[fullPallets.length - 1];
        var extraH = nextLayerHeight(last.layers, t, cfg);
        var canH = last.height + extraH <= cfg.stackH + EPS;
        var canW = !(cfg.maxLoad > 0) || (last.weight + partial * cfg.carton.weight <= cfg.maxLoad + EPS);
        var canL = cfg.maxLayers <= 0 || last.layers < cfg.maxLayers;
        if (canH && canW && canL) {
          last.units.push(makeLayerUnit(cfg, sol, si, partial, true));
          refreshPallet(last, cfg);
          info.absorbed = true;
          partial = 0;
        }
      }

      info.fullPallets = fullPallets.length;
      info.tailBoxes = left * perLayer + partial;
      info.tailLayers = left + (partial > 0 ? 1 : 0);

      var tail = [];
      var tailTotal = left * perLayer + partial;
      var blockCap = Math.max(1, Math.floor(perLayer / 2));
      var chunkCount = tailTotal > blockCap ? Math.ceil(tailTotal / blockCap) : 1;
      for (var l = 0; l < left; l++) tail.push(baseUnit);
      if (partial > 0) tail.push(makeLayerUnit(cfg, sol, si, partial, true));

      if (tail.length) {
        if (allowMix) {
          tail.forEach(function (u) { tailUnits.push(u); });
          if (chunkCount > 1 && !options.noSplit) {
            hasSplitStack = true;
            var baseCount = Math.floor(tailTotal / chunkCount);
            var extra = tailTotal - baseCount * chunkCount;
            var chunks = [];
            for (var hc = 0; hc < chunkCount; hc++) {
              var chunk = baseCount + (hc < extra ? 1 : 0);
              var su = makeLayerUnit(cfg, sol, si, chunk, true);
              su.substack = true;
              su.stackGroup = si;
              chunks.push(su);
            }
            splitUnitsBySku[si] = chunks;
          }
        } else {
          var tailPallets = packUnits(tail, cfg, { maxPartials: 1 });
          tailPallets.forEach(function (tp) {
            tp.type = 'tail';
            tp.skuIndex = si;
            plan.tailPallets.push(tp);
          });
          info.palletCount = fullPallets.length + tailPallets.length;
        }
      } else {
        info.palletCount = fullPallets.length;
      }

      fullPallets.forEach(function (fp) { plan.fullPallets.push(fp); });
      plan.skus.push(info);
    });

    if (allowMix && tailUnits.length) {
      var packed = packTailCandidates(tailUnits, cfgBase, options);
      plan.potentialSaving = packed.potentialSaving;
      plan.smallBottomUsed = packed.smallBottomUsed;
      var chosen = packed.chosen;
      if (hasSplitStack) {
        Object.keys(splitUnitsBySku).forEach(function (siKey) {
          var chunks = splitUnitsBySku[siKey];
          var inserted = false;
          var altUnits = [];
          tailUnits.forEach(function (u) {
            if (u.skuIndex === Number(siKey)) {
              if (!inserted) {
                altUnits = altUnits.concat(chunks);
                inserted = true;
              }
            } else {
              altUnits.push(u);
            }
          });
          var altPacked;
          var onePallet = onePalletTailCandidate(altUnits, cfgBase);
          if (onePallet) {
            altPacked = {
              chosen: onePallet,
              potentialSaving: 0,
              smallBottomUsed: false
            };
          } else {
            altPacked = packTailCandidates(altUnits, cfgBase, options);
            applyParallelStacks(altPacked.chosen, cfgBase);
          }
          var altSup = tailSupportMin(altPacked.chosen);
          var stdSup = tailSupportMin(chosen);
          var altHeight = tailMaxHeight(altPacked.chosen);
          var stdHeight = tailMaxHeight(chosen);
          if (altPacked.chosen.length < chosen.length ||
              (altPacked.chosen.length === chosen.length &&
               (altSup > stdSup + EPS ||
                (Math.abs(altSup - stdSup) <= EPS && altHeight <= stdHeight + EPS)))) {
            chosen = altPacked.chosen;
            plan.potentialSaving = altPacked.potentialSaving;
            plan.smallBottomUsed = altPacked.smallBottomUsed;
            plan.splitStacked = true;
          }
        });
      }
      chosen.forEach(function (p) {
        if (p.type === 'mixed') plan.mixedPallets.push(p);
        else {
          p.type = 'tail';
          plan.tailPallets.push(p);
        }
      });
    }

    plan.pallets = plan.fullPallets.concat(plan.tailPallets, plan.mixedPallets);
    if (plan.splitStacked) applyParallelStacks(plan.pallets, cfgBase);
    finalizePalletPlan(plan, cfgBase);
    var beforePartial = plan.partialTopCount;
    var flat = flattenTops(plan.pallets, cfgBase, allowMix, !!options.allowSmallBottom);
    if (flat.changed) {
      plan.pallets = flat.pallets;
      finalizePalletPlan(plan, cfgBase);
    }
    plan.flattened = Math.max(0, beforePartial - plan.partialTopCount);
    plan.partialTopCount = plan.partialTopCount || 0;
    annotateStability(plan, cfgBase);
    return plan;
  }

  function annotateStability(plan, cfg) {
    cfg = cfg || {};
    var min = 1, low = 0, interlocked = 0, kinds = {};
    plan.pallets.forEach(function (p) {
      var s = palletSupport(p, cfg);
      p.support = s;
      min = Math.min(min, s.min);
      if (s.lowLayers.length) low++;
      if (p.interlock) {
        interlocked++;
        kinds[p.interlock] = (kinds[p.interlock] || 0) + 1;
      }
    });
    plan.supportMin = min;
    plan.lowSupportPallets = low;
    plan.interlockPallets = interlocked;
    plan.interlockKinds = kinds;
    var parts = [];
    if (interlocked) {
      var label = { rot90: '旋转 90°', rot180: '旋转 180°', mirrorX: '镜像 X', mirrorY: '镜像 Y' };
      var kindText = Object.keys(kinds).map(function (k) { return label[k] || k; }).join(' / ');
      parts.push('层间交错：' + interlocked + ' 托采用 ' + kindText);
    } else {
      if (cfg.sheet > 0 && cfg.sheetEvery > 0) {
        parts.push('层型镜像/旋转后没有有效差异，保持排列整齐；当前已设置每 ' + cfg.sheetEvery +
          ' 层加 ' + cfg.sheet + 'mm 层板，并已计入总高');
      } else {
        parts.push('层型镜像/旋转后没有有效差异，保持排列整齐；建议加 3–5mm 层间垫板并配合缠绕膜/护角，或调整箱型/层型实现错缝。若加垫板后超高，需要增加托盘');
      }
    }
    if (low) {
      parts.push('支撑检查：' + low + ' 托存在最低支撑率 < 85% 的层；建议加硬质层间垫板，或拆分为额外托盘' +
        (plan.interlockPallets ? '（交错层也建议配合垫板/缠绕膜）' : '') +
        '。若加垫板后超高，需要增加托盘。');
    } else {
      parts.push('支撑检查：最低 ' + Math.round(min * 100) + '%（≥85%）');
    }
    if (plan.partialTopCount > 0) {
      parts.push('顶部平整：仍有 ' + plan.partialTopCount +
        ' 托为不完整顶层；不增加托盘时建议加硬质顶板/垫板找平，若要求每托满层则需调整尾箱分配或增加托盘');
    }
    plan.stabilityAdvice = parts.join('；');
    return plan;
  }

  function buildGlobalTop(cfgs, cfgBase) {
    var boxes = [];
    cfgs.forEach(function (cfg, si) {
      var sol = solveStack(cfg);
      if (!sol.ok) return;
      var per = sol.perLayer;
      var full = Math.floor(cfg.carton.qty / per);
      var partial = cfg.carton.qty - full * per;
      if (partial <= 0) return;
      sol.layer.rects.slice(0, partial).forEach(function (r) {
        boxes.push({
          w: r.w, h: r.h, thickness: sol.orientation.thickness,
          weight: cfg.carton.weight, skuIndex: si
        });
      });
    });
    if (!boxes.length) return null;
    var effL = cfgBase.pallet.L + 2 * cfgBase.overhang - 2 * cfgBase.margin;
    var effW = cfgBase.pallet.W + 2 * cfgBase.overhang - 2 * cfgBase.margin;
    var originX = -cfgBase.overhang + cfgBase.margin;
    var originY = -cfgBase.overhang + cfgBase.margin;
    var placed = packMixedRects(boxes, effL, effW, cfgBase.gap);
    if (!placed) return null;
    var bySku = {}, maxT = 0, totalW = 0, totalBulk = 0;
    placed.forEach(function (b) {
      bySku[b.skuIndex] = (bySku[b.skuIndex] || 0) + 1;
      if (b.thickness > maxT) maxT = b.thickness;
      totalW += b.weight;
      totalBulk += b.w * b.h * b.thickness;
    });
    var parts = Object.keys(bySku).map(function (si) {
      return { skuIndex: Number(si), count: bySku[si] };
    });
    return {
      skuIndex: -1, count: placed.length, thickness: maxT,
      weight: totalW, bulk: totalBulk, partial: true, mixed: true,
      parts: parts, pattern: '混装顶层',
      rects: placed.map(function (b) {
        return {
          x: b.x, y: b.y, w: b.w, h: b.h, rot: b.rot, skuIndex: b.skuIndex,
          thickness: b.thickness, wx: b.x + originX, wy: b.y + originY
        };
      })
    };
  }

  function globalPatterns(types, top, cfg) {
    var patterns = [];
    var counts = new Array(types.length).fill(0);
    var stateCount = types.reduce(function (s, t) { return s * (t.count + 1); }, 1);
    if (stateCount > 220000) return null;

    function record(layers, height, weight) {
      var withTop = top ? [0, 1] : [0];
      withTop.forEach(function (hasTop) {
        var n = layers + hasTop;
        if (!n) return;
        var h = height + (hasTop ? top.thickness : 0) + sheetCountFor(n, cfg) * cfg.sheet;
        var w = weight + (hasTop ? top.weight : 0);
        if (h > cfg.stackH + EPS) return;
        if (cfg.maxLoad > 0 && w > cfg.maxLoad + EPS) return;
        if (cfg.maxLayers > 0 && n > cfg.maxLayers) return;
        patterns.push({ counts: counts.slice(), top: !!hasTop, height: h, weight: w });
      });
    }

    function rec(i, layers, height, weight) {
      if (i === types.length) { record(layers, height, weight); return; }
      for (var c = 0; c <= types[i].count; c++) {
        counts[i] = c;
        rec(i + 1, layers + c, height + c * types[i].thickness, weight + c * types[i].weight);
      }
      counts[i] = 0;
    }
    rec(0, 0, 0, 0);
    return patterns.length ? patterns : null;
  }

  function solveGlobalPatterns(types, top, patterns) {
    var dims = types.map(function (t) { return t.count; });
    var hasTop = top ? 1 : 0;
    var byType = types.map(function () { return []; });
    var topOnly = [];
    patterns.forEach(function (p) {
      var used = false;
      for (var i = 0; i < p.counts.length; i++) {
        if (p.counts[i] > 0) { byType[i].push(p); used = true; }
      }
      if (!used && p.top) topOnly.push(p);
    });

    var memo = new Map();
    function key(state, topLeft) {
      return state.join(',') + '|' + topLeft;
    }
    function solve(state, topLeft) {
      var any = false;
      for (var i = 0; i < state.length; i++) if (state[i] > 0) { any = true; break; }
      if (!any && !topLeft) return { bins: 0, choice: null };
      var k = key(state, topLeft);
      if (memo.has(k)) return memo.get(k);

      var idx = -1, smallest = Infinity;
      for (var j = 0; j < state.length; j++) {
        if (state[j] > 0 && state[j] < smallest) { smallest = state[j]; idx = j; }
      }
      var list = idx >= 0 ? byType[idx] : topOnly;
      var best = Infinity, choice = null;
      for (var p = 0; p < list.length; p++) {
        var pat = list[p];
        if (pat.top && !topLeft) continue;
        var fits = true;
        for (var t = 0; t < state.length; t++) {
          if (pat.counts[t] > state[t]) { fits = false; break; }
        }
        if (!fits) continue;
        var next = state.slice();
        for (var u = 0; u < next.length; u++) next[u] -= pat.counts[u];
        var sub = solve(next, topLeft - (pat.top ? 1 : 0));
        if (sub.bins + 1 < best) {
          best = sub.bins + 1;
          choice = pat;
        }
      }
      var out = { bins: best, choice: choice };
      memo.set(k, out);
      return out;
    }

    var start = dims.slice();
    var res = solve(start, hasTop);
    if (!isFinite(res.bins)) return null;

    // 重建
    var chosen = [];
    var state = start.slice(), topLeft = hasTop;
    while (true) {
      var any = false;
      for (var i = 0; i < state.length; i++) if (state[i] > 0) { any = true; break; }
      if (!any && !topLeft) break;
      var entry = memo.get(key(state, topLeft));
      if (!entry || !entry.choice) return null;
      chosen.push(entry.choice);
      for (var q = 0; q < state.length; q++) state[q] -= entry.choice.counts[q];
      topLeft -= entry.choice.top ? 1 : 0;
    }
    return chosen;
  }

  function buildGlobalPlan(cfgs, base) {
    if (!base || !base.ok) return base;
    var cfgBase = cfgs[0];
    var types = [];
    var totalHeight = 0, totalLayers = 0;
    cfgs.forEach(function (cfg, si) {
      var sol = solveStack(cfg);
      if (!sol.ok || cfg.carton.qty <= 0) return;
      var per = sol.perLayer;
      var full = Math.floor(cfg.carton.qty / per);
      if (!full) return;
      var unit = makeLayerUnit(cfg, sol, si, per, false);
      types.push({
        skuIndex: si, count: full, thickness: unit.thickness, weight: unit.weight, unit: unit
      });
      totalHeight += full * unit.thickness;
      totalLayers += full;
    });
    if (!types.length) return base;
    if (types.length > 3) return base;

    var top = buildGlobalTop(cfgs, cfgBase);
    var hasPartial = cfgs.some(function (cfg) {
      var sol = solveStack(cfg);
      return sol.ok && cfg.carton.qty > 0 && cfg.carton.qty % sol.perLayer > 0;
    });
    if (hasPartial && !top) return base;
    if (top) {
      totalHeight += top.thickness;
      totalLayers += 1;
    }
    if (totalLayers > 80) return base;

    var patterns = globalPatterns(types, top, cfgBase);
    if (!patterns) return base;
    var chosen = solveGlobalPatterns(types, top, patterns);
    if (!chosen) return base;

    var pallets = chosen.map(function (pat) {
      var units = [];
      for (var i = 0; i < pat.counts.length; i++) {
        for (var c = 0; c < pat.counts[i]; c++) units.push(types[i].unit);
      }
      var full = units.slice().sort(function (a, b) {
        if (b.weight !== a.weight) return b.weight - a.weight;
        return b.bulk - a.bulk;
      });
      var ordered = full.concat(pat.top && top ? [top] : []);
      var set = {};
      ordered.forEach(function (u) {
        if (u.parts) u.parts.forEach(function (p) { set[p.skuIndex] = 1; });
        else set[u.skuIndex] = 1;
      });
      var keys = Object.keys(set);
      var type = keys.length > 1 ? 'mixed' : (pat.top ? 'tail' : 'full');
      var skuIndex = keys.length === 1 ? Number(keys[0]) : -1;
      return makePallet(ordered, cfgBase, type, skuIndex);
    });

    if (pallets.length >= base.totalPallets) {
      base.globalAttempted = true;
      base.globalLowerBound = Math.ceil((totalHeight + sheetCountFor(totalLayers, cfgBase) * cfgBase.sheet) / cfgBase.stackH);
      return base;
    }

    var plan = {
      ok: true, allowMix: true, allowSmallBottom: true,
      globalUsed: true, globalSaved: base.totalPallets - pallets.length,
      globalAttempted: true,
      globalLowerBound: Math.ceil((totalHeight + sheetCountFor(totalLayers, cfgBase) * cfgBase.sheet) / cfgBase.stackH),
      skus: base.skus, fullPallets: [], tailPallets: [], mixedPallets: [],
      pallets: pallets, totalBoxes: base.totalBoxes, errors: base.errors,
      allowMixOn: true
    };
    plan.pallets.forEach(function (p, i) { p.id = 'P' + (i + 1); });
    plan.fullCount = pallets.filter(function (p) { return p.type === 'full'; }).length;
    plan.tailCount = pallets.filter(function (p) { return p.type === 'tail'; }).length;
    plan.mixedCount = pallets.filter(function (p) { return p.type === 'mixed'; }).length;
    plan.totalPallets = pallets.length;
    plan.skus.forEach(function (info) {
      info.palletCount = plan.pallets.filter(function (p) {
        return (p.skuBreakdown[info.index] || 0) > 0;
      }).length;
    });
    annotateStability(plan, cfgBase);
    return plan;
  }

  return {
    version: '1.8.0',
    DEFAULTS: DEFAULTS,
    normalize: normalize,
    orientations: orientations,
    solveLayer: solveLayer,
    solveStack: solveStack,
    layerBoxes: layerBoxes,
    analyzeExpansion: analyzeExpansion,
    buildPlan: buildPlan,
    buildGlobalPlan: buildGlobalPlan,
    chooseStep: chooseStep,
    utilizationText: utilizationText
  };
});
