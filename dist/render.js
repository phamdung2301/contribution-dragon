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
const lerpPt = (a, b, k) => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k });
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
/** góc hướng vector (độ): E=0, S=90, W=180, N=-90 */
const angleDeg = (d) => (Math.atan2(d.y, d.x) * 180) / Math.PI;
/** DeltaAngle — hiệu góc ngắn nhất (quay từ prev đến next theo cung ≤ 180°) */
const deltaAngle = (prev, next) => {
    let d = (next - prev) % 360;
    if (d > 180)
        d -= 360;
    if (d < -180)
        d += 360;
    return d;
};
/** góc tiếp theo liên tục (unwrap — chống quay vòng 350° thay vì 10°) */
const unwrapAngle = (prev, next) => prev + deltaAngle(prev, next);
export function buildShow(cal, seed) {
    const rnd = mulberry32(seed);
    const { width, cols, rows } = gridSize(cal);
    const center = { x: width / 2, y: GEO.top + (rows * GEO.pitch) / 2 };
    const inGrid = (p) => p.x >= GEO.marginX - GEO.pitch * 0.6 && p.x <= GEO.marginX + (cols - 1) * GEO.pitch + GEO.pitch * 0.6 &&
        p.y >= GEO.top - GEO.pitch * 0.6 && p.y <= GEO.top + 6 * GEO.pitch + GEO.pitch * 0.6;
    const bright = [];
    for (let c = 0; c < cols; c++)
        for (let r = 0; r < 7; r++) {
            const day = cal.weeks[c]?.[r];
            if (day && day.level >= 2)
                bright.push({ p: cellCenter(c, r), count: day.count });
        }
    const pool0 = bright.length >= 4 ? bright : (() => {
        const any_ = [];
        for (let c = 0; c < cols; c += 2)
            for (let r = 0; r < 7; r += 2)
                any_.push({ p: cellCenter(c, r), count: 1 });
        return any_;
    })();
    const SESSIONS = 3;
    const plans = [];
    let cur = center;
    for (let s = 0; s < SESSIONS; s++) {
        const pool = shuffle(pool0.filter(b => dist(b.p, cur) > GEO.pitch * 3), rnd).slice(0, 10);
        const target = (pool[0] ?? pool0[s % pool0.length]).p;
        // hướng phun: 8 HƯỚNG (4 chính + 4 chéo) — theo hướng MIỆNG rồng.
        // Mỗi hướng phải có toàn tầm lửa 1–3 ô trong bảng: hướng nào mà cone
        // chạm boundary của bảng thì BỎ, không phun ra ngoài.
        const allDirs = shuffle([
            { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 },
            { x: 1, y: 1 }, { x: 1, y: -1 }, { x: -1, y: 1 }, { x: -1, y: -1 },
        ], rnd);
        const sprayFits = (d) => {
            for (let k = -1; k <= 3; k++) {
                const q = { x: target.x + d.x * GEO.pitch * k, y: target.y + d.y * GEO.pitch * k };
                if (!inGrid(q))
                    return false;
            }
            return true;
        };
        const d0 = allDirs.find(sprayFits) ?? allDirs.find(d => inGrid({ x: target.x - d.x * GEO.pitch, y: target.y - d.y * GEO.pitch })) ?? allDirs[0];
        const origin = { x: target.x - d0.x * GEO.pitch, y: target.y - d0.y * GEO.pitch };
        const ox = origin.x - center.x, oy = origin.y - center.y;
        const ol = Math.max(1, Math.hypot(ox, oy));
        const arrival = { x: origin.x + (ox / ol) * GEO.pitch * 1.4, y: origin.y + (oy / ol) * GEO.pitch * 1.4 };
        // SWEEP-IN: vào từ biên gần arrival → vòng săn 10–14 ô trong bảng → origin
        const want = 11 + Math.floor(rnd() * 4);
        const clampIn = (pt) => ({
            x: Math.min(width - GEO.marginX + GEO.pitch * 0.5, Math.max(GEO.marginX - GEO.pitch * 0.5, pt.x)),
            y: Math.min(GEO.top + 6 * GEO.pitch + GEO.pitch * 0.5, Math.max(GEO.top - GEO.pitch * 0.5, pt.y)),
        });
        const entryC = Math.max(0, Math.min(cols - 1, Math.round((arrival.x - GEO.marginX - GEO.cell / 2) / GEO.pitch)));
        const entryR = Math.max(0, Math.min(6, Math.round((arrival.y - GEO.top - GEO.cell / 2) / GEO.pitch)));
        const entry = cellCenter(entryC, entryR);
        const into = { x: center.x - entry.x, y: center.y - entry.y };
        const il = Math.max(1, Math.hypot(into.x, into.y));
        const intoDir = { x: into.x / il, y: into.y / il };
        const perpIn = { x: -intoDir.y, y: intoDir.x };
        const away = clampIn({
            x: entry.x + intoDir.x * GEO.pitch * (6 + rnd() * 3) + perpIn.x * (rnd() - 0.5) * GEO.pitch * 4,
            y: entry.y + intoDir.y * GEO.pitch * (6 + rnd() * 3) + perpIn.y * (rnd() - 0.5) * GEO.pitch * 4,
        });
        const bez = (p0, pc, p2, n) => {
            const out = [];
            for (let i = 0; i <= n; i++) {
                const k = i / n;
                out.push(clampIn(lerpPt(lerpPt(p0, pc, k), lerpPt(pc, p2, k), k)));
            }
            return out;
        };
        const hopN = (a, b) => Math.max(3, Math.round(dist(a, b) / (GEO.pitch * 1.3)));
        const leg1 = bez(entry, clampIn({
            x: (entry.x + away.x) / 2 + perpIn.x * (rnd() - 0.5) * GEO.pitch * 4,
            y: (entry.y + away.y) / 2 + perpIn.y * (rnd() - 0.5) * GEO.pitch * 4,
        }), away, hopN(entry, away));
        const leg2 = bez(away, clampIn({
            x: (away.x + origin.x) / 2 + perpIn.x * (rnd() - 0.5) * GEO.pitch * 2.5,
            y: (away.y + origin.y) / 2 + perpIn.y * (rnd() - 0.5) * GEO.pitch * 2.5,
        }), origin, hopN(away, origin));
        const trail = [...leg1.slice(1), ...leg2];
        const order = [d0, ...shuffle(allDirs.filter(d => d !== d0), rnd)];
        const dirCount = 1 + Math.floor(rnd() * 4); // xoay ngẫu nhiên 1–4 hướng
        const dirs = order.slice(0, dirCount).map(d => ({ d, len: 1 + Math.floor(rnd() * 3), rot: angleDeg(d) }));
        const walks = [];
        let wp = { ...origin };
        const nSteps = 4 + Math.floor(rnd() * 4); // 4–7 bước — xuất hiện lâu hơn
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
    // ===== phát phases — rotEnd là góc ABSOLUTE unwrap liên tục =====
    const phases = [];
    const burns = [];
    const vertices = [plans[0].arrival];
    let t = 0;
    let rot = 0; // góc liên tục — khởi đầu hướng phải
    const push = (kind, from, to, dur, rotTarget) => {
        if (rotTarget === undefined) {
            if ((kind === "move" || kind === "walk" || kind === "slide") && dist(from, to) > 1) {
                rot = unwrapAngle(rot, angleDeg({ x: to.x - from.x, y: to.y - from.y }));
            }
        }
        else {
            rot = unwrapAngle(rot, rotTarget);
        }
        phases.push({ t0: t, t1: t + dur, from, to, kind, visible: kind !== "slide" && kind !== "fadeout", rotEnd: rot });
        t += dur;
        if (kind === "move" || kind === "walk" || kind === "slide") {
            const lastV = vertices[vertices.length - 1];
            if (lastV.x !== to.x || lastV.y !== to.y)
                vertices.push(to);
        }
    };
    plans.forEach((plan, si) => {
        let spinAngle = 0;
        const doSpin = rnd() < 0.55;
        const spinDur = doSpin ? 0.85 : 0.35;
        const spinStart = spinAngle;
        if (doSpin)
            spinAngle += 360 * (rnd() < 0.5 ? 1 : -1);
        phases.push({ t0: t, t1: t + spinDur, from: plan.arrival, to: plan.arrival, kind: "fadein", visible: true,
            rotEnd: rot, spinEnd: spinAngle, spinning: doSpin });
        t += spinDur;
        let prev = plan.arrival;
        for (const g of plan.glide) {
            push("move", prev, g, 0.3);
            prev = g;
        }
        for (const { d, len, rot: rAbs } of plan.dirs) {
            push("rotate", plan.origin, plan.origin, 0.14, rAbs);
            push("spray", plan.origin, plan.origin, 0.9 + len * 0.22, rAbs);
            phases[phases.length - 1].len = len;
            for (let k = 1; k <= len; k++) {
                const cell = { x: plan.origin.x + d.x * GEO.pitch * k, y: plan.origin.y + d.y * GEO.pitch * k };
                if (!inGrid(cell))
                    continue;
                const col = Math.round((cell.x - GEO.marginX - GEO.cell / 2) / GEO.pitch);
                const row = Math.round((cell.y - GEO.top - GEO.cell / 2) / GEO.pitch);
                const day = cal.weeks[col]?.[row];
                if (!day)
                    continue;
                burns.push({ col, row, x: cell.x, y: cell.y, level: day.level, t: t - (0.9 + len * 0.22) + 0.25 + (k - 1) * 0.3 });
            }
        }
        const lastEffectEnd = Math.max(t, ...burns.map(b => b.t + 0.9)); // flame 0.5s + flash/fade 0.4s
        push("hold", plan.origin, plan.origin, 1.2 + Math.max(0, lastEffectEnd - t));
        let wp = plan.origin;
        for (const stepTo of plan.walks) {
            push("walk", wp, stepTo, 0.65);
            wp = stepTo;
        }
        push("fadeout", wp, wp, 0.35);
        const nextArrival = plans[(si + 1) % plans.length].arrival;
        push("slide", wp, nextArrival, 0.45 + dist(wp, nextArrival) / 320);
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
// sampling
// ============================================================
/** Vị trí ĐẦU rồng tại thời điểm t — nội suy tuyến tính trong phase. */
function headPositionAt(phases, t) {
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
/** góc xoay của đầu tại t — nội suy theo phase (move/walk: xoay dần theo hướng đi) */
function scalarRotAt(phases, t) {
    const T = phases[phases.length - 1].t1;
    const tt = ((t % T) + T) % T;
    for (let i = 0; i < phases.length; i++) {
        const ph = phases[i];
        if (tt >= ph.t0 && tt <= ph.t1) {
            const prev = phases[(i - 1 + phases.length) % phases.length].rotEnd;
            const k = (tt - ph.t0) / Math.max(0.0001, ph.t1 - ph.t0);
            if ((ph.kind === "move" || ph.kind === "walk") && dist(ph.from, ph.to) > 1) {
                const target = angleDeg({ x: ph.to.x - ph.from.x, y: ph.to.y - ph.from.y });
                const unwrapped = prev + deltaAngle(prev, target);
                return prev + (unwrapped - prev) * k; // xoay mượt dần theo hướng đi
            }
            if (ph.kind === "rotate") {
                return prev + (ph.rotEnd - prev) * k; // xoay mượt trong pha aim
            }
            return ph.rotEnd;
        }
    }
    return 0;
}
/** motion cho đốt trễ arcDelay: đi trên path chung với keyPoints dịch arc */
function segMotionAt(arcDelay, show) {
    const bounds = [0, ...show.phases.map(p => p.t1)];
    const kps = bounds.map(b => f(Math.max(0, Math.min(1, (distAt(show, b) - arcDelay) / show.pathLen))));
    const kts = bounds.map(b => f(b / show.total));
    return `path="${show.pathD}" keyPoints="${kps.join(";")}" keyTimes="${kts.join(";")}" calcMode="linear"`;
}
function distAt(show, t) {
    const segLens = show.phases.map(p => (p.kind === "move" || p.kind === "walk" || p.kind === "slide") ? dist(p.from, p.to) : 0);
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
}
/** góc tiếp tuyến của path tại arc distance d (độ) */
function tangentAtDist(show, d) {
    const verts = show.vertices;
    const cum = [0];
    for (let i = 1; i < verts.length; i++)
        cum.push(cum[i - 1] + dist(verts[i - 1], verts[i]));
    const dd = Math.max(0, Math.min(show.pathLen, d));
    let i = 1;
    while (i < cum.length && cum[i] < dd)
        i++;
    return angleDeg({ x: verts[i].x - verts[i - 1].x, y: verts[i].y - verts[i - 1].y });
}
// ============================================================
// dragon assembly — arc-offset chain + full-360° vector head
// ============================================================
function dragonRiders(show) {
    const total = show.total;
    const bounds = [0, ...show.phases.map(p => p.t1)];
    // polyline của đầu + cumulative distances
    const verts = show.vertices;
    const cum = [0];
    for (let i = 1; i < verts.length; i++)
        cum.push(cum[i - 1] + dist(verts[i - 1], verts[i]));
    const pointAtDist = (d) => {
        const dd = Math.max(0, Math.min(show.pathLen, d));
        let i = 1;
        while (i < cum.length && cum[i] < dd)
            i++;
        const k = (dd - cum[i - 1]) / Math.max(0.0001, cum[i] - cum[i - 1]);
        return lerpPt(verts[i - 1], verts[i], k);
    };
    /** hướng tiếp tuyến tại arc distance d (độ) */
    const tangentAtDist = (d) => {
        const dd = Math.max(0, Math.min(show.pathLen, d));
        let i = 1;
        while (i < cum.length && cum[i] < dd)
            i++;
        return angleDeg({ x: verts[i].x - verts[i - 1].x, y: verts[i].y - verts[i - 1].y });
    };
    const distAtT = (t) => distAt(show, t);
    const OPACITY = `<animate attributeName="opacity" ${emitChannel(bounds.map(b => ({ t: b, v: opacityAt(show.phases, b) })), total, v => String(f(v)))} dur="${f(total)}s" repeatCount="indefinite"/>`;
    // ĐẦU: xoay full-360° — mũi luôn chỉ theo vector di chuyển/phun
    const rotSamples = [], rotKts = [];
    for (let t = 0; t <= total; t += 0.15) {
        rotSamples.push(f(scalarRotAt(show.phases, t)));
        rotKts.push(f(t / total));
    }
    const ROT = `<animateTransform attributeName="transform" type="rotate" ${linEmit(rotKts, rotSamples, v => String(f(v)))} dur="${f(total)}s" repeatCount="indefinite"/>`;
    // đuôi lửa
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
    /** rider trễ arcDelay px trên path chung */
    const rider = (arcDelay, content) => {
        const kps = bounds.map(b => f(Math.max(0, Math.min(1, (distAtT(b) - arcDelay) / show.pathLen))));
        const kts = bounds.map(b => f(b / total));
        return `<g><animateMotion dur="${f(total)}s" repeatCount="indefinite" path="${show.pathD}" keyPoints="${kps.join(";")}" keyTimes="${kts.join(";")}" calcMode="linear"/>` +
            `<g transform="scale(${DRAGON.scale})">${OPACITY}${content}</g></g>`;
    };
    /** rider đốt có XOAY theo tiếp tuyến path tại vị trí của nó */
    const orientedRider = (arcDelay, baseAngle, content) => {
        const kps = bounds.map(b => f(Math.max(0, Math.min(1, (distAtT(b) - arcDelay) / show.pathLen))));
        const kts = bounds.map(b => f(b / total));
        const oKts = [], oVals = [];
        let prevAng = null;
        for (let t = 0; t <= total; t += 0.5) {
            const tang = tangentAtDist(Math.max(0, distAtT(t) - arcDelay)) + baseAngle;
            const ang = prevAng === null ? tang : prevAng + deltaAngle(prevAng, tang);
            prevAng = ang;
            oKts.push(f(t / total));
            oVals.push(f(ang));
        }
        if (oKts[oKts.length - 1] < 0.9999) {
            oKts.push(1);
            oVals.push(oVals[oVals.length - 1]);
        }
        return `<g><animateMotion dur="${f(total)}s" repeatCount="indefinite" path="${show.pathD}" keyPoints="${kps.join(";")}" keyTimes="${kts.join(";")}" calcMode="linear"/>` +
            `<g transform="scale(${DRAGON.scale})">${OPACITY}<g><animateTransform attributeName="transform" type="rotate" ${linEmit(oKts, oVals, v => String(f(v)))} dur="${f(total)}s" repeatCount="indefinite"/>${content}</g></g></g>`;
    };
    const segs = [];
    // thân: 12 đốt — MỖI ĐỐT XOAY theo tiếp tuyến + 2 lớp silhouette mint
    const radii = [11, 10.6, 10.2, 9.7, 9.2, 8.6, 8, 7.4, 6.8, 6.2, 5.6, 5];
    for (let k = radii.length; k >= 1; k--) {
        const r = radii[k - 1];
        segs.push(orientedRider(k * 7, 90, `<circle r="${r + 1.2}" fill="${DRAGON.shade}" stroke="${DRAGON.line}" stroke-width="1.5"/><circle r="${r}" fill="${DRAGON.body}"/>`));
    }
    for (let k = radii.length; k >= 1; k--) {
        const r = radii[k - 1];
        const spike = k <= 7
            ? `<polygon points="0,${-r + 1} 3.4,${-r - 5.5} -3.4,${-r - 5.5}" fill="${DRAGON.spike}" opacity="0.95"/>`
            : "";
        segs.push(orientedRider(k * 7, 90, `${spike}<circle r="${r}" fill="${k % 2 === 0 ? DRAGON.body : DRAGON.shade}"/>`));
    }
    // cánh trên đốt 3
    segs.push(orientedRider(3 * 7, 0, `<g opacity="0.5"><path d="M2 -8 C -10 -24 -27 -30 -35 -24 C -27 -19 -17 -13 -5 -7 Z" fill="${DRAGON.shade}">` +
        `<animateTransform attributeName="transform" type="rotate" values="-13 0 -5;13 0 -5;-13 0 -5" dur="0.72s" repeatCount="indefinite"/></path></g>` +
        `<path d="M0 -7 C -11 -20 -25 -24 -31 -18 C -23 -13 -13 -9 -4 -5 Z" fill="${DRAGON.body}" stroke="${DRAGON.line}" stroke-width="1.4">` +
        `<animateTransform attributeName="transform" type="rotate" values="11 0 -5;-15 0 -5;11 0 -5" dur="0.72s" repeatCount="indefinite"/></path>`));
    // đuôi: spade hướng NGƯỢC chiều bay (+180)
    segs.push(orientedRider(13 * 7, 180, `<polygon points="-3,-5 -12,-8 -8,0 -12,8 -3,5" fill="${DRAGON.spike}" opacity="0.95"/>` +
        `<polygon points="-2,-3 -8,-4.5 -5,0 -8,4.5 -2,3" fill="${DRAGON.glow}" opacity="0.8"/>`));
    // ĐẦU — ROT full-360 đưa MŨI đúng hướng di chuyển/phun
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
    // đầu = node xoay riêng: ROT full-360 đưa MŨI theo vector heading
    // (di chuyển + hướng phun) — miệng luôn đúng hướng ngắm
    segs.push(`<g><animateMotion ${segMotionAt(0, show)}/>` +
        `<g transform="scale(${DRAGON.scale})">${OPACITY}<g>${ROT}${head}</g></g></g>`);
    return segs.join("");
}
function linEmit(kts, vals, fmt) {
    return `values="${vals.map(v => fmt(v)).join(";")}" keyTimes="${kts.map(k => f(k)).join(";")}"`;
}
function snapEmit(kts, vals, fmt) {
    const outV = [], outK = [];
    for (let i = 0; i < kts.length; i++) {
        if (i > 0 && vals[i] !== vals[i - 1]) {
            outV.push(fmt(vals[i - 1]));
            outK.push(f(Math.max(0, kts[i] - 0.003)));
            outV.push(fmt(vals[i]));
            outK.push(f(kts[i]));
        }
        else {
            outV.push(fmt(vals[i]));
            outK.push(f(kts[i]));
        }
    }
    if (outK[0] > 0.0001) {
        outK.unshift(0);
        outV.unshift(outV[outV.length - 1]);
    }
    if (outK[outK.length - 1] < 0.9999) {
        outK.push(1);
        outV.push(outV[outV.length - 1]);
    }
    return `values="${outV.join(";")}" keyTimes="${outK.join(";")}"`;
}
export function renderDragon(cal, theme, opts = {}) {
    const { width, height, cols } = gridSize(cal);
    const total = cal.weeks.flat().reduce((s2, d) => s2 + d.count, 0);
    const seed = opts.seed ?? 20261025;
    const show = buildShow(cal, seed);
    const parts = [];
    // ===== bảng contribution — cell state machine: INTACT → BURNING → SCORCHED =====
    const T = show.total;
    const burnMap = new Map();
    for (const b of show.burns) {
        const key = `${b.col},${b.row}`;
        if (!burnMap.has(key))
            burnMap.set(key, b); // lần đốt sớm nhất thắng
    }
    for (let c = 0; c < cols; c++) {
        for (let r = 0; r < 7; r++) {
            const day = cal.weeks[c]?.[r];
            if (!day)
                continue;
            const x = GEO.marginX + c * GEO.pitch;
            const y = GEO.top + r * GEO.pitch;
            const burn = burnMap.get(`${c},${r}`);
            const orig = day.level === 0 ? theme.empty : theme.levels[day.level - 1];
            // INTACT → (t) lửa bốc cháy 0.5s (giữ màu) → chớp trắng → mòn về SCORCHED 0.4s
            const iS = burn ? burn.t / T : 0;
            const iM = burn ? Math.min(0.999, (burn.t + 0.5) / T) : 0;
            const iF = burn ? Math.min(0.999, (burn.t + 0.62) / T) : 0;
            const iE = burn ? Math.min(0.999, (burn.t + 1.02) / T) : 0;
            if (day.level === 4) {
                const glowFade = burn
                    ? `<animate attributeName="opacity" values="0.16;0.16;0.1;0;0" keyTimes="0;${f(iS)};${f(iM)};${f(iE)};1" dur="${f(T)}s" repeatCount="indefinite"/>`
                    : "";
                parts.push(`<rect x="${x - 2.5}" y="${y - 2.5}" width="${GEO.cell + 5}" height="${GEO.cell + 5}" rx="4.5" fill="${theme.glow}" opacity="0.16">${glowFade}</rect>`);
            }
            const fillAnim = burn
                ? `<animate attributeName="fill" values="${orig};${orig};${orig};#FFFFFF;${theme.scorch};${theme.scorch}" keyTimes="0;${f(iS)};${f(iM)};${f(iF)};${f(iE)};1" dur="${f(T)}s" repeatCount="indefinite"/>`
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
    // ===== BURNING: biểu tượng lửa cháy trên ô trong 0.5s + vòng ignition =====
    for (const b of show.burns) {
        const start = ((b.t % T) + T) % T;
        // flame icon trên ô: 0.5s với flicker + phóng to
        const kts = [0];
        const ops = [0];
        const scs = ["0.4 0.4"];
        const steps = 6;
        for (let i = 0; i <= steps; i++) {
            const tt = start + (i / steps) * 0.5;
            kts.push(f(Math.min(0.999, tt / T)));
            ops.push(f(i === 0 ? 0.5 : (i % 2 === 1 ? 1 : 0.65)));
            const sc = 0.8 + (i / steps) * 1.3 + (i % 2 === 1 ? 0.15 : 0);
            scs.push(`${f(sc)} ${f(sc)}`);
        }
        kts.push(1);
        ops.push(0);
        scs.push("0.4 0.4");
        parts.push(`<g transform="translate(${f(b.x)},${f(b.y)})" opacity="0">` +
            `<animate attributeName="opacity" values="${ops.join(";")}" keyTimes="${kts.join(";")}" dur="${f(T)}s" repeatCount="indefinite"/>` +
            `<circle r="6.5" fill="#F97316" opacity="0.35"/>` +
            `<g><animateTransform attributeName="transform" type="scale" values="${scs.join(";")}" keyTimes="${kts.join(";")}" dur="${f(T)}s" repeatCount="indefinite"/>` +
            `<path d="M0 3.4 C -3.4 1.2 -2.2 -2.2 0 -4.4 C 1.1 -2.2 3.3 -1.1 2.9 1.1 C 2.6 2.6 1.1 3.4 0 3.4 Z" fill="#F97316"/>` +
            `<path d="M0 3.4 C -1.3 2 -0.9 0.4 0 -0.9 C 0.9 0.2 1.5 1.1 1.1 2.2 C 0.9 2.8 0.4 3.4 0 3.4 Z" fill="#FDE68A"/>` +
            `</g></g>`);
        // vòng ignition trắng
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
