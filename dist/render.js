import { cellCenter, GEO, gridSize, MONTHS } from "./route.js";
const FONT = "ui-monospace,SFMono-Regular,'JetBrains Mono',Consolas,monospace";
const DRAGON = {
    scale: 1.22,
    body: "#0B3B33",
    shade: "#062E26",
    line: "#00F5D4",
    spike: "#00F5D4",
    glow: "#E6FFFB",
};
const dist = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
const f = (n) => Math.round(n * 1000) / 1000;
function mulberry32(seed) {
    return () => {
        seed |= 0;
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
function shuffle(arr, rnd) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rnd() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}
const rotFor = (d) => (d.y === 1 ? 90 : d.y === -1 ? -90 : 0);
const flipFor = (d) => (d.x === -1 ? -1 : 1);
function buildShow(cal, seed) {
    const rnd = mulberry32(seed);
    const { width, cols, rows } = gridSize(cal);
    const center = { x: width / 2, y: GEO.top + (rows * GEO.pitch) / 2 };
    const inGrid = (p) => p.x >= GEO.marginX - GEO.pitch * 0.6 && p.x <= GEO.marginX + (cols - 1) * GEO.pitch + GEO.pitch * 0.6 &&
        p.y >= GEO.top - GEO.pitch * 0.6 && p.y <= GEO.top + 6 * GEO.pitch + GEO.pitch * 0.6;
    const bright = [];
    for (let c = 0; c < cols; c++)
        for (let r = 0; r < 7; r++) {
            const day = cal.weeks[c][r];
            if (day.level >= 2)
                bright.push({ p: cellCenter(c, r), count: day.count });
        }
    const pool0 = bright.length >= 4 ? bright : (() => {
        const any_ = [];
        for (let c = 0; c < cols; c += 2)
            for (let r = 0; r < 7; r += 2)
                any_.push({ p: cellCenter(c, r), count: 1 });
        return any_;
    })();
    const SESSIONS = 2;
    const plans = [];
    let cur = center;
    for (let s = 0; s < SESSIONS; s++) {
        // ô sáng ngẫu nhiên (ưu tiên count cao, cách vị trí hiện tại ≥ 3 ô)
        const pool = shuffle(pool0.filter(b => dist(b.p, cur) > GEO.pitch * 3), rnd).slice(0, 10);
        const target = (pool[0] ?? pool0[s % pool0.length]).p;
        // hướng phun: ô MŨI NẮM (origin = ô trước ô sáng) phải nằm trong bảng ±1 ô
        const allDirs = shuffle([{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 0, y: -1 }], rnd);
        const d0 = allDirs.find(d => {
            const o = { x: target.x - d.x * GEO.pitch, y: target.y - d.y * GEO.pitch };
            return o.x >= GEO.marginX - GEO.pitch * 0.6 && o.x <= width - GEO.marginX + GEO.pitch * 0.6 &&
                o.y >= GEO.top - GEO.pitch * 0.6 && o.y <= GEO.top + 6 * GEO.pitch + GEO.pitch * 0.6;
        }) ?? allDirs[0];
        const origin = { x: target.x - d0.x * GEO.pitch, y: target.y - d0.y * GEO.pitch };
        // điểm hiện ra: NGOÀI boundary 1.4 ô
        const ox = origin.x - center.x, oy = origin.y - center.y;
        const ol = Math.max(1, Math.hypot(ox, oy));
        const arrival = { x: origin.x + (ox / ol) * GEO.pitch * 1.4, y: origin.y + (oy / ol) * GEO.pitch * 1.4 };
        // 4 hướng xoay: bắt đầu từ hướng chọn rồi quay lần lượt
        const order = [d0, ...shuffle(allDirs.filter(d => d !== d0), rnd)];
        const dirCount = 1 + Math.floor(rnd() * 4); // xoay ngẫu nhiên 1–4 hướng
        const dirs = order.slice(0, dirCount).map(d => ({ d, len: 1 + Math.floor(rnd() * 3), rot: rotFor(d), flip: flipFor(d) }));
        // đi bộ ngẫu nhiên 2–4 bước (có thể ra ngoài boundary 1 ô)
        const walks = [];
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
        plans.push({ origin, arrival, dirs, walks });
        cur = walks[walks.length - 1] ?? origin;
    }
    // ===== phát phases =====
    const phases = [];
    const burns = [];
    const vertices = [plans[0].arrival];
    let t = 0;
    let rot = 0, flip = 1;
    const push = (kind, from, to, dur, rotEnd = rot, flipEnd = flip) => {
        phases.push({ t0: t, t1: t + dur, from, to, kind, visible: kind !== "slide" && kind !== "fadeout", rotEnd, flipEnd });
        t += dur;
        if (kind === "move" || kind === "walk" || kind === "slide") {
            const lastV = vertices[vertices.length - 1];
            if (lastV.x !== to.x || lastV.y !== to.y)
                vertices.push(to);
        }
    };
    let spinAngle = 0;
    plans.forEach((plan, si) => {
        // grand entrance: ~55% lần hiện ra có xoay tròn 360° (hướng ngẫu nhiên)
        const doSpin = rnd() < 0.55;
        const spinDur = doSpin ? 0.85 : 0.35;
        const spinStart = spinAngle;
        if (doSpin)
            spinAngle += 360 * (rnd() < 0.5 ? 1 : -1);
        phases.push({ t0: t, t1: t + spinDur, from: plan.arrival, to: plan.arrival, kind: "fadein", visible: true,
            rotEnd: rot, flipEnd: flip, spinEnd: spinAngle, spinning: doSpin });
        t += spinDur;
        push("move", plan.arrival, plan.origin, Math.max(0.8, dist(plan.arrival, plan.origin) / 110), rot, flip);
        for (const { d, len, rot: rEnd, flip: fEnd } of plan.dirs) {
            push("rotate", plan.origin, plan.origin, 0.14, rEnd, fEnd);
            push("spray", plan.origin, plan.origin, 0.7 + len * 0.18, rEnd, fEnd);
            phases[phases.length - 1].len = len;
            // các ô sáng trong tầm lửa: bay màu tuần tự, gần origin trước
            for (let k = 1; k <= len; k++) {
                const cell = { x: plan.origin.x + d.x * GEO.pitch * k, y: plan.origin.y + d.y * GEO.pitch * k };
                if (!inGrid(cell))
                    continue;
                const col = Math.round((cell.x - GEO.marginX - GEO.cell / 2) / GEO.pitch);
                const row = Math.round((cell.y - GEO.top - GEO.cell / 2) / GEO.pitch);
                const day = cal.weeks[col]?.[row];
                if (!day || day.level === 0)
                    continue;
                burns.push({ col, row, x: cell.x, y: cell.y, level: day.level, t: t - (0.7 + len * 0.18) + 0.2 + (k - 1) * 0.24 });
            }
        }
        const lastEffectEnd = Math.max(t, ...burns.map(b => b.t + 0.9)); // ô xa nhất mất màu xong
        push("hold", plan.origin, plan.origin, 0.5 + Math.max(0, lastEffectEnd - t), rot, flip); // +0.5s sau đó
        let wp = plan.origin;
        for (const stepTo of plan.walks) {
            const dx = stepTo.x - wp.x;
            const nFlip = Math.abs(dx) > 2 ? (dx > 0 ? 1 : -1) : flip;
            push("walk", wp, stepTo, 0.55, rot, nFlip);
            flip = nFlip;
            wp = stepTo;
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
// ============================================================
// sampling
// ============================================================
function distanceAt(show, segLens, t) {
    const T = show.total;
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
}
function opacityAt(phases, t) {
    const T = phases[phases.length - 1].t1;
    const tt = ((t % T) + T) % T;
    for (const ph of phases) {
        if (tt >= ph.t0 && tt <= ph.t1) {
            const k = (tt - ph.t0) / Math.max(0.0001, ph.t1 - ph.t0);
            if (ph.kind === "fadeout")
                return 1 - k;
            if (ph.kind === "fadein")
                return k;
            if (ph.kind === "slide")
                return 0;
            return 1;
        }
    }
    return 1;
}
/** knot list (t, giá trị) cho kênh có bước NHẢY (flip) — chèn cặp ε tại mốc đổi giá trị. */
function snapChannel(phases, pickEnd) {
    const knots = [{ t: 0, v: pickEnd(phases[0]) }];
    for (let i = 0; i < phases.length; i++) {
        const v = pickEnd(phases[i]);
        const prev = knots[knots.length - 1].v;
        if (v !== prev) {
            knots.push({ t: phases[i].t0 - 0.001, v: prev });
            knots.push({ t: phases[i].t0, v });
        }
    }
    return knots;
}
function emitChannel(knots, total, fmt) {
    const T = total;
    const sorted = [...knots].sort((a, b) => a.t - b.t);
    const seen = new Set();
    const pts = [];
    for (const k of sorted) {
        const lt = (((k.t % T) + T) % T) / T;
        const key = lt.toFixed(4);
        if (seen.has(key))
            continue;
        seen.add(key);
        pts.push({ kt: f(lt), v: k.v });
    }
    if (pts[0].kt > 0.0001)
        pts.unshift({ kt: 0, v: pts[pts.length - 1].v });
    if (pts[pts.length - 1].kt < 0.9999)
        pts.push({ kt: 1, v: pts[0].v });
    return `values="${pts.map(p => fmt(p.v)).join(";")}" keyTimes="${pts.map(p => f(p.kt)).join(";")}"`;
}
// ============================================================
// dragon
// ============================================================
function dragonRiders(show) {
    const segLens = show.phases.map(p => (p.kind === "move" || p.kind === "walk" || p.kind === "slide") ? dist(p.from, p.to) : 0);
    const total = show.total;
    const bounds = [0, ...show.phases.map(p => p.t1)];
    // opacity — fade mượt theo phase (linear tại ranh giới là đúng)
    const OPACITY = `<animate attributeName="opacity" ${emitChannel(bounds.map(b => ({ t: b, v: opacityAt(show.phases, b) })), total, v => String(f(v)))} dur="${f(total)}s" repeatCount="indefinite"/>`;
    // xoay — quay mượt trong pha rotate (0.14s)
    const ROT = `<animateTransform attributeName="transform" type="rotate" ${emitChannel(bounds.map(b => ({ t: b, v: f(scalarRotAt(show.phases, b)) })), total, v => String(f(v)))} dur="${f(total)}s" repeatCount="indefinite"/>`;
    // lật ngang — NHẢY qua squish 0 tại mốc đổi hướng
    const FLIP = `<animateTransform attributeName="transform" type="scale" ${emitChannel(snapChannel(show.phases, p => p.flipEnd), total, v => `${f(v)} 1`)} dur="${f(total)}s" repeatCount="indefinite"/>`;
    // đuôi lửa — dài ra theo len của từng pha spray (1–3 ô)
    const flameKnots = [{ t: 0, v: 1 }];
    for (const ph of show.phases) {
        if (ph.kind !== "spray" || !ph.len)
            continue;
        const ext = 0.9 + (ph.len - 1) * 0.62;
        flameKnots.push({ t: ph.t0 - 0.002, v: 1 });
        flameKnots.push({ t: ph.t0 + 0.1, v: ext });
        flameKnots.push({ t: ph.t1 - 0.002, v: ext });
        flameKnots.push({ t: ph.t1, v: 1 });
    }
    const FLAME = `<animateTransform attributeName="transform" type="scale" ${emitChannel(flameKnots, total, v => `${f(v)} 1`)} dur="${f(total)}s" repeatCount="indefinite"/>`;
    // spin-in — xoay tròn 360° khi biến tới (grand entrance)
    const SPIN = `<animateTransform attributeName="transform" type="rotate" ${emitChannel(bounds.map(b => ({ t: b, v: f(scalarSpinAt(show.phases, b)) })), total, v => String(f(v)))} dur="${f(total)}s" repeatCount="indefinite"/>`;
    // rider chính — keyframes lấy tại ranh giới phase
    const kts = [], kps = [];
    const seen = new Set();
    for (const b of bounds) {
        const lt = (((b % total) + total) % total) / total;
        const key = lt.toFixed(4);
        if (seen.has(key))
            continue;
        seen.add(key);
        kts.push(f(lt));
        kps.push(f(Math.min(1, distanceAt(show, segLens, b) / show.pathLen)));
    }
    kts.sort((a, b) => a - b);
    const sortedPairs = kts.map(kt => ({ kt, kp: kps[kts.indexOf(kt)] })).sort((a, b) => a.kt - b.kt);
    if (sortedPairs[0].kt > 0.0001)
        sortedPairs.unshift({ kt: 0, kp: sortedPairs[sortedPairs.length - 1].kp });
    if (sortedPairs[sortedPairs.length - 1].kt < 0.9999)
        sortedPairs.push({ kt: 1, kp: sortedPairs[0].kp });
    // ===== sprite rigid =====
    const body = `
  <path d="M -6 -9
           C -20 -15 -30 -4 -44 -10
           C -56 -15 -64 -5 -78 -13
           L -88 -16
           L -80 -6
           C -68 -1 -58 -5 -46 1
           C -33 6 -19 -1 -6 8 Z"
        fill="${DRAGON.body}" stroke="${DRAGON.line}" stroke-width="1.7"/>
  <path d="M -86 -16 C -94 -20 -98 -18 -103 -22 C -97 -13 -97 -11 -90 -6 Z" fill="${DRAGON.spike}" opacity="0.9"/>
  <polygon points="-16,-12 -12,-18 -8,-11" fill="${DRAGON.spike}" opacity="0.95"/>
  <polygon points="-30,-10 -26,-16 -22,-9" fill="${DRAGON.spike}" opacity="0.9"/>
  <polygon points="-46,-12 -42,-18 -38,-11" fill="${DRAGON.spike}" opacity="0.85"/>
  <polygon points="-62,-12 -58,-18 -54,-11" fill="${DRAGON.spike}" opacity="0.8"/>
  <path d="M -10 6 C -22 2 -32 6 -44 0 C -34 -1 -22 -3 -10 3 Z" fill="${DRAGON.glow}" opacity="0.25"/>
  <g opacity="0.5">
    <path d="M -14 -8 C -22 -24 -36 -30 -44 -25 C -38 -19 -28 -13 -16 -7 Z" fill="${DRAGON.shade}">
      <animateTransform attributeName="transform" type="rotate" values="-13 -12 -6;13 -12 -6;-13 -12 -6" dur="0.72s" repeatCount="indefinite"/>
    </path>
  </g>
  <path d="M -12 -7 C -20 -19 -32 -22 -38 -17 C -31 -12 -22 -8 -13 -5 Z" fill="${DRAGON.body}" stroke="${DRAGON.line}" stroke-width="1.4">
    <animateTransform attributeName="transform" type="rotate" values="11 -11 -5;-15 -11 -5;11 -11 -5" dur="0.72s" repeatCount="indefinite"/>
  </path>`;
    // đầu v2: râu dài đu đưa, lông mày, răng, sừng kép
    const head = `
  <path d="M-4 -9 C -12 -17 -22 -18 -28 -12" stroke="${DRAGON.line}" stroke-width="2.4" fill="none" stroke-linecap="round"/>
  <path d="M0 -10 C -6 -18 -14 -20 -20 -17" stroke="${DRAGON.line}" stroke-width="1.8" fill="none" stroke-linecap="round"/>
  <path d="M24 -1 C 30 -3 34 0 38 -2" stroke="${DRAGON.line}" stroke-width="1.3" fill="none" opacity="0.8"/>
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
    <animateTransform attributeName="transform" type="scale" ${emitChannel((() => {
        const knots = [{ t: 0, v: 1 }];
        for (const ph of show.phases) {
            if (ph.kind !== "spray" || !ph.len)
                continue;
            const ext = 0.9 + (ph.len - 1) * 0.62;
            knots.push({ t: ph.t0 - 0.002, v: 1 });
            knots.push({ t: ph.t0 + 0.1, v: ext });
            knots.push({ t: ph.t1 - 0.002, v: ext });
            knots.push({ t: ph.t1, v: 1 });
        }
        return knots;
    })(), total, v => `${f(v)} 1`)} dur="${f(total)}s" repeatCount="indefinite"/>
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
    // một rider duy nhất mang cả con rồng
    return `<g><animateMotion dur="${f(total)}s" repeatCount="indefinite" path="${show.pathD}" keyPoints="${sortedPairs.map(p => f(p.kp)).join(";")}" keyTimes="${sortedPairs.map(p => f(p.kt)).join(";")}" calcMode="linear"/><g transform="scale(${DRAGON.scale})">${OPACITY}<g>${ROT}<g>${SPIN}<g>${FLIP}${body}${head}</g></g></g></g></g>`;
}
function scalarSpinAt(phases, t) {
    const T = phases[phases.length - 1].t1;
    const tt = ((t % T) + T) % T;
    for (let i = 0; i < phases.length; i++) {
        const ph = phases[i];
        if (tt >= ph.t0 && tt <= ph.t1) {
            const prev = phases[(i - 1 + phases.length) % phases.length].spinEnd ?? 0;
            const end = ph.spinEnd ?? prev;
            const k = (tt - ph.t0) / Math.max(0.0001, ph.t1 - ph.t0);
            return ph.spinning ? prev + (end - prev) * k : end;
        }
    }
    return 0;
}
function scalarRotAt(phases, t) {
    const T = phases[phases.length - 1].t1;
    const tt = ((t % T) + T) % T;
    for (let i = 0; i < phases.length; i++) {
        const ph = phases[i];
        if (tt >= ph.t0 && tt <= ph.t1) {
            const prev = phases[(i - 1 + phases.length) % phases.length].rotEnd;
            const k = (tt - ph.t0) / Math.max(0.0001, ph.t1 - ph.t0);
            return ph.kind === "rotate" ? prev + (ph.rotEnd - prev) * k : ph.rotEnd;
        }
    }
    return 0;
}
export function renderDragon(cal, theme, opts = {}) {
    const { width, height, cols } = gridSize(cal);
    const total = cal.weeks.flat().reduce((s, d) => s + d.count, 0);
    const seed = opts.seed ?? 20261025;
    const show = buildShow(cal, seed);
    const parts = [];
    // ===== bảng contribution — ô bị rồng phun sẽ TỪ TỪ mất màu (gần trước, xa sau) =====
    const burnMap = new Map();
    for (const b of show.burns) {
        const key = `${b.col},${b.row}`;
        if (!burnMap.has(key))
            burnMap.set(key, b); // lần đốt sớm nhất thắng
    }
    const FADE = 0.9; // mỗi ô mòn màu trong 0.9s
    for (let c = 0; c < cols; c++) {
        for (let r = 0; r < 7; r++) {
            const day = cal.weeks[c][r];
            const x = GEO.marginX + c * GEO.pitch;
            const y = GEO.top + r * GEO.pitch;
            const burn = burnMap.get(`${c},${r}`);
            const T = show.total;
            const orig = day.level === 0 ? theme.empty : theme.levels[day.level - 1];
            const iS = burn ? burn.t / T : 0;
            const iE = burn ? Math.min(0.999, (burn.t + FADE) / T) : 0;
            if (day.level === 4) {
                const glowFade = burn
                    ? `<animate attributeName="opacity" values="0.16;0.16;0;0" keyTimes="0;${f(iS)};${f(iE)};1" dur="${f(T)}s" repeatCount="indefinite"/>`
                    : "";
                parts.push(`<rect x="${x - 2.5}" y="${y - 2.5}" width="${GEO.cell + 5}" height="${GEO.cell + 5}" rx="4.5" fill="${theme.glow}" opacity="0.16">${glowFade}</rect>`);
            }
            const fillAnim = burn && day.level > 0
                ? `<animate attributeName="fill" values="${orig};${orig};${theme.empty};${theme.empty}" keyTimes="0;${f(iS)};${f(iE)};1" dur="${f(T)}s" repeatCount="indefinite"/>`
                : "";
            parts.push(`<rect x="${x}" y="${y}" width="${GEO.cell}" height="${GEO.cell}" rx="2" fill="${orig}">${fillAnim}</rect>`);
        }
        const first = cal.weeks[c][0]?.date ?? "";
        if (first.endsWith("-01") && c < cols - 1) {
            parts.push(`<text x="${GEO.marginX + c * GEO.pitch}" y="${GEO.top - 9}" font-family="${FONT}" font-size="9" fill="${theme.label}">${MONTHS[Number(first.slice(5, 7)) - 1]}</text>`);
        }
    }
    if (opts.showCount !== false) {
        parts.push(`<text x="${width - GEO.marginX}" y="${GEO.top - 9}" text-anchor="end" font-family="${FONT}" font-size="10" fill="${theme.label}">${total} contributions — last year</text>`);
    }
    // ===== vòng ignition trắng ngắn khi lửa chạm ô (đánh dấu khoảnh khắc cháy) =====
    const T = show.total;
    for (const b of show.burns) {
        const start = ((b.t % T) + T) % T;
        const a = f(start / T);
        const b2 = f(Math.min(0.999, (start + 0.07) / T));
        const c2 = f(Math.min(0.999, (start + 0.3) / T));
        parts.push(`<circle cx="${f(b.x)}" cy="${f(b.y)}" r="5" fill="none" stroke="${DRAGON.glow}" stroke-width="2" opacity="0">` +
            `<animate attributeName="opacity" values="0;0;0.85;0;0" keyTimes="0;${a};${b2};${c2};1" dur="${f(T)}s" repeatCount="indefinite"/>` +
            `<animate attributeName="r" values="4;4;9;12;4" keyTimes="0;${a};${b2};${c2};1" dur="${f(T)}s" repeatCount="indefinite"/></circle>`);
    }
    parts.push(dragonRiders(show));
    const pad = GEO.pitch * 2;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-pad} ${-pad} ${width + pad * 2} ${height + pad * 2}" width="100%" fill="none" role="img" aria-label="Contribution dragon — ${total} contributions in the last year">${parts.join("")}</svg>`;
}
