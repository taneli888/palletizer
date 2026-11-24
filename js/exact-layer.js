/*
 * 可选：单层 CP-SAT 精确优化（OR-Tools WebAssembly）
 * 只有用户主动开启时才动态加载 solver 资源。
 */
let cpModulePromise = null;

async function loadCpSat() {
  if (!cpModulePromise) {
    cpModulePromise = import('../vendor/cp-sat/build/javascript/browser/cp-sat.js');
  }
  return cpModulePromise;
}

function buildModel(cp, L, W, a, b, n) {
  const model = new cp.CpModel();
  const xs = [], ys = [], ws = [], hs = [], xiv = [], yiv = [];
  for (let i = 0; i < n; i++) {
    const x = model.newIntVar(0, L, `x${i}`);
    const y = model.newIntVar(0, W, `y${i}`);
    const rot = model.newBoolVar(`r${i}`);
    const w = model.newIntVar(Math.min(a, b), Math.max(a, b), `w${i}`);
    const h = model.newIntVar(Math.min(a, b), Math.max(a, b), `h${i}`);
    model.add(w.eq(a)).onlyEnforceIf(rot.not());
    model.add(w.eq(b)).onlyEnforceIf(rot);
    model.add(h.eq(b)).onlyEnforceIf(rot.not());
    model.add(h.eq(a)).onlyEnforceIf(rot);
    const xe = model.newIntVar(0, L, `xe${i}`);
    const ye = model.newIntVar(0, W, `ye${i}`);
    model.add(xe.eq(x.plus(w)));
    model.add(ye.eq(y.plus(h)));
    model.add(xe.le(L));
    model.add(ye.le(W));
    xs.push(x); ys.push(y); ws.push(w); hs.push(h);
    xiv.push(model.newIntervalVar(x, w, xe, `xi${i}`));
    yiv.push(model.newIntervalVar(y, h, ye, `yi${i}`));
  }
  model.addNoOverlap2D(xiv, yiv);

  // 相同纸箱的排列对称性：按 x 排序，同 x 再按 y 排序
  for (let i = 0; i < n - 1; i++) {
    model.add(xs[i].le(xs[i + 1]));
    const eq = model.newBoolVar(`eq${i}`);
    model.add(xs[i].eq(xs[i + 1])).onlyEnforceIf(eq);
    model.add(xs[i].ne(xs[i + 1])).onlyEnforceIf(eq.not());
    model.add(ys[i].le(ys[i + 1])).onlyEnforceIf(eq);
  }
  // 平移对称性：最左、最下都贴边
  const minx = model.newIntVar(0, L, 'minx');
  const miny = model.newIntVar(0, W, 'miny');
  model.addMinEquality(minx, xs);
  model.addMinEquality(miny, ys);
  model.add(minx.eq(0));
  model.add(miny.eq(0));
  return { model, xs, ys, ws, hs };
}

function extract(cp, result, m, L, W) {
  const rects = [];
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < m.xs.length; i++) {
    const x = Number(result.value(m.xs[i]));
    const y = Number(result.value(m.ys[i]));
    const w = Number(result.value(m.ws[i]));
    const h = Number(result.value(m.hs[i]));
    rects.push({ x, y, w, h, rot: w > h });
    x0 = Math.min(x0, x); y0 = Math.min(y0, y);
    x1 = Math.max(x1, x + w); y1 = Math.max(y1, y + h);
  }
  const ox = (L - (x1 - x0)) / 2 - x0;
  const oy = (W - (y1 - y0)) / 2 - y0;
  return rects.map(r => ({
    x: r.x + ox, y: r.y + oy, w: r.w, h: r.h, rot: r.rot
  }));
}

/**
 * @param {object} o {L,W,a,b,gap,currentCount,timeLimit}
 * @returns {Promise<{supported:boolean,count:number,rects:Array,proven:boolean,status:string,elapsed:number,error?:string}>}
 */
export async function solveExactLayer(o) {
  const L = Number(o.L), W = Number(o.W), a = Number(o.a), b = Number(o.b);
  const gap = Math.max(0, Number(o.gap) || 0);
  const timeLimit = Math.max(2, Number(o.timeLimit) || 20);
  const current = Math.max(0, Math.floor(Number(o.currentCount) || 0));
  const upper = Math.min(60, Math.floor((L * W) / (a * b)));
  const target = Math.min(upper, current + 1);
  if (!(L > 0 && W > 0 && a > 0 && b > 0)) {
    return { supported: false, count: 0, rects: [], proven: false, status: 'INVALID', elapsed: 0, error: '尺寸无效' };
  }
  if (target <= current) {
    return { supported: true, count: current, rects: [], proven: true, status: 'OPTIMAL', elapsed: 0 };
  }
  const started = Date.now();
  let cp;
  try {
    cp = await loadCpSat();
  } catch (e) {
    return { supported: false, count: current, rects: [], proven: false, status: 'UNAVAILABLE', elapsed: Date.now() - started, error: '求解器加载失败' };
  }

  async function tryN(n, remaining) {
    const m = buildModel(cp, L, W, a, b, n);
    const result = await cp.CpSat.solve(m.model, {
      executor: o.executor || 'worker',
      numWorkers: Number(o.numWorkers) || 1,
      maxTimeInSeconds: Math.max(1, remaining),
      randomSeed: 0
    });
    const status = String(result.status);
    if (status === 'OPTIMAL' || status === 'FEASIBLE') {
      return { ok: true, status, rects: extract(cp, result, m, L, W) };
    }
    return { ok: false, status };
  }

  let count = current, rects = [], status = 'UNKNOWN', proven = false;
  try {
    const remain1 = timeLimit - (Date.now() - started) / 1000;
    const r1 = await tryN(target, remain1);
    if (r1.ok) {
      count = target; rects = r1.rects; status = r1.status; proven = target >= upper;
      const next = target + 1;
      const remain2 = timeLimit - (Date.now() - started) / 1000;
      if (!proven && next <= upper && remain2 > 2) {
        const r2 = await tryN(next, Math.min(remain2, 12));
        if (r2.ok) {
          count = next; rects = r2.rects; status = r2.status; proven = next >= upper;
        } else if (String(r2.status) === 'INFEASIBLE') {
          proven = true;
        }
      }
    } else if (String(r1.status) === 'INFEASIBLE') {
      // target=current+1 不可行；由于单调性，current 就是最大
      proven = true; status = 'INFEASIBLE';
    }
  } catch (e) {
    return { supported: false, count: current, rects: [], proven: false, status: 'ERROR', elapsed: Date.now() - started, error: e.message || String(e) };
  }
  return {
    supported: true, count, rects, proven, status,
    elapsed: Math.round((Date.now() - started) / 100) / 10
  };
}
