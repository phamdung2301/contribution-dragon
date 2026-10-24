import { Calendar, Theme } from "./theme.js";
import { cellCenter, GEO, gridSize, MONTHS, Pt } from "./route.js";

const FONT = "ui-monospace,SFMono-Regular,'JetBrains Mono',Consolas,monospace";

const DRAGON = {
  scale: 1.22,
  body: "#0B3B33",
  shade: "#062E26",
  line: "#00F5D4",
  spike: "#00F5D4",
  glow: "#E6FFFB",
};

const dist = (a: Pt, b: Pt) => Math.hypot(b.x - a.x, b.y - a.y);
const f = (n: number) => Math.round(n * 1000) / 1000;
const lerpPt = (a: Pt, b: Pt, k: number): Pt => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k });

function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(arr: T[], rnd: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ============================================================
// Timeline — hunter sessions, 8-way glides, walk, teleport
// ============================================================
type Kind = "fadein" | "move" | "rotate" | "spray" | "hold" | "walk" | "fadeout" | "slide";

interface Phase {
  t0: number; t1: number;
  from: Pt; to: Pt;
  kind: Kind;
  visible: boolean;
  rotEnd: number;
  flipEnd: number;
  spinEnd?: number;     // góc spin tích lũy sau phase (multiple của 360)
  spinning?: boolean;   // phase fadein có xoay 360° không
  len?: number;         // tầm lửa của pha spray (1–3 ô)
}

interface Burn { col: number; row: number; x: number; y: number; level: 0 | 1 | 2 | 3 | 4; t: number }

interface Show {
  phases: Phase[];
  total: number;
  pathD: string;
  pathLen: number;
  burns: Burn[];
  vertices: Pt[];
}

const rotFor = (d: Pt) => (d.y === 1 ? 90 : d.y === -1 ? -90 : 0);
const flipFor = (d: Pt) => (d.x === -1 ? -1 : 1);

export function buildShow(cal: Calendar, seed: number): Show {
  const rnd = mulberry32(seed);
  const { width, cols, rows } = gridSize(cal);
  const center: Pt = { x: width / 2, y: GEO.top + (rows * GEO.pitch) / 2 };
  const inGrid = (p: Pt) =>
    p.x >= GEO.marginX - GEO.pitch * 0.6 && p.x <= GEO.marginX + (cols - 1) * GEO.pitch + GEO.pitch * 0.6 &&
    p.y >= GEO.top - GEO.pitch * 0.6 && p.y <= GEO.top + 6 * GEO.pitch + GEO.pitch * 0.6;

  const bright: { p: Pt; count: number }[] = [];
  for (let c = 0; c < cols; c++)
    for (let r = 0; r < 7; r++) {
      const day = cal.weeks[c]?.[r];
      if (!day || day.level < 2) continue;      // tuần rének (GitHub calendar) có thể < 7 ngày
      bright.push({ p: cellCenter(c, r), count: day.count });
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
    // hướng phun: origin VÀ toàn tầm lửa 1–3 ô phải nằm trong bảng — nếu không
    // lửa phun ra ngoài稀缺 và không ô nào cháy (bug "đốt nhưng không mất")
    const sprayFits = (d: Pt) => {
      for (let k = -1; k <= 3; k++) {
        const q = { x: target.x + d.x * GEO.pitch * k, y: target.y + d.y * GEO.pitch * k };
        if (!inGrid(q)) return false;
      }
      return true;
    };
    const d0 = allDirs.find(sprayFits) ?? allDirs.find(d => inGrid({ x: target.x - d.x * GEO.pitch, y: target.y - d.y * GEO.pitch })) ?? allDirs[0];
    const origin: Pt = { x: target.x - d0.x * GEO.pitch, y: target.y - d0.y * GEO.pitch };

    const ox = origin.x - center.x, oy = origin.y - center.y;
    const ol = Math.max(1, Math.hypot(ox, oy));
    const arrival: Pt = { x: origin.x + (ox / ol) * GEO.pitch * 1.4, y: origin.y + (oy / ol) * GEO.pitch * 1.4 };

    // SWEEP-IN: vào từ biên gần arrival → quét VÒNG LỚN qua tâm bảng
    // (2 cung bezier: entry → away → origin) → tổng 11–14 ô, dài hơn thân
    // rồng (91px) nên chuỗi duỗi ra đẹp; kết thúc CHÍNH XÁC tại origin.
    const want = 11 + Math.floor(rnd() * 4);          // 11–14 điểm
    const clampIn = (pt: Pt) => ({
      x: Math.min(width - GEO.marginX + GEO.pitch * 0.5, Math.max(GEO.marginX - GEO.pitch * 0.5, pt.x)),
      y: Math.min(GEO.top + 6 * GEO.pitch + GEO.pitch * 0.5, Math.max(GEO.top - GEO.pitch * 0.5, pt.y)),
    });
    const entryC = Math.max(0, Math.min(cols - 1, Math.round((arrival.x - GEO.marginX - GEO.cell / 2) / GEO.pitch)));
    const entryR = Math.max(0, Math.min(6, Math.round((arrival.y - GEO.top - GEO.cell / 2) / GEO.pitch)));
    const entry = cellCenter(entryC, entryR);
    // away: 6–9 ô VÀO TRONG BẢNG từ điểm nhập (theo hướng tâm) — sweep
    // băng qua các ô thay vì xoay local; perpIn dùng cho 2 control point
    const into = { x: center.x - entry.x, y: center.y - entry.y };
    const il = Math.max(1, Math.hypot(into.x, into.y));
    const intoDir = { x: into.x / il, y: into.y / il };
    const perpIn = { x: -intoDir.y, y: intoDir.x };
    const away = clampIn({
      x: entry.x + intoDir.x * GEO.pitch * (6 + rnd() * 3) + perpIn.x * (rnd() - 0.5) * GEO.pitch * 4,
      y: entry.y + intoDir.y * GEO.pitch * (6 + rnd() * 3) + perpIn.y * (rnd() - 0.5) * GEO.pitch * 4,
    });
    const bez = (p0: Pt, pc: Pt, p2: Pt, n: number): Pt[] => {
      const out: Pt[] = [];
      for (let i = 0; i <= n; i++) {
        const k = i / n;
        // clamp TỪNG điểm sample — control point có thể lôi đường cong ra
        // ngoài bảng (bug "rồng lượn ngoài rìa") nên phải giữ từng bước
        out.push(clampIn(lerpPt(lerpPt(p0, pc, k), lerpPt(pc, p2, k), k)));
      }
      return out;
    };
    const d1 = { x: away.x - entry.x, y: away.y - entry.y };
    const l1 = Math.max(1, Math.hypot(d1.x, d1.y));
    const c1 = clampIn({
      x: (entry.x + away.x) / 2 + perpIn.x * (rnd() - 0.5) * GEO.pitch * 4,
      y: (entry.y + away.y) / 2 + perpIn.y * (rnd() - 0.5) * GEO.pitch * 4,
    });
    const hopN = (a: Pt, b: Pt) => Math.max(3, Math.round(dist(a, b) / (GEO.pitch * 1.3)));
    const leg1 = bez(entry, c1, away, hopN(entry, away));
    const d2 = { x: origin.x - away.x, y: origin.y - away.y };
    const l2 = Math.max(1, Math.hypot(d2.x, d2.y));
    const c2 = clampIn({
      x: (away.x + origin.x) / 2 + perpIn.x * (rnd() - 0.5) * GEO.pitch * 2.5,
      y: (away.y + origin.y) / 2 + perpIn.y * (rnd() - 0.5) * GEO.pitch * 2.5,
    });
    const leg2 = bez(away, c2, origin, hopN(away, origin));
    const trail = [...leg1.slice(0, -1), ...leg2];    // nối 2 cung, away dùng 1 lần

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

    let prev = plan.arrival;
    for (const g of plan.glide) {
      push("move", prev, g, 0.3, rot, flip);
      prev = g;
    }

    for (const { d, len, rot: rEnd, flip: fEnd } of plan.dirs) {
      push("rotate", plan.origin, plan.origin, 0.14, rEnd, fEnd);
      push("spray", plan.origin, plan.origin, 0.7 + len * 0.18, rEnd, fEnd);
      phases[phases.length - 1].len = len;
      // đốt toàn bộ đường lửa: mọi ô trong tầm 1..len
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

    const lastEffectEnd = Math.max(t, ...burns.map(b => b.t + 0.85));   // flame 0.5s + fade 0.35s
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

  return { phases, total: t, pathD, pathLen, burns, vertices };
}

// ============================================================
// vector head + chain simulation (rope constraint)
// ============================================================
/** Vị trí ĐẦU rồng tại thời điểm t — nội suy tuyến tính trong phase. */
function headPositionAt(phases: Phase[], t: number): Pt {
  const T = phases[phases.length - 1].t1;
  const tt = ((t % T) + T) % T;
  for (const ph of phases) {
    if (tt >= ph.t0 && tt <= ph.t1) {
      const k = (tt - ph.t0) / Math.max(0.0001, ph.t1 - ph.t0);
      return lerpPt(ph.from, ph.to, k);
    }
  }
  return phases[phases.length - 1].to;
}

// ============================================================
// dragon assembly
// ============================================================
/** Hướng đầu (độ, chuẩn hóa [-90,90]) + lật gương — từ vector vận tốc. */
function headingChannel(samples: Pt[], dt: number, sampleEvery: number): { angles: number[]; flips: number[]; kts: number[] } {
  const n = samples.length - 1;
  const step = Math.max(1, Math.round(sampleEvery / dt));
  const angles: number[] = [], flips: number[] = [], kts: number[] = [];
  let lastAngle = 0, lastFlip = 1;
  for (let i = 0; i <= n; i += step) {
    const j = Math.min(n, i + step);
    const dx = samples[j].x - samples[i].x;
    const dy = samples[j].y - samples[i].y;
    if (Math.hypot(dx, dy) > 1.2) {
      let a = (Math.atan2(dy, dx) * 180) / Math.PI;
      let fl = 1;
      if (a > 90 || a < -90) { a += a > 0 ? -180 : 180; fl = -1; }
      lastAngle = a; lastFlip = fl;
    }
    angles.push(f(lastAngle));
    flips.push(lastFlip);
    kts.push(f(i / n));
  }
  if (kts[kts.length - 1] < 0.9999) { kts.push(1); angles.push(f(lastAngle)); flips.push(lastFlip); }
  return { angles, flips, kts };
}

/** knot channel có bước NHẢY (flip đổi dấu) — chèn cặp ε tại mốc đổi. */
function snapEmit(kts: number[], vals: number[], fmt: (v: number) => string): string {
  const outV: string[] = [], outK: number[] = [];
  for (let i = 0; i < kts.length; i++) {
    if (i > 0 && vals[i] !== vals[i - 1]) {
      outV.push(fmt(vals[i - 1])); outK.push(f(Math.max(0, kts[i] - 0.003)));
      outV.push(fmt(vals[i])); outK.push(f(kts[i]));
    } else {
      outV.push(fmt(vals[i])); outK.push(f(kts[i]));
    }
  }
  if (outK[0] > 0.0001) { outK.unshift(0); outV.unshift(outV[outV.length - 1]); }
  if (outK[outK.length - 1] < 0.9999) { outK.push(1); outV.push(outV[outV.length - 1]); }
  return `values="${outV.join(";")}" keyTimes="${outK.join(";")}"`;
}

function linEmit(kts: number[], vals: number[], fmt: (v: number) => string): string {
  return `values="${vals.map(v => fmt(v)).join(";")}" keyTimes="${kts.map(k => f(k)).join(";")}"`;
}

function dragonRiders(show: Show): string {
  const total = show.total;
  const segLens = show.phases.map(p => (p.kind === "move" || p.kind === "walk" || p.kind === "slide") ? dist(p.from, p.to) : 0);
  const bounds = [0, ...show.phases.map(p => p.t1)];

  // polyline của đầu: vertices + cumulative distances
  const verts = show.vertices;
  const cum: number[] = [0];
  for (let i = 1; i < verts.length; i++) cum.push(cum[i - 1] + dist(verts[i - 1], verts[i]));
  const pointAtDist = (d: number): Pt => {
    const dd = Math.max(0, Math.min(show.pathLen, d));
    let i = 1;
    while (i < cum.length && cum[i] < dd) i++;
    const k = (dd - cum[i - 1]) / Math.max(0.0001, cum[i] - cum[i - 1]);
    return lerpPt(verts[i - 1], verts[i], k);
  };
  const distAt = (t: number) => {
    const T = show.phases[show.phases.length - 1].t1;
    const tt = ((t % T) + T) % T;
    let d = 0;
    for (let i = 0; i < show.phases.length; i++) {
      const ph = show.phases[i];
      if (tt <= ph.t1) {
        if (ph.kind === "move" || ph.kind === "walk" || ph.kind === "slide") {
          const k = (tt - ph.t0) / Math.max(0.0001, ph.t1 - ph.t0);
          return d + segLens[i] * k;
        }
        return d;
      }
      d += segLens[i];
    }
    return d;
  };

  const OPACITY = `<animate attributeName="opacity" ${linEmit(
    bounds.map(b => b / total), bounds.map(b => f(opacityAt(show.phases, b))), v => String(f(v)))} dur="${f(total)}s" repeatCount="indefinite"/>`;

  // heading của đầu — từ vector vận tốc (sample mỗi 0.3s)
  const headPts: Pt[] = [], headTs: number[] = [];
  for (let t = 0; t <= total; t += 0.3) { headPts.push(pointAtDist(distAt(t))); headTs.push(t); }
  const { angles, flips, kts: hKts } = headingChannel(headPts, 0.3, 0.3);
  const ROT = `<animateTransform attributeName="transform" type="rotate" ${linEmit(hKts, angles, v => String(f(v)))} dur="${f(total)}s" repeatCount="indefinite"/>`;
  const FLIP = `<animateTransform attributeName="transform" type="scale" ${snapEmit(hKts, flips, v => `${f(v)} 1`)} dur="${f(total)}s" repeatCount="indefinite"/>`;

  // đuôi lửa — dài theo len của từng pha spray
  const flameKnots: { t: number; v: number }[] = [{ t: 0, v: 1 }];
  for (const ph of show.phases) {
    if (ph.kind !== "spray" || !ph.len) continue;
    const ext = 0.9 + (ph.len - 1) * 0.62;
    flameKnots.push({ t: ph.t0 - 0.002, v: 1 });
    flameKnots.push({ t: ph.t0 + 0.1, v: ext });
    flameKnots.push({ t: ph.t1 - 0.002, v: ext });
    flameKnots.push({ t: ph.t1, v: 1 });
  }
  const FLAME = `<animateTransform attributeName="transform" type="scale" ${emitChannel(
    flameKnots, total, v => `${f(v)} 1`)} dur="${f(total)}s" repeatCount="indefinite"/>`;

  /** rider trễ arcDelay px dọc path chung — keyPoints = (d(t) - arcDelay)/len */
  const rider = (arcDelay: number, content: string) => {
    const kps = bounds.map(b => f(Math.max(0, Math.min(1, (distAt(b) - arcDelay) / show.pathLen))));
    const kts = bounds.map(b => f(b / total));
    return `<g><animateMotion dur="${f(total)}s" repeatCount="indefinite" path="${show.pathD}" keyPoints="${kps.join(";")}" keyTimes="${kts.join(";")}" calcMode="linear"/>` +
      `<g transform="scale(${DRAGON.scale})">${OPACITY}${content}</g></g>`;
  };

  const segs: string[] = [];

  // thân: 12 đốt — MỖI ĐỐT 2 LỚP: viền mint (r+1.2) trước, fill đậm sau →
  // silhouette mint LIÊN MẠCH bao toàn chuỗi (không đường chia đốt)
  const radii = [11, 10.6, 10.2, 9.7, 9.2, 8.6, 8, 7.4, 6.8, 6.2, 5.6, 5];
  for (let k = radii.length; k >= 1; k--) {
    const r = radii[k - 1];
    segs.push(rider(k * 7,
      `<circle r="${r + 1.2}" fill="${DRAGON.shade}" stroke="${DRAGON.line}" stroke-width="1.5"/>`));
  }
  for (let k = radii.length; k >= 1; k--) {
    const r = radii[k - 1];
    const spike = k <= 7
      ? `<polygon points="0,${-r + 1} 3.4,${-r - 5.5} -3.4,${-r - 5.5}" fill="${DRAGON.spike}" opacity="0.95"/>`
      : "";
    segs.push(rider(k * 7,
      `${spike}<circle r="${r}" fill="${k % 2 === 0 ? DRAGON.body : DRAGON.shade}"/>`));
  }

  // cánh trên đốt 3
  segs.push(rider(3 * 7,
    `<g opacity="0.5"><path d="M2 -8 C -10 -24 -27 -30 -35 -24 C -27 -19 -17 -13 -5 -7 Z" fill="${DRAGON.shade}">` +
    `<animateTransform attributeName="transform" type="rotate" values="-13 0 -5;13 0 -5;-13 0 -5" dur="0.72s" repeatCount="indefinite"/></path></g>` +
    `<path d="M0 -7 C -11 -20 -25 -24 -31 -18 C -23 -13 -13 -9 -4 -5 Z" fill="${DRAGON.body}" stroke="${DRAGON.line}" stroke-width="1.4">` +
    `<animateTransform attributeName="transform" type="rotate" values="11 0 -5;-15 0 -5;11 0 -5" dur="0.72s" repeatCount="indefinite"/></path>` +
    `<g transform="translate(2,2)"><path d="M0 0 C 5 -1 9 -3 13 -2 C 10 1 9 3 5 4 Z" fill="#F97316" opacity="0.9"/></g>`
  ));

  // đuôi: spade lớn trên đốt cuối (trễ nhất)
  segs.push(rider(13 * 7,
    `<circle r="5" fill="${DRAGON.shade}" stroke="${DRAGON.line}" stroke-width="1.5"/>` +
    `<polygon points="-2,-4 -10,-7 -7,0 -10,7 -2,4" fill="${DRAGON.spike}" opacity="0.95"/>` +
    `<polygon points="-1,-2.5 -7,-4 -4,0 -7,4 -1,2.5" fill="${DRAGON.glow}" opacity="0.8"/>`
  ));

  // ĐẦU — xoay theo vector heading; râu + lửa
  const head = `
  <path d="M-4 -9 C -12 -17 -22 -18 -28 -12" stroke="${DRAGON.line}" stroke-width="2.4" fill="none" stroke-linecap="round"/>
  <path d="M0 -10 C -6 -18 -14 -20 -20 -17" stroke="${DRAGON.line}" stroke-width="1.8" fill="none" stroke-linecap="round"/>
  <g>
    <animateTransform attributeName="transform" type="rotate" values="-5 24 0;6 24 0;-5 24 0" dur="2.4s" repeatCount="indefinite"/>
    <path d="M26 -2 C 34 -8 44 -6 52 -12 C 56 -15 60 -14 63 -16" stroke="${DRAGON.line}" stroke-width="1.7" fill="none" stroke-linecap="round"/>
    <path d="M27 3 C 35 7 43 5 50 10 C 54 13 58 12 62 14" stroke="${DRAGON.line}" stroke-width="1.3" fill="none" stroke-linecap="round" opacity="0.8"/>
  </g>
  <path d="M-7 -7 L 3 -9" stroke="${DRAGON.line}" stroke-width="1.6" stroke-linecap="round"/>
  <polygon points="5,5 20,9 7,14" fill="${DRAGON.shade}" stroke="${DRAGON.line}" stroke-width="1.6"/>
  <polygon points="9,7 12,9.5 10,10" fill="${DRAGON.glow}" opacity="0.9"/>
  <polygon points="14,8.2 17,10.5 15,11" fill="${DRAGON.glow}" opacity="0.9"/>
  <polygon points="6,-8 24,-3 24,3 6,6" fill="${DRAGON.body}" stroke="${DRAGON.line}" stroke-width="1.8"/>
  <ellipse cx="-4" cy="0" rx="15" ry="11.5" fill="${DRAGON.body}" stroke="${DRAGON.line}" stroke-width="1.8"/>
  <polygon points="10,0 22,1 22,2.5 10,3.5" fill="${DRAGON.line}"/>
  <circle cx="20" cy="0" r="1" fill="${DRAGON.line}"/>
  <circle cx="-2" cy="-4" r="3" fill="${DRAGON.glow}"/>
  <circle cx="-1" cy="-4.9" r="1.05" fill="${DRAGON.line}"/>
  <g>
    ${FLAME}
    <g>
      <animateTransform attributeName="transform" type="translate" values="28 2;31 2;28 2" dur="0.5s" repeatCount="indefinite"/>
      <path d="M0 0 C 8 -2 14 -6 20 -5 C 15 -1 14 3 9 6 C 5 7 2 4 0 0 Z" fill="#F97316" opacity="0.95">
        <animate attributeName="opacity" values="0.95;0.55;0.95" dur="0.4s" repeatCount="indefinite"/>
      </path>
      <path d="M0 0 C 6 -1 10 -3 14 -3 C 11 1 10 3 6 5 C 3 5 1 3 0 0 Z" fill="#FDE68A">
        <animate attributeName="opacity" values="1;0.5;1" dur="0.35s" repeatCount="indefinite"/>
      </path>
    </g>
  </g>`;
  segs.push(rider(0, head));

  return segs.join("");
}

function emitChannel(knots: { t: number; v: number }[], total: number, fmt: (v: number) => string): string {
  const T = total;
  const sorted = [...knots].sort((a, b) => a.t - b.t);
  const seen = new Set<string>();
  const pts: { kt: number; v: number }[] = [];
  for (const k of sorted) {
    const lt = (((k.t % T) + T) % T) / T;
    const key = lt.toFixed(4);
    if (seen.has(key)) continue;
    seen.add(key);
    pts.push({ kt: f(lt), v: k.v });
  }
  if (pts[0].kt > 0.0001) pts.unshift({ kt: 0, v: pts[pts.length - 1].v });
  if (pts[pts.length - 1].kt < 0.9999) pts.push({ kt: 1, v: pts[0].v });
  return `values="${pts.map(p => fmt(p.v)).join(";")}" keyTimes="${pts.map(p => f(p.kt)).join(";")}"`;
}

function opacityAt(phases: Phase[], t: number): number {
  const T = phases[phases.length - 1].t1;
  const tt = ((t % T) + T) % T;
  for (const ph of phases) {
    if (tt >= ph.t0 && tt <= ph.t1) {
      const k = (tt - ph.t0) / Math.max(0.0001, ph.t1 - ph.t0);
      if (ph.kind === "fadeout") return 1 - k;
      if (ph.kind === "fadein") return k;
      if (ph.kind === "slide") return 0;
      return 1;
    }
  }
  return 1;
}

export function renderDragon(cal: Calendar, theme: Theme, opts: { showCount?: boolean; seed?: number } = {}): string {
  const { width, height, cols } = gridSize(cal);
  const total = cal.weeks.flat().reduce((s2, d) => s2 + d.count, 0);
  const seed = opts.seed ?? 20261025;
  const show = buildShow(cal, seed);
  const parts: string[] = [];

  // ===== bảng contribution =====
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < 7; r++) {
      const day = cal.weeks[c]?.[r];
      if (!day) continue;                          // tuần rének
      const x = GEO.marginX + c * GEO.pitch;
      const y = GEO.top + r * GEO.pitch;
      if (day.level === 4) {
        parts.push(`<rect x="${x - 2.5}" y="${y - 2.5}" width="${GEO.cell + 5}" height="${GEO.cell + 5}" rx="4.5" fill="${theme.glow}" opacity="0.16"/>`);
      }
      parts.push(
        `<rect x="${x}" y="${y}" width="${GEO.cell}" height="${GEO.cell}" rx="2" fill="${day.level === 0 ? theme.empty : theme.levels[day.level - 1]}"/>`
      );
    }
    const first = cal.weeks[c][0]?.date ?? "";
    if (first.endsWith("-01") && c < cols - 1) {
      parts.push(`<text x="${GEO.marginX + c * GEO.pitch}" y="${GEO.top - 9}" font-family="${FONT}" font-size="9" fill="${theme.label}">${MONTHS[Number(first.slice(5, 7)) - 1]}</text>`);
    }
  }

  if (opts.showCount !== false) {
    parts.push(`<text x="${width - GEO.marginX}" y="${GEO.top - 9}" text-anchor="end" font-family="${FONT}" font-size="10" fill="${theme.label}">${total} contributions — last year</text>`);
  }

  // ===== vòng ignition trắng khi lửa chạm ô =====
  const T = show.total;
  for (const b of show.burns) {
    const start = ((b.t % T) + T) % T;
    const a = f(start / T);
    const b2 = f(Math.min(0.999, (start + 0.07) / T));
    const c2 = f(Math.min(0.999, (start + 0.3) / T));
    parts.push(
      `<circle cx="${f(b.x)}" cy="${f(b.y)}" r="5" fill="none" stroke="${DRAGON.glow}" stroke-width="2" opacity="0">` +
      `<animate attributeName="opacity" values="0;0;0.85;0;0" keyTimes="0;${a};${b2};${c2};1" dur="${f(T)}s" repeatCount="indefinite"/>` +
      `<animate attributeName="r" values="4;4;9;12;4" keyTimes="0;${a};${b2};${c2};1" dur="${f(T)}s" repeatCount="indefinite"/></circle>`
    );
  }

  parts.push(dragonRiders(show));

  const pad = GEO.pitch * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-pad} ${-pad} ${width + pad * 2} ${height + pad * 2}" width="100%" fill="none" role="img" aria-label="Contribution dragon — ${total} contributions in the last year">${parts.join("")}</svg>`;
}
