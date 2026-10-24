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
const rotFor = (d) => (d.y === 1 ? 90 : d.y === -1 ? -90 : 0);
const flipFor = (d) => (d.x === -1 ? -1 : 1);
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
            if (!day || day.level < 2)
                continue; // tuần rének (GitHub calendar) có thể < 7 ngày
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
        const allDirs = shuffle([{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 0, y: -1 }], rnd);
        const d0 = allDirs.find(d => {
            const o = { x: target.x - d.x * GEO.pitch, y: target.y - d.y * GEO.pitch };
            return o.x >= GEO.marginX - GEO.pitch * 0.6 && o.x <= width - GEO.marginX + GEO.pitch * 0.6 &&
                o.y >= GEO.top - GEO.pitch * 0.6 && o.y <= GEO.top + 6 * GEO.pitch + GEO.pitch * 0.6;
        }) ?? allDirs[0];
        const origin = { x: target.x - d0.x * GEO.pitch, y: target.y - d0.y * GEO.pitch };
        const ox = origin.x - center.x, oy = origin.y - center.y;
        const ol = Math.max(1, Math.hypot(ox, oy));
        const arrival = { x: origin.x + (ox / ol) * GEO.pitch * 1.4, y: origin.y + (oy / ol) * GEO.pitch * 1.4 };
        // SWEEP-IN: vào từ biên gần arrival → quét VÒNG LỚN qua tâm bảng
        // (2 cung bezier: entry → away → origin) → tổng 11–14 ô, dài hơn thân
        // rồng (91px) nên chuỗi duỗi ra đẹp; kết thúc CHÍNH XÁC tại origin.
        const want = 11 + Math.floor(rnd() * 4); // 11–14 điểm
        const clampIn = (pt) => ({
            x: Math.min(width - GEO.marginX + GEO.pitch * 0.5, Math.max(GEO.marginX - GEO.pitch * 0.5, pt.x)),
            y: Math.min(GEO.top + 6 * GEO.pitch + GEO.pitch * 0.5, Math.max(GEO.top - GEO.pitch * 0.5, pt.y)),
        });
        const entryC = Math.max(0, Math.min(cols - 1, Math.round((arrival.x - GEO.marginX - GEO.cell / 2) / GEO.pitch)));
        const entryR = Math.max(0, Math.min(6, Math.round((arrival.y - GEO.top - GEO.cell / 2) / GEO.pitch)));
        const entry = cellCenter(entryC, entryR);
        const away = clampIn({
            x: 2 * center.x - origin.x + (rnd() - 0.5) * GEO.pitch * 3,
            y: 2 * center.y - origin.y + (rnd() - 0.5) * GEO.pitch * 3,
        });
        const bez = (p0, pc, p2, n) => {
            const out = [];
            for (let i = 0; i <= n; i++) {
                const k = i / n;
                out.push(lerpPt(lerpPt(p0, pc, k), lerpPt(pc, p2, k), k));
            }
            return out;
        };
        const d1 = { x: away.x - entry.x, y: away.y - entry.y };
        const l1 = Math.max(1, Math.hypot(d1.x, d1.y));
        const c1 = clampIn({
            x: entry.x + d1.x / l1 * l1 * 0.5 + (-d1.y / l1) * GEO.pitch * (2 + rnd() * 2.5),
            y: entry.y + d1.y / l1 * l1 * 0.5 + (d1.x / l1) * GEO.pitch * (2 + rnd() * 2.5),
        });
        const leg1 = bez(entry, c1, away, Math.ceil(want / 2));
        const d2 = { x: origin.x - away.x, y: origin.y - away.y };
        const l2 = Math.max(1, Math.hypot(d2.x, d2.y));
        const c2 = clampIn({
            x: away.x + d2.x / l2 * l2 * 0.5 + (-d2.y / l2) * GEO.pitch * (2 + rnd() * 2.5),
            y: away.y + d2.y / l2 * l2 * 0.5 + (d2.x / l2) * GEO.pitch * (2 + rnd() * 2.5),
        });
        const leg2 = bez(away, c2, origin, Math.floor(want / 2));
        const trail = [...leg1.slice(0, -1), ...leg2]; // nối 2 cung, away dùng 1 lần
        const order = [d0, ...shuffle(allDirs.filter(d => d !== d0), rnd)];
        const dirCount = 1 + Math.floor(rnd() * 4); // xoay ngẫu nhiên 1–4 hướng
        const dirs = order.slice(0, dirCount).map(d => ({ d, len: 1 + Math.floor(rnd() * 3), rot: rotFor(d), flip: flipFor(d) }));
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
        plans.push({ glide: trail, origin, arrival, dirs, walks });
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
    plans.forEach((plan, si) => {
        let spinAngle = 0;
        const doSpin = rnd() < 0.55;
        const spinDur = doSpin ? 0.85 : 0.35;
        const spinStart = spinAngle;
        if (doSpin)
            spinAngle += 360 * (rnd() < 0.5 ? 1 : -1);
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
                if (!inGrid(cell))
                    continue;
                const col = Math.round((cell.x - GEO.marginX - GEO.cell / 2) / GEO.pitch);
                const row = Math.round((cell.y - GEO.top - GEO.cell / 2) / GEO.pitch);
                const day = cal.weeks[col]?.[row];
                if (!day)
                    continue;
                burns.push({ col, row, x: cell.x, y: cell.y, level: day.level, t: t - (0.7 + len * 0.18) + 0.2 + (k - 1) * 0.24 });
            }
        }
        const lastEffectEnd = Math.max(t, ...burns.map(b => b.t + 0.85)); // flame 0.5s + fade 0.35s
        push("hold", plan.origin, plan.origin, 0.5 + Math.max(0, lastEffectEnd - t), rot, flip);
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
// vector head + chain simulation (rope constraint)
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
/**
 * Mô phỏng chuỗi đuôi: seg[0] = đầu (vector vị trí + heading), seg[k] bám
 * seg[k-1] với khoảng cách cố định (rope constraint) — đốt sau nối đuôi
 * vào đốt trước theo đúng quỹ đạo lịch sử. Khởi đầu tất cả stacked tại
 * điểm xuất phát → thân "mọc ra" khi đầu bay; snap ở vòng lặp xảy ra trong
 * lúc tàng hình nên không thấy.
 */
export function simulateChain(phases, total, dt, spacing, segCount) {
    const n = Math.floor(total / dt); // không vượt quá total — keyTimes phải đơn điệu
    const head = [];
    for (let i = 0; i <= n; i++)
        head.push(headPositionAt(phases, i * dt));
    head.push(headPositionAt(phases, total)); // sample cuối đúng mốc kết thúc chu kỳ
    const chain = [head];
    for (let k = 1; k < segCount; k++) {
        const leader = chain[k - 1];
        const seg = [{ ...leader[0] }];
        for (let i = 1; i <= n; i++) {
            const L = leader[i];
            const Lprev = leader[i - 1];
            const headMoved = Math.hypot(L.x - Lprev.x, L.y - Lprev.y) > 0.4;
            const c = seg[i - 1];
            if (!headMoved) {
                seg.push({ ...c });
                continue;
            } // đầu đứng yên → thân GIỮ thế (không cuộn)
            const dx = c.x - L.x, dy = c.y - L.y;
            const len = Math.hypot(dx, dy);
            if (len < 0.001) {
                seg.push({ ...L });
                continue;
            }
            seg.push({ x: L.x + (dx / len) * spacing, y: L.y + (dy / len) * spacing });
        }
        chain.push(seg);
    }
    return { samples: chain, dt, n };
}
/** Hướng đầu (độ, chuẩn hóa [-90,90]) + lật gương — từ vector vận tốc. */
function headingChannel(samples, dt, sampleEvery) {
    const n = samples.length - 1;
    const step = Math.max(1, Math.round(sampleEvery / dt));
    const angles = [], flips = [], kts = [];
    let lastAngle = 0, lastFlip = 1;
    for (let i = 0; i <= n; i += step) {
        const j = Math.min(n, i + step);
        const dx = samples[j].x - samples[i].x;
        const dy = samples[j].y - samples[i].y;
        if (Math.hypot(dx, dy) > 1.2) {
            let a = (Math.atan2(dy, dx) * 180) / Math.PI;
            let fl = 1;
            if (a > 90 || a < -90) {
                a += a > 0 ? -180 : 180;
                fl = -1;
            }
            lastAngle = a;
            lastFlip = fl;
        }
        angles.push(f(lastAngle));
        flips.push(lastFlip);
        kts.push(f(i / n));
    }
    if (kts[kts.length - 1] < 0.9999) {
        kts.push(1);
        angles.push(f(lastAngle));
        flips.push(lastFlip);
    }
    return { angles, flips, kts };
}
/** knot channel có bước NHẢY (flip đổi dấu) — chèn cặp ε tại mốc đổi. */
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
function linEmit(kts, vals, fmt) {
    return `values="${vals.map(v => fmt(v)).join(";")}" keyTimes="${kts.map(k => f(k)).join(";")}"`;
}
/** path + keyTimes/keyPoints cho MỘT đốt từ sample vị trí của nó. */
function segMotion(samples, dt, total) {
    const pts = [], times = [];
    for (let i = 0; i < samples.length; i++) {
        const p = samples[i];
        if (i === 0 || dist(p, samples[i - 1]) > 0.02) {
            pts.push(p);
            times.push(i * dt);
        }
    }
    // ép mốc cuối = đúng total: sample cuối có thời gian mod total về 0 sẽ làm
    // keyTimes không đơn điệu → animateMotion vô hiệu → đầu rồng đứng yên
    pts[pts.length - 1] = samples[samples.length - 1];
    times[times.length - 1] = total;
    if (pts.length === 1)
        pts.push({ x: pts[0].x + 0.01, y: pts[0].y });
    let d = `M ${f(pts[0].x)} ${f(pts[0].y)}`;
    let len = 0;
    const cum = [0];
    for (let i = 1; i < pts.length; i++) {
        len += dist(pts[i - 1], pts[i]);
        cum.push(len);
        d += ` L ${f(pts[i].x)} ${f(pts[i].y)}`;
    }
    if (len < 0.01)
        len = 0.01;
    const ktsRaw = times.map(tt => f((((tt % total) + total) % total) / total));
    const kps = cum.map(c => f(Math.min(1, c / len)));
    const kts = [];
    for (const k of ktsRaw)
        if (kts.length === 0 || k > kts[kts.length - 1])
            kts.push(k);
    if (kts[kts.length - 1] < 1) {
        kts[kts.length - 1] = 1;
    } // mốc cuối = 1
    if (kts[0] !== 0) {
        kts.unshift(0);
        kps.unshift(kps[0]);
    }
    return `path="${d}" keyPoints="${kps.join(";")}" keyTimes="${kts.join(";")}" calcMode="linear"`;
}
// ============================================================
// dragon assembly
// ============================================================
function dragonRiders(show, seed) {
    const total = show.total;
    const dt = 0.15;
    const spacing = 7; // < bán kính đốt → các đốt CHỐT nhau thành thân liền
    const segCount = 14; // đầu + 12 đốt thân + đốt đuôi
    const chainSim = simulateChain(show.phases, total, dt, spacing, segCount);
    const chain = chainSim.samples;
    const bounds = [0, ...show.phases.map(p => p.t1)];
    const OPACITY = `<animate attributeName="opacity" ${linEmit(bounds.map(b => b / total), bounds.map(b => f(opacityAt(show.phases, b))), v => String(f(v)))} dur="${f(total)}s" repeatCount="indefinite"/>`;
    // heading của đầu — từ vector vận tốc (định nghĩa vector của đầu)
    const { angles, flips, kts: hKts } = headingChannel(chain[0], dt, 0.3);
    const ROT = `<animateTransform attributeName="transform" type="rotate" ${linEmit(hKts, angles, v => String(f(v)))} dur="${f(total)}s" repeatCount="indefinite"/>`;
    const FLIP = `<animateTransform attributeName="transform" type="scale" ${snapEmit(hKts, flips, v => `${f(v)} 1`)} dur="${f(total)}s" repeatCount="indefinite"/>`;
    // đuôi lửa — dài theo len của từng pha spray
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
    const segs = [];
    // thân: đốt 1..9 — circle KHÔNG viền (chồng khít thành thân liền) + gai hướng lên
    const radii = [11, 10.6, 10.1, 9.5, 8.8, 8.1, 7.4, 6.7, 6, 5.4, 4.8, 4.3];
    for (let k = radii.length; k >= 1; k--) {
        const r = radii[k - 1];
        const spike = k <= 5
            ? `<polygon points="0,${-r + 1} 3.4,${-r - 5.5} -3.4,${-r - 5.5}" fill="${DRAGON.spike}" opacity="0.95"/>`
            : "";
        segs.push(`<g><animateMotion ${segMotion(chain[k], dt, total)}/>` +
            `<g transform="scale(${DRAGON.scale})">${OPACITY}${spike}<circle r="${r}" fill="${k % 2 === 0 ? DRAGON.body : DRAGON.shade}"/></g></g>`);
    }
    // cánh trên đốt 3
    segs.push(`<g><animateMotion ${segMotion(chain[3], dt, total)}/>` +
        `<g transform="scale(${DRAGON.scale})">${OPACITY}` +
        `<g opacity="0.5"><path d="M2 -8 C -10 -24 -27 -30 -35 -24 C -27 -19 -17 -13 -5 -7 Z" fill="${DRAGON.shade}">` +
        `<animateTransform attributeName="transform" type="rotate" values="-13 0 -5;13 0 -5;-13 0 -5" dur="0.72s" repeatCount="indefinite"/></path></g>` +
        `<path d="M0 -7 C -11 -20 -25 -24 -31 -18 C -23 -13 -13 -9 -4 -5 Z" fill="${DRAGON.body}" stroke="${DRAGON.line}" stroke-width="1.4">` +
        `<animateTransform attributeName="transform" type="rotate" values="11 0 -5;-15 0 -5;11 0 -5" dur="0.72s" repeatCount="indefinite"/></path></g></g>`);
    // đuôi: lá spade + 2 gai phụ trên đốt cuối
    segs.push(`<g><animateMotion ${segMotion(chain[segCount - 1], dt, total)}/>` +
        `<g transform="scale(${DRAGON.scale})">${OPACITY}` +
        `<polygon points="-2,-4 -9,-7 -6,0 -9,7 -2,4" fill="${DRAGON.spike}" opacity="0.95"/>` +
        `<polygon points="-1,-2.5 -5,-3.5 -3,0 -5,3.5 -1,2.5" fill="${DRAGON.glow}" opacity="0.75"/>` +
        `</g></g>`);
    // ĐẦU — xoay theo vector heading; lửa dài theo pha spray (group lồng nhau)
    const headContent = `
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
    segs.push(`<g><animateMotion ${segMotion(chain[0], dt, total)}/>` +
        `<g transform="scale(${DRAGON.scale})">${OPACITY}<g>${ROT}<g>${FLIP}${headContent}</g></g></g></g>`);
    return segs.join("");
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
export function renderDragon(cal, theme, opts = {}) {
    const { width, height, cols } = gridSize(cal);
    const total = cal.weeks.flat().reduce((s2, d) => s2 + d.count, 0);
    const seed = opts.seed ?? 20261025;
    const show = buildShow(cal, seed);
    const parts = [];
    // ===== bảng contribution =====
    for (let c = 0; c < cols; c++) {
        for (let r = 0; r < 7; r++) {
            const day = cal.weeks[c]?.[r];
            if (!day)
                continue; // tuần rének
            const x = GEO.marginX + c * GEO.pitch;
            const y = GEO.top + r * GEO.pitch;
            if (day.level === 4) {
                parts.push(`<rect x="${x - 2.5}" y="${y - 2.5}" width="${GEO.cell + 5}" height="${GEO.cell + 5}" rx="4.5" fill="${theme.glow}" opacity="0.16"/>`);
            }
            parts.push(`<rect x="${x}" y="${y}" width="${GEO.cell}" height="${GEO.cell}" rx="2" fill="${day.level === 0 ? theme.empty : theme.levels[day.level - 1]}"/>`);
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
        parts.push(`<circle cx="${f(b.x)}" cy="${f(b.y)}" r="5" fill="none" stroke="${DRAGON.glow}" stroke-width="2" opacity="0">` +
            `<animate attributeName="opacity" values="0;0;0.85;0;0" keyTimes="0;${a};${b2};${c2};1" dur="${f(T)}s" repeatCount="indefinite"/>` +
            `<animate attributeName="r" values="4;4;9;12;4" keyTimes="0;${a};${b2};${c2};1" dur="${f(T)}s" repeatCount="indefinite"/></circle>`);
    }
    parts.push(dragonRiders(show, seed));
    const pad = GEO.pitch * 2;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-pad} ${-pad} ${width + pad * 2} ${height + pad * 2}" width="100%" fill="none" role="img" aria-label="Contribution dragon — ${total} contributions in the last year">${parts.join("")}</svg>`;
}
