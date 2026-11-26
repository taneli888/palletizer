(function () {
  'use strict';

  var Core = window.PalletCore;
  var XL = window.XlsxLite;
  var KEY = 'palletizer.v1';
  var VERSION = '1.9.26';
  var PALETTE = ['#C99A5F', '#9FB3A6', '#C7A6A0', '#B1A3C9', '#D1B280', '#8FA9B8'];

  var DEFAULTS = {
    pallet: { L: 1200, W: 800, H: 1100, base: 145 },
    cartons: [
      { name: '示例纸箱', l: 368, w: 236, h: 153, qty: 300, weight: 10 }
    ],
    opts: {
      gap: 0, margin: 0, sheet: 0, sheetEvery: 2, overhang: 0, maxLoad: 1000, maxLayers: 0,
      allowSide: false, allowUprightLay: false,
      allowMix: true, allowSmallBottom: true, globalOptimize: false,
      useExactRules: true
    },
    fontSize: 'normal'
  };

  var state = loadState();
  var plan = null;
  var planCfgs = null;
  var planDirty = true;
  var scene = null;
  var editingIndex = -1;
  var detailId = '';
  var currentDetail = null;
  var explodePct = 10;

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function fmt(v) {
    var n = Math.round(Number(v || 0) * 100) / 100;
    return String(n);
  }
  function pct(v) { return (Math.round(Number(v || 0) * 1000) / 10).toFixed(1) + '%'; }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function numValue(v, fallback) {
    var n = parseFloat(v);
    return Number.isFinite(n) ? Math.max(0, n) : (fallback || 0);
  }

  function loadState() {
    var s = clone(DEFAULTS);
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return s;
      var saved = JSON.parse(raw);
      if (saved.pallet) {
        ['L', 'W', 'H', 'base'].forEach(function (k) {
          if (Number.isFinite(Number(saved.pallet[k]))) s.pallet[k] = Math.max(0, Number(saved.pallet[k]));
        });
      }
      if (saved.opts) {
        ['gap', 'margin', 'sheet', 'sheetEvery', 'overhang', 'maxLoad', 'maxLayers'].forEach(function (k) {
          if (Number.isFinite(Number(saved.opts[k]))) s.opts[k] = Math.max(0, Number(saved.opts[k]));
        });
        ['allowSide', 'allowUprightLay', 'allowMix', 'allowSmallBottom', 'globalOptimize'].forEach(function (k) {
          if (saved.opts[k] != null) s.opts[k] = !!saved.opts[k];
        });
        if (saved.opts.useExactRules != null) s.opts.useExactRules = !!saved.opts.useExactRules;
      }
      if (Array.isArray(saved.cartons) && saved.cartons.length) {
        s.cartons = saved.cartons.filter(function (c) {
          return c && c.name && Number(c.l) > 0 && Number(c.w) > 0 && Number(c.h) > 0;
        }).map(function (c) {
          return {
            name: String(c.name), l: Math.max(0, Number(c.l)), w: Math.max(0, Number(c.w)),
            h: Math.max(0, Number(c.h)), qty: Math.max(0, Math.floor(Number(c.qty) || 0)),
            weight: Math.max(0, Number(c.weight) || 0)
          };
        });
        if (!s.cartons.length) s.cartons = clone(DEFAULTS.cartons);
      }
      if (['normal', 'large', 'xlarge', 'xxlarge'].indexOf(saved.fontSize) >= 0) {
        s.fontSize = saved.fontSize;
      }
    } catch (e) { /* ignore broken storage */ }
    return s;
  }

  function saveState() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
  }

  function toast(text) {
    var el = $('#toast');
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { el.classList.remove('show'); }, 2400);
  }

  function applyFontSize() {
    var size = ['normal', 'large', 'xlarge', 'xxlarge'].indexOf(state.fontSize) >= 0 ? state.fontSize : 'normal';
    state.fontSize = size;
    document.documentElement.dataset.font = size;
    $all('#fontSeg button').forEach(function (b) {
      b.classList.toggle('active', b.dataset.font === size);
    });
    if (scene) setTimeout(function () { scene.resize(); }, 80);
  }

  function usableH() { return Math.max(0, state.pallet.H - state.pallet.base); }

  function skuName(index) {
    return state.cartons[index] ? state.cartons[index].name : '纸箱 ' + (index + 1);
  }

  /* ------------------------------------------------------------------ *
   * 录入
   * ------------------------------------------------------------------ */

  function syncPalletInputs() {
    $('#palletL').value = fmt(state.pallet.L);
    $('#palletW').value = fmt(state.pallet.W);
    $('#palletH').value = fmt(state.pallet.H);
    $('#palletBase').value = fmt(state.pallet.base);
    updateUsable();
  }

  function updateUsable() {
    var usable = usableH();
    $('#usableH').textContent = fmt(usable) + ' mm';
    $('#palletChip').textContent = usable > 0 ? '可用 ' + fmt(usable) + ' mm' : '请检查高度';
  }

  function readPalletInputs() {
    state.pallet.L = numValue($('#palletL').value);
    state.pallet.W = numValue($('#palletW').value);
    state.pallet.H = numValue($('#palletH').value);
    state.pallet.base = numValue($('#palletBase').value);
    updateUsable();
    saveState();
    markDirty();
  }

  function readAdvanced() {
    state.opts.gap = numValue($('#optGap').value);
    state.opts.margin = numValue($('#optMargin').value);
    state.opts.sheet = numValue($('#optSheet').value);
    state.opts.sheetEvery = Math.max(1, Math.floor(numValue($('#optSheetEvery').value)));
    state.opts.overhang = numValue($('#optOverhang').value);
    state.opts.maxLoad = numValue($('#optMaxLoad').value);
    state.opts.maxLayers = Math.floor(numValue($('#optMaxLayers').value));
    saveState();
    markDirty();
  }

  function syncAdvanced() {
    $('#optGap').value = fmt(state.opts.gap);
    $('#optMargin').value = fmt(state.opts.margin);
    $('#optSheet').value = fmt(state.opts.sheet);
    $('#optSheetEvery').value = fmt(state.opts.sheetEvery);
    $('#optOverhang').value = fmt(state.opts.overhang);
    $('#optMaxLoad').value = fmt(state.opts.maxLoad);
    $('#optMaxLayers').value = fmt(state.opts.maxLayers);
  }

  function syncSwitches() {
    $('#allowSide').checked = !!state.opts.allowSide;
    $('#allowUprightLay').checked = !!state.opts.allowUprightLay;
    $('#allowMix').checked = !!state.opts.allowMix;
    $('#allowSmallBottom').checked = !!state.opts.allowSmallBottom;
    $('#globalOptimize').checked = !!state.opts.globalOptimize;
    if ($('#useExactRules')) $('#useExactRules').checked = state.opts.useExactRules !== false;
    syncExactRuleInfo();
  }

  function syncExactRuleInfo() {
    var el = $('#exactRuleInfo');
    if (!el) return;
    var n = loadLayerRules().length;
    el.textContent = n ? ('已保存 ' + n + ' 条规则；匹配时自动使用') : '还没有保存规则';
  }

  function renderCartons() {
    var wrap = $('#cartonList');
    if (!state.cartons.length) {
      wrap.innerHTML = '<div class="empty-cartons">还没有纸箱，点右上角“+ 添加”或导入 Excel。</div>';
      return;
    }
    wrap.innerHTML = state.cartons.map(function (c, i) {
      var color = PALETTE[i % PALETTE.length];
      return '<button class="carton-card" data-carton="' + i + '" type="button">' +
        '<span class="carton-swatch" style="background:' + color + '"></span>' +
        '<span class="carton-main"><strong>' + esc(c.name) + '</strong>' +
        '<small>' + fmt(c.l) + ' × ' + fmt(c.w) + ' × ' + fmt(c.h) + ' mm · ' + fmt(c.weight) + ' kg/箱</small></span>' +
        '<span class="carton-qty"><b>' + fmt(c.qty) + '</b><span>箱</span></span>' +
        '</button>';
    }).join('');
  }

  function markDirty() {
    planDirty = true;
    var hint = $('#inputHint');
    if (hint) hint.textContent = '参数已修改，点「计算装托方案」更新结果。';
  }

  function switchTab(name) {
    $all('.view').forEach(function (v) { v.classList.toggle('active', v.id === 'view-' + name); });
    $all('.tab').forEach(function (b) { b.classList.toggle('active', b.dataset.tab === name); });
    window.scrollTo(0, 0);
  }

  /* ------------------------------------------------------------------ *
   * 纸箱编辑
   * ------------------------------------------------------------------ */

  function openCartonSheet(index) {
    editingIndex = index == null ? -1 : index;
    var c = editingIndex >= 0 ? state.cartons[editingIndex] : {
      name: '', l: 0, w: 0, h: 0, qty: 0, weight: 0
    };
    $('#sheetTitle').textContent = editingIndex >= 0 ? '编辑纸箱' : '添加纸箱';
    $('#cartonName').value = c.name || '';
    $('#cartonL').value = fmt(c.l);
    $('#cartonW').value = fmt(c.w);
    $('#cartonH').value = fmt(c.h);
    $('#cartonQty').value = fmt(c.qty);
    $('#cartonWeight').value = fmt(c.weight);
    $('#cartonDelete').hidden = editingIndex < 0;
    $('#cartonSheet').classList.add('open');
    $('#cartonSheet').setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    setTimeout(function () { $('#cartonName').focus(); }, 200);
  }

  function closeCartonSheet() {
    $('#cartonSheet').classList.remove('open');
    $('#cartonSheet').setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  function saveCarton() {
    var c = {
      name: String($('#cartonName').value || '').trim() || '未命名纸箱',
      l: numValue($('#cartonL').value),
      w: numValue($('#cartonW').value),
      h: numValue($('#cartonH').value),
      qty: Math.floor(numValue($('#cartonQty').value)),
      weight: numValue($('#cartonWeight').value)
    };
    if (!(c.l > 0 && c.w > 0 && c.h > 0)) { toast('纸箱长宽高都要大于 0'); return; }
    if (editingIndex >= 0) state.cartons[editingIndex] = c;
    else state.cartons.push(c);
    saveState();
    renderCartons();
    closeCartonSheet();
    compute(false);
    toast(editingIndex >= 0 ? '纸箱已更新' : '纸箱已添加');
  }

  function deleteCarton() {
    if (editingIndex < 0) return;
    var c = state.cartons[editingIndex];
    if (!confirm('删除「' + (c ? c.name : '这个纸箱') + '」？')) return;
    state.cartons.splice(editingIndex, 1);
    saveState();
    renderCartons();
    closeCartonSheet();
    compute(false);
    toast('纸箱已删除');
  }

  /* ------------------------------------------------------------------ *
   * 计算
   * ------------------------------------------------------------------ */

  function buildCfgs() {
    return state.cartons.filter(function (c) {
      return c.qty > 0 && c.l > 0 && c.w > 0 && c.h > 0;
    }).map(function (c) {
      return Core.normalize({
        pallet: state.pallet,
        carton: c,
        gap: state.opts.gap, margin: state.opts.margin, sheet: state.opts.sheet,
        sheetEvery: state.opts.sheetEvery,
        overhang: state.opts.overhang, maxLoad: state.opts.maxLoad, maxLayers: state.opts.maxLayers,
        allowFlat: true, allowSide: !!state.opts.allowSide,
        allowUprightLay: !!state.opts.allowUprightLay
      });
    });
  }

  var RULES_KEY = 'palletizer.layerRules.v1';
  var SCHEMES_KEY = 'palletizer.schemes.v1';

  function loadLayerRules() {
    try {
      var data = JSON.parse(localStorage.getItem(RULES_KEY) || '{}');
      return Array.isArray(data.rules) ? data.rules : [];
    } catch (e) { return []; }
  }

  function saveLayerRules(rules) {
    try { localStorage.setItem(RULES_KEY, JSON.stringify({ rules: rules })); } catch (e) {}
  }

  function loadSchemes() {
    try {
      var data = JSON.parse(localStorage.getItem(SCHEMES_KEY) || '{}');
      return Array.isArray(data.schemes) ? data.schemes : [];
    } catch (e) { return []; }
  }

  function saveSchemes(list) {
    try { localStorage.setItem(SCHEMES_KEY, JSON.stringify({ version: 1, schemes: list })); } catch (e) {}
  }

  function schemeRuleKey(r) {
    return [r.L, r.W, r.a, r.b, r.gap].map(Number).join('|');
  }

  function schemeMatchingRules() {
    var L = state.pallet.L, W = state.pallet.W;
    var result = [];
    loadLayerRules().forEach(function (r) {
      if (Math.abs(Number(r.L) - L) > 0.5 || Math.abs(Number(r.W) - W) > 0.5) return;
      for (var i = 0; i < state.cartons.length; i++) {
        var c = state.cartons[i];
        if (Math.abs(Number(r.a) - c.l) <= 0.5 &&
            Math.abs(Number(r.b) - c.w) <= 0.5 &&
            Math.abs(Number(r.gap) - state.opts.gap) <= 0.01) {
          result.push(JSON.parse(JSON.stringify(r)));
          return;
        }
      }
    });
    return result;
  }

  function schemeSummary(s) {
    var qty = (s.cartons || []).reduce(function (n, c) { return n + (Number(c.qty) || 0); }, 0);
    return (s.pallet ? fmt(s.pallet.L) + '×' + fmt(s.pallet.W) : '—') +
      ' · ' + (s.cartons || []).length + ' 种纸箱 · ' + fmt(qty) + ' 箱';
  }

  function saveCurrentScheme() {
    readPalletInputs();
    readAdvanced();
    var input = $('#schemeName');
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
      cartons: clone(state.cartons),
      opts: clone(state.opts),
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

  function renderSchemes() {
    var wrap = $('#schemeList');
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

  function mergeSchemesRules(rules) {
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

  function applyScheme(id) {
    var s = loadSchemes().filter(function (x) { return x.id === id; })[0];
    if (!s) return;
    if (s.pallet) state.pallet = Object.assign({}, state.pallet, s.pallet);
    if (Array.isArray(s.cartons) && s.cartons.length) state.cartons = clone(s.cartons);
    if (s.opts) state.opts = Object.assign({}, state.opts, s.opts);
    mergeSchemesRules(s.rules);
    saveState();
    syncPalletInputs();
    syncAdvanced();
    syncSwitches();
    renderCartons();
    compute(true);
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

  function ruleFor(cfg, sol) {
    if (!sol || !sol.ok || !sol.orientation || sol.orientation.key !== 'flat') return null;
    var L = cfg.pallet.L + 2 * cfg.overhang - 2 * cfg.margin;
    var W = cfg.pallet.W + 2 * cfg.overhang - 2 * cfg.margin;
    var rules = loadLayerRules();
    for (var i = 0; i < rules.length; i++) {
      var r = rules[i];
      if (Math.abs(Number(r.L) - L) > 0.5 || Math.abs(Number(r.W) - W) > 0.5) continue;
      if (Math.abs(Number(r.a) - cfg.carton.l) > 0.5 || Math.abs(Number(r.b) - cfg.carton.w) > 0.5) continue;
      if (Math.abs(Number(r.gap) - cfg.gap) > 0.01) continue;
      if (!(r.count > 0) || !Array.isArray(r.rects) || r.rects.length !== r.count) continue;
      return r;
    }
    return null;
  }

  function exactSolution(cfg) {
    var base = Core.solveStack(cfg);
    var rule = ruleFor(cfg, base);
    if (!rule) return null;
    var count = rule.count;
    var layers = base.layers;
    if (cfg.maxLoad > 0 && cfg.carton.weight > 0) {
      layers = Math.min(layers, Math.floor(cfg.maxLoad / (count * cfg.carton.weight)));
    }
    if (!(layers > 0)) return null;
    var sol = Object.assign({}, base);
    var originX = -cfg.overhang + cfg.margin;
    var originY = -cfg.overhang + cfg.margin;
    var rects = rule.rects.map(function (r) {
      return Object.assign({}, r, {
        wx: Number(r.x) + originX,
        wy: Number(r.y) + originY,
        thickness: base.orientation.thickness
      });
    });
    var maxX = 0, maxY = 0;
    rects.forEach(function (r) {
      maxX = Math.max(maxX, r.x + r.w);
      maxY = Math.max(maxY, r.y + r.h);
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
    sol.ruleId = rule.id || '';
    return sol;
  }

  function exactSolutions(cfgs) {
    if (state.opts.useExactRules === false) return { list: cfgs.map(function () { return null; }), used: 0 };
    var used = 0;
    var list = cfgs.map(function (cfg) {
      var sol = exactSolution(cfg);
      if (sol) used++;
      return sol;
    });
    return { list: list, used: used };
  }

  function compute(goPlan) {
    readPalletInputs();
    readAdvanced();
    if (!(state.pallet.L > 0 && state.pallet.W > 0 && state.pallet.H > 0)) {
      toast('请填写托盘长、宽、最大总高'); return;
    }
    if (usableH() <= 0) { toast('最大总高要大于托盘高度'); return; }
    var cfgs = buildCfgs();
    if (!cfgs.length) {
      plan = null; planCfgs = null;
      renderPlan();
      if (goPlan) switchTab('plan');
      toast('请先添加至少一个有数量的纸箱');
      return;
    }
    planCfgs = cfgs;
    var exact = exactSolutions(cfgs);
    plan = Core.buildPlan(cfgs, {
      allowMix: !!state.opts.allowMix,
      allowSmallBottom: !!state.opts.allowSmallBottom,
      solutions: exact.list
    });
    if (state.opts.globalOptimize && !exact.used) plan = Core.buildGlobalPlan(cfgs, plan);
    if (exact.used && state.opts.globalOptimize) toast('已使用精确布局规则，本次跳过全局省托');
    planDirty = false;
    saveState();
    var hint = $('#inputHint');
    if (hint) {
      hint.textContent = '当前方案：' + plan.totalPallets + ' 托 · ' + fmt(plan.totalBoxes) + ' 箱' +
        (plan.globalUsed ? ' · 全局省托' : '');
    }
    renderPlan();
    if (goPlan) switchTab('plan');
  }

  function palletTitle(p) {
    if (p.type === 'mixed') {
      return Object.keys(p.skuBreakdown).map(function (si) {
        return skuName(Number(si)) + ' ' + p.skuBreakdown[si];
      }).join(' + ');
    }
    return skuName(p.skuIndex);
  }

  function palletKind(p) {
    if (p.type === 'mixed') return '混托';
    if (p.type === 'tail') return '尾托';
    return p.hasPartial ? '整托含尾' : '整托';
  }

  function palletColors(p) {
    if (p.type !== 'mixed') return PALETTE[(p.skuIndex >= 0 ? p.skuIndex : 0) % PALETTE.length];
    var keys = Object.keys(p.skuBreakdown);
    return keys.length ? PALETTE[Number(keys[0]) % PALETTE.length] : PALETTE[0];
  }

  function renderPlan() {
    var empty = $('#planEmpty');
    var content = $('#planContent');
    if (!plan || !plan.pallets || !plan.pallets.length) {
      empty.style.display = 'block';
      content.classList.remove('show');
      content.style.display = '';
      return;
    }
    empty.style.display = 'none';
    content.classList.add('show');
    content.style.display = '';

    $('#planTotal').textContent = plan.totalPallets;
    $('#planSub').textContent = fmt(plan.totalBoxes) + ' 箱 · ' + state.cartons.length + ' 种规格' +
      (plan.globalUsed ? ' · 全局混装' : '');
    $('#planFull').textContent = plan.fullCount;
    $('#planMixed').textContent = plan.mixedCount;
    $('#planTail').textContent = plan.tailCount;
    $('#planBoxes').textContent = fmt(plan.totalBoxes);
    $('#palletCountLabel').textContent = plan.totalPallets + ' 托';

    var note = '';
    if (plan.errors && plan.errors.length) {
      note = '<span class="warn">有 ' + plan.errors.length + ' 种纸箱放不下，请检查尺寸。</span>';
    } else if (plan.globalUsed) {
      note = '全局省托：' + (plan.totalPallets + plan.globalSaved) + ' → ' + plan.totalPallets +
        ' 托（少 ' + plan.globalSaved + ' 托）；' + plan.mixedCount +
        ' 个托盘跨规格整层混装，建议加隔板/缠绕膜。理论下界 ' + plan.globalLowerBound + ' 托。';
    } else if (plan.smallBottomUsed) {
      note = '已用小/轻层补空：' + (plan.totalPallets + plan.potentialSaving) + ' → ' +
        plan.totalPallets + ' 托（少 ' + plan.potentialSaving + ' 托）。';
    } else if (plan.allowSmallBottom && plan.potentialSaving > 0) {
      note = '打开「小/轻层垫底补空」可少 ' + plan.potentialSaving + ' 托。';
    } else if (plan.globalAttempted) {
      note = '全局省托没有找到更少托数，保留当前方案。';
    } else {
      note = '按大/重在下、小/轻在上；尾箱优先并入剩余空间。';
    }
    if (!plan.globalUsed && plan.partialTopCount > 0) {
      note += ' 顶部平整：' +
        (plan.flattened > 0 ? '已合并 ' + plan.flattened + ' 个尾层，' : '') +
        '仅 ' + plan.partialTopCount + ' 托顶层有尾箱。';
    }
    $('#planNote').innerHTML = note;

    $('#palletList').innerHTML = plan.pallets.map(function (p) {
      var totalH = p.height + state.pallet.base;
      return '<button class="pallet-card" data-pallet="' + esc(p.id) + '" type="button">' +
        '<span class="pallet-stripe" style="background:' + palletColors(p) + '"></span>' +
        '<span class="pallet-main"><strong>' + esc(palletTitle(p)) +
        '<span class="badge' + (p.type === 'mixed' ? ' mixed' : '') + '">' + esc(palletKind(p)) + '</span></strong>' +
        '<small>' + p.id + ' · ' + p.boxes + ' 箱 · ' + p.layers + ' 层 · 高 ' + fmt(p.height) +
        ' / ' + fmt(usableH()) + ' mm · 含托盘 ' + fmt(totalH) + ' mm · ' + fmt(p.weight) + ' kg</small></span>' +
        '<span class="pallet-num"><b>' + p.layers + '</b><span>层</span></span>' +
        '</button>';
    }).join('');

    if (planDirty) $('#planNote').innerHTML = '参数已修改，回「录入」重新计算后更新。';
  }

  function unitLabel(u) {
    if (u.parts && u.parts.length) {
      return u.parts.map(function (p) { return skuName(p.skuIndex) + ' ' + p.count; }).join(' + ');
    }
    return skuName(u.skuIndex);
  }

  /* ------------------------------------------------------------------ *
   * 3D 详情
   * ------------------------------------------------------------------ */

  function ensureScene() {
    if (scene) return scene;
    scene = new window.Scene3D($('#scene'));
    scene.showDims = true;
    window.__palletizerScene = scene;
    return scene;
  }

  function buildModel(p) {
    var base = state.pallet.base || 0;
    var usable = usableH();
    var boxes = [];
    var z = 0;
    p.units.forEach(function (u, li) {
      u.rects.forEach(function (r) {
        var si = r.skuIndex != null ? r.skuIndex : u.skuIndex;
        var color = p.type === 'mixed' && si >= 0 ? PALETTE[si % PALETTE.length] : '#C99A5F';
        boxes.push({
          x: r.wx, y: r.wy, z: z,
          w: r.w, d: r.h, h: r.thickness || u.thickness,
          layer: li, rot: r.rot, color: color
        });
      });
      var board = li < p.units.length - 1 && state.opts.sheet > 0 &&
        state.opts.sheetEvery > 0 && (li + 1) % state.opts.sheetEvery === 0;
      z += u.thickness + (board ? state.opts.sheet : 0);
    });
    return {
      L: state.pallet.L, W: state.pallet.W,
      H: usable,
      viewH: Math.max(usable, p.height),
      baseThickness: base > 0 ? base : Math.max(3, Math.min(state.pallet.L, state.pallet.W) * 0.045),
      baseHeight: base,
      totalH: base + usable,
      boxes: boxes,
      cartonLabels: [],
      actual: p.actual,
      showDims: true
    };
  }

  function openDetail(id) {
    var p = plan && plan.pallets.filter(function (x) { return x.id === id; })[0];
    if (!p) return;
    detailId = id;
    currentDetail = p;
    $('#detailTitle').textContent = p.id + ' · ' + palletKind(p);
    $('#detailSub').textContent = p.boxes + ' 箱 · ' + p.layers + ' 层 · ' + fmt(p.weight) + ' kg';
    var totalH = p.height + state.pallet.base;
    var vol = 0;
    Object.keys(p.skuBreakdown).forEach(function (si) {
      var sku = state.cartons[si];
      if (sku) vol += p.skuBreakdown[si] * sku.l * sku.w * sku.h;
    });
    var denom = state.pallet.L * state.pallet.W * usableH();
    var util = denom > 0 ? vol / denom : 0;
    $('#detailMetrics').innerHTML =
      '<div><span>实际码放</span><b>' + fmt(p.actual.L) + ' × ' + fmt(p.actual.W) + ' × ' + fmt(p.actual.H) + ' mm</b></div>' +
      '<div><span>含托盘总高</span><b>' + fmt(totalH) + ' mm</b></div>' +
      '<div><span>层数 / 箱数</span><b>' + p.layers + ' 层 / ' + p.boxes + ' 箱</b></div>' +
      '<div><span>体积利用率</span><b>' + pct(util) + '</b></div>';
    $('#layerCountLabel').textContent = p.layers + ' 层';
    $('#layerList').innerHTML = p.units.map(function (u, i) {
      var color = '#C99A5F';
      if (p.type === 'mixed' && u.skuIndex >= 0) color = PALETTE[u.skuIndex % PALETTE.length];
      if (u.parts && u.parts.length) color = PALETTE[u.parts[0].skuIndex % PALETTE.length];
      return '<div class="layer-row" data-layer="' + i + '" role="button" tabindex="0">' +
        '<span class="layer-index">' + (i + 1) + '</span>' +
        '<span class="layer-main"><strong>' + esc(unitLabel(u)) + '</strong>' +
        '<small>' + fmt(u.thickness) + ' mm · ' + u.count + ' 箱 · ' + esc(u.pattern) + '</small></span>' +
        '<span class="layer-color" style="background:' + color + '"></span>' +
        '</div>';
    }).join('');
    $('#detail').classList.add('open');
    $('#detail').setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    $('#explodeRange').value = explodePct;
    $('#explodeValue').textContent = explodePct + '%';
    requestAnimationFrame(function () {
      var s = ensureScene();
      s.resize();
      s.selectedLayer = -1;
      s.onlySelected = false;
      s.setModel(buildModel(p));
      s.setView('iso');
      applyExplode();
    });
  }

  function selectLayer(index) {
    if (!scene) return;
    var next = scene.selectedLayer === index ? -1 : index;
    scene.setLayerView({ selectedLayer: next, onlySelected: false });
    $all('#layerList .layer-row').forEach(function (row) {
      row.classList.toggle('active', Number(row.dataset.layer) === next);
    });
  }

  function applyExplode() {
    if (!currentDetail || !scene) return;
    var p = currentDetail;
    explodePct = Math.max(0, Math.min(100, Number($('#explodeRange').value) || 0));
    var pitch = p.height / Math.max(1, p.layers);
    var mm = (explodePct / 100) * Math.max(8, pitch * 2.4);
    var model = buildModel(p);
    model.viewH = Math.max(usableH(), p.height + Math.max(0, p.layers - 1) * mm);
    scene.explode = mm;
    scene.setModel(model);
    $('#explodeValue').textContent = explodePct + '%';
  }

  function closeDetail() {
    $('#detail').classList.remove('open');
    $('#detail').setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  /* ------------------------------------------------------------------ *
   * Excel
   * ------------------------------------------------------------------ */

  function normLabel(s) {
    return String(s == null ? '' : s).replace(/\s/g, '').replace(/[（(][^)）]*[)）]/g, '').toLowerCase();
  }

  function boolFrom(v) {
    if (v === true) return true;
    if (v === false) return false;
    var s = String(v == null ? '' : v).trim().toLowerCase();
    if (/^(是|允许|开|true|yes|y|1)$/.test(s)) return true;
    if (/^(否|不允许|关|false|no|n|0)$/.test(s)) return false;
    return null;
  }

  function palletKey(label, sheetName) {
    var s = normLabel(label);
    if (!s) return null;
    if (/混托|混装/.test(s)) return 'allowMix';
    if (/全局.*省托|全局.*混/.test(s)) return 'globalOptimize';
    if (/小.*垫底|轻.*垫底|小箱垫底/.test(s)) return 'allowSmallBottom';
    if (/侧立|侧放/.test(s)) return 'allowSide';
    if (/竖放|立放/.test(s)) return 'allowUprightLay';
    if (/载重|承重/.test(s)) return 'maxLoad';
    if (/最大.*层|层数.*上限|最多.*层|堆叠层/.test(s)) return 'maxLayers';
    if (/垫板|隔板|层间/.test(s)) return 'sheet';
    if (/间隙|间距/.test(s)) return 'gap';
    if (/边距|留边|余量/.test(s)) return 'margin';
    if (/超出|悬空|外伸/.test(s)) return 'overhang';
    if (/托盘.*高|盘高|托盘厚|垫高/.test(s)) return 'base';
    if (/长/.test(s) && /(托盘|容器|内|净)/.test(s + sheetName)) return 'L';
    if (/宽/.test(s) && /(托盘|容器|内|净)/.test(s + sheetName)) return 'W';
    if (/高/.test(s)) return 'H';
    return null;
  }

  function findHeader(rows) {
    for (var r = 0; r < Math.min(rows.length, 30); r++) {
      var row = rows[r] || [];
      var texts = row.map(function (v) { return String(v == null ? '' : v); });
      var joined = texts.join('|');
      if (/名称|型号/.test(joined) && /长/.test(joined) && /宽/.test(joined) && /高/.test(joined)) {
        var cols = { name: -1, l: -1, w: -1, h: -1, qty: -1, weight: -1 };
        texts.forEach(function (t, i) {
          var s = t.replace(/\s/g, '');
          if (/名称|型号/.test(s)) cols.name = i;
          else if (/^长|长\(|长度/.test(s)) cols.l = i;
          else if (/^宽|宽\(|宽度/.test(s)) cols.w = i;
          else if (/^高|高\(|高度/.test(s)) cols.h = i;
          else if (/数量|订单|箱数/.test(s)) cols.qty = i;
          else if (/重量|单重|kg/.test(s.toLowerCase())) cols.weight = i;
        });
        if (cols.name >= 0 && cols.l >= 0 && cols.w >= 0 && cols.h >= 0) return { row: r, cols: cols };
      }
    }
    return null;
  }

  function parseWorkbook(sheets) {
    var out = { pallet: {}, opts: {}, cartons: [], allowMix: null };
    var ordered = sheets.slice().sort(function (a, b) {
      function score(name) {
        var s = 0;
        if (/托盘|容器/.test(name)) s += 3;
        if (/纸箱|明细/.test(name)) s += 2;
        return s;
      }
      return score(b.name) - score(a.name);
    });
    ordered.forEach(function (sh) {
      var rows = sh.rows || [];
      var hdr = findHeader(rows);
      if (hdr) {
        for (var r = hdr.row + 1; r < rows.length; r++) {
          var row = rows[r] || [];
          var name = String(row[hdr.cols.name] == null ? '' : row[hdr.cols.name]).trim();
          var l = numValue(row[hdr.cols.l]), w = numValue(row[hdr.cols.w]), h = numValue(row[hdr.cols.h]);
          if (!name || !(l > 0 && w > 0 && h > 0)) continue;
          out.cartons.push({
            name: name, l: l, w: w, h: h,
            qty: Math.floor(numValue(row[hdr.cols.qty])),
            weight: numValue(row[hdr.cols.weight])
          });
        }
        return;
      }
      for (var i = 0; i < rows.length; i++) {
        var cells = rows[i] || [];
        if (cells.length < 2) continue;
        var key = palletKey(cells[0], sh.name);
        if (!key) continue;
        var val = cells[1];
        if (key === 'allowMix' || key === 'allowSmallBottom' || key === 'globalOptimize' ||
            key === 'allowSide' || key === 'allowUprightLay') {
          var b = boolFrom(val);
          if (b == null) continue;
          if (key === 'allowMix') out.allowMix = b;
          else out.opts[key] = b;
        } else if (key === 'L' || key === 'W' || key === 'H' || key === 'base') {
          if (out.pallet[key] == null) out.pallet[key] = numValue(val);
        } else if (['maxLoad', 'maxLayers', 'sheet', 'gap', 'margin', 'overhang'].indexOf(key) >= 0) {
          if (out.opts[key] == null) out.opts[key] = numValue(val);
        }
      }
    });
    return out;
  }

  async function importFile(file) {
    if (!file) return;
    try {
      var sheets;
      if (/\.csv$/i.test(file.name)) {
        var text = await file.text();
        sheets = [{ name: 'CSV', rows: XL.parseCSV(text) }];
      } else {
        var buf = await file.arrayBuffer();
        var wb = await XL.readWorkbook(buf);
        sheets = wb.sheets;
      }
      var parsed = parseWorkbook(sheets);
      if (!parsed.cartons.length && !parsed.pallet.L && !parsed.pallet.W && !parsed.pallet.H) {
        throw new Error('没有识别到托盘尺寸或纸箱表');
      }
      if (parsed.pallet.L != null) state.pallet.L = parsed.pallet.L;
      if (parsed.pallet.W != null) state.pallet.W = parsed.pallet.W;
      if (parsed.pallet.H != null) state.pallet.H = parsed.pallet.H;
      state.pallet.base = parsed.pallet.base != null ? parsed.pallet.base : 0;
      Object.keys(parsed.opts).forEach(function (k) {
        if (state.opts[k] != null) state.opts[k] = parsed.opts[k];
      });
      if (parsed.allowMix != null) state.opts.allowMix = parsed.allowMix;
      if (parsed.cartons.length) state.cartons = parsed.cartons;
      saveState();
      syncPalletInputs();
      syncAdvanced();
      syncSwitches();
      renderCartons();
      compute(true);
      toast('已导入 ' + (parsed.cartons.length || 0) + ' 种纸箱');
    } catch (e) {
      var msg = e && e.message ? e.message : '文件格式不支持';
      if (/DecompressionStream|deflate/i.test(msg)) {
        msg = '当前 Safari 版本不支持 xlsx 解压，请升级到 iOS 16.4+，或改用 CSV / 手工输入';
      }
      toast('导入失败：' + msg);
    }
  }

  function templateBook() {
    var palletRows = [
      ['参数', '值', '单位', '说明'],
      ['托盘长', state.pallet.L, 'mm', '托盘 / 容器内净长'],
      ['托盘宽', state.pallet.W, 'mm', '托盘 / 容器内净宽'],
      ['最大总高', state.pallet.H, 'mm', '含托盘总高；可用高 = 最大总高 − 托盘高度'],
      ['托盘高度', state.pallet.base, 'mm', '托盘 / 垫木高度'],
      ['最大载重', state.opts.maxLoad, 'kg', '0 = 不限制'],
      ['最大堆叠层数', state.opts.maxLayers, '层', '0 = 不限制'],
      ['允许侧立', state.opts.allowSide ? '是' : '否', '', '是 = 允许宽作高'],
      ['允许竖放', state.opts.allowUprightLay ? '是' : '否', '', '是 = 允许长作高'],
      ['允许混托', state.opts.allowMix ? '是' : '否', '', '是 = 尾箱可合托'],
      ['允许小箱垫底', state.opts.allowSmallBottom ? '是' : '否', '', '是 = 允许小/轻层补空'],
      ['全局省托', state.opts.globalOptimize ? '是' : '否', '', '是 = 整层跨规格补位']
    ];
    var cartonRows = [
      ['名称', '长(mm)', '宽(mm)', '高(mm)', '数量', '单重(kg)']
    ];
    state.cartons.forEach(function (c) {
      cartonRows.push([c.name, c.l, c.w, c.h, c.qty, c.weight]);
    });
    return {
      sheets: [
        { name: '托盘参数', cols: [22, 12, 9, 44], rows: palletRows },
        { name: '纸箱明细', cols: [22, 12, 12, 12, 10, 12], rows: cartonRows },
        { name: '填写说明', cols: [20, 72], rows: [
          ['项目', '说明'],
          ['尺寸', '全部毫米 mm；填纸箱外径和托盘内净尺寸'],
          ['高度', '最大总高包含托盘；可用码放高 = 最大总高 − 托盘高度'],
          ['多规格', '每行一种纸箱；数量为 0 的行会被忽略'],
          ['开关', '是/否：侧立、竖放、混托、小箱垫底、全局省托']
        ] }
      ]
    };
  }

  function planBook() {
    var summary = [
      ['托盘长', state.pallet.L, 'mm'],
      ['托盘宽', state.pallet.W, 'mm'],
      ['最大总高', state.pallet.H, 'mm'],
      ['托盘高度', state.pallet.base, 'mm'],
      ['可用码放高', usableH(), 'mm'],
      ['总托数', plan.totalPallets, '托'],
      ['总箱数', plan.totalBoxes, '箱'],
      ['整托 / 混托 / 尾托', plan.fullCount + ' / ' + plan.mixedCount + ' / ' + plan.tailCount, '']
    ];
    var rows = [['托盘号', '类型', '规格明细', '箱数', '层数', '实际长', '实际宽', '实际高', '含托盘总高', '重量kg']];
    plan.pallets.forEach(function (p) {
      rows.push([p.id, palletKind(p), palletTitle(p), p.boxes, p.layers,
        p.actual.L, p.actual.W, p.actual.H, p.actual.H + state.pallet.base, p.weight]);
    });
    var layers = [['托盘', '层', '规格', '箱数', '层厚mm', '说明']];
    plan.pallets.forEach(function (p) {
      p.units.forEach(function (u, i) {
        layers.push([p.id, i + 1, unitLabel(u), u.count, u.thickness, u.pattern || '']);
      });
    });
    return {
      sheets: [
        { name: '订单汇总', cols: [22, 14, 8], rows: summary },
        { name: '托盘计划', cols: [9, 9, 30, 8, 7, 10, 10, 10, 11, 10], rows: rows },
        { name: '逐层明细', cols: [9, 6, 26, 8, 9, 18], rows: layers }
      ]
    };
  }

  function downloadBytes(bytes, name) {
    var blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1200);
  }

  async function shareBytes(bytes, name) {
    var blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    try {
      if (navigator.canShare && typeof File !== 'undefined') {
        var file = new File([blob], name, { type: blob.type });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: name });
          return;
        }
      }
    } catch (e) {
      if (e && e.name === 'AbortError') return;
    }
    downloadBytes(bytes, name);
    toast('已生成 Excel，请用系统分享保存');
  }

  async function exportPlan() {
    if (!plan) compute(false);
    if (!plan) return;
    var d = new Date();
    var stamp = d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0') +
      '-' + String(d.getHours()).padStart(2, '0') + String(d.getMinutes()).padStart(2, '0');
    await shareBytes(XL.writeWorkbook(planBook()), 'Palletizer-装托方案-' + stamp + '.xlsx');
  }

  async function downloadTemplate() {
    await shareBytes(XL.writeWorkbook(templateBook()), 'Palletizer-导入模板.xlsx');
  }

  /* ------------------------------------------------------------------ *
   * 事件 / 初始化
   * ------------------------------------------------------------------ */

  function bind() {
    $all('.tab').forEach(function (b) {
      b.addEventListener('click', function () {
        if (b.dataset.tab === 'plan' && !plan) compute(false);
        switchTab(b.dataset.tab);
      });
    });
    $('#btnGoInput').addEventListener('click', function () { switchTab('input'); });
    $('#btnCalc').addEventListener('click', function () { compute(true); });
    $('#btnAddCarton').addEventListener('click', function () { openCartonSheet(-1); });
    $('#cartonList').addEventListener('click', function (e) {
      var card = e.target.closest('[data-carton]');
      if (card) openCartonSheet(Number(card.dataset.carton));
    });
    $('#cartonSave').addEventListener('click', saveCarton);
    $('#cartonDelete').addEventListener('click', deleteCarton);
    $('#sheetClose').addEventListener('click', closeCartonSheet);
    $('#cartonSheet').addEventListener('click', function (e) {
      if (e.target === $('#cartonSheet')) closeCartonSheet();
    });
    $('#palletList').addEventListener('click', function (e) {
      var card = e.target.closest('[data-pallet]');
      if (card) openDetail(card.dataset.pallet);
    });
    $('#detailBack').addEventListener('click', closeDetail);
    $('#explodeRange').addEventListener('input', applyExplode);
    $('#layerList').addEventListener('click', function (e) {
      var row = e.target.closest('[data-layer]');
      if (row) selectLayer(Number(row.dataset.layer));
    });
    $('#layerList').addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      var row = e.target.closest('[data-layer]');
      if (!row) return;
      e.preventDefault();
      selectLayer(Number(row.dataset.layer));
    });
    $all('#viewSeg button').forEach(function (b) {
      b.addEventListener('click', function () {
        $all('#viewSeg button').forEach(function (x) { x.classList.toggle('active', x === b); });
        if (scene) scene.setView(b.dataset.view);
      });
    });

    ['palletL', 'palletW', 'palletH', 'palletBase'].forEach(function (id) {
      $('#' + id).addEventListener('change', readPalletInputs);
      $('#' + id).addEventListener('input', updateUsable);
    });
    ['optGap', 'optMargin', 'optSheet', 'optSheetEvery', 'optOverhang', 'optMaxLoad', 'optMaxLayers'].forEach(function (id) {
      $('#' + id).addEventListener('change', readAdvanced);
    });
    ['allowSide', 'allowUprightLay', 'allowMix', 'allowSmallBottom', 'globalOptimize', 'useExactRules'].forEach(function (id) {
      $('#' + id).addEventListener('change', function () {
        state.opts[id] = $('#' + id).checked;
        saveState();
        markDirty();
      });
    });

    $('#btnImport').addEventListener('click', function () { $('#fileInput').click(); });
    $('#btnImport2').addEventListener('click', function () { $('#fileInput').click(); });
    $('#fileInput').addEventListener('change', function (e) {
      var f = e.target.files && e.target.files[0];
      e.target.value = '';
      importFile(f);
    });
    $('#btnTemplate').addEventListener('click', downloadTemplate);
    $('#btnExport').addEventListener('click', exportPlan);
    $('#btnExport2').addEventListener('click', exportPlan);
    $('#btnReset').addEventListener('click', function () {
      if (!confirm('恢复示例数据？当前录入会被覆盖。')) return;
      state = clone(DEFAULTS);
      saveState();
      syncPalletInputs(); syncAdvanced(); syncSwitches(); renderCartons();
      applyFontSize();
      compute(false);
      switchTab('input');
      toast('已恢复示例数据');
    });

    if ($('#saveScheme')) {
      $('#saveScheme').addEventListener('click', saveCurrentScheme);
      $('#schemeName').addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); saveCurrentScheme(); }
      });
      $('#schemeList').addEventListener('click', function (e) {
        var btn = e.target.closest('button[data-act]');
        if (!btn) return;
        var row = btn.closest('[data-scheme]');
        if (!row) return;
        if (btn.dataset.act === 'load') applyScheme(row.dataset.scheme);
        else if (btn.dataset.act === 'delete') deleteScheme(row.dataset.scheme);
      });
      renderSchemes();
    }
    $('#fontSeg').addEventListener('click', function (e) {
      var b = e.target.closest('[data-font]');
      if (!b) return;
      state.fontSize = b.dataset.font;
      saveState();
      applyFontSize();
      toast('字体大小：' + b.textContent);
    });
  }

  function init() {
    applyFontSize();
    syncPalletInputs();
    syncAdvanced();
    syncSwitches();
    renderCartons();
    bind();
    compute(false);
    renderPlan();
    if (location.hash === '#plan') switchTab('plan');
    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    }
    var standalone = window.navigator.standalone === true ||
      (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
    var badge = $('#installBadge');
    if (badge) badge.textContent = standalone ? '已添加到主屏幕 · 可离线运行' : '未安装 · Safari 分享 → 添加到主屏幕';
    window.addEventListener('beforeinstallprompt', function () {
      if (badge) badge.textContent = '可安装 · 浏览器菜单里选择“安装应用”';
    });
  }

  window.addEventListener('pageshow', function () {
    if (!plan) return;
    syncExactRuleInfo();
    compute(false);
  });

  document.addEventListener('DOMContentLoaded', init);
})();
