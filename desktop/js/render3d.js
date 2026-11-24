/*!
 * 轻量 3D 码垛渲染器（Canvas 2D，无 WebGL / 无第三方库）
 * 透视投影 + 背面剔除 + 面片深度排序，支持旋转、缩放、逐层、拆层、尺寸标注。
 */
(function (root) {
  'use strict';

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function hexToRgb(hex) {
    var h = hex.replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgbStr(c, f) {
    f = f == null ? 1 : f;
    return 'rgb(' + Math.round(clamp(c[0] * f, 0, 255)) + ',' +
      Math.round(clamp(c[1] * f, 0, 255)) + ',' +
      Math.round(clamp(c[2] * f, 0, 255)) + ')';
  }
  function mix(c1, c2, t) {
    return [c1[0] + (c2[0] - c1[0]) * t, c1[1] + (c2[1] - c1[1]) * t, c1[2] + (c2[2] - c1[2]) * t];
  }
  function ease(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

  var KRAFT = hexToRgb('#C99A5F');
  var KRAFT_ROT = hexToRgb('#C08B4E');
  var WOOD = hexToRgb('#8A5B32');

  function Scene3D(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.model = null;
    this.cam = { yaw: -0.72, pitch: 0.55, zoom: 1, tx: 0, ty: 0 };
    this.drag = null;
    this.autoRotate = false;
    this.selectedLayer = -1;
    this.onlySelected = false;
    this.visibleLayers = Infinity;
    this.explode = 0;
    this.showDims = true;
    this._pending = false;
    this._tween = null;
    this._bind();
    this.resize();
    if (typeof ResizeObserver !== 'undefined') {
      var self = this;
      this._ro = new ResizeObserver(function () { self.resize(); });
      this._ro.observe(canvas.parentElement || canvas);
    }
  }

  Scene3D.prototype.setModel = function (model) {
    this.model = model;
    this.requestRender();
  };

  Scene3D.prototype.setLayerView = function (o) {
    if (o.selectedLayer != null) this.selectedLayer = o.selectedLayer;
    if (o.onlySelected != null) this.onlySelected = !!o.onlySelected;
    if (o.visibleLayers != null) this.visibleLayers = o.visibleLayers;
    if (o.explode != null) this.explode = o.explode;
    this.requestRender();
  };

  Scene3D.prototype.setAutoRotate = function (v) {
    this.autoRotate = !!v;
    this.requestRender();
  };

  Scene3D.prototype.setView = function (name, animate) {
    var views = {
      iso: { yaw: -0.72, pitch: 0.55 },
      top: { yaw: 0, pitch: 1.44 },
      front: { yaw: 0, pitch: 0.12 },
      side: { yaw: -Math.PI / 2, pitch: 0.12 },
      back: { yaw: Math.PI, pitch: 0.35 }
    };
    var v = views[name] || views.iso;
    if (animate === false) {
      this.cam.yaw = v.yaw;
      this.cam.pitch = v.pitch;
      this.requestRender();
      return;
    }
    this._tween = {
      t0: performance.now(), dur: 380,
      y0: this.cam.yaw, p0: this.cam.pitch,
      y1: v.yaw, p1: v.pitch
    };
    this.requestRender();
  };

  Scene3D.prototype.resetCamera = function () {
    this.cam.zoom = 1;
    this.cam.tx = 0;
    this.cam.ty = 0;
    this.setView('iso');
  };

  Scene3D.prototype.resize = function () {
    var parent = this.canvas.parentElement;
    if (!parent) return;
    var w = Math.max(100, parent.clientWidth);
    var h = Math.max(100, parent.clientHeight);
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    if (this._w === w && this._h === h && this._dpr === dpr) return;
    this._w = w; this._h = h; this._dpr = dpr;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.requestRender();
  };

  Scene3D.prototype.setDimensions = function () { /* kept for API symmetry */ };

  Scene3D.prototype.requestRender = function () {
    if (this._pending) return;
    this._pending = true;
    var self = this;
    requestAnimationFrame(function () {
      self._pending = false;
      self.draw();
    });
  };

  /* ------------------------------ 相机 ------------------------------ */

  Scene3D.prototype._camera = function () {
    var m = this.model;
    var stackH = m ? (m.viewH || m.H) : 100;
    var bottom = m && m.baseHeight ? -m.baseHeight : 0;
    var span = stackH - bottom;
    var maxDim = m
      ? (this.onlySelected ? Math.max(m.L, m.W, m.H * 0.35, 1) : Math.max(m.L, m.W, span, 1))
      : 100;
    var target = m ? [m.L / 2, m.W / 2, this.onlySelected ? 0 : (bottom + span * 0.46)] : [0, 0, 0];
    target[0] += this.cam.tx * maxDim;
    target[1] += this.cam.ty * maxDim;
    var dist = maxDim * (this.onlySelected ? 1.62 : 2.18) * this.cam.zoom;
    var cp = Math.cos(this.cam.pitch), sp = Math.sin(this.cam.pitch);
    var eye = [
      target[0] + dist * cp * Math.sin(this.cam.yaw),
      target[1] - dist * cp * Math.cos(this.cam.yaw),
      target[2] + dist * sp
    ];
    var fwd = [target[0] - eye[0], target[1] - eye[1], target[2] - eye[2]];
    var fl = Math.hypot(fwd[0], fwd[1], fwd[2]) || 1;
    fwd = [fwd[0] / fl, fwd[1] / fl, fwd[2] / fl];
    var right = [fwd[1] * 1 - fwd[2] * 0, fwd[2] * 0 - fwd[0] * 1, 0];
    var rl = Math.hypot(right[0], right[1]) || 1;
    right = [right[0] / rl, right[1] / rl, 0];
    var up = [
      right[1] * fwd[2] - right[2] * fwd[1],
      right[2] * fwd[0] - right[0] * fwd[2],
      right[0] * fwd[1] - right[1] * fwd[0]
    ];
    var focal = Math.min(this._w, this._h) * 1.02;
    return {
      eye: eye, fwd: fwd, right: right, up: up, focal: focal,
      cx: this._w / 2, cy: this._h * 0.47
    };
  };

  Scene3D.prototype._project = function (cam, p) {
    var vx = p[0] - cam.eye[0], vy = p[1] - cam.eye[1], vz = p[2] - cam.eye[2];
    var z = vx * cam.fwd[0] + vy * cam.fwd[1] + vz * cam.fwd[2];
    if (z < 0.05) return null;
    var x = vx * cam.right[0] + vy * cam.right[1] + vz * cam.right[2];
    var y = vx * cam.up[0] + vy * cam.up[1] + vz * cam.up[2];
    return { x: cam.cx + cam.focal * x / z, y: cam.cy - cam.focal * y / z, z: z };
  };

  /* ------------------------------ 绘制 ------------------------------ */

  Scene3D.prototype.draw = function () {
    var ctx = this.ctx;
    var m = this.model;
    var w = this._w, h = this._h;
    if (!w || !h) return;

    if (this._tween) {
      var t = clamp((performance.now() - this._tween.t0) / this._tween.dur, 0, 1);
      var e = ease(t);
      this.cam.yaw = this._tween.y0 + (this._tween.y1 - this._tween.y0) * e;
      this.cam.pitch = this._tween.p0 + (this._tween.p1 - this._tween.p0) * e;
      if (t >= 1) this._tween = null;
      else this.requestRender();
    }

    ctx.clearRect(0, 0, w, h);
    var bg = ctx.createRadialGradient(w * 0.5, h * 0.35, 20, w * 0.5, h * 0.45, Math.max(w, h) * 0.8);
    bg.addColorStop(0, '#26333f');
    bg.addColorStop(0.55, '#161f28');
    bg.addColorStop(1, '#0b1015');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    if (!m) {
      ctx.fillStyle = 'rgba(255,255,255,.45)';
      ctx.font = '13px "Segoe UI","Microsoft YaHei",sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('输入尺寸后显示 3D 码放示意', w / 2, h / 2);
      return;
    }

    var cam = this._camera();
    this._drawFloor(ctx, cam);
    if (m.actual && m.actual.L > 0) this._drawActualFootprint(ctx, cam, m);

    var faces = [];
    var palletFaces = [];
    var baseT = m.baseThickness || 0;
    this._pushBox(cam, palletFaces, 0, 0, -baseT, m.L, m.W, baseT, WOOD, {
      kind: 'pallet', stroke: 'rgba(20,10,2,.55)', lineWidth: 1
    });

    var boxes = m.boxes || [];
    for (var i = 0; i < boxes.length; i++) {
      var b = boxes[i];
      if (b.layer >= this.visibleLayers) continue;
      if (this.onlySelected && b.layer !== this.selectedLayer) continue;
      var z = this.onlySelected ? 0 : (b.z + b.layer * this.explode);
      var base = b.color ? hexToRgb(b.color) : (b.rot ? KRAFT_ROT : KRAFT);
      this._pushBox(cam, faces, b.x, b.y, z, b.w, b.d, b.h, base, {
        kind: 'carton', layer: b.layer, selected: b.layer === this.selectedLayer,
        stroke: b.layer === this.selectedLayer ? 'rgba(255,190,95,.95)' : 'rgba(44,27,11,.62)',
        lineWidth: b.layer === this.selectedLayer ? 1.8 : 0.85
      });
    }

    // 托盘永远画在纸箱之前：托盘顶面很大，按质心排序会盖住上层纸箱
    palletFaces.sort(function (a, b) { return b.depth - a.depth; });
    this._drawFaces(ctx, cam, palletFaces);
    faces.sort(function (a, b) { return b.depth - a.depth; });
    this._drawFaces(ctx, cam, faces);

    if (m.cartonLabels && m.cartonLabels.length) {
      this._drawCartonLabels(ctx, cam, m.cartonLabels);
    }

    if (m.showDims !== false && this.showDims) {
      this._drawDims(ctx, cam, m);
    }

    if (this.autoRotate) {
      this.cam.yaw += 0.006;
      this.requestRender();
    }
  };

  Scene3D.prototype._drawFaces = function (ctx, cam, faces) {
    for (var f = 0; f < faces.length; f++) {
      var face = faces[f];
      var pts = [];
      var ok = true;
      for (var v = 0; v < 4; v++) {
        var pr = this._project(cam, face.verts[v]);
        if (!pr) { ok = false; break; }
        pts.push(pr);
      }
      if (!ok) continue;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (var k = 1; k < 4; k++) ctx.lineTo(pts[k].x, pts[k].y);
      ctx.closePath();
      ctx.fillStyle = face.color;
      ctx.fill();
      if (face.lineWidth) {
        ctx.strokeStyle = face.stroke;
        ctx.lineWidth = face.lineWidth;
        ctx.stroke();
      }
    }
  };

  Scene3D.prototype._pushBox = function (cam, faces, x, y, z, w, d, h, color, opt) {
    var x1 = x + w, y1 = y + d, z1 = z + h;
    var verts = {
      top: [[x, y, z1], [x1, y, z1], [x1, y1, z1], [x, y1, z1]],
      bottom: [[x, y, z], [x, y1, z], [x1, y1, z], [x1, y, z]],
      front: [[x, y, z], [x1, y, z], [x1, y, z1], [x, y, z1]],
      back: [[x1, y1, z], [x, y1, z], [x, y1, z1], [x1, y1, z1]],
      left: [[x, y1, z], [x, y, z], [x, y, z1], [x, y1, z1]],
      right: [[x1, y, z], [x1, y1, z], [x1, y1, z1], [x1, y, z1]]
    };
    var data = [
      ['top', [0, 0, 1], 1.10], ['bottom', [0, 0, -1], 0.55],
      ['front', [0, -1, 0], 0.94], ['back', [0, 1, 0], 0.80],
      ['left', [-1, 0, 0], 0.86], ['right', [1, 0, 0], 0.72]
    ];
    var self = this;
    data.forEach(function (dd) {
      var vs = verts[dd[0]];
      var cx = 0, cy = 0, cz = 0;
      for (var i = 0; i < 4; i++) { cx += vs[i][0]; cy += vs[i][1]; cz += vs[i][2]; }
      cx /= 4; cy /= 4; cz /= 4;
      var nx = dd[1][0], ny = dd[1][1], nz = dd[1][2];
      // 背面剔除
      if ((cam.eye[0] - cx) * nx + (cam.eye[1] - cy) * ny + (cam.eye[2] - cz) * nz <= 0) return;
      var depth = (cx - cam.eye[0]) * cam.fwd[0] + (cy - cam.eye[1]) * cam.fwd[1] + (cz - cam.eye[2]) * cam.fwd[2];
      var tint = opt.kind === 'carton' ? (opt.layer % 2 ? 0.93 : 1.0) : 1;
      var col = rgbStr(color, dd[2] * tint);
      if (opt.selected) {
        col = rgbStr(mix(color, hexToRgb('#F3A742'), 0.42), dd[2] > 1 ? 1.02 : dd[2] + 0.10);
      } else if (opt.kind === 'carton' && self.selectedLayer >= 0 && opt.layer !== self.selectedLayer) {
        col = rgbStr(mix(color, hexToRgb('#4a5560'), 0.22), dd[2] * tint);
      }
      faces.push({
        verts: vs, depth: depth, color: col,
        stroke: opt.stroke, lineWidth: opt.lineWidth,
        layer: opt.layer, kind: opt.kind
      });
    });
  };

  Scene3D.prototype._drawFloor = function (ctx, cam) {
    var m = this.model;
    var baseT = m.baseThickness || 0;
    var z = -baseT - 0.4;
    var pad = Math.max(m.L, m.W) * 0.55;
    var x0 = -pad, x1 = m.L + pad, y0 = -pad, y1 = m.W + pad;

    // 地面柔光
    var c = this._project(cam, [m.L / 2, m.W / 2, z]);
    if (c) {
      var rg = ctx.createRadialGradient(c.x, c.y, 4, c.x, c.y, Math.max(this._w, this._h) * 0.45);
      rg.addColorStop(0, 'rgba(88,120,150,.16)');
      rg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = rg;
      ctx.fillRect(0, 0, this._w, this._h);
    }

    // 托盘投影
    var corners = [[0, 0], [m.L, 0], [m.L, m.W], [0, m.W]];
    var proj = [];
    for (var i = 0; i < 4; i++) {
      var p = this._project(cam, [corners[i][0], corners[i][1], z]);
      if (!p) return;
      proj.push(p);
    }
    ctx.save();
    ctx.filter = 'blur(14px)';
    ctx.fillStyle = 'rgba(0,0,0,.34)';
    ctx.beginPath();
    ctx.moveTo(proj[0].x + 8, proj[0].y + 10);
    for (var j = 1; j < 4; j++) ctx.lineTo(proj[j].x + 8, proj[j].y + 10);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // 网格
    var step = Math.max(m.L, m.W) / 8;
    ctx.strokeStyle = 'rgba(170,205,230,.075)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (var gx = x0; gx <= x1 + 0.01; gx += step) {
      var a = this._project(cam, [gx, y0, z]);
      var b = this._project(cam, [gx, y1, z]);
      if (a && b) { ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); }
    }
    for (var gy = y0; gy <= y1 + 0.01; gy += step) {
      var c1 = this._project(cam, [x0, gy, z]);
      var c2 = this._project(cam, [x1, gy, z]);
      if (c1 && c2) { ctx.moveTo(c1.x, c1.y); ctx.lineTo(c2.x, c2.y); }
    }
    ctx.stroke();
  };

  Scene3D.prototype._drawActualFootprint = function (ctx, cam) {
    var m = this.model;
    var a = m.actual;
    var z = 0.3;
    var corners = [[a.x0, a.y0], [a.x1, a.y0], [a.x1, a.y1], [a.x0, a.y1]];
    var pts = [];
    for (var i = 0; i < 4; i++) {
      var p = this._project(cam, [corners[i][0], corners[i][1], z]);
      if (!p) return;
      pts.push(p);
    }
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = 'rgba(235,178,104,.55)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (var k = 1; k < 4; k++) ctx.lineTo(pts[k].x, pts[k].y);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  };

  Scene3D.prototype._drawCartonLabels = function (ctx, cam, labels) {
    function dimArrow(a, b, color) {
      var ang = Math.atan2(b.y - a.y, b.x - a.x);
      var size = 5;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x - size * Math.cos(ang - 0.4), b.y - size * Math.sin(ang - 0.4));
      ctx.lineTo(b.x - size * Math.cos(ang + 0.4), b.y - size * Math.sin(ang + 0.4));
      ctx.closePath();
      ctx.fill();
    }
    function dimPill(text, x, y, color, fontSize, vertical) {
      ctx.save();
      ctx.translate(x, y);
      if (vertical) ctx.rotate(-Math.PI / 2);
      ctx.font = '600 ' + fontSize + 'px "Segoe UI","Microsoft YaHei",sans-serif';
      var tw = ctx.measureText(text).width;
      var bw = tw + fontSize * 1.15, bh = fontSize * 1.7;
      var rx = -bw / 2, ry = -bh / 2;
      ctx.fillStyle = 'rgba(9,14,19,.9)';
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(rx + 4, ry);
      ctx.arcTo(rx + bw, ry, rx + bw, ry + bh, 4);
      ctx.arcTo(rx + bw, ry + bh, rx, ry + bh, 4);
      ctx.arcTo(rx, ry + bh, rx, ry, 4);
      ctx.arcTo(rx, ry, rx + bw, ry, 4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#f5e9d5';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 0, 0.5);
      ctx.restore();
    }
    function drawDims(label) {
      var color = label.color || '#C99A5F';
      var center = self._project(cam, [label.anchor.x, label.anchor.y, label.anchor.z]);
      (label.dims || []).forEach(function (d) {
        var a = self._project(cam, [d.a.x, d.a.y, d.a.z]);
        var b = self._project(cam, [d.b.x, d.b.y, d.b.z]);
        if (!a || !b) return;
        var dx = b.x - a.x, dy = b.y - a.y;
        var len = Math.hypot(dx, dy);
        if (len < 6) return;
        var nx = -dy / len, ny = dx / len;
        var mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        // 尺寸线朝箱体外侧偏移，避免压住箱面
        if (center && (nx * (mid.x - center.x) + ny * (mid.y - center.y)) < 0) {
          nx = -nx; ny = -ny;
        }
        var gap = Math.max(8, Math.min(18, len * 0.08));
        var a2 = { x: a.x + nx * gap, y: a.y + ny * gap };
        var b2 = { x: b.x + nx * gap, y: b.y + ny * gap };
        ctx.save();
        ctx.strokeStyle = 'rgba(138,75,34,.7)';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y); ctx.lineTo(a2.x, a2.y);
        ctx.moveTo(b.x, b.y); ctx.lineTo(b2.x, b2.y);
        ctx.stroke();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.moveTo(a2.x, a2.y); ctx.lineTo(b2.x, b2.y);
        ctx.stroke();
        dimArrow(a2, b2, color);
        dimArrow(b2, a2, color);
        ctx.restore();
        var fontSize = Math.max(10, Math.min(19, len * 0.14));
        var tx = (a2.x + b2.x) / 2 + nx * (fontSize * 0.95);
        var ty = (a2.y + b2.y) / 2 + ny * (fontSize * 0.95);
        var vertical = d.kind === 'h';
        dimPill(d.text, tx, ty, color, fontSize, vertical);
      });
    }
    var self = this;
    for (var i = 0; i < labels.length; i++) {
      var label = labels[i];
      if (label.dims && label.dims.length) {
        drawDims(label);
        continue;
      }
      var p = this._project(cam, [label.anchor.x, label.anchor.y, label.anchor.z]);
      if (!p) continue;
      var text = String(label.text || '');
      if (text.length > 30) text = text.slice(0, 29) + '…';
      ctx.font = '600 11px "Segoe UI","Microsoft YaHei",sans-serif';
      var tw = ctx.measureText(text).width;
      var bw = tw + 28, bh = 22;
      var x = p.x + 36;
      var y = p.y - 38 - i * 27;
      if (x + bw > this._w - 12) x = p.x - bw - 36;
      if (y < 88) y = p.y + 28 + i * 27;
      y = Math.max(82, Math.min(this._h - 76, y));
      x = Math.max(12, Math.min(this._w - bw - 12, x));

      var rgb = hexToRgb(label.color || '#C99A5F');
      var stroke = 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',.55)';
      var lx = x > p.x ? x : x + bw;
      var ly = y + bh / 2;

      ctx.save();
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(lx, ly);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fillStyle = label.color || '#C99A5F';
      ctx.fill();
      ctx.strokeStyle = 'rgba(10,14,18,.7)';
      ctx.stroke();
      ctx.restore();

      var r = 6;
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + bw, y, x + bw, y + bh, r);
      ctx.arcTo(x + bw, y + bh, x, y + bh, r);
      ctx.arcTo(x, y + bh, x, y, r);
      ctx.arcTo(x, y, x + bw, y, r);
      ctx.closePath();
      ctx.fillStyle = 'rgba(9,14,19,.9)';
      ctx.fill();
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(x + 10, y + bh / 2, 3.2, 0, Math.PI * 2);
      ctx.fillStyle = label.color || '#C99A5F';
      ctx.fill();

      ctx.fillStyle = '#f5e9d5';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, x + 18, y + bh / 2 + 0.5);
    }
  };

  Scene3D.prototype._drawDims = function (ctx, cam, m) {
    var baseT = m.baseHeight != null ? m.baseHeight : (m.baseThickness || 0);
    var off = Math.max(8, Math.max(m.L, m.W) * 0.10);
    var accent = 'rgba(235,178,104,.92)';
    var self = this;

    function seg(p1, p2, color, width, dash) {
      var a = self._project(cam, p1), b = self._project(cam, p2);
      if (!a || !b) return null;
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = width || 1;
      if (dash) ctx.setLineDash(dash);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.restore();
      return [a, b];
    }

    function arrow(seg2, atEnd) {
      if (!seg2) return;
      var a = atEnd ? seg2[0] : seg2[1];
      var b = atEnd ? seg2[1] : seg2[0];
      var ang = Math.atan2(b.y - a.y, b.x - a.x);
      var size = 5.5;
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x - size * Math.cos(ang - 0.42), b.y - size * Math.sin(ang - 0.42));
      ctx.lineTo(b.x - size * Math.cos(ang + 0.42), b.y - size * Math.sin(ang + 0.42));
      ctx.closePath();
      ctx.fill();
    }

    function pill(text, x, y) {
      ctx.font = '600 11.5px "Segoe UI","Microsoft YaHei",sans-serif';
      var tw = ctx.measureText(text).width;
      var bw = tw + 16, bh = 21;
      ctx.fillStyle = 'rgba(9,14,19,.82)';
      ctx.strokeStyle = 'rgba(235,178,104,.45)';
      ctx.lineWidth = 1;
      var rx = x - bw / 2, ry = y - bh / 2;
      var r = 5;
      ctx.beginPath();
      ctx.moveTo(rx + r, ry);
      ctx.arcTo(rx + bw, ry, rx + bw, ry + bh, r);
      ctx.arcTo(rx + bw, ry + bh, rx, ry + bh, r);
      ctx.arcTo(rx, ry + bh, rx, ry, r);
      ctx.arcTo(rx, ry, rx + bw, ry, r);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#F4DFC2';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, x, y + 0.5);
    }

    // 长
    var yL = -off, zL = -baseT;
    seg([0, 0, zL], [0, yL, zL], 'rgba(235,178,104,.25)', 1);
    seg([m.L, 0, zL], [m.L, yL, zL], 'rgba(235,178,104,.25)', 1);
    var sL = seg([0, yL, zL], [m.L, yL, zL], accent, 1.2);
    arrow(sL, false); arrow(sL, true);
    if (sL) pill('长 ' + fmt(m.L) + (m.delta && m.delta.L ? ' (+' + fmt(m.delta.L) + ')' : ''),
      (sL[0].x + sL[1].x) / 2, (sL[0].y + sL[1].y) / 2 + 17);

    // 宽
    var xW = -off, zW = -baseT;
    seg([0, 0, zW], [xW, 0, zW], 'rgba(235,178,104,.25)', 1);
    seg([0, m.W, zW], [xW, m.W, zW], 'rgba(235,178,104,.25)', 1);
    var sW = seg([xW, 0, zW], [xW, m.W, zW], accent, 1.2);
    arrow(sW, false); arrow(sW, true);
    if (sW) pill('宽 ' + fmt(m.W) + (m.delta && m.delta.W ? ' (+' + fmt(m.delta.W) + ')' : ''),
      Math.max(40, (sW[0].x + sW[1].x) / 2 - 54), (sW[0].y + sW[1].y) / 2 + 17);

    // 高（单独查看单层或接近俯视时不再画限高线）
    if (!this.onlySelected && cam.pitch < 1.30) {
      var xH = m.L + off, yH = 0;
      seg([m.L, 0, -baseT], [xH, 0, -baseT], 'rgba(235,178,104,.25)', 1);
      var sH = seg([xH, yH, -baseT], [xH, yH, m.H], accent, 1.2);
      arrow(sH, false); arrow(sH, true);
      var shownH = m.totalH != null ? m.totalH : (baseT + m.H);
      if (sH) pill('总高 ' + fmt(shownH) + (m.delta && m.delta.H ? ' (+' + fmt(m.delta.H) + ')' : ''),
        Math.min(this._w - 58, sH[1].x + 46), (sH[0].y + sH[1].y) / 2);
      // 拆层示意：用虚线把“实际限高”延伸到展开后的视觉高度
      if (m.viewH && m.viewH > m.H + 0.01) {
        seg([xH, yH, m.H], [xH, yH, m.viewH], 'rgba(235,178,104,.34)', 1, [3, 4]);
      }
    }
  };

  function fmt(v) {
    var n = Math.round(v * 100) / 100;
    return String(n);
  }

  /* ------------------------------ 交互 ------------------------------ */

  Scene3D.prototype._bind = function () {
    var self = this;
    var canvas = this.canvas;
    var down = null;

    canvas.addEventListener('pointerdown', function (e) {
      if (e.button !== 0) return;
      down = { x: e.clientX, y: e.clientY, yaw: self.cam.yaw, pitch: self.cam.pitch, moved: false };
      canvas.setPointerCapture(e.pointerId);
      canvas.style.cursor = 'grabbing';
    });
    canvas.addEventListener('pointermove', function (e) {
      if (!down) return;
      var dx = e.clientX - down.x;
      var dy = e.clientY - down.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) down.moved = true;
      self.cam.yaw = down.yaw + dx * 0.0075;
      self.cam.pitch = clamp(down.pitch + dy * 0.006, 0.06, 1.50);
      self.requestRender();
    });
    function up(e) {
      if (!down) return;
      down = null;
      canvas.style.cursor = 'grab';
      if (canvas.hasPointerCapture && e.pointerId != null && canvas.hasPointerCapture(e.pointerId)) {
        canvas.releasePointerCapture(e.pointerId);
      }
    }
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('wheel', function (e) {
      e.preventDefault();
      var f = Math.exp(e.deltaY * 0.0011);
      self.cam.zoom = clamp(self.cam.zoom * f, 0.48, 3.2);
      self.requestRender();
    }, { passive: false });
    canvas.addEventListener('dblclick', function () { self.resetCamera(); });
    canvas.style.cursor = 'grab';
  };

  root.Scene3D = Scene3D;
})(window);
