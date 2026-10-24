# -*- coding: utf-8 -*-
"""Patch render.ts: glide 11-14 cells + burn-all-path + 3 sessions."""
p = 'src/render.ts'
s = open(p, encoding='utf8').read()

# --- thay toàn bộ hàm buildShow ---
start = s.index('function buildShow(cal: Calendar, seed: number): Show {')
end = s.index('// ============================================================\n// sampling')

new_fn = '''function buildShow(cal: Calendar, seed: number): Show {
  const rnd = mulberry32(seed);
  const { width, cols, rows } = gridSize(cal);
  const center: Pt = { x: width / 2, y: GEO.top + (rows * GEO.pitch) / 2 };
  const inGrid = (p: Pt) =>
    p.x >= GEO.marginX - GEO.pitch * 0.6 && p.x <= GEO.marginX + (cols - 1) * GEO.pitch + GEO.pitch * 0.6 &&
    p.y >= GEO.top - GEO.pitch * 0.6 && p.y <= GEO.top + 6 * GEO.pitch + GEO.pitch * 0.6;

  const bright: { p: Pt; count: number }[] = [];
  for (let c = 0; c < cols; c++)
    for (let r = 0; r < 7; r++) {
      const day = cal.weeks[c][r];
      if (day.level >= 2) bright.push({ p: cellCenter(c, r), count: day.count });
    }
  const pool0 = bright.length >= 4 ? bright : (() => {
    const any_: { p: Pt; count: number }[] = [];
    for (let c = 0; c < cols; c += 2) for (let r = 0; r < 7; r += 2) any_.push({ p: cellCenter(c, r), count: 1 });
    return any_;
  })();

  const SESSIONS = 3;
  type Plan = { glide: Pt[]; origin: Pt; arrival: Pt; dirs: { d: Pt; len: number; rot: number; flip: number }[]; walks: Pt[] };
  const plans: Plan[] = [];
  let cur: Pt = center;

  for (let s = 0; s < SESSIONS; s++) {
    const pool = shuffle(pool0.filter(b => dist(b.p, cur) > GEO.pitch * 3), rnd).slice(0, 10);
    const target = (pool[0] ?? pool0[s % pool0.length]).p;

    const allDirs = shuffle([{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 0, y: -1 }], rnd);
    const d0 = allDirs.find(d => {
      const o = { x: target.x - d.x * GEO.pitch, y: target.y - d.y * GEO.pitch };
      return o.x >= GEO.marginX - GEO.pitch * 0.6 && o.x <= width - GEO.marginX + GEO.pitch * 0.6 &&
             o.y >= GEO.top - GEO.pitch * 0.6 && o.y <= GEO.top + 6 * GEO.pitch + GEO.pitch * 0.6;
    }) ?? allDirs[0];
    const origin: Pt = { x: target.x - d0.x * GEO.pitch, y: target.y - d0.y * GEO.pitch };

    const ox = origin.x - center.x, oy = origin.y - center.y;
    const ol = Math.max(1, Math.hypot(ox, oy));
    const arrival: Pt = { x: origin.x + (ox / ol) * GEO.pitch * 1.4, y: origin.y + (oy / ol) * GEO.pitch * 1.4 };

    // GLIDE: trượt ngẫu nhiên qua 11–14 ô, kết thúc tại origin
    const want = 11 + Math.floor(rnd() * 4);
    const trail: Pt[] = [{ ...origin }];
    let p = { ...origin };
    let guard = 0;
    while (trail.length < want && guard++ < 80) {
      const dirs4 = shuffle([{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }], rnd);
      const d = dirs4.find(d => {
        const n = { x: p.x + d.x * GEO.pitch, y: p.y + d.y * GEO.pitch };
        return inGrid(n) && !trail.some(t => t.x === n.x && t.y === n.y);
      }) ?? dirs4.find(d => {
        const n = { x: p.x + d.x * GEO.pitch, y: p.y + d.y * GEO.pitch };
        const prev = trail[trail.length - 2];
        return inGrid(n) && (!prev || !(n.x === prev.x && n.y === prev.y));
      });
      if (!d) break;
      p = { x: p.x + d.x * GEO.pitch, y: p.y + d.y * GEO.pitch };
      trail.push({ ...p });
    }
    trail.reverse();   // đầu = xa origin nhất, cuối = origin (mũi phun)

    const order = [d0, ...shuffle(allDirs.filter(d => d !== d0), rnd)];
    const dirCount = 1 + Math.floor(rnd() * 4);   // xoay ngẫu nhiên 1–4 hướng
    const dirs = order.slice(0, dirCount).map(d => ({ d, len: 1 + Math.floor(rnd() * 3), rot: rotFor(d), flip: flipFor(d) }));

    const walks: Pt[] = [];
    let wp = { ...origin };
    const nSteps = 2 + Math.floor(rnd() * 3);
    for (let i = 0; i < nSteps; i++) {
      const ang = rnd() * Math.PI * 2;
      const step = GEO.pitch * (1 + rnd() * 2);
      wp = {
        x: Math.min(width - GEO.marginX + GEO.pitch, Math.max(GEO.marginX - GEO.pitch, wp.x + Math.cos(ang) * step)),
        y: Math.min(GEO.top + 6 * GEO.pitch + GEO.pitch * 0.5, Math.max(GEO.top - GEO.pitch * 0.5, wp.y + Math.sin(ang) * step)),
      };
      walks.push(wp);
    }

    plans.push({ glide: trail, origin, arrival, dirs, walks });
    cur = walks[walks.length - 1] ?? origin;
  }

  // ===== phát phases =====
  const phases: Phase[] = [];
  const burns: Burn[] = [];
  const vertices: Pt[] = [plans[0].arrival];
  let t = 0;
  let rot = 0, flip = 1;
  const push = (kind: Kind, from: Pt, to: Pt, dur: number, rotEnd = rot, flipEnd = flip) => {
    phases.push({ t0: t, t1: t + dur, from, to, kind, visible: kind !== "slide" && kind !== "fadeout", rotEnd, flipEnd });
    t += dur;
    if (kind === "move" || kind === "walk" || kind === "slide") {
      const lastV = vertices[vertices.length - 1];
      if (lastV.x !== to.x || lastV.y !== to.y) vertices.push(to);
    }
  };

  plans.forEach((plan, si) => {
    let spinAngle = 0;
    const doSpin = rnd() < 0.55;
    const spinDur = doSpin ? 0.85 : 0.35;
    const spinStart = spinAngle;
    if (doSpin) spinAngle += 360 * (rnd() < 0.5 ? 1 : -1);
    phases.push({ t0: t, t1: t + spinDur, from: plan.arrival, to: plan.arrival, kind: "fadein", visible: true,
      rotEnd: rot, flipEnd: flip, spinEnd: spinAngle, spinning: doSpin });
    t += spinDur;

    // SLIDE qua 11–14 ô của glide
    let prev = plan.arrival;
    for (const g of plan.glide) {
      push("move", prev, g, 0.3, rot, flip);
      prev = g;
    }

    for (const { d, len, rot: rEnd, flip: fEnd } of plan.dirs) {
      push("rotate", plan.origin, plan.origin, 0.14, rEnd, fEnd);
      push("spray", plan.origin, plan.origin, 0.7 + len * 0.18, rEnd, fEnd);
      phases[phases.length - 1].len = len;
      // ĐỐT TOÀN BỘ ĐƯỜNG LỬA (mọi ô trong tầm 1..len — ô có màu mòn về trống hoàn toàn)
      for (let k = 1; k <= len; k++) {
        const cell = { x: plan.origin.x + d.x * GEO.pitch * k, y: plan.origin.y + d.y * GEO.pitch * k };
        if (!inGrid(cell)) continue;
        const col = Math.round((cell.x - GEO.marginX - GEO.cell / 2) / GEO.pitch);
        const row = Math.round((cell.y - GEO.top - GEO.cell / 2) / GEO.pitch);
        const day = cal.weeks[col]?.[row];
        if (!day) continue;
        burns.push({ col, row, x: cell.x, y: cell.y, level: day.level, t: t - (0.7 + len * 0.18) + 0.2 + (k - 1) * 0.24 });
      }
    }

    const lastEffectEnd = Math.max(t, ...burns.map(b => b.t + 0.9));
    push("hold", plan.origin, plan.origin, 0.5 + Math.max(0, lastEffectEnd - t), rot, flip);
    let wp = plan.origin;
    for (const stepTo of plan.walks) {
      const dx = stepTo.x - wp.x;
      const nFlip = Math.abs(dx) > 2 ? (dx > 0 ? 1 : -1) : flip;
      push("walk", wp, stepTo, 0.55, rot, nFlip);
      flip = nFlip; wp = stepTo;
    }
    push("fadeout", wp, wp, 0.35, rot, flip);
    const nextArrival = plans[(si + 1) % plans.length].arrival;
    push("slide", wp, nextArrival, 0.45 + dist(wp, nextArrival) / 320, rot, flip);
  });

  let pathD = `M ${f(vertices[0].x)} ${f(vertices[0].y)}`;
  let pathLen = 0;
  for (let i = 1; i < vertices.length; i++) {
    pathLen += dist(vertices[i - 1], vertices[i]);
    pathD += ` L ${f(vertices[i].x)} ${f(vertices[i].y)}`;
  }
  pathLen += dist(vertices[vertices.length - 1], vertices[0]);
  pathD += " Z";

  return { phases, total: t, pathD, pathLen, burns };
}

'''

s = s[:start] + new_fn + s[end:]

# --- burns render: mọi ô trên đường lửa đều mòn về trống hoàn toàn ---
old_burn = '''      const fillAnim = burn && day.level > 0'''
new_burn = '''      const fillAnim = burn'''
assert old_burn in s, 'burn fill condition not found'
s = s.replace(old_burn, new_burn)

open(p, 'w', encoding='utf8').write(s)
print('buildShow v6 + burn-all patched')
