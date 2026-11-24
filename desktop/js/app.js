(function () {
  'use strict';

  var Core = window.PalletCore;
  var XL = window.XlsxLite;

  var KEY = 'pallet-stacking-studio.v1';

  var DEFAULTS = {
    pallet: { L: 120, W: 80, H: 115, base: 0 },
    carton: { name: '示例纸箱', l: 28, w: 18, h: 10, qty: 500, weight: 0.15 },
    opts: {
      gap: 0, margin: 0, sheet: 0, overhang: 0, maxLoad: 0, maxLayers: 0,
      allowSide: false, allowUprightLay: false, allowSmallBottom: true, globalOptimize: false
    },
    limits: { L: 20, W: 0, H: 6 },
    deltas: { L: 0, W: 0, H: 0 },
    skus: [],
    allowMix: true
  };

  var state = loadState();
  var scene = null;
  var baseSolution = null;
  var currentSolution = null;
  var currentCfg = null;
  var analysis = null;
  var analysisKey = '';
  var plan = null;
  var skuIndex = -1;
  var lastSig = '';
  var saveTimer = null;
  var recomputeTimer = null;
  var toastTimer = null;
  var hintTimer = null;

  var PALETTE = ['#C99A5F', '#9FB3A6', '#C7A6A0', '#B1A3C9', '#D1B280', '#8FA9B8'];

  function $(sel) { return document.querySelector(sel); }
  function $$(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function round1(v) { return Math.round(v * 10) / 10; }
  function fmt(v) {
    if (v == null || !isFinite(v)) return '—';
    return String(Math.round(v * 100) / 100);
  }
  function pct(v) { return (Math.round(v * 1000) / 10).toFixed(1) + '%'; }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function numInput(id) {
    var v = parseFloat($('#' + id).value);
    return isFinite(v) ? Math.max(0, v) : 0;
  }
  function txtInput(id) { return String($('#' + id).value || '').trim(); }

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function loadState() {
    var s = clone(DEFAULTS);
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return s;
      var saved = JSON.parse(raw);
      if (saved && saved.pallet) {
        ['L', 'W', 'H', 'base'].forEach(function (k) {
          if (isFinite(saved.pallet[k])) s.pallet[k] = Math.max(0, Number(saved.pallet[k]));
        });
      }
      if (saved && saved.carton) {
        if (saved.carton.name) s.carton.name = String(saved.carton.name);
        ['l', 'w', 'h', 'qty', 'weight'].forEach(function (k) {
          if (isFinite(saved.carton[k])) s.carton[k] = Math.max(0, Number(saved.carton[k]));
        });
      }
      if (saved && saved.opts) {
        ['gap', 'margin', 'sheet', 'overhang', 'maxLoad', 'maxLayers'].forEach(function (k) {
          if (isFinite(saved.opts[k])) s.opts[k] = Math.max(0, Number(saved.opts[k]));
        });
        s.opts.allowSide = !!saved.opts.allowSide;
        s.opts.allowUprightLay = !!saved.opts.allowUprightLay;
        if (saved.opts.allowSmallBottom != null) {
          s.opts.allowSmallBottom = !!saved.opts.allowSmallBottom;
        }
        s.opts.globalOptimize = !!saved.opts.globalOptimize;
      }
      if (saved && saved.allowMix === false) s.allowMix = false;
      if (saved && saved.limits) {
        ['L', 'W', 'H'].forEach(function (k) {
          if (isFinite(saved.limits[k])) s.limits[k] = clamp(Number(saved.limits[k]), 0, 500);
        });
      }
      if (saved && Array.isArray(saved.skus)) {
        s.skus = saved.skus.filter(function (x) {
          return x && isFinite(x.l) && isFinite(x.w) && isFinite(x.h) && x.l > 0 && x.w > 0 && x.h > 0;
        }).map(function (x) {
          return {
            name: String(x.name || '纸箱'),
            l: Number(x.l), w: Number(x.w), h: Number(x.h),
            qty: Math.max(0, Number(x.qty) || 0),
            weight: Math.max(0, Number(x.weight) || 0)
          };
        });
      }
    } catch (e) { /* ignore corrupt storage */ }
    return s;
  }

  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      try {
        localStorage.setItem(KEY, JSON.stringify({
          pallet: state.pallet, carton: state.carton, opts: state.opts,
          limits: state.limits, skus: state.skus, allowMix: state.allowMix
        }));
        var hint = $('#saveHint');
        hint.textContent = '已自动保存';
        hint.classList.add('show');
        clearTimeout(hint._t);
        hint._t = setTimeout(function () { hint.classList.remove('show'); }, 1600);
      } catch (e) { /* storage may be disabled */ }
    }, 450);
  }

  /* ------------------------------ 表单 ------------------------------ */

  function fillForm() {
    $('#palletL').value = fmt(state.pallet.L);
    $('#palletW').value = fmt(state.pallet.W);
    $('#palletH').value = fmt(state.pallet.H);
    $('#palletBase').value = fmt(state.pallet.base);
    $('#palletUsable').value = fmt(Math.max(0, state.pallet.H - state.pallet.base));
    $('#cartonName').value = state.carton.name;
    $('#cartonL').value = fmt(state.carton.l);
    $('#cartonW').value = fmt(state.carton.w);
    $('#cartonH').value = fmt(state.carton.h);
    $('#cartonQty').value = fmt(state.carton.qty);
    $('#cartonWeight').value = state.carton.weight;
    $('#optGap').value = fmt(state.opts.gap);
    $('#optMargin').value = fmt(state.opts.margin);
    $('#optSheet').value = fmt(state.opts.sheet);
    $('#optOverhang').value = fmt(state.opts.overhang);
    $('#optMaxLoad').value = fmt(state.opts.maxLoad);
    $('#optMaxLayers').value = fmt(state.opts.maxLayers);
    $('#allowSide').checked = !!state.opts.allowSide;
    $('#allowUprightLay').checked = !!state.opts.allowUprightLay;
    $('#allowSmallBottom').checked = !!state.opts.allowSmallBottom;
    $('#globalOptimize').checked = !!state.opts.globalOptimize;
    $('#allowMix').checked = !!state.allowMix;
    $('#limL').value = fmt(state.limits.L);
    $('#limW').value = fmt(state.limits.W);
    $('#limH').value = fmt(state.limits.H);
  }

  function readForm() {
    state.pallet = {
      L: numInput('palletL'), W: numInput('palletW'), H: numInput('palletH'),
      base: Math.max(0, numInput('palletBase'))
    };
    var usable = Math.max(0, state.pallet.H - state.pallet.base);
    if ($('#palletUsable')) $('#palletUsable').value = fmt(usable);
    state.carton = {
      name: txtInput('cartonName') || '纸箱',
      l: numInput('cartonL'), w: numInput('cartonW'), h: numInput('cartonH'),
      qty: numInput('cartonQty'), weight: numInput('cartonWeight')
    };
    state.opts = {
      gap: numInput('optGap'), margin: numInput('optMargin'), sheet: numInput('optSheet'),
      overhang: numInput('optOverhang'), maxLoad: numInput('optMaxLoad'),
      maxLayers: Math.floor(numInput('optMaxLayers')),
      allowSide: $('#allowSide').checked,
      allowUprightLay: $('#allowUprightLay').checked,
      allowSmallBottom: $('#allowSmallBottom').checked,
      globalOptimize: $('#globalOptimize').checked
    };
    state.allowMix = $('#allowMix').checked;
    state.limits = {
      L: clamp(numInput('limL'), 0, 500),
      W: clamp(numInput('limW'), 0, 500),
      H: clamp(numInput('limH'), 0, 500)
    };
  }

  function activeDeltas() {
    var o = {};
    ['L', 'W', 'H'].forEach(function (k) {
      var lim = state.limits[k];
      var v = lim > 0 ? clamp(Math.round(state.deltas[k] || 0), 0, lim) : 0;
      o[k] = v;
    });
    return o;
  }

  function hasDelta() {
    var d = activeDeltas();
    return d.L + d.W + d.H > 0;
  }

  function buildConfig(carton) {
    return Core.normalize({
      pallet: state.pallet,
      carton: carton || state.carton,
      gap: state.opts.gap, margin: state.opts.margin, sheet: state.opts.sheet,
      overhang: state.opts.overhang, maxLoad: state.opts.maxLoad,
      maxLayers: state.opts.maxLayers,
      allowFlat: true,
      allowSide: !!state.opts.allowSide,
      allowUprightLay: !!state.opts.allowUprightLay
    });
  }

  /* ------------------------------ 主计算 ------------------------------ */

  var LAYER_RULES_KEY = 'palletizer.layerRules.v1';
  var SCHEMES_KEY = 'palletizer.schemes.v1';

  function loadSchemes() {
    try {
      var data = JSON.parse(localStorage.getItem(SCHEMES_KEY) || '{}');
      return Array.isArray(data.schemes) ? data.schemes : [];
    } catch (e) { return []; }
  }

  function saveSchemes(list) {
    try { localStorage.setItem(SCHEMES_KEY, JSON.stringify({ version: 1, schemes: list })); } catch (e) {}
  }

  function saveLayerRules(rules) {
    try { localStorage.setItem(LAYER_RULES_KEY, JSON.stringify({ rules: rules })); } catch (e) {}
  }

  function schemeRuleKey(r) {
    return [r.L, r.W, r.a, r.b, r.gap].map(Number).join('|');
  }

  function schemeMatchingRules() {
    var list = state.skus.length ? state.skus : [state.carton];
    return loadLayerRules().filter(function (r) {
      if (Math.abs(Number(r.L) - state.pallet.L) > 0.5 ||
          Math.abs(Number(r.W) - state.pallet.W) > 0.5) return false;
      if (Math.abs(Number(r.gap) - Number(state.opts.gap || 0)) > 0.01) return false;
      return list.some(function (c) {
        return Math.abs(Number(r.a) - c.l) <= 0.5 && Math.abs(Number(r.b) - c.w) <= 0.5;
      });
    }).map(function (r) { return clone(r); });
  }

  function mergeSchemeRules(rules) {
    if (!Array.isArray(rules) || !rules.length) return;
    var existing = loadLayerRules();
    var keys = {};
    existing.forEach(function (r) { keys[schemeRuleKey(r)] = 1; });
    rules.forEach(function (r) {
      if (!keys[schemeRuleKey(r)]) {
        existing.push(r);
        keys[schemeRuleKey(r)] = 1;
      }
    });
    saveLayerRules(existing);
  }

  function schemeSummary(s) {
    var list = s.skus && s.skus.length ? s.skus : (s.carton ? [s.carton] : []);
    var qty = list.reduce(function (n, c) { return n + (Number(c.qty) || 0); }, 0);
    return (s.pallet ? fmt(s.pallet.L) + '×' + fmt(s.pallet.W) : '—') +
      ' · ' + list.length + ' 种纸箱 · ' + fmt(qty) + ' 箱';
  }

  function renderSchemes() {
    var wrap = $('#desktopSchemeList');
    if (!wrap) return;
    var list = loadSchemes();
    if (!list.length) {
      wrap.innerHTML = '<div class="scheme-empty">还没有保存方案。</div>';
      return;
    }
    wrap.innerHTML = list.map(function (s) {
      return '<div class="scheme-row" data-scheme="' + esc(s.id) + '">' +
        '<div class="scheme-main"><b>' + esc(s.name) + '</b><small>' + esc(schemeSummary(s)) + '</small></div>' +
        '<div class="scheme-actions">' +
        '<button class="load" type="button" data-act="load">调取</button>' +
        '<button class="del" type="button" data-act="delete">删除</button>' +
        '</div></div>';
    }).join('');
  }

  function saveCurrentScheme() {
    readForm();
    var input = $('#desktopSchemeName');
    var name = input ? input.value.trim() : '';
    if (!name) {
      var d = new Date();
      name = '方案 ' + (d.getMonth() + 1) + '-' + d.getDate() + ' ' +
        String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    }
    var list = loadSchemes();
    var existing = list.filter(function (s) { return s.name === name; })[0];
    var now = new Date().toISOString();
    var data = {
      name: name,
      pallet: clone(state.pallet),
      carton: clone(state.carton),
      skus: clone(state.skus || []),
      opts: clone(state.opts),
      allowMix: !!state.allowMix,
      limits: clone(state.limits),
      rules: schemeMatchingRules(),
      updatedAt: now
    };
    if (existing) {
      data.id = existing.id;
      data.createdAt = existing.createdAt || now;
      list = list.map(function (s) { return s.id === existing.id ? data : s; });
    } else {
      data.id = 'scheme-' + Date.now();
      data.createdAt = now;
      list.unshift(data);
    }
    saveSchemes(list.slice(0, 60));
    if (input) input.value = '';
    renderSchemes();
    toast(existing ? '方案已更新' : '方案已保存');
  }

  function applyScheme(id) {
    var s = loadSchemes().filter(function (x) { return x.id === id; })[0];
    if (!s) return;
    if (s.pallet) state.pallet = Object.assign({}, state.pallet, s.pallet);
    if (s.carton) state.carton = Object.assign({}, state.carton, s.carton);
    if (Array.isArray(s.skus)) state.skus = clone(s.skus);
    if (s.opts) state.opts = Object.assign({}, state.opts, s.opts);
    if (s.allowMix != null) state.allowMix = !!s.allowMix;
    if (s.limits) state.limits = Object.assign({}, state.limits, s.limits);
    mergeSchemeRules(s.rules);
    fillForm();
    closeSchemeModal();
    recompute();
    setCalcState('已调取方案：' + s.name, true);
    scheduleSave();
    toast('已调取方案：' + s.name);
  }

  function deleteScheme(id) {
    var list = loadSchemes();
    var s = list.filter(function (x) { return x.id === id; })[0];
    if (!s) return;
    if (!window.confirm('删除方案“' + s.name + '”？')) return;
    saveSchemes(list.filter(function (x) { return x.id !== id; }));
    renderSchemes();
    toast('方案已删除');
  }

  function openSchemeModal() {
    renderSchemes();
    var modal = $('#schemeModal');
    if (modal) modal.hidden = false;
    var input = $('#desktopSchemeName');
    if (input) input.focus();
  }

  function closeSchemeModal() {
    var modal = $('#schemeModal');
    if (modal) modal.hidden = true;
  }

  function loadLayerRules() {
    try {
      var data = JSON.parse(localStorage.getItem(LAYER_RULES_KEY) || '{}');
      return Array.isArray(data.rules) ? data.rules : [];
    } catch (e) { return []; }
  }

  function exactSolutionFor(cfg) {
    var base = Core.solveStack(cfg);
    if (!base || !base.ok || !base.orientation || base.orientation.key !== 'flat') return null;
    var L = cfg.pallet.L + 2 * cfg.overhang - 2 * cfg.margin;
    var W = cfg.pallet.W + 2 * cfg.overhang - 2 * cfg.margin;
    var rules = loadLayerRules();
    for (var i = 0; i < rules.length; i++) {
      var r = rules[i];
      if (Math.abs(Number(r.L) - L) > 0.5 || Math.abs(Number(r.W) - W) > 0.5) continue;
      if (Math.abs(Number(r.a) - cfg.carton.l) > 0.5 || Math.abs(Number(r.b) - cfg.carton.w) > 0.5) continue;
      if (Math.abs(Number(r.gap) - cfg.gap) > 0.01) continue;
      if (!(r.count > 0) || !Array.isArray(r.rects) || r.rects.length !== r.count) continue;
      var count = r.count;
      var layers = base.layers;
      if (cfg.maxLoad > 0 && cfg.carton.weight > 0) {
        layers = Math.min(layers, Math.floor(cfg.maxLoad / (count * cfg.carton.weight)));
      }
      if (!(layers > 0)) return null;
      var sol = Object.assign({}, base);
      var originX = -cfg.overhang + cfg.margin;
      var originY = -cfg.overhang + cfg.margin;
      var rects = r.rects.map(function (x) {
        return Object.assign({}, x, {
          wx: Number(x.x) + originX,
          wy: Number(x.y) + originY,
          thickness: base.orientation.thickness
        });
      });
      var maxX = 0, maxY = 0;
      rects.forEach(function (x) {
        maxX = Math.max(maxX, x.x + x.w);
        maxY = Math.max(maxY, x.y + x.h);
      });
      sol.perLayer = count;
      sol.layers = layers;
      sol.total = count * layers;
      sol.layer = Object.assign({}, base.layer, {
        count: count,
        rects: rects,
        usedW: maxX,
        usedH: maxY,
        pattern: '精确规则',
        patternKey: 'exactRule'
      });
      sol.exactRule = true;
      sol.ruleId = r.id || '';
      return sol;
    }
    return null;
  }

  function recompute(opts) {
    opts = opts || {};
    readForm();
    if (inputIsTooDense()) {
      toast('纸箱尺寸过小，已暂停计算；请检查长宽和托盘尺寸');
      return;
    }
    state.deltas = activeDeltas();
    var cfg = buildConfig();
    var exactBase = exactSolutionFor(cfg);
    var nextBase = exactBase || Core.solveStack(cfg);
    var d = activeDeltas();
    var useDelta = d.L + d.W + d.H > 0;
    var dims = { L: cfg.pallet.L + d.L, W: cfg.pallet.W + d.W, H: cfg.pallet.H + d.H };
    var next = useDelta ? Core.solveStack(cfg, dims) : nextBase;

    var sig = [next.ok, next.total, next.layers, dims.L, dims.W, dims.H].join('|');
    if (sig !== lastSig) {
      lastSig = sig;
      state.ui.selected = -1;
      state.ui.visible = null;
      state.ui.only = false;
    }

    baseSolution = nextBase;
    currentSolution = next;
    currentCfg = cfg;
    state.palletView = null;

    var planCfgs = (state.skus.length ? state.skus : [state.carton]).map(function (sku) {
      return buildConfig(sku);
    });
    var exactSols = planCfgs.map(exactSolutionFor);
    var exactUsed = exactSols.some(Boolean);
    plan = Core.buildPlan(planCfgs, {
      allowMix: !!state.allowMix,
      allowSmallBottom: !!state.opts.allowSmallBottom,
      solutions: exactSols
    });
    if (state.opts.globalOptimize && !exactUsed) {
      plan = Core.buildGlobalPlan(planCfgs, plan);
    }
    if (exactUsed && state.opts.globalOptimize) toast('已使用精确布局规则，本次跳过全局省托');

    if (!opts.skipAnalysis) ensureAnalysis(cfg);
    updateDeltaUI();
    renderAll();
    scheduleSave();
  }

  function ensureAnalysis(cfg) {
    if (state.limits.L + state.limits.W + state.limits.H <= 0) {
      analysis = null;
      analysisKey = '';
      return;
    }
    var key = JSON.stringify(cfg) + '|' + JSON.stringify(state.limits);
    if (key === analysisKey) return;
    analysis = Core.analyzeExpansion(cfg, state.limits);
    analysisKey = key;
  }

  function updateDeltaUI() {
    var d = activeDeltas();
    ['L', 'W', 'H'].forEach(function (k) {
      var lim = state.limits[k];
      var slider = $('#d' + k);
      slider.max = String(Math.max(1, lim));
      slider.value = String(d[k]);
      slider.disabled = lim <= 0;
      $('#d' + k + 'val').textContent = '+' + fmt(d[k]);
      $('#d' + k + 'max').textContent = '/' + fmt(lim);
    });
    var dims = { L: state.pallet.L + d.L, W: state.pallet.W + d.W, H: state.pallet.H + d.H };
    $('#previewDimText').textContent = fmt(dims.L) + ' × ' + fmt(dims.W) + ' × ' + fmt(dims.H) + ' mm';
    $('#btnApplyPreview').disabled = !(d.L + d.W + d.H > 0);
  }

  /* ------------------------------ 渲染 ------------------------------ */

  function renderAll() {
    $('#limitHint').textContent = analysis
      ? '最多可增加多少 mm · 步长 ' + fmt(analysis.step) + ' mm'
      : '最多可增加多少 mm';
    renderKpis();
    renderScenario();
    render3D();
    renderAdvice();
    renderLayers();
    renderPlan();
    renderSkus();
  }

  function renderKpis() {
    if (state.palletView) {
      renderPalletKpis(state.palletView);
      return;
    }
    var sol = currentSolution;
    var base = baseSolution;
    var ok = sol && sol.ok;

    $('#kpiPerLayerLabel').textContent = '每层';
    $('#kpiLayersLabel').textContent = '层数';
    $('#kpiTotalLabel').textContent = '单托数量';
    $('#kpiVolLabel').textContent = '体积利用率';
    $('#kpiPalletLabel').textContent = plan && plan.skus.length > 1 ? '全部订单托数' : '订单需托数';

    $('#kpiPerLayer').innerHTML = ok ? sol.perLayer + '<span class="unit">箱</span>' : '—';
    $('#kpiPattern').textContent = ok ? (sol.layer.pattern + ' · ' + sol.orientation.label) : '等待有效尺寸';

    $('#kpiLayers').innerHTML = ok ? sol.layers + '<span class="unit">层</span>' : '—';
    $('#kpiPitch').textContent = ok
      ? ('层高 ' + fmt(sol.pitch) + ' mm' + (state.opts.sheet > 0 ? ' · 含垫板' : ''))
      : '—';

    $('#kpiTotal').innerHTML = ok ? sol.total + '<span class="unit">箱</span>' : '—';
    if (ok && hasDelta()) {
      var diff = sol.total - base.total;
      $('#kpiDelta').textContent = diff > 0 ? '较基准 +' + diff + ' 箱' : '与基准相同';
    } else if (ok) {
      $('#kpiDelta').textContent = '每层 ' + sol.perLayer + ' × ' + sol.layers + ' 层';
    } else {
      $('#kpiDelta').textContent = '请检查尺寸';
    }

    var vol = ok ? sol.volUtil : 0;
    $('#kpiVol').textContent = ok ? pct(vol) : '—';
    $('#kpiVolBar').style.width = (ok ? clamp(vol * 100, 0, 100) : 0) + '%';

    if (plan && plan.totalPallets > 0) {
      var multi = plan.skus.length > 1;
      $('#kpiPallets').innerHTML = plan.totalPallets + '<span class="unit">托</span>';
      if (multi) {
        $('#kpiQty').textContent = '整托 ' + plan.fullCount + ' · 混托 ' + plan.mixedCount +
          (plan.tailCount ? ' · 尾托 ' + plan.tailCount : '');
      } else {
        var sp = plan.skus[0];
        var last = plan.pallets[plan.pallets.length - 1];
        $('#kpiQty').textContent = '共 ' + fmt(sp.qty) + ' 箱' + (last ? ' · 末托 ' + last.boxes : '');
      }
    } else {
      $('#kpiPallets').textContent = '—';
      $('#kpiQty').textContent = state.carton.qty > 0 ? '无法装下' : '未填数量';
    }
  }

  function renderPalletKpis(p) {
    var mixed = p.type === 'mixed';
    var counts = p.units.map(function (u) { return u.count; });
    var same = counts.length > 0 && counts.every(function (n) { return n === counts[0]; });
    var skuName = mixed ? '混托' : skuLabel(p.skuIndex);

    $('#kpiPerLayerLabel').textContent = '每层';
    $('#kpiLayersLabel').textContent = '层数';
    $('#kpiTotalLabel').textContent = '本托箱数';
    $('#kpiVolLabel').textContent = '体积利用率';
    $('#kpiPalletLabel').textContent = '方案总托数';

    $('#kpiPerLayer').innerHTML = same ? counts[0] + '<span class="unit">箱</span>' : '—';
    $('#kpiPattern').textContent = mixed
      ? '混托 · ' + Object.keys(p.skuBreakdown).length + ' 种规格'
      : (p.type === 'tail' ? '尾托 · ' : (p.hasPartial ? '整托含尾 · ' : '整托 · ')) + skuName;
    $('#kpiLayers').innerHTML = p.layers + '<span class="unit">层</span>';
    $('#kpiPitch').textContent = '实际高 ' + fmt(p.height) + ' mm（含托盘 ' + fmt(p.height + state.pallet.base) + '）';
    $('#kpiTotal').innerHTML = p.boxes + '<span class="unit">箱</span>';
    $('#kpiDelta').textContent = p.id + ' · 第 ' + (plan.pallets.indexOf(p) + 1) + ' / ' + plan.totalPallets + ' 托';

    var vol = palletVolumeUtil(p);
    $('#kpiVol').textContent = pct(vol);
    $('#kpiVolBar').style.width = clamp(vol * 100, 0, 100) + '%';
    $('#kpiPallets').innerHTML = plan.totalPallets + '<span class="unit">托</span>';
    $('#kpiQty').textContent = '整托 ' + plan.fullCount + ' · 混托 ' + plan.mixedCount +
      (plan.tailCount ? ' · 尾托 ' + plan.tailCount : '');
  }

  function skuLabel(index) {
    if (state.skus[index]) return state.skus[index].name;
    if (plan && plan.skus[index]) return plan.skus[index].name;
    return state.carton.name;
  }

  function unitLabel(u) {
    if (u && u.parts && u.parts.length) {
      return u.parts.map(function (p) { return skuLabel(p.skuIndex) + ' ' + p.count; }).join(' + ');
    }
    return skuLabel(u ? u.skuIndex : -1);
  }

  function palletVolumeUtil(p) {
    var vol = 0;
    Object.keys(p.skuBreakdown).forEach(function (si) {
      var sku = state.skus[si] || state.carton;
      vol += p.skuBreakdown[si] * sku.l * sku.w * sku.h;
    });
    var denom = state.pallet.L * state.pallet.W * Math.max(0, state.pallet.H - state.pallet.base);
    return denom > 0 ? vol / denom : 0;
  }

  function renderScenario() {
    var el = $('#scenarioBadge');
    var d = activeDeltas();
    if (state.palletView) {
      var p = state.palletView;
      el.textContent = p.id + ' · ' + palletKindLabel(p) + ' · ' + p.boxes + ' 箱';
      el.classList.toggle('preview', p.type === 'mixed');
      return;
    }
    if (!currentSolution || !currentSolution.ok) {
      el.textContent = '当前尺寸放不下';
      el.classList.remove('preview');
      return;
    }
    if (d.L + d.W + d.H > 0) {
      var parts = [];
      if (d.L) parts.push('长+' + fmt(d.L));
      if (d.W) parts.push('宽+' + fmt(d.W));
      if (d.H) parts.push('高+' + fmt(d.H));
      el.textContent = '放量预览 · ' + parts.join(' / ');
      el.classList.add('preview');
    } else {
      el.textContent = '基准方案 · ' + fmt(state.pallet.L) + ' × ' + fmt(state.pallet.W) + ' × ' + fmt(state.pallet.H) + ' mm';
      el.classList.remove('preview');
    }
  }

  function render3D() {
    var pv = state.palletView;
    var dims, layers, boxes, labels, actual, explode, viewH, delta, baseH = state.pallet.base || 0;
    if (pv) {
      dims = { L: state.pallet.L, W: state.pallet.W, H: Math.max(0, state.pallet.H - baseH) };
      layers = pv.layers;
      var built = palletBoxes(pv);
      boxes = built.boxes;
      labels = built.labels;
      actual = pv.actual;
      var pitch = pv.height / Math.max(1, pv.layers);
      explode = state.ui.explode ? (state.ui.explode / 100) * Math.max(8, pitch * 2.4) : 0;
      viewH = pv.height + Math.max(0, pv.layers - 1) * explode;
      delta = null;
    } else {
      var sol = currentSolution;
      var d = activeDeltas();
      dims = {
        L: state.pallet.L + d.L,
        W: state.pallet.W + d.W,
        H: Math.max(0, state.pallet.H + d.H - baseH)
      };
      layers = sol && sol.ok ? sol.layers : 0;
      boxes = sol && sol.ok ? Core.layerBoxes(sol, sol.total > 6000 ? 6000 : 0) : [];
      labels = solutionLabels(sol);
      actual = actualFromBoxes(boxes);
      explode = explodeMM(sol);
      viewH = dims.H + (sol && sol.ok ? Math.max(0, sol.layers - 1) * explode : 0);
      delta = (d.L + d.W + d.H > 0) ? d : null;
    }

    var visible = state.ui.visible == null ? layers : clamp(state.ui.visible, 1, Math.max(1, layers));
    var selected = state.ui.selected;
    if (selected >= layers) {
      selected = layers - 1;
      state.ui.selected = selected;
    }
    if (state.ui.only && selected < 0 && layers > 0) {
      selected = layers - 1;
      state.ui.selected = selected;
    }

    scene.setModel({
      L: dims.L, W: dims.W, H: dims.H,
      viewH: viewH,
      baseThickness: baseH > 0 ? baseH : clamp(Math.min(dims.L, dims.W) * 0.055, 2.5, 26),
      baseHeight: baseH,
      totalH: baseH + dims.H,
      boxes: boxes,
      cartonLabels: labels,
      actual: actual,
      delta: delta,
      showDims: true
    });
    scene.setLayerView({
      visibleLayers: visible,
      selectedLayer: selected,
      onlySelected: state.ui.only,
      explode: explode
    });

    var range = $('#visibleRange');
    range.max = String(Math.max(1, layers));
    range.value = String(Math.max(1, visible));
    range.disabled = layers < 2 || state.ui.only;
    $('#visibleLabel').textContent = state.ui.only
      ? (selected >= 0 ? '第 ' + (selected + 1) + ' 层' : '—')
      : (visible === layers ? '全部 ' + layers + ' 层' : '第 1–' + visible + ' 层');

    var onlyBtn = $('#onlyLayer');
    onlyBtn.disabled = layers < 2;
    onlyBtn.classList.toggle('active', state.ui.only);

    updateActualChip(actual);
    $('#btnExitPallet').hidden = !pv;

    if (pv) {
      if (selected >= 0) {
        var unit = pv.units[selected];
        $('#layerInfo').textContent = pv.id + ' · 第 ' + (selected + 1) + ' 层 · ' +
          (unit ? (unit.count + ' 箱 · ' + unitLabel(unit)) : '');
      } else {
        $('#layerInfo').textContent = pv.id + ' · ' + (pv.type === 'mixed' ? '混托' : pv.type === 'tail' ? '尾托' : '整托') +
          ' · ' + pv.layers + ' 层 · ' + pv.boxes + ' 箱 · 实际高 ' + fmt(pv.height) +
          ' mm（含托盘 ' + fmt(pv.height + state.pallet.base) + '）';
      }
    } else if (!currentSolution || !currentSolution.ok) {
      $('#layerInfo').textContent = currentSolution && currentSolution.warnings[0] ? currentSolution.warnings[0] : '无法码放';
    } else if (selected >= 0) {
      $('#layerInfo').textContent = '第 ' + (selected + 1) + ' 层' + (state.ui.only ? ' · 单独查看' : '') +
        ' · ' + currentSolution.perLayer + ' 箱 · ' + currentSolution.orientation.label;
    } else {
      $('#layerInfo').textContent = '全部 ' + currentSolution.layers + ' 层 · 每层 ' + currentSolution.perLayer + ' 箱' +
        (state.ui.explode > 0 ? ' · 拆层示意' : '') +
        (currentSolution.total > 6000 ? ' · 3D 仅显示前 6000 箱' : '');
    }
  }

  function actualFromBoxes(boxes) {
    if (!boxes || !boxes.length) return null;
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, maxZ = 0;
    boxes.forEach(function (b) {
      if (b.x < minX) minX = b.x;
      if (b.y < minY) minY = b.y;
      if (b.x + b.w > maxX) maxX = b.x + b.w;
      if (b.y + b.d > maxY) maxY = b.y + b.d;
      if (b.z + b.h > maxZ) maxZ = b.z + b.h;
    });
    return { x0: minX, y0: minY, x1: maxX, y1: maxY, L: maxX - minX, W: maxY - minY, H: maxZ };
  }

  function solOrientationGroups(sol) {
    if (!sol || !sol.ok || !sol.layer || !sol.layer.rects.length) return [];
    var groups = {};
    sol.layer.rects.forEach(function (r) {
      var thick = r.thickness || sol.orientation.thickness;
      var key = r.w + '|' + r.h + '|' + thick;
      if (!groups[key]) {
        groups[key] = {
          w: r.w, h: r.h, thickness: thick,
          count: 0, rect: r, rot: !!r.rot
        };
      }
      groups[key].count++;
    });
    return Object.keys(groups).map(function (k) { return groups[k]; });
  }

  function solutionLabels(sol) {
    return solOrientationGroups(sol).map(function (g, i) {
      var r = g.rect;
      var z = (sol.layers - 1) * sol.pitch + g.thickness;
      return {
        text: state.carton.name + ' ' + fmt(g.w) + '×' + fmt(g.h) + '×' + fmt(g.thickness),
        color: i === 0 ? '#C99A5F' : '#9FB3A6',
        anchor: {
          x: r.wx + r.w / 2,
          y: r.wy + r.h / 2,
          z: z
        },
        dims: [
          { kind: 'w', a: { x: r.wx, y: r.wy, z: z }, b: { x: r.wx + r.w, y: r.wy, z: z }, text: fmt(g.w) },
          { kind: 'h', a: { x: r.wx, y: r.wy, z: z }, b: { x: r.wx, y: r.wy + r.h, z: z }, text: fmt(g.h) }
        ]
      };
    });
  }

  function palletBoxes(p) {
    var boxes = [], tops = {}, z = 0;
    var mixed = p.type === 'mixed';
    p.units.forEach(function (u, li) {
      var zTop = z + u.thickness;
      u.rects.forEach(function (r) {
        var si = r.skuIndex != null ? r.skuIndex : u.skuIndex;
        var thick = r.thickness || u.thickness;
        var color = (mixed && si >= 0) ? PALETTE[si % PALETTE.length] : null;
        boxes.push({
          x: r.wx, y: r.wy, z: z,
          w: r.w, d: r.h, h: thick,
          layer: li, rot: r.rot, color: color, skuIndex: si
        });
        // 同一 SKU 的不同朝向分别标注，避免接近正方形时看不出方向差异
        var key = si + '|' + r.w + '|' + r.h + '|' + thick;
        if (si >= 0 && (!tops[key] || li >= tops[key].layer)) {
          tops[key] = {
            layer: li,
            skuIndex: si,
            w: r.w, h: r.h, thickness: thick,
            anchor: { x: r.wx + r.w / 2, y: r.wy + r.h / 2, z: z + thick }
          };
        }
      });
      z = zTop + (li < p.units.length - 1 ? state.opts.sheet : 0);
    });
    var labels = Object.keys(tops).map(function (key) {
      var t = tops[key];
      var sku = state.skus[t.skuIndex] || state.carton;
      var color = mixed ? PALETTE[t.skuIndex % PALETTE.length] : '#C99A5F';
      return {
        text: sku.name + ' ' + fmt(t.w) + '×' + fmt(t.h) + '×' + fmt(t.thickness),
        color: color,
        anchor: t.anchor,
        dims: [
          { kind: 'w', a: { x: t.anchor.x - t.w / 2, y: t.anchor.y - t.h / 2, z: t.anchor.z },
            b: { x: t.anchor.x + t.w / 2, y: t.anchor.y - t.h / 2, z: t.anchor.z }, text: fmt(t.w) },
          { kind: 'h', a: { x: t.anchor.x - t.w / 2, y: t.anchor.y - t.h / 2, z: t.anchor.z },
            b: { x: t.anchor.x - t.w / 2, y: t.anchor.y + t.h / 2, z: t.anchor.z }, text: fmt(t.h) }
        ]
      };
    });
    return { boxes: boxes, labels: labels };
  }

  function updateActualChip(actual) {
    var el = $('#actualChip');
    if (!actual || !(actual.L > 0)) {
      el.classList.add('empty');
      el.textContent = '实际码放 —';
      return;
    }
    el.classList.remove('empty');
    el.textContent = '实际码放 ' + fmt(actual.L) + ' × ' + fmt(actual.W) + ' × ' + fmt(actual.H) +
      ' mm · 含托盘 ' + fmt(actual.H + state.pallet.base) + ' mm';
  }

  function explodeMM(sol) {
    if (!sol || !sol.ok || sol.layers < 2 || !state.ui.explode) return 0;
    return (state.ui.explode / 100) * Math.max(8, sol.pitch * 2.4);
  }

  function heightHint() {
    if (!baseSolution || !baseSolution.ok || hasDelta()) return '';
    if (state.carton.qty <= 0 && state.limits.H <= 0) return '';
    if (state.opts.maxLayers > 0 && baseSolution.layers >= state.opts.maxLayers) return '';
    if (state.opts.maxLoad > 0 && state.carton.weight > 0) {
      var cap = Math.floor(state.opts.maxLoad / (baseSolution.perLayer * state.carton.weight) + 1e-6);
      if (baseSolution.layers >= cap) return '';
    }
    var t = baseSolution.orientation.thickness;
    var s = state.opts.sheet;
    var need = baseSolution.usedHeight + t + s;
    var usable = Math.max(0, state.pallet.H - state.pallet.base);
    var delta = need - usable;
    if (!(delta > 0)) return '';
    if (state.limits.H >= delta) return '';
    var extra = delta - state.limits.H;
    return '<div class="notice hint">最大总高做到 ' + fmt(state.pallet.H + delta) + ' mm（+' + fmt(delta) +
      '）可多 1 层；当前高度上限 ' + (state.limits.H > 0 ? '+' + fmt(state.limits.H) + ' mm' : '未设置') +
      (extra > 0 ? '，还差 ' + fmt(extra) + ' mm' : '') + '。</div>';
  }

  function renderAdvice() {
    updatePreviewBar();
    var box = $('#adviceList');
    if (!currentSolution || !currentSolution.ok) {
      box.innerHTML = '<div class="empty">' + esc((currentSolution && currentSolution.warnings[0]) || '请填写有效尺寸。') + '</div>';
      $('#axisTable').innerHTML = '';
      return;
    }
    if (!analysis) {
      box.innerHTML = '<div class="empty">把「可放量范围」设为大于 0，<br>就能看到长 / 宽 / 高各增加多少可多装。</div>';
      $('#axisTable').innerHTML = '';
      appendHeightHint(box);
      return;
    }
    if (!analysis.options.length || analysis.maxTotal <= analysis.baseTotal) {
      box.innerHTML = '<div class="empty">当前放量范围内箱数无法增加。<br>可放宽范围，或先调整箱型 / 排布约束。</div>';
      appendHeightHint(box);
    } else {
      var kindNames = { fit: '一托装下', height: '只加高', min: '最小改动', max: '容量最大', more: '候选方案' };
      var html = analysis.options.map(function (opt, i) {
        var dims = {
          L: state.pallet.L + opt.dL,
          W: state.pallet.W + opt.dW,
          H: state.pallet.H + opt.dH
        };
        var chips = [
          ['长', opt.dL], ['宽', opt.dW], ['高', opt.dH]
        ].map(function (p) {
          return '<span class="' + (p[1] > 0 ? 'on' : '') + '">' + p[0] + ' +' + fmt(p[1]) + '</span>';
        }).join('');
        return '<article class="adv-card' + (i === 0 ? ' best' : '') + '">' +
          '<header><span class="kind">' + kindNames[opt.kind] + '</span>' +
          '<span class="gain">+' + opt.gain + '<small>箱</small></span></header>' +
          '<div class="dims">' + chips + '</div>' +
          '<div class="res">' + fmt(dims.L) + ' × ' + fmt(dims.W) + ' × ' + fmt(dims.H) +
          ' → <b>' + opt.total + '</b> 箱 · ' + opt.layers + ' 层 × ' + opt.perLayer + ' 箱' +
          (opt.note ? ' · ' + esc(opt.note) : '') + '</div>' +
          '<footer><button data-act="preview" data-idx="' + i + '">预览</button>' +
          '<button data-act="apply" data-idx="' + i + '" class="solid">应用</button></footer>' +
          '</article>';
      }).join('');
      box.innerHTML = html;
      var qty = state.carton.qty;
      if (qty > 0) {
        if (analysis.maxTotal < qty) {
          var info = plan ? plan.skus[skuIndex >= 0 ? skuIndex : 0] : null;
          var pc = info ? info.palletCount : currentSolution.pallets;
          var tailText = info && info.tailBoxes > 0 ? '（尾箱 ' + info.tailBoxes + ' 箱）' : '';
          box.insertAdjacentHTML('beforeend', '<div class="notice warn">订单 ' + qty + ' 箱按当前方案需 ' +
            pc + ' 托' + tailText + '；当前放量上限下单托最多 ' +
            analysis.maxTotal + ' 箱。</div>');
        } else if (analysis.baseTotal >= qty) {
          box.insertAdjacentHTML('beforeend', '<div class="notice ok">一托可装下全部 ' + qty +
            ' 箱，余量 ' + (analysis.baseTotal - qty) + ' 箱。</div>');
        }
      }
      appendHeightHint(box);
    }
    renderAxisTable();
  }

  function appendHeightHint(box) {
    var html = heightHint();
    if (html) box.insertAdjacentHTML('beforeend', html);
  }

  function renderAxisTable() {
    var el = $('#axisTable');
    if (!analysis || !analysis.singleAxis) { el.innerHTML = ''; return; }
    var axisNames = { L: '长', W: '宽', H: '高' };
    var rows = ['L', 'W', 'H'].map(function (axis) {
      var list = analysis.singleAxis[axis] || [];
      var vals = list.length
        ? list.map(function (x) {
          return '<button data-axis="' + axis + '" data-delta="' + x.delta + '">+' + fmt(x.delta) +
            ' → ' + x.total + '<em>+' + x.gain + '</em></button>';
        }).join('')
        : '<span style="color:#b0a695;font-size:10px;padding-top:3px">此方向无增益</span>';
      return '<div class="axis-row"><b>' + axisNames[axis] + '</b><div class="vals">' + vals + '</div></div>';
    }).join('');
    el.innerHTML = rows;
  }

  function updatePreviewBar() {
    var sol = currentSolution;
    if (!sol || !sol.ok) {
      $('#previewCount').textContent = '—';
      $('#previewSub').textContent = '无法码放';
      return;
    }
    var diff = sol.total - baseSolution.total;
    $('#previewCount').innerHTML = sol.total + ' 箱' +
      (hasDelta() && diff !== 0 ? '<span class="up">' + (diff > 0 ? '+' : '') + diff + '</span>' : '');
    $('#previewSub').textContent = fmt(state.pallet.L + activeDeltas().L) + '×' +
      fmt(state.pallet.W + activeDeltas().W) + '×' +
      fmt(state.pallet.H + activeDeltas().H) + ' mm · ' + sol.layers + ' 层';
  }

  function layerSVG(sol, withLabels, actual) {
    if (!sol || !sol.ok || !sol.layer || !sol.layer.rects.length) return '';
    var labels = [];
    if (withLabels) {
      labels = solOrientationGroups(sol).map(function (g) {
        var r = g.rect;
        return {
          x: r.wx + r.w / 2, y: r.wy + r.h / 2,
          x0: r.wx, y0: r.wy, w: r.w, h: r.h,
          wText: fmt(g.w), hText: fmt(g.h),
          text: fmt(g.w) + '×' + fmt(g.h) + '×' + fmt(g.thickness)
        };
      });
    }
    return rectsSVG(sol.layer.rects, sol.dims.L, sol.dims.W, function (r) {
      return r.rot ? '#c08b4e' : '#c99a5f';
    }, labels, actual);
  }

  function rectsSVG(rects, L, W, colorFn, labels, actual) {
    if (!rects || !rects.length) return '';
    var minX = 0, minY = 0, maxX = L, maxY = W;
    rects.forEach(function (r) {
      if (r.wx < minX) minX = r.wx;
      if (r.wy < minY) minY = r.wy;
      if (r.wx + r.w > maxX) maxX = r.wx + r.w;
      if (r.wy + r.h > maxY) maxY = r.wy + r.h;
    });
    var outside = actual ? Math.max(38, Math.max(L, W) * 0.11) : 0;
    if (actual) {
      minX = Math.min(minX, -outside - 28);
      maxY = Math.max(maxY, W + outside + 34);
    }
    var pad = Math.max(2, Math.max(maxX - minX, maxY - minY) * 0.025);
    var vb = (minX - pad) + ' ' + (minY - pad) + ' ' +
      (maxX - minX + pad * 2) + ' ' + (maxY - minY + pad * 2);
    var parts = [];
    parts.push('<svg viewBox="' + vb + '" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">');
    if ((labels && labels.length) || actual) {
      parts.push('<defs><marker id="dimArrow" markerWidth="7" markerHeight="7" refX="5.5" refY="3.5" orient="auto">' +
        '<path d="M0 0 L7 3.5 L0 7 Z" fill="#8a4b22"/></marker></defs>');
    }
    parts.push('<rect x="0" y="0" width="' + L + '" height="' + W + '" fill="#f7f1e5" stroke="#b9ab92" stroke-width="0.9" stroke-dasharray="3 2" vector-effect="non-scaling-stroke"/>');
    rects.forEach(function (r) {
      parts.push('<rect x="' + r.wx + '" y="' + r.wy + '" width="' + r.w + '" height="' + r.h +
        '" rx="0.5" fill="' + colorFn(r) +
        '" stroke="#7c5127" stroke-width="0.55" vector-effect="non-scaling-stroke"/>');
    });
    (labels || []).forEach(function (lab) {
      var fs = Math.max(6, Math.min(20, Math.min(lab.w, lab.h) * 0.12));
      var midX = lab.x0 + lab.w / 2;
      var midY = lab.y0 + lab.h / 2;
      var lineY = lab.y0 + lab.h * 0.82;
      var lineX = lab.x0 + lab.w * 0.82;
      parts.push('<line x1="' + lab.x0 + '" y1="' + lineY + '" x2="' + (lab.x0 + lab.w) + '" y2="' + lineY +
        '" stroke="#8a4b22" stroke-width="0.7" vector-effect="non-scaling-stroke" marker-start="url(#dimArrow)" marker-end="url(#dimArrow)"/>');
      parts.push('<text x="' + midX + '" y="' + (lineY - fs * 0.45) + '" text-anchor="middle" font-size="' + fs +
        '" fill="#6b3a1c">' + esc(lab.wText) + '</text>');
      parts.push('<line x1="' + lineX + '" y1="' + lab.y0 + '" x2="' + lineX + '" y2="' + (lab.y0 + lab.h) +
        '" stroke="#8a4b22" stroke-width="0.7" vector-effect="non-scaling-stroke" marker-start="url(#dimArrow)" marker-end="url(#dimArrow)"/>');
      parts.push('<text x="' + (lineX - fs * 0.55) + '" y="' + midY + '" text-anchor="middle" dominant-baseline="middle" font-size="' + fs +
        '" fill="#6b3a1c" transform="rotate(-90 ' + (lineX - fs * 0.55) + ' ' + midY + ')">' + esc(lab.hText) + '</text>');
    });
    if (actual) {
      var fs2 = Math.max(7, Math.min(22, Math.min(actual.L, actual.W) * 0.028));
      var lineY2 = W + outside;
      var lineX2 = -outside;
      var midX2 = actual.x0 + actual.L / 2;
      var midY2 = actual.y0 + actual.W / 2;
      // 实际长：托盘外侧下方
      parts.push('<line x1="' + actual.x0 + '" y1="' + actual.y1 + '" x2="' + actual.x0 + '" y2="' + lineY2 +
        '" stroke="#8a4b22" stroke-width="0.6" stroke-dasharray="2 2" vector-effect="non-scaling-stroke"/>');
      parts.push('<line x1="' + (actual.x0 + actual.L) + '" y1="' + actual.y1 + '" x2="' + (actual.x0 + actual.L) + '" y2="' + lineY2 +
        '" stroke="#8a4b22" stroke-width="0.6" stroke-dasharray="2 2" vector-effect="non-scaling-stroke"/>');
      parts.push('<line x1="' + actual.x0 + '" y1="' + lineY2 + '" x2="' + (actual.x0 + actual.L) + '" y2="' + lineY2 +
        '" stroke="#8a4b22" stroke-width="0.9" vector-effect="non-scaling-stroke" marker-start="url(#dimArrow)" marker-end="url(#dimArrow)"/>');
      parts.push('<text x="' + midX2 + '" y="' + (lineY2 + fs2 * 0.9) + '" text-anchor="middle" font-size="' + fs2 +
        '" fill="#6b3a1c">实际长 ' + fmt(actual.L) + '</text>');
      // 实际宽：托盘外侧左侧
      parts.push('<line x1="' + actual.x0 + '" y1="' + actual.y0 + '" x2="' + lineX2 + '" y2="' + actual.y0 +
        '" stroke="#8a4b22" stroke-width="0.6" stroke-dasharray="2 2" vector-effect="non-scaling-stroke"/>');
      parts.push('<line x1="' + actual.x0 + '" y1="' + (actual.y0 + actual.W) + '" x2="' + lineX2 + '" y2="' + (actual.y0 + actual.W) +
        '" stroke="#8a4b22" stroke-width="0.6" stroke-dasharray="2 2" vector-effect="non-scaling-stroke"/>');
      parts.push('<line x1="' + lineX2 + '" y1="' + actual.y0 + '" x2="' + lineX2 + '" y2="' + (actual.y0 + actual.W) +
        '" stroke="#8a4b22" stroke-width="0.9" vector-effect="non-scaling-stroke" marker-start="url(#dimArrow)" marker-end="url(#dimArrow)"/>');
      parts.push('<text x="' + (lineX2 - fs2 * 0.55) + '" y="' + midY2 + '" text-anchor="middle" dominant-baseline="middle" font-size="' + fs2 +
        '" fill="#6b3a1c" transform="rotate(-90 ' + (lineX2 - fs2 * 0.55) + ' ' + midY2 + ')">实际宽 ' + fmt(actual.W) + '</text>');
    }
    parts.push('</svg>');
    return parts.join('');
  }

  function renderLayers() {
    if (state.palletView) {
      renderPalletLayers(state.palletView);
      return;
    }
    var sol = currentSolution;
    var summary = $('#layersSummary');
    var list = $('#layerList');
    if (!sol || !sol.ok) {
      summary.innerHTML = '<b>暂无排布</b><br>' + esc((sol && sol.warnings[0]) || '请填写有效尺寸。');
      list.innerHTML = '';
      return;
    }
    var svg = layerSVG(sol);
    var usableH = Math.max(0, state.pallet.H + activeDeltas().H - state.pallet.base);
    summary.innerHTML = '共 <b>' + sol.layers + ' 层</b> × 每层 <b>' + sol.perLayer + ' 箱</b> = <b>' +
      sol.total + ' 箱</b><br>层高 ' + fmt(sol.pitch) + ' mm · 占用高 ' +
      fmt(sol.usedHeight) + ' / ' + fmt(usableH) + ' mm（含托盘总高 ' +
      fmt(state.pallet.H + activeDeltas().H) + ' mm）· ' + esc(sol.layer.pattern);

    var maxRows = 240;
    var html = [];
    var count = Math.min(sol.layers, maxRows);
    for (var i = 0; i < count; i++) {
      var tags = [];
      if (i === 0) tags.push('底层');
      if (i === sol.layers - 1) tags.push('顶层');
      html.push('<div class="layer-item' + (state.ui.selected === i ? ' active' : '') + '" data-layer="' + i + '">' +
        '<div class="layer-thumb">' + svg + '</div>' +
        '<div class="layer-main"><strong>第 ' + (i + 1) + ' 层' + (tags.length ? ' · ' + tags.join(' / ') : '') + '</strong>' +
        '<span>' + fmt(sol.pitch) + ' mm · ' + esc(sol.layer.pattern) + '</span></div>' +
        '<div class="layer-count">' + sol.perLayer + '<small>箱</small></div></div>');
    }
    if (sol.layers > maxRows) {
      html.push('<div class="empty">仅列出前 ' + maxRows + ' 层，共 ' + sol.layers + ' 层。</div>');
    }
    list.innerHTML = html.join('');
  }

  function renderPalletLayers(p) {
    var summary = $('#layersSummary');
    var list = $('#layerList');
    var mixed = p.type === 'mixed';
    summary.innerHTML = '<b>' + p.id + ' · ' + palletKindLabel(p) + '</b> · <b>' +
      p.layers + ' 层</b> · <b>' + p.boxes + ' 箱</b><br>实际占用 ' +
      fmt(p.actual.L) + ' × ' + fmt(p.actual.W) + ' × ' + fmt(p.actual.H) + ' mm（含托盘 ' +
      fmt(p.actual.H + state.pallet.base) + ' mm）· 重量 ' +
      fmt(p.weight) + ' / ' + (state.opts.maxLoad > 0 ? fmt(state.opts.maxLoad) : '不限') + ' kg';

    var maxRows = 240;
    var html = [];
    var count = Math.min(p.layers, maxRows);
    var L = state.pallet.L, W = state.pallet.W;
    for (var i = 0; i < count; i++) {
      var u = p.units[i];
      var svg = rectsSVG(u.rects, L, W, function (r) {
        var si = r.skuIndex != null ? r.skuIndex : u.skuIndex;
        return (mixed && si >= 0) ? PALETTE[si % PALETTE.length] : '#c99a5f';
      });
      var tags = [];
      if (i === 0) tags.push('底层');
      if (i === p.layers - 1) tags.push('顶层');
      html.push('<div class="layer-item' + (state.ui.selected === i ? ' active' : '') + '" data-layer="' + i + '">' +
        '<div class="layer-thumb">' + svg + '</div>' +
        '<div class="layer-main"><strong>第 ' + (i + 1) + ' 层 · ' + esc(unitLabel(u)) +
        (tags.length ? ' · ' + tags.join(' / ') : '') + '</strong>' +
        '<span>' + fmt(u.thickness) + ' mm · ' + u.count + ' 箱 · ' + esc(u.pattern) + '</span></div>' +
        '<div class="layer-count">' + u.count + '<small>箱</small></div></div>');
    }
    if (p.layers > maxRows) {
      html.push('<div class="empty">仅列出前 ' + maxRows + ' 层，共 ' + p.layers + ' 层。</div>');
    }
    list.innerHTML = html.join('');
  }

  function renderPlan() {
    var summary = $('#planSummary');
    var skuEl = $('#planSkuList');
    var listEl = $('#palletList');
    $('#allowMix').checked = !!state.allowMix;
    if (!plan) {
      summary.textContent = '—';
      skuEl.innerHTML = '';
      listEl.innerHTML = '<div class="pallet-empty">暂无托盘计划</div>';
      return;
    }
    var mixLine = plan.globalUsed
      ? '全局混装：整层跨规格补位，尾层同层混排'
      : (plan.mixedCount > 0
        ? '尾箱已合并到 <b>' + plan.mixedCount + '</b> 个混托'
        : (plan.tailCount > 0
          ? (plan.potentialSaving > 0 ? '尾箱各自成托，可进一步合并' : '尾箱各自成托（没有可合并的规格）')
          : '没有需要混托的尾箱'));
    summary.innerHTML =
      '<div class="plan-total"><b>' + plan.totalPallets + '</b><span>托</span><em>共 ' + fmt(plan.totalBoxes) + ' 箱</em></div>' +
      '<div class="plan-breakdown">' +
      '<span>整托 <b>' + plan.fullCount + '</b></span>' +
      '<span>混托 <b>' + plan.mixedCount + '</b></span>' +
      '<span>尾托 <b>' + plan.tailCount + '</b></span>' +
      '</div>' +
      '<div class="plan-note' + (plan.errors.length ? ' warn' : '') + '">' +
      (plan.errors.length ? '有 ' + plan.errors.length + ' 种纸箱放不下，请检查尺寸。' : mixLine) +
      '</div>';

    var strategyNote = '';
    if (plan.globalUsed) {
      strategyNote = '全局省托：' + (plan.totalPallets + plan.globalSaved) + ' → ' + plan.totalPallets +
        ' 托（少 ' + plan.globalSaved + ' 托）；' + plan.mixedCount +
        ' 个托盘跨规格整层混装，请确认层序和承压。理论下界 ' + plan.globalLowerBound + ' 托。';
    } else if (plan.globalAttempted) {
      strategyNote = '全局省托没有找到更少托数，保留当前 ' + plan.totalPallets + ' 托。';
    } else if (plan.smallBottomUsed) {
      strategyNote = '已用小/轻层垫底补空：' + (plan.totalPallets + plan.potentialSaving) + ' → ' +
        plan.totalPallets + ' 托（少 ' + plan.potentialSaving + ' 托）；层序仍按大/重在下、小/轻在上。';
    } else if (plan.allowSmallBottom && plan.allowMix && (plan.mixedCount > 0 || plan.tailCount > 0)) {
      strategyNote = '已尝试小/轻层垫底补空，但没有减少托数；保持大/重在下、小/轻在上。';
    } else if (plan.potentialSaving > 0) {
      strategyNote = '打开「允许小/轻层垫底补空」可少 ' + plan.potentialSaving + ' 托（' +
        plan.totalPallets + ' → ' + (plan.totalPallets - plan.potentialSaving) + '）。';
    }
    if (!plan.globalUsed && plan.partialTopCount > 0) {
      var flatText = '顶部平整：' +
        (plan.flattened > 0 ? '已合并 ' + plan.flattened + ' 个尾层，' : '') +
        '仅 ' + plan.partialTopCount + ' 托顶层有尾箱。';
      strategyNote = strategyNote ? strategyNote + ' ' + flatText : flatText;
    }
    if (strategyNote) {
      summary.insertAdjacentHTML('beforeend', '<div class="plan-note">' + strategyNote + '</div>');
    }

    skuEl.innerHTML = plan.skus.map(function (info, i) {
      if (plan.globalUsed) {
        return '<div class="plan-sku">' +
          '<div><strong>' + esc(info.name) + '</strong><div class="meta">' +
          fmt(info.qty) + ' 箱 · 全局分摊</div></div>' +
          '<div class="nums"><b>' + info.palletCount + '</b><span>参与托</span></div></div>';
      }
      var tailText = tailFlow(info);
      return '<div class="plan-sku">' +
        '<div><strong>' + esc(info.name) + '</strong><div class="meta">' +
        fmt(info.qty) + ' 箱 · ' + (info.ok ? '单托上限 ' + info.sol.total + ' 箱' : '放不下') + '</div></div>' +
        '<div class="nums"><b>' + (info.ok ? info.fullPallets : '—') + '</b><span>整托</span>' +
        '<span>' + esc(tailText) + '</span></div></div>';
    }).join('');

    var maxRows = 80;
    var rows = plan.pallets.slice(0, maxRows).map(function (p) {
      var title = palletTitle(p);
      var type = palletKindLabel(p);
      return '<div class="pallet-item' + (p.type === 'mixed' ? ' mixed' : '') +
        (state.palletView && state.palletView.id === p.id ? ' active' : '') +
        '" data-pallet="' + esc(p.id) + '">' +
        '<div class="pallet-id">' + esc(p.id) + '</div>' +
        '<div class="pallet-main"><strong>' + esc(title) + '</strong><span>' +
        type + ' · ' + p.boxes + ' 箱 · ' + p.layers + ' 层 · 高 ' + fmt(p.height) + '/' +
        fmt(Math.max(0, state.pallet.H - state.pallet.base)) + ' mm（含托盘 ' + fmt(p.height + state.pallet.base) + '）· ' +
        fmt(p.weight) + ' kg</span></div>' +
        '<div class="pallet-right">' + p.boxes + '<small>箱</small></div></div>';
    }).join('');
    if (plan.pallets.length > maxRows) {
      rows += '<div class="pallet-empty">仅列出前 ' + maxRows + ' 托，共 ' + plan.pallets.length + ' 托。</div>';
    }
    listEl.innerHTML = rows || '<div class="pallet-empty">暂无托盘</div>';
  }

  function palletTitle(p) {
    if (p.type === 'mixed') {
      return Object.keys(p.skuBreakdown).map(function (si) {
        return skuLabel(Number(si)) + ' ' + p.skuBreakdown[si];
      }).join(' + ');
    }
    return skuLabel(p.skuIndex);
  }

  function palletKindLabel(p) {
    if (p.type === 'mixed') return '混托';
    if (p.type === 'tail') return '尾托';
    return p.hasPartial ? '整托含尾' : '整托';
  }

  function tailFlow(info, planObj) {
    if (!info) return '';
    if (!(info.tailBoxes > 0)) return info.absorbed ? '尾箱已并入整托' : '无尾箱';
    var p = planObj || plan;
    var inMixed = p && p.mixedPallets.some(function (x) {
      return (x.skuBreakdown[info.index] || 0) > 0;
    });
    var inTail = p && p.tailPallets.some(function (x) {
      return (x.skuBreakdown[info.index] || 0) > 0;
    });
    if (inMixed && inTail) return '尾 ' + info.tailBoxes + ' 箱（部分混托）';
    if (inMixed) return '尾 ' + info.tailBoxes + ' 箱 → 混托';
    if (inTail) return '尾 ' + info.tailBoxes + ' 箱（单独尾托）';
    return '尾 ' + info.tailBoxes + ' 箱';
  }

  function viewPallet(id) {
    if (!plan) return;
    var p = plan.pallets.filter(function (x) { return x.id === id; })[0];
    if (!p) return;
    state.palletView = p;
    state.ui.selected = -1;
    state.ui.visible = null;
    state.ui.only = false;
    renderAll();
    switchTab('pallets');
    setTimeout(function () {
      var panel = $('.insights');
      var active = $('#palletList .pallet-item.active');
      if (panel && active) {
        var pr = panel.getBoundingClientRect();
        var ar = active.getBoundingClientRect();
        if (ar.top < pr.top || ar.bottom > pr.bottom) {
          panel.scrollTop += ar.top - pr.top - 80;
        }
      }
    }, 50);
  }

  function exitPalletView() {
    state.palletView = null;
    state.ui.selected = -1;
    state.ui.visible = null;
    state.ui.only = false;
    renderAll();
  }

  function renderSkus() {
    var wrap = $('#skuList');
    var badge = $('#skuCount');
    if (!state.skus.length) {
      badge.hidden = true;
      wrap.innerHTML = '<div class="empty">还没有批量清单。<br>导入 Excel 的多行纸箱后，可在这里逐个比较。</div>';
      return;
    }
    badge.hidden = false;
    badge.textContent = String(state.skus.length);
    var html = state.skus.map(function (sku, i) {
      var info = plan && plan.skus[i];
      var sol = info ? info.sol : Core.solveStack(buildConfig(sku));
      var dims = fmt(sku.l) + '×' + fmt(sku.w) + '×' + fmt(sku.h);
      var tail = info ? info.tailBoxes : 0;
      return '<div class="sku-item' + (i === skuIndex ? ' active' : '') + '" data-sku="' + i + '">' +
        '<div><strong>' + esc(sku.name) + '</strong><div class="meta">' + dims + ' mm · 订单 ' +
        fmt(sku.qty) + ' 箱 · 单托 ' + (sol && sol.ok ? sol.total : '—') + '</div></div>' +
        '<div class="nums"><b>' + (plan && plan.globalUsed ? (info ? info.palletCount : '—') : (info && info.ok ? info.fullPallets : '—')) +
        '</b><span>' + (plan && plan.globalUsed ? '参与托' : '整托' + (tail > 0 ? ' · 尾' + tail : '')) + '</span></div></div>';
    }).join('');
    wrap.innerHTML = html;
  }

  /* ------------------------------ 交互 ------------------------------ */

  function estimatedLayerBoxes() {
    var a = Number(state.carton.l), b = Number(state.carton.w);
    if (!(a > 0) || !(b > 0)) return Infinity;
    var n1 = Math.floor(state.pallet.L / a) * Math.floor(state.pallet.W / b);
    var n2 = Math.floor(state.pallet.L / b) * Math.floor(state.pallet.W / a);
    return Math.max(n1, n2);
  }

  function inputIsTooDense() {
    return estimatedLayerBoxes() > 5000;
  }

  function setCalcState(text, ready) {
    var el = $('#calcDirty');
    if (!el) return;
    el.textContent = text || '';
    el.classList.toggle('ready', !!ready);
  }

  function onParamInput() {
    readForm();
    if (skuIndex >= 0 && state.skus[skuIndex]) {
      state.skus[skuIndex] = clone(state.carton);
    }
    scheduleSave();
    setCalcState('参数已修改，点“开始计算”', false);
  }

  function calculateNow() {
    readForm();
    if (skuIndex >= 0 && state.skus[skuIndex]) {
      state.skus[skuIndex] = clone(state.carton);
    }
    if (inputIsTooDense()) {
      toast('纸箱尺寸过小，单层箱数超过 5000；请确认尺寸后再计算');
      setCalcState('尺寸过小，已暂停计算', false);
      return;
    }
    clearTimeout(recomputeTimer);
    recompute();
    setCalcState('已按当前参数重新计算', true);
    scheduleSave();
  }

  function onLimitsInput() {
    readForm();
    state.deltas = activeDeltas();
    updateDeltaUI();
    clearTimeout(recomputeTimer);
    recomputeTimer = setTimeout(function () { recompute(); }, 80);
    scheduleSave();
  }

  function onDeltaInput(axis) {
    readForm();
    var lim = state.limits[axis];
    state.deltas[axis] = clamp(parseInt($('#d' + axis).value, 10) || 0, 0, lim);
    updateDeltaUI();
    recompute({ skipAnalysis: true });
  }

  function applyPreview() {
    var d = activeDeltas();
    if (!(d.L + d.W + d.H > 0)) return;
    state.pallet.L = round1(state.pallet.L + d.L);
    state.pallet.W = round1(state.pallet.W + d.W);
    state.pallet.H = round1(state.pallet.H + d.H);
    state.deltas = { L: 0, W: 0, H: 0 };
    fillForm();
    recompute();
    toast('已采用新基准：' + fmt(state.pallet.L) + ' × ' + fmt(state.pallet.W) + ' × ' + fmt(state.pallet.H) + ' mm');
  }

  function previewOption(idx) {
    if (!analysis || !analysis.options[idx]) return;
    var opt = analysis.options[idx];
    state.deltas = { L: opt.dL, W: opt.dW, H: opt.dH };
    updateDeltaUI();
    recompute({ skipAnalysis: true });
    toast('预览方案：' + [opt.dL ? '长+' + opt.dL : '', opt.dW ? '宽+' + opt.dW : '', opt.dH ? '高+' + opt.dH : ''].filter(Boolean).join(' / '));
  }

  function applyOption(idx) {
    if (!analysis || !analysis.options[idx]) return;
    var opt = analysis.options[idx];
    state.pallet.L = round1(state.pallet.L + opt.dL);
    state.pallet.W = round1(state.pallet.W + opt.dW);
    state.pallet.H = round1(state.pallet.H + opt.dH);
    state.deltas = { L: 0, W: 0, H: 0 };
    fillForm();
    recompute();
    toast('已应用：单托 ' + currentSolution.total + ' 箱');
  }

  function previewAxis(axis, delta) {
    state.deltas = { L: 0, W: 0, H: 0 };
    state.deltas[axis] = clamp(delta, 0, state.limits[axis]);
    updateDeltaUI();
    recompute({ skipAnalysis: true });
  }

  function activeLayerCount() {
    if (state.palletView) return state.palletView.layers;
    return currentSolution && currentSolution.ok ? currentSolution.layers : 0;
  }

  function selectLayer(i) {
    if (!activeLayerCount()) return;
    state.ui.selected = i;
    if (state.ui.visible != null && state.ui.visible < i + 1) {
      state.ui.visible = i + 1;
    }
    // 俯视时各层完全重叠，自动切回等轴测，点哪层就能看到哪层
    if (scene.cam.pitch > 1.30 && !state.ui.only) {
      scene.setView('iso', true);
      $$('#viewSeg button').forEach(function (b) {
        b.classList.toggle('active', b.dataset.view === 'iso');
      });
    }
    render3D();
    renderLayers();
    var items = $$('#layerList .layer-item');
    items.forEach(function (el) {
      el.classList.toggle('active', Number(el.dataset.layer) === i);
    });
  }

  function toggleOnly() {
    if (!activeLayerCount()) return;
    if (state.ui.selected < 0) state.ui.selected = activeLayerCount() - 1;
    state.ui.only = !state.ui.only;
    render3D();
  }

  function switchTab(name) {
    if ((name === 'advice' || name === 'skus') && state.palletView) {
      state.palletView = null;
      state.ui.selected = -1;
      state.ui.visible = null;
      state.ui.only = false;
      renderAll();
    }
    $$('#tabs button').forEach(function (b) {
      b.classList.toggle('active', b.dataset.tab === name);
    });
    $$('.tab-pane').forEach(function (p) {
      p.hidden = p.id !== 'tab-' + name;
    });
    state.ui.tab = name;
  }

  function loadSku(i) {
    if (!state.skus[i]) return;
    readForm();
    skuIndex = i;
    state.palletView = null;
    state.carton = clone(state.skus[i]);
    state.deltas = { L: 0, W: 0, H: 0 };
    fillForm();
    recompute();
    toast('当前：' + state.carton.name);
  }

  function toast(msg, type) {
    var el = $('#toast');
    el.textContent = msg;
    el.classList.toggle('error', type === 'error');
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 2800);
  }

  /* ------------------------------ Excel 解析 ------------------------------ */

  function numFrom(v) {
    if (typeof v === 'number' && isFinite(v)) return v;
    if (v == null) return null;
    var s = String(v).replace(/,/g, '').replace(/[^\d.\-+]/g, '');
    if (!s) return null;
    var n = parseFloat(s);
    return isFinite(n) ? n : null;
  }

  function normHeader(v) {
    return String(v == null ? '' : v)
      .replace(/[（(][^)）]*[)）]/g, '')
      .replace(/\s|\*|：|:/g, '')
      .toLowerCase();
  }

  function findCol(hdr, kind) {
    var tests = {
      name: [/名称/, /品名/, /型号/, /物料/, /sku/, /产品/],
      l: [/^长$/, /^长度$/, /^外长$/, /^l$/, /纸箱长/, /箱长/],
      w: [/^宽$/, /^宽度$/, /^外宽$/, /^w$/, /纸箱宽/, /箱宽/],
      h: [/^高$/, /^高度$/, /^外高$/, /^h$/, /纸箱高/, /箱高/],
      qty: [/数量/, /箱数/, /qty/, /订单/, /件数/],
      weight: [/单重/, /毛重/, /净重/, /重量/, /kg/]
    };
    var list = tests[kind] || [];
    for (var i = 0; i < hdr.length; i++) {
      for (var j = 0; j < list.length; j++) {
        if (list[j].test(hdr[i])) return i;
      }
    }
    return -1;
  }

  function boolFrom(v) {
    if (typeof v === 'boolean') return v;
    if (typeof v === 'number' && isFinite(v)) return v !== 0;
    var s = String(v == null ? '' : v).trim().toLowerCase();
    if (!s) return null;
    if (/^(是|允许|开|true|yes|y|1)$/.test(s)) return true;
    if (/^(否|不允许|关|false|no|n|0)$/.test(s)) return false;
    return null;
  }

  function palletKey(label, sheetName) {
    var s = String(label).replace(/\s/g, '').replace(/[（(][^)）]*[)）]/g, '');
    if (!s) return null;
    if (/(允许)?混托|混装/.test(s)) return 'allowMix';
    if (/全局.*省托|全局.*混装/.test(s)) return 'globalOptimize';
    if (/(允许)?小.*垫底|轻.*垫底|小箱垫底|小箱在下/.test(s)) return 'allowSmallBottom';
    if (/(允许)?侧立|侧放/.test(s)) return 'allowSide';
    if (/(允许)?竖放|立放/.test(s)) return 'allowUprightLay';
    if (/(载重|承重)/.test(s)) return 'maxLoad';
    if (/(最大.*层|层数.*上限|最多.*层|堆叠层)/.test(s)) return 'maxLayers';
    if (/(垫板|隔板|层间)/.test(s)) return 'sheet';
    if (/(间隙|间距)/.test(s)) return 'gap';
    if (/(边距|留边|余量)/.test(s)) return 'margin';
    if (/(超出|悬空|外伸)/.test(s)) return 'overhang';
    if (/(托盘.*高|盘高|托盘厚|垫高)/.test(s)) return 'base';
    var isPalletSheet = /托盘|容器|参数/.test(sheetName);
    if (/(放量|可增|增加|上限|最多可放)/.test(s)) {
      if (/长/.test(s)) return 'limL';
      if (/宽/.test(s)) return 'limW';
      if (/高/.test(s)) return 'limH';
    }
    if (/长/.test(s) && (/托盘|容器|内|净/.test(s) || isPalletSheet)) return 'L';
    if (/宽/.test(s) && (/托盘|容器|内|净/.test(s) || isPalletSheet)) return 'W';
    if (/高/.test(s) && (/码放|可用|最大|托盘|容器|内|净/.test(s) || isPalletSheet)) return 'H';
    return null;
  }

  function parseCartonSheet(sh) {
    var rows = sh.rows || [];
    for (var r = 0; r < Math.min(rows.length, 45); r++) {
      var hdr = (rows[r] || []).map(normHeader);
      var cols = {
        name: findCol(hdr, 'name'), l: findCol(hdr, 'l'), w: findCol(hdr, 'w'),
        h: findCol(hdr, 'h'), qty: findCol(hdr, 'qty'), weight: findCol(hdr, 'weight')
      };
      if (cols.l < 0 || cols.w < 0 || cols.h < 0) continue;
      if (cols.l === cols.w || cols.w === cols.h || cols.l === cols.h) continue;
      var list = [];
      var empty = 0;
      for (var i = r + 1; i < rows.length; i++) {
        var row = rows[i] || [];
        var l = numFrom(row[cols.l]);
        var w = numFrom(row[cols.w]);
        var h = numFrom(row[cols.h]);
        if (l == null || w == null || h == null || l <= 0 || w <= 0 || h <= 0) {
          var blank = row.every(function (c) { return String(c == null ? '' : c).trim() === ''; });
          if (blank) { empty++; if (empty >= 2) break; }
          continue;
        }
        empty = 0;
        var name = cols.name >= 0 ? String(row[cols.name] == null ? '' : row[cols.name]).trim() : '';
        list.push({
          name: name || ('纸箱 ' + (list.length + 1)),
          l: l, w: w, h: h,
          qty: cols.qty >= 0 ? (numFrom(row[cols.qty]) || 0) : 0,
          weight: cols.weight >= 0 ? (numFrom(row[cols.weight]) || 0) : 0
        });
        if (list.length >= 200) break;
      }
      if (list.length) return list;
    }
    return [];
  }

  function parseWorkbook(sheets) {
    var out = { pallet: {}, limits: {}, opts: {}, cartons: [], allowMix: null };
    var ordered = sheets.slice().sort(function (a, b) {
      function score(name) {
        var s = 0;
        if (/托盘|容器/.test(name)) s += 3;
        if (/参数/.test(name)) s += 2;
        if (/纸箱|明细|箱型/.test(name)) s += 1;
        return s;
      }
      return score(b.name) - score(a.name);
    });

    ordered.forEach(function (sh) {
      (sh.rows || []).forEach(function (row) {
        if (!row || !row.length) return;
        for (var c = 0; c < row.length - 1; c++) {
          var label = String(row[c] == null ? '' : row[c]).trim();
          if (!label || label.length > 30) continue;
          var key = palletKey(label, sh.name);
          if (!key) continue;
          if (key === 'allowSide' || key === 'allowUprightLay' || key === 'allowSmallBottom' || key === 'globalOptimize' || key === 'allowMix') {
            var bool = boolFrom(row[c + 1]);
            if (bool == null) continue;
            if (key === 'allowMix') {
              if (out.allowMix == null) out.allowMix = bool;
            } else if (out.opts[key] == null) {
              out.opts[key] = bool;
            }
            break;
          }
          var val = numFrom(row[c + 1]);
          if (val == null) continue;
          if (key === 'L' || key === 'W' || key === 'H' || key === 'base') {
            if (out.pallet[key] == null) out.pallet[key] = val;
          } else if (key === 'limL') {
            if (out.limits.L == null) out.limits.L = val;
          } else if (key === 'limW') {
            if (out.limits.W == null) out.limits.W = val;
          } else if (key === 'limH') {
            if (out.limits.H == null) out.limits.H = val;
          } else if (out.opts[key] == null) {
            out.opts[key] = val;
          }
          break;
        }
      });
    });

    for (var i = 0; i < ordered.length; i++) {
      var list = parseCartonSheet(ordered[i]);
      if (list.length) { out.cartons = list; break; }
    }
    return out;
  }

  function applyParsed(parsed) {
    var p = parsed.pallet;
    if (p.L != null && p.W != null && p.H != null) {
      state.pallet = { L: p.L, W: p.W, H: p.H, base: p.base != null ? p.base : 0 };
    } else {
      if (p.L != null) state.pallet.L = p.L;
      if (p.W != null) state.pallet.W = p.W;
      if (p.H != null) state.pallet.H = p.H;
      state.pallet.base = p.base != null ? p.base : 0;
    }
    if (parsed.limits.L != null || parsed.limits.W != null || parsed.limits.H != null) {
      if (parsed.limits.L != null) state.limits.L = clamp(parsed.limits.L, 0, 500);
      if (parsed.limits.W != null) state.limits.W = clamp(parsed.limits.W, 0, 500);
      if (parsed.limits.H != null) state.limits.H = clamp(parsed.limits.H, 0, 500);
    }
    if (parsed.allowMix != null) state.allowMix = !!parsed.allowMix;
    Object.keys(parsed.opts || {}).forEach(function (k) {
      if (k === 'allowSide' || k === 'allowUprightLay' || k === 'allowSmallBottom' || k === 'globalOptimize') {
        state.opts[k] = !!parsed.opts[k];
      } else if (state.opts[k] != null) {
        state.opts[k] = Math.max(0, parsed.opts[k]);
      }
    });
    if (parsed.cartons.length) {
      state.skus = parsed.cartons;
      skuIndex = 0;
      state.carton = clone(parsed.cartons[0]);
    }
    state.deltas = { L: 0, W: 0, H: 0 };
    fillForm();
    recompute();
    switchTab(parsed.cartons.length > 1 ? 'pallets' : 'advice');
    toast('已导入' + (parsed.cartons.length ? ' ' + parsed.cartons.length + ' 种纸箱' : '托盘参数') +
      ' · ' + fmt(state.pallet.L) + '×' + fmt(state.pallet.W) + '×' + fmt(state.pallet.H) +
      ' mm（总高，含托盘 ' + fmt(state.pallet.base) + '）');
  }

  async function handleFile(file) {
    if (!file) return;
    var label = $('#importLabel');
    var old = label.childNodes[0];
    try {
      label.classList.add('loading');
      var sheets;
      if (/\.csv$/i.test(file.name)) {
        var text = await file.text();
        sheets = [{ name: 'CSV', rows: XL.parseCSV(text) }];
      } else if (/\.xls$/i.test(file.name)) {
        throw new Error('旧版 .xls 不支持，请在 Excel 中另存为 .xlsx。');
      } else {
        var buf = await file.arrayBuffer();
        var wb = await XL.readWorkbook(buf);
        sheets = wb.sheets;
      }
      var parsed = parseWorkbook(sheets);
      if (!parsed.pallet.L && !parsed.pallet.W && !parsed.pallet.H && !parsed.cartons.length) {
        throw new Error('没有识别到托盘尺寸或纸箱表。请用「模板」填写后再导入。');
      }
      applyParsed(parsed);
    } catch (e) {
      toast(e && e.message ? e.message : '导入失败', 'error');
    } finally {
      label.classList.remove('loading');
      $('#fileInput').value = '';
    }
  }

  /* ------------------------------ 导出 ------------------------------ */

  function downloadBytes(bytes, name) {
    var blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 500);
  }

  function templateBook() {
    return {
      sheets: [
        {
          name: '托盘参数',
          cols: [22, 12, 9, 38],
          rows: [
            ['参数', '值', '单位', '说明'],
            ['托盘长', 120, 'mm', '托盘 / 容器内净长'],
            ['托盘宽', 80, 'mm', '托盘 / 容器内净宽'],
            ['最大总高', 115, 'mm', '含托盘总高；可用码放高 = 最大总高 − 托盘高度'],
            ['托盘高度', 0, 'mm', '托盘 / 垫木本身高度；计入总高，但不占纸箱层高'],
            ['长可放量上限', 20, 'mm', '最多允许增加多少（0 = 不放量）'],
            ['宽可放量上限', 0, 'mm', ''],
            ['高可放量上限', 6, 'mm', ''],
            ['箱间间隙', 0, 'mm', '相邻纸箱之间预留'],
            ['边缘余量', 0, 'mm', '纸箱离托盘边缘预留'],
            ['层间垫板厚', 0, 'mm', '每层之间垫板 / 隔纸厚度'],
            ['允许超出托盘', 0, 'mm', '向四周同时允许超出'],
            ['最大载重', 0, 'kg', '0 = 不限制'],
            ['最大堆叠层数', 0, '层', '0 = 不限制'],
            ['允许侧立', '否', '', '是 = 允许用纸箱的“宽”作高'],
            ['允许竖放', '否', '', '是 = 允许用纸箱的“长”作高'],
            ['允许混托', '是', '', '是 = 允许尾箱与其他规格合并到一托'],
            ['允许小箱垫底', '是', '', '是 = 允许小/轻尾层垫底补空，只有减少托数才采用'],
            ['全局省托', '否', '', '是 = 允许整层跨规格补位，托盘数优先，整托可能不再单一规格']
          ]
        },
        {
          name: '纸箱明细',
          cols: [20, 11, 11, 11, 10, 12, 26],
          rows: [
            ['名称', '长(mm)', '宽(mm)', '高(mm)', '数量', '单重(kg)', '备注'],
            ['示例纸箱 A', 28, 18, 10, 500, 0.15, '按原包装方向正放'],
            ['示例纸箱 B', 40, 30, 15, 240, 0.40, '可多行，导入后逐个测算']
          ]
        },
        {
          name: '填写说明',
          cols: [26, 80],
          rows: [
            ['项目', '说明'],
            ['尺寸单位', '全部使用毫米 mm，填纸箱外径与托盘内净尺寸'],
            ['托盘高度', '填最大总高（含托盘）和托盘本身高度；可用码放高 = 最大总高 − 托盘高度'],
            ['纸箱方向', '默认按原包装方向平放；侧立 / 竖放在左侧开关打开后才参与计算，平放始终允许'],
            ['多行纸箱', '每行一种纸箱，导入后在「托盘清单 / 纸箱清单」里切换查看'],
            ['混托', '允许混托时，各规格尾箱会尝试合并到同一托；关闭则尾箱各自成托'],
            ['小箱垫底', '默认大/重在下；打开后允许多个尾层同托，只有确实减少托数时才采用'],
            ['全局省托', '先按规格整托，再把整层塞进其他托剩余高度；托数最少，但整托可能不再单一规格'],
            ['放量上限', '长宽高各能增加多少毫米；设为 0 表示该方向固定'],
            ['排布算法', '顺排 / 旋转 90° / 对拼 / 行列混排 / 风车拼花，取每层最多']
          ]
        }
      ]
    };
  }

  function downloadTemplate() {
    downloadBytes(XL.writeWorkbook(templateBook()), '托盘码放-导入模板.xlsx');
    toast('模板已下载，填好后直接拖回「导入 Excel」');
  }

  function exportXlsx() {
    var list = state.skus.length ? state.skus : [state.carton];
    var cfgs = list.map(function (sku) { return buildConfig(sku); });
    var p = Core.buildPlan(cfgs, { allowMix: !!state.allowMix, solutions: cfgs.map(exactSolutionFor) });

    var infoRows = [[
      '纸箱名称', '订单数量', '单托上限', '整托数', '尾箱数', '参与托盘数', '说明'
    ]];
    p.skus.forEach(function (info) {
      var involved = p.pallets.filter(function (x) { return x.skuBreakdown[info.index] > 0; }).length;
      infoRows.push([
        info.name, info.qty, info.ok ? info.sol.total : 0,
        p.globalUsed ? involved : info.fullPallets,
        p.globalUsed ? '' : info.tailBoxes,
        involved,
        info.error ? '放不下' : (p.globalUsed ? '全局省托分摊' : tailFlow(info, p))
      ]);
    });
    infoRows.push(['合计', p.totalBoxes, '', p.fullCount, '', p.totalPallets,
      '整托 ' + p.fullCount + ' · 混托 ' + p.mixedCount + ' · 尾托 ' + p.tailCount]);

    var planRows = [[
      '托盘号', '类型', '规格明细', '箱数', '层数', '实际长', '实际宽', '实际高', '含托盘总高', '重量kg', '限高mm'
    ]];
    p.pallets.forEach(function (x) {
      planRows.push([
        x.id,
        palletKindLabel(x),
        palletTitle(x), x.boxes, x.layers,
        Math.round(x.actual.L * 10) / 10,
        Math.round(x.actual.W * 10) / 10,
        Math.round(x.actual.H * 10) / 10,
        Math.round((x.actual.H + state.pallet.base) * 10) / 10,
        Math.round(x.weight * 100) / 100,
        state.pallet.H
      ]);
    });

    var capRows = [[
      '纸箱名称', '长', '宽', '高', '每层', '层数', '单托上限', '排布方式', '朝向', '体积利用率', '单托重量kg'
    ]];
    p.skus.forEach(function (info) {
      var sol = info.sol;
      capRows.push([
        info.name,
        (state.skus[info.index] || state.carton).l,
        (state.skus[info.index] || state.carton).w,
        (state.skus[info.index] || state.carton).h,
        sol.ok ? sol.perLayer : 0, sol.ok ? sol.layers : 0, sol.ok ? sol.total : 0,
        sol.ok ? sol.layer.pattern : '无法码放',
        sol.ok ? sol.orientation.label : '—',
        sol.ok ? pct(sol.volUtil) : '—',
        sol.ok ? Math.round(sol.weight * 100) / 100 : 0
      ]);
    });

    var sheets = [
      { name: '订单汇总', cols: [22, 10, 10, 8, 8, 10, 22], rows: infoRows },
      { name: '托盘计划', cols: [9, 8, 26, 8, 7, 10, 10, 10, 10, 10, 9], rows: planRows },
      { name: '单托能力', cols: [22, 9, 9, 9, 8, 8, 10, 15, 14, 12, 12], rows: capRows }
    ];

    if (analysis) {
      var rec = [['方案', '长放量', '宽放量', '高放量', '长', '宽', '高', '单托数量', '增加箱数', '改动合计mm', '层数', '每层']];
      rec.push(['基准', 0, 0, 0, state.pallet.L, state.pallet.W, state.pallet.H,
        analysis.baseTotal, 0, 0, baseSolution.layers, baseSolution.perLayer]);
      analysis.options.forEach(function (o) {
        rec.push([o.title, o.dL, o.dW, o.dH,
          state.pallet.L + o.dL, state.pallet.W + o.dW, state.pallet.H + o.dH,
          o.total, o.gain, o.cost, o.layers, o.perLayer]);
      });
      sheets.push({ name: '放量推荐', cols: [16, 9, 9, 9, 9, 9, 9, 11, 10, 12, 8, 8], rows: rec });
    }

    var lay = [['层号', '纸箱规格', '箱数', '层高mm', '累计高mm']];
    if (state.palletView) {
      var pv = state.palletView;
      var acc = 0;
      pv.units.forEach(function (u, i) {
        acc += u.thickness + (i ? state.opts.sheet : 0);
        lay.push([i + 1, unitLabel(u), u.count, u.thickness, Math.round(acc)]);
      });
      sheets.push({ name: '逐层明细', cols: [8, 20, 9, 10, 11], rows: lay });
    } else if (currentSolution && currentSolution.ok) {
      for (var i = 0; i < currentSolution.layers; i++) {
        lay.push([i + 1, state.carton.name, currentSolution.perLayer, currentSolution.orientation.thickness,
          Math.round((i + 1) * currentSolution.orientation.thickness + i * state.opts.sheet)]);
      }
      sheets.push({ name: '逐层明细', cols: [8, 20, 9, 10, 11], rows: lay });
    }

    var d = new Date();
    var stamp = d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0') +
      '-' + String(d.getHours()).padStart(2, '0') + String(d.getMinutes()).padStart(2, '0');
    downloadBytes(XL.writeWorkbook({ sheets: sheets }), '托盘码放测算-' + stamp + '.xlsx');
    toast('托盘计划与测算结果已导出');
  }

  function printReport() {
    if (!currentSolution || !currentSolution.ok) { toast('当前没有可打印的方案', 'error'); return; }
    var sol = currentSolution;
    var dims = {
      L: state.pallet.L + activeDeltas().L,
      W: state.pallet.W + activeDeltas().W,
      H: Math.max(0, state.pallet.H + activeDeltas().H - state.pallet.base)
    };
    var actual = actualFromBoxes(Core.layerBoxes(sol, 6000)) || { L: 0, W: 0, H: 0 };
    var orientGroups = solOrientationGroups(sol);
    var orientRows = orientGroups.map(function (g, i) {
      return '<tr><td>' + (g.rot ? '旋转 90°' : '平放') + '</td><td>' +
        fmt(g.w) + ' × ' + fmt(g.h) + ' × ' + fmt(g.thickness) + ' mm</td><td>' +
        g.count + ' 箱</td></tr>';
    }).join('');
    var orientTable = '<h2>单箱尺寸 / 朝向</h2>' +
      '<table><thead><tr><th>朝向</th><th>实际长 × 宽 × 高</th><th>每层数量</th></tr></thead><tbody>' +
      orientRows + '</tbody></table>';
    var rows = '';
    if (analysis) {
      rows = analysis.options.map(function (o) {
        return '<tr><td>' + esc(o.title) + '</td><td>+' + fmt(o.dL) + ' / +' + fmt(o.dW) + ' / +' + fmt(o.dH) +
          '</td><td>' + o.total + '</td><td>+' + o.gain + '</td><td>' + o.layers + ' 层 × ' + o.perLayer + ' 箱</td></tr>';
      }).join('');
    }
    var planRows = '';
    if (plan) {
      planRows = plan.pallets.map(function (p) {
        return '<tr><td>' + esc(p.id) + '</td><td>' +
          palletKindLabel(p) + '</td><td>' +
          esc(palletTitle(p)) + '</td><td>' + p.boxes + '</td><td>' + p.layers + '</td><td>' +
          fmt(p.actual.L) + '×' + fmt(p.actual.W) + '×' + fmt(p.actual.H) + ' / ' +
          fmt(p.actual.H + state.pallet.base) + '</td><td>' +
          fmt(p.weight) + '</td></tr>';
      }).join('');
    }
    var html = '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>托盘码放方案</title>' +
      '<style>' +
      'body{font-family:"Microsoft YaHei","Segoe UI",sans-serif;color:#222;margin:26px;font-size:12px;line-height:1.6}' +
      'h1{font-size:21px;margin:0 0 2px}p.sub{color:#777;margin:0 0 18px;font-size:11px}' +
      '.kpis{display:flex;gap:8px;margin:14px 0 18px;flex-wrap:wrap}' +
      '.kpi{border:1px solid #ddd;border-radius:8px;padding:8px 14px;min-width:96px}' +
      '.kpi span{display:block;color:#777;font-size:10px}.kpi b{font-size:20px}' +
      'h2{font-size:13px;margin:18px 0 8px;border-left:3px solid #b4551f;padding-left:8px}' +
      'table{border-collapse:collapse;width:100%;font-size:11px}' +
      'th,td{border:1px solid #ddd;padding:5px 7px;text-align:left}th{background:#f7f2e8}' +
      '.layout{display:flex;gap:22px;align-items:flex-start}.drawing{flex:0 0 46%}.drawing svg{width:100%;border:1px solid #e3dccd;border-radius:8px;background:#faf6ed}' +
      '.params{flex:1}.params div{display:flex;justify-content:space-between;border-bottom:1px dashed #e5dfd2;padding:4px 0}' +
      '.foot{margin-top:22px;color:#999;font-size:10px}' +
      '@page{size:A4;margin:13mm}@media print{body{margin:0}.noprint{display:none}}' +
      '</style></head><body>' +
      '<button class="noprint" onclick="window.print()" style="float:right;padding:6px 14px">打印 / 存为 PDF</button>' +
      '<h1>托盘码放方案 · ' + esc(state.carton.name) + '</h1>' +
      '<p class="sub">生成时间 ' + new Date().toLocaleString('zh-CN') + ' · 尺寸单位 mm · 订单共 ' +
      (plan ? plan.totalPallets : sol.pallets) + ' 托（整托 ' + (plan ? plan.fullCount : '—') +
      ' · 混托 ' + (plan ? plan.mixedCount : '—') + '）</p>' +
      '<div class="kpis">' +
      '<div class="kpi"><span>每层</span><b>' + sol.perLayer + '</b></div>' +
      '<div class="kpi"><span>层数</span><b>' + sol.layers + '</b></div>' +
      '<div class="kpi"><span>单托总数</span><b>' + sol.total + '</b></div>' +
      '<div class="kpi"><span>实际占用</span><b style="font-size:14px">' + fmt(actual.L) + '×' + fmt(actual.W) + '×' + fmt(actual.H) + '</b></div>' +
      '<div class="kpi"><span>订单需托</span><b>' + (plan ? plan.totalPallets : sol.pallets) + '</b></div>' +
      '</div>' +
      '<div class="layout"><div class="drawing"><h2>单层排布（俯视）</h2>' + layerSVG(sol, true, actual) +
      '<p class="sub">' + esc(sol.layer.pattern) + ' · 每层 ' + sol.perLayer + ' 箱 · ' + esc(sol.orientation.label) + '</p></div>' +
      '<div class="params"><h2>方案参数</h2>' +
      '<div><span>可用尺寸（长×宽×可用高）</span><b>' + fmt(dims.L) + ' × ' + fmt(dims.W) + ' × ' + fmt(dims.H) + '</b></div>' +
      '<div><span>最大总高 / 托盘高</span><b>' + fmt(state.pallet.H + activeDeltas().H - state.pallet.base + state.pallet.base) + ' / ' + fmt(state.pallet.base) + ' mm</b></div>' +
      '<div><span>纸箱外径</span><b>' + fmt(state.carton.l) + ' × ' + fmt(state.carton.w) + ' × ' + fmt(state.carton.h) + '</b></div>' +
      '<div><span>实际码放（长×宽×高）</span><b>' + fmt(actual.L) + ' × ' + fmt(actual.W) + ' × ' + fmt(actual.H) + ' mm</b></div>' +
      '<div><span>含托盘总高</span><b>' + fmt(actual.H + state.pallet.base) + ' mm</b></div>' +
      '<div><span>层高 / 占用高</span><b>' + fmt(sol.pitch) + ' / ' + fmt(sol.usedHeight) + ' mm</b></div>' +
      '<div><span>单箱重量 / 单托重量</span><b>' + fmt(state.carton.weight) + ' / ' + fmt(sol.weight) + ' kg</b></div>' +
      '<div><span>订单数量</span><b>' + fmt(state.carton.qty) + ' 箱</b></div>' +
      '<div><span>订单托数</span><b>' + (plan ? plan.totalPallets : sol.pallets) + ' 托（整托 ' +
      (plan ? plan.fullCount : '—') + ' · 混托 ' + (plan ? plan.mixedCount : '—') + '）</b></div>' +
      '</div></div>' +
      orientTable +
      (planRows ? '<h2>托盘计划（共 ' + plan.totalPallets + ' 托）</h2>' +
        '<table><thead><tr><th>托盘号</th><th>类型</th><th>规格明细</th><th>箱数</th><th>层数</th><th>实际长×宽×高 / 含托盘</th><th>重量kg</th></tr></thead><tbody>' +
        planRows + '</tbody></table>' : '') +
      (analysis && rows ? '<h2>放量推荐</h2><table><thead><tr><th>方案</th><th>长 / 宽 / 高 放量</th><th>单托箱数</th><th>增加</th><th>层数</th></tr></thead><tbody>' + rows + '</tbody></table>' : '') +
      '<p class="foot">由「托盘码放测算台」生成 · 算法：分层启发式（顺排 / 90° / 对拼 / 行列混排 / 风车拼花）</p>' +
      '</body></html>';

    var w = window.open('', '_blank');
    if (!w) { toast('浏览器拦截了打印窗口，请允许弹窗后重试', 'error'); return; }
    w.document.open();
    w.document.write(html);
    w.document.close();
    setTimeout(function () { try { w.focus(); w.print(); } catch (e) { /* ignore */ } }, 400);
  }

  function savePng() {
    if (!scene || !scene.canvas) return;
    scene.canvas.toBlob(function (blob) {
      if (!blob) { toast('截图失败', 'error'); return; }
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = '码放3D-' + Date.now() + '.png';
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 500);
      toast('3D 截图已保存');
    }, 'image/png');
  }

  function resetAll() {
    if (!window.confirm('恢复示例参数会覆盖当前填写的内容，继续？')) return;
    state.pallet = clone(DEFAULTS.pallet);
    state.carton = clone(DEFAULTS.carton);
    state.opts = clone(DEFAULTS.opts);
    state.limits = clone(DEFAULTS.limits);
    state.deltas = { L: 0, W: 0, H: 0 };
    state.skus = [];
    state.ui.selected = -1;
    state.ui.visible = null;
    state.ui.only = false;
    state.ui.explode = 10;
    state.palletView = null;
    state.allowMix = true;
    $('#explodeRange').value = '10';
    $('#explodeVal').textContent = '10%';
    skuIndex = -1;
    fillForm();
    recompute();
    switchTab('advice');
    toast('已恢复示例');
  }

  /* ------------------------------ 事件绑定 ------------------------------ */

  function bindEvents() {
    ['palletL', 'palletW', 'palletH', 'palletBase', 'cartonName', 'cartonL', 'cartonW', 'cartonH',
      'cartonQty', 'cartonWeight', 'optGap', 'optMargin', 'optSheet', 'optOverhang',
      'optMaxLoad', 'optMaxLayers'].forEach(function (id) {
        // 输入时只做防抖；纸箱过小会被 inputIsTooDense 拦截，避免把 120 输到一半时按 1 卡死
        $('#' + id).addEventListener('input', onParamInput);
        $('#' + id).addEventListener('change', onParamInput);
        $('#' + id).addEventListener('keydown', function (e) {
          if (e.key === 'Enter') {
            e.preventDefault();
            calculateNow();
          }
        });
      });
    ['limL', 'limW', 'limH'].forEach(function (id) {
      $('#' + id).addEventListener('input', onLimitsInput);
    });
    ['allowSide', 'allowUprightLay'].forEach(function (id) {
      $('#' + id).addEventListener('change', onParamInput);
    });
    $('#allowSmallBottom').addEventListener('change', onParamInput);
    $('#globalOptimize').addEventListener('change', onParamInput);
    ['L', 'W', 'H'].forEach(function (k) {
      $('#d' + k).addEventListener('input', function () { onDeltaInput(k); });
    });

    $('#btnApplyPreview').addEventListener('click', applyPreview);
    $('#btnCalculate').addEventListener('click', calculateNow);
    $('#onlyLayer').addEventListener('click', toggleOnly);
    $('#btnExitPallet').addEventListener('click', exitPalletView);
    $('#allowMix').addEventListener('change', function () {
      state.allowMix = this.checked;
      scheduleSave();
      setCalcState('参数已修改，点“开始计算”', false);
    });

    $('#visibleRange').addEventListener('input', function () {
      var v = parseInt(this.value, 10) || 1;
      var layers = activeLayerCount() || 1;
      state.ui.visible = v >= layers ? null : v;
      if (state.ui.selected >= v) state.ui.selected = v - 1;
      state.ui.only = false;
      render3D();
      renderLayers();
    });
    $('#explodeRange').addEventListener('input', function () {
      state.ui.explode = parseInt(this.value, 10) || 0;
      $('#explodeVal').textContent = state.ui.explode + '%';
      scene.setLayerView({ explode: explodeMM(currentSolution) });
      render3D();
    });

    $$('#tabs button').forEach(function (b) {
      b.addEventListener('click', function () { switchTab(b.dataset.tab); });
    });

    $('#adviceList').addEventListener('click', function (e) {
      var btn = e.target.closest('button[data-act]');
      if (!btn) return;
      var idx = Number(btn.dataset.idx);
      if (btn.dataset.act === 'preview') previewOption(idx);
      else applyOption(idx);
    });
    $('#axisTable').addEventListener('click', function (e) {
      var btn = e.target.closest('button[data-axis]');
      if (!btn) return;
      previewAxis(btn.dataset.axis, Number(btn.dataset.delta));
    });
    $('#layerList').addEventListener('click', function (e) {
      var item = e.target.closest('.layer-item');
      if (!item) return;
      selectLayer(Number(item.dataset.layer));
    });
    $('#palletList').addEventListener('click', function (e) {
      var item = e.target.closest('.pallet-item');
      if (!item) return;
      viewPallet(item.dataset.pallet);
    });
    $('#skuList').addEventListener('click', function (e) {
      var item = e.target.closest('.sku-item');
      if (!item) return;
      loadSku(Number(item.dataset.sku));
    });

    $('#btnTemplate').addEventListener('click', downloadTemplate);
    $('#fileInput').addEventListener('change', function (e) {
      handleFile(e.target.files && e.target.files[0]);
    });
    $('#btnExport').addEventListener('click', function (e) {
      e.stopPropagation();
      var menu = $('#exportMenu');
      menu.hidden = !menu.hidden;
    });
    $('#exportMenu').addEventListener('click', function (e) {
      var btn = e.target.closest('button[data-export]');
      if (!btn) return;
      $('#exportMenu').hidden = true;
      if (btn.dataset.export === 'xlsx') exportXlsx();
      else if (btn.dataset.export === 'print') printReport();
      else if (btn.dataset.export === 'png') savePng();
    });
    document.addEventListener('click', function () { $('#exportMenu').hidden = true; });

    var seg = $('#viewSeg');
    seg.addEventListener('click', function (e) {
      var btn = e.target.closest('button[data-view]');
      if (!btn) return;
      $$('#viewSeg button').forEach(function (b) { b.classList.toggle('active', b === btn); });
      scene.setView(btn.dataset.view, true);
    });
    $('#btnResetCam').addEventListener('click', function () {
      scene.resetCamera();
      $$('#viewSeg button').forEach(function (b) { b.classList.toggle('active', b.dataset.view === 'iso'); });
    });
    $('#btnRotate').addEventListener('click', function () {
      var on = !this.classList.contains('active');
      this.classList.toggle('active', on);
      scene.setAutoRotate(on);
    });

    $('#advToggle').addEventListener('click', function () {
      var expanded = this.getAttribute('aria-expanded') === 'true';
      this.setAttribute('aria-expanded', String(!expanded));
      $('#advBody').hidden = expanded;
    });
    $('#btnReset').addEventListener('click', resetAll);

    document.addEventListener('keydown', function (e) {
      if (/input|textarea|select/i.test((e.target.tagName || ''))) return;
      var map = { '1': 'iso', '2': 'top', '3': 'front', '4': 'side' };
      if (map[e.key]) {
        scene.setView(map[e.key], true);
        $$('#viewSeg button').forEach(function (b) { b.classList.toggle('active', b.dataset.view === map[e.key]); });
      }
      if (e.key === 'Escape') {
        state.ui.selected = -1;
        state.ui.only = false;
        render3D();
        renderLayers();
      }
    });

    $('#btnSchemes').addEventListener('click', openSchemeModal);
    $('#schemeClose').addEventListener('click', closeSchemeModal);
    $('#schemeModal').addEventListener('click', function (e) {
      if (e.target === $('#schemeModal')) closeSchemeModal();
    });
    $('#desktopSaveScheme').addEventListener('click', saveCurrentScheme);
    $('#desktopSchemeName').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); saveCurrentScheme(); }
    });
    $('#desktopSchemeList').addEventListener('click', function (e) {
      var btn = e.target.closest('button[data-act]');
      if (!btn) return;
      var row = btn.closest('[data-scheme]');
      if (!row) return;
      if (btn.dataset.act === 'load') applyScheme(row.dataset.scheme);
      else if (btn.dataset.act === 'delete') deleteScheme(row.dataset.scheme);
    });

    var hint = $('#vpHint');
    hintTimer = setTimeout(function () { hint.classList.add('hide'); }, 7000);
    $('#scene').addEventListener('pointerdown', function () {
      hint.classList.add('hide');
      clearTimeout(hintTimer);
    });
    $('#scene').addEventListener('wheel', function () {
      hint.classList.add('hide');
      clearTimeout(hintTimer);
    }, { passive: true });
  }

  /* ------------------------------ 启动 ------------------------------ */

  function init() {
    state.ui = { tab: 'advice', selected: -1, visible: null, only: false, explode: 10 };
    state.palletView = null;
    fillForm();
    scene = new Scene3D($('#scene'));
    bindEvents();
    recompute();
    setCalcState('已显示基准方案；修改参数后点“开始计算”', true);
    setTimeout(function () { scene.resize(); }, 80);
  }

  init();
})();
