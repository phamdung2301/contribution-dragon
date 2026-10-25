import { cellCenter, GEO, gridSize, MONTHS } from "./route.js";
const FONT = "ui-monospace,SFMono-Regular,'JetBrains Mono',Consolas,monospace";
const DRAGON = {
    scale: 1.1,
    body: "#0B3B33",
    shade: "#062E26",
    line: "#00F5D4",
    spike: "#00F5D4",
    glow: "#E6FFFB",
};
const SPACING = 7; // khoảng cách các node (px) < bán kính → thân liền
const BODY_NODES = 12; // 12 đốt thân sau đầu
const dist = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
const f = (n) => Math.round(n * 1e5) / 1e5; // 5 chữ số lẻ: chu kỳ dài cần knot thời gian mịn hơn 0.001
const f4 = (n) => Math.round(n * 1e4) / 1e4; // keyPoints — 0.0001 × pathLen ≈ 0.3px là đủ
const fa = (n) => Math.round(n * 10) / 10; // góc xoay — 0.1° là đủ, tiết kiệm bytes
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
/** DeltaAngle — quay từ prev đến next luôn theo cung ngắn nhất (≤ 180°) */
const deltaAngle = (prev, next) => {
    let d = (next - prev) % 360;
    if (d > 180)
        d -= 360;
    if (d < -180)
        d += 360;
    return d;
};
/** góc kế tiếp trong chuỗi liên tục (unwrap — chống quay vòng 350°) */
const unwrapAngle = (prev, next) => prev + deltaAngle(prev, next);
export function buildFlightPlan(cal, seed) {
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
    const sessions = [];
    let cur = center;
    // mỗi session nhắm ô sáng CHƯA cháy — vòng chỉ dừng khi MỌI đốm sáng của
    // repo này đã được đốt (độ dài chu kỳ phụ thuộc dữ liệu), cap 24 session
    const burned = new Set();
    const colOf = (x) => Math.round((x - GEO.marginX - GEO.cell / 2) / GEO.pitch);
    const rowOf = (y) => Math.round((y - GEO.top - GEO.cell / 2) / GEO.pitch);
    for (let s = 0; s < 40; s++) {
        const remaining = pool0.filter(b => !burned.has(`${colOf(b.p.x)},${rowOf(b.p.y)}`));
        if (bright.length >= 4 ? remaining.length === 0 : s >= 3)
            break;
        // ---- mục tiêu: TÂM CỤM ô sáng chưa cháy (nhiều hàng xóm chưa cháy nhất trong
        // bán kính ~3 ô) để mỗi loạt phun quét trọn chùm — ưu tiên cách vị trí hiện tại ≥ 3 ô ----
        const clusterScore = (p) => remaining.reduce((n, b) => n + (dist(b.p, p) <= GEO.pitch * 3.2 ? 1 : 0), 0);
        const sorted = [...remaining].sort((a, b) => clusterScore(b.p) - clusterScore(a.p) || b.count - a.count);
        const pool = shuffle(sorted.slice(0, 10).filter(b => dist(b.p, cur) > GEO.pitch * 3), rnd);
        const target = (pool[0] ?? sorted[0] ?? pool0[s % pool0.length]).p;
        // ---- hướng phun: 8 hướng (4 chính + 4 chéo — theo MIỆNG rồng) ----
        // origin VÀ toàn tầm lửa 1–3 ô phải nằm trong bảng, chạm boundary → bỏ hướng
        const dirs8 = shuffle([
            { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 },
            { x: 1, y: 1 }, { x: 1, y: -1 }, { x: -1, y: 1 }, { x: -1, y: -1 },
        ], rnd);
        const coneFits = (d) => {
            for (let k = -1; k <= 3; k++) {
                const q = { x: target.x + d.x * GEO.pitch * k, y: target.y + d.y * GEO.pitch * k };
                if (!inGrid(q))
                    return false;
            }
            return true;
        };
        const d0 = dirs8.find(coneFits) ?? dirs8.find(d => inGrid({ x: target.x - d.x * GEO.pitch, y: target.y - d.y * GEO.pitch })) ?? dirs8[0];
        const origin = { x: target.x - d0.x * GEO.pitch, y: target.y - d0.y * GEO.pitch };
        // ---- arrival + entry: fade-in NGOÀI biên TRÁI/PHẢI rồi quét ngang tới origin (ưu tiên Ox) ----
        const side = origin.x < center.x ? -1 : 1;
        const entryC = side < 0 ? 0 : cols - 1;
        const entryR = Math.max(0, Math.min(6, Math.round((origin.y - GEO.top - GEO.cell / 2) / GEO.pitch)));
        const entry = cellCenter(entryC, entryR);
        const arrival = { x: entry.x + side * GEO.pitch * 1.4, y: entry.y };
        // ---- GLIDE: serpentine 20–30 bước từ entry đến origin (user spec 2026-10-25) ----
        const want = 20 + Math.floor(rnd() * 11); // 20–30 bước
        const glide = [];
        const originC = Math.max(0, Math.min(cols - 1, Math.round((origin.x - GEO.marginX - GEO.cell / 2) / GEO.pitch)));
        const originR = Math.max(0, Math.min(6, Math.round((origin.y - GEO.top - GEO.cell / 2) / GEO.pitch)));
        const dc = originC - entryC, dr = originR - entryR;
        const majorIsCol = Math.abs(dc) * 1.35 >= Math.abs(dr); // ưu tiên tiến theo trục Ox
        const span = Math.abs(majorIsCol ? dc : dr);
        // quãng ngắn + nhiều bước → biên độ lượn 2 ô cho khỏi lắc tại chỗ
        const amp = span < want * 0.5 ? 2 : 1;
        const halfPeriod = Math.max(2, Math.round(want / (amp * 5)));
        let wob = rnd() < 0.5 ? 1 : -1;
        for (let i = 0; i < want; i++) {
            const k = i / (want - 1);
            if (i > 0 && i % halfPeriod === 0)
                wob = -wob;
            const w = i === 0 || i === want - 1 ? 0 : wob * amp;
            if (majorIsCol) {
                const gc = Math.max(0, Math.min(cols - 1, Math.round(entryC + dc * k)));
                const gr = Math.max(0, Math.min(6, Math.round(entryR + dr * k) + w));
                glide.push(cellCenter(gc, gr));
            }
            else {
                const gr = Math.max(0, Math.min(6, Math.round(entryR + dr * k)));
                const gc = Math.max(0, Math.min(cols - 1, Math.round(entryC + dc * k) + w));
                glide.push(cellCenter(gc, gr));
            }
        }
        glide[glide.length - 1] = { ...origin }; // điểm cuối = đúng origin
        // ---- walk: 2–3 bước ngang thiên (nhiều session → giữ chu kỳ phủ-đốt gọn) ----
        const walks = [];
        let wp = { ...origin };
        const nSteps = 2 + Math.floor(rnd() * 2);
        for (let i = 0; i < nSteps; i++) {
            const ang = (rnd() < 0.5 ? 0 : Math.PI) + (rnd() - 0.5) * 0.9; // lang thang thiên về ngang (±26°)
            const step = GEO.pitch * (0.8 + rnd() * 1.6);
            wp = {
                x: Math.min(width - GEO.marginX + GEO.pitch * 0.6, Math.max(GEO.marginX - GEO.pitch * 0.6, wp.x + Math.cos(ang) * step)),
                y: Math.min(GEO.top + 6 * GEO.pitch + GEO.pitch * 0.6, Math.max(GEO.top - GEO.pitch * 0.6, wp.y + Math.sin(ang) * step)),
            };
            walks.push(wp);
        }
        const sprayDirs = (() => {
            // xếp hạng hướng theo TIA PHUN: hướng có ô sáng chưa cháy trên tia đứng trước,
            // và tầm lửa len bám theo ô sáng xa nhất trên tia đó (min 2) — không phun lãng vào ô rỗng
            const rayInfo = (d) => {
                let far = 0;
                for (let k = 1; k <= 3; k++) {
                    const q = { x: origin.x + d.x * GEO.pitch * k, y: origin.y + d.y * GEO.pitch * k };
                    if (!inGrid(q))
                        break;
                    if (!burned.has(`${colOf(q.x)},${rowOf(q.y)}`) && (cal.weeks[colOf(q.x)]?.[rowOf(q.y)]?.level ?? 0) >= 2)
                        far = k;
                }
                return far;
            };
            const fitting = dirs8.filter(coneFits)
                .map(d => ({ d, far: rayInfo(d) }))
                .sort((a, b) => (b.far > 0 ? 1 : 0) - (a.far > 0 ? 1 : 0) || b.far - a.far);
            const order = [d0, ...fitting.filter(x => x.d !== d0).map(x => x.d)];
            const dirCount = 3 + Math.floor(rnd() * 3); // 3–5 hướng
            return order.slice(0, dirCount).map(d => {
                const far = fitting.find(x => x.d === d)?.far ?? 0;
                return { d, len: Math.max(2, far), aim: angleDeg(d) };
            });
        })();
        // đánh dấu trước các ô session này sẽ đốt để session sau không nhắm lại
        for (const { d, len } of sprayDirs) {
            for (let k = 1; k <= len; k++) {
                const q = { x: origin.x + d.x * GEO.pitch * k, y: origin.y + d.y * GEO.pitch * k };
                if (inGrid(q) && cal.weeks[colOf(q.x)]?.[rowOf(q.y)])
                    burned.add(`${colOf(q.x)},${rowOf(q.y)}`);
            }
        }
        sessions.push({ entry, glide, origin, arrival, sprayDirs, walks });
        cur = walks[walks.length - 1] ?? origin;
    }
    void cur;
    // ===== phát phases — aim = góc ABSOLUTE unwrap liên tục =====
    const phases = [];
    const burns = [];
    const vertices = [sessions[0].arrival];
    let t = 0;
    let aim = 0; // góc liên tục — khởi đầu hướng phải
    const pushMove = (kind, from, to, dur) => {
        if (dist(from, to) > 1)
            aim = unwrapAngle(aim, angleDeg({ x: to.x - from.x, y: to.y - from.y }));
        phases.push({ t0: t, t1: t + dur, from, to, kind, visible: true, aim, rotEnd: aim });
        t += dur;
        const lastV = vertices[vertices.length - 1];
        if (lastV.x !== to.x || lastV.y !== to.y)
            vertices.push(to);
    };
    sessions.forEach((plan, si) => {
        // FADE-IN (+ spin-in 55%)
        let spinAngle = 0;
        const doSpin = rnd() < 0.55;
        const spinDur = doSpin ? 0.85 : 0.35;
        if (doSpin)
            spinAngle += 360 * (rnd() < 0.5 ? 1 : -1);
        phases.push({ t0: t, t1: t + spinDur, from: plan.arrival, to: plan.arrival, kind: "fadein", visible: true,
            aim, rotEnd: aim, spinEnd: spinAngle, spinning: doSpin });
        t += spinDur;
        // ENTER biên
        pushMove("move", plan.arrival, plan.entry, 0.35);
        // GLIDE serpentine
        let prev = plan.entry;
        for (const g of plan.glide) {
            pushMove("move", prev, g, 0.24);
            prev = g;
        }
        // ROTATE + SPRAY: mỗi hướng ngắm → phun → burn
        for (const { d, len, aim: aimDegV } of plan.sprayDirs) {
            aim = unwrapAngle(aim, aimDegV);
            phases.push({ t0: t, t1: t + 0.14, from: plan.origin, to: plan.origin, kind: "rotate", visible: true, aim, rotEnd: aim });
            t += 0.14;
            phases.push({ t0: t, t1: t + 0.9 + len * 0.22, from: plan.origin, to: plan.origin, kind: "spray", visible: true, aim, rotEnd: aim });
            for (let k = 1; k <= len; k++) {
                const cell = { x: plan.origin.x + d.x * GEO.pitch * k, y: plan.origin.y + d.y * GEO.pitch * k };
                if (!inGrid(cell))
                    continue;
                const col = Math.round((cell.x - GEO.marginX - GEO.cell / 2) / GEO.pitch);
                const row = Math.round((cell.y - GEO.top - GEO.cell / 2) / GEO.pitch);
                const day = cal.weeks[col]?.[row];
                if (!day)
                    continue;
                burns.push({ col, row, x: cell.x, y: cell.y, t: t + 0.25 + (k - 1) * 0.3 });
            }
            t += 0.9 + len * 0.22;
        }
        // HOLD sau khi ô xa nhất xong hiệu ứng (nhiều session → hold gọn lại)
        const lastEffectEnd = Math.max(t, ...burns.map(b => b.t + 0.9));
        const holdDur = 0.8 + Math.max(0, lastEffectEnd - t);
        phases.push({ t0: t, t1: t + holdDur, from: plan.origin, to: plan.origin, kind: "hold", visible: true, aim, rotEnd: aim });
        t += holdDur;
        // WANDER 4–7 bước
        let wprev = plan.origin;
        for (const stepTo of plan.walks) {
            pushMove("walk", wprev, stepTo, 0.55);
            wprev = stepTo;
        }
        // FADE-OUT + SLIDE sang session kế
        phases.push({ t0: t, t1: t + 0.35, from: wprev, to: wprev, kind: "fadeout", visible: false, aim, rotEnd: aim });
        t += 0.35;
        const nextArrival = sessions[(si + 1) % sessions.length].arrival;
        const slideDur = 0.45 + dist(wprev, nextArrival) / 320;
        phases.push({ t0: t, t1: t + slideDur, from: wprev, to: nextArrival, kind: "slide", visible: false, aim, rotEnd: aim });
        t += slideDur;
        const lastSlideV = vertices[vertices.length - 1];
        if (lastSlideV.x !== nextArrival.x || lastSlideV.y !== nextArrival.y)
            vertices.push(nextArrival);
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
// sampling: vị trí/góc trên path của đầu
// ============================================================
function posAtArc(plan, arc) {
    const dd = Math.max(0, Math.min(plan.pathLen, arc));
    const cum = [0];
    const v = plan.vertices;
    for (let i = 1; i < v.length; i++)
        cum.push(cum[i - 1] + dist(v[i - 1], v[i]));
    let i = 1;
    while (i < cum.length && cum[i] < dd)
        i++;
    const k = (dd - cum[i - 1]) / Math.max(0.0001, cum[i] - cum[i - 1]);
    return lerpPt(v[i - 1], v[i], k);
}
function tangentAtArc(plan, arc) {
    const dd = Math.max(0, Math.min(plan.pathLen, arc));
    const v = plan.vertices;
    const cum = [0];
    for (let i = 1; i < v.length; i++)
        cum.push(cum[i - 1] + dist(v[i - 1], v[i]));
    let i = 1;
    while (i < cum.length && cum[i] < dd)
        i++;
    return angleDeg({ x: v[i].x - v[i - 1].x, y: v[i].y - v[i - 1].y });
}
/** hướng node k tại t = tiếp tuyến path tại vị trí arc của node đó (vector 2D) */
function nodeHeading(plan, k, t) {
    return tangentAtArc(plan, arcAt(plan, t) - k * SPACING);
}
/** quãng đường arc của ĐẦU tại thời điểm t (move/walk/slide tiêu thụ) */
function arcAt(plan, t) {
    const T = plan.phases[plan.phases.length - 1].t1;
    const tt = ((t % T) + T) % T;
    let d = 0;
    for (const ph of plan.phases) {
        if (tt <= ph.t1) {
            if (ph.kind === "move" || ph.kind === "walk" || ph.kind === "slide") {
                const k = (tt - ph.t0) / Math.max(0.0001, ph.t1 - ph.t0);
                return d + dist(ph.from, ph.to) * k;
            }
            return d;
        }
        d += dist(ph.from, ph.to);
    }
    return d;
}
/** góc aim của ĐẦU tại thời điểm t (nội suy trong phase) */
function aimAt(plan, t) {
    const T = plan.phases[plan.phases.length - 1].t1;
    const tt = ((t % T) + T) % T;
    for (let i = 0; i < plan.phases.length; i++) {
        const ph = plan.phases[i];
        if (tt >= ph.t0 && tt <= ph.t1) {
            const prev = plan.phases[(i - 1 + plan.phases.length) % plan.phases.length].aim ?? 0;
            const k = (tt - ph.t0) / Math.max(0.0001, ph.t1 - ph.t0);
            if ((ph.kind === "move" || ph.kind === "walk") && dist(ph.from, ph.to) > 1) {
                const target = angleDeg({ x: ph.to.x - ph.from.x, y: ph.to.y - ph.from.y });
                const unw = prev + deltaAngle(prev, target);
                return prev + (unw - prev) * k;
            }
            if (ph.kind === "rotate") {
                return prev + ((ph.aim ?? prev) - prev) * k;
            }
            return ph.aim ?? prev;
        }
    }
    return 0;
}
// ============================================================
// SMIL assembly
// ============================================================
function linEmit(kts, vals, fmt) {
    const oK = [], oV = [];
    for (let i = 0; i < kts.length; i++) {
        const w = f(kts[i]);
        if (w > (oK[oK.length - 1] ?? -Infinity)) {
            oK.push(w);
            oV.push(fmt(vals[i]));
        }
    }
    return `values="${oV.join(";")}" keyTimes="${oK.join(";")}"`;
}
function emitChannel(knots, total, fmt) {
    const T = total;
    const sorted = [...knots].sort((a, b) => a.t - b.t);
    const seen = new Set();
    const pts = [];
    for (const k of sorted) {
        const lt = (((k.t % T) + T) % T) / T;
        const key = String(f(lt)); // dedupe theo giá trị ĐÃ LÀM TRÒN sẽ phát ra
        if (seen.has(key))
            continue;
        seen.add(key);
        pts.push({ kt: f(lt), v: k.v });
    }
    if (pts[0].kt > 0.0001)
        pts.unshift({ kt: 0, v: pts[pts.length - 1].v });
    if (pts[pts.length - 1].kt < 0.9999)
        pts.push({ kt: 1, v: pts[0].v });
    const oV = [], oK = []; // lọc đơn điệu sau làm tròn — browser drop animate nếu trùng
    for (const p of pts)
        if (p.kt > (oK[oK.length - 1] ?? -Infinity)) {
            oK.push(p.kt);
            oV.push(fmt(p.v));
        }
    return `values="${oV.join(";")}" keyTimes="${oK.join(";")}"`;
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
/** góc spin-in tích luỹ tại t: ramp trong fadein, giữ nguyên sau (≡ 0 mod 360) */
function spinAt(phases, t) {
    const T = phases[phases.length - 1].t1;
    const tt = ((t % T) + T) % T;
    let acc = 0;
    for (const ph of phases) {
        if (ph.kind !== "fadein" || !ph.spinning)
            continue;
        const k = (tt - ph.t0) / Math.max(0.0001, ph.t1 - ph.t0);
        if (tt >= ph.t1)
            acc += ph.spinEnd ?? 0;
        else if (tt >= ph.t0)
            acc += (ph.spinEnd ?? 0) * Math.max(0, Math.min(1, k));
    }
    return acc;
}
function dragonRiders(plan) {
    const total = plan.total;
    // opacity chỉ đổi tại biên fade — đừng phát knot cho mọi biên phase (chu kỳ dài sẽ phình file)
    const bounds = [0, ...plan.phases.filter(p => p.kind === "fadein" || p.kind === "fadeout" || p.kind === "slide").flatMap(p => [p.t0, p.t1])];
    const T = total;
    const OPACITY = `<animate attributeName="opacity" ${linEmit(bounds.map(b => b / T), bounds.map(b => f(opacityAt(plan.phases, b))), v => String(f(v)))} dur="${f(T)}s" repeatCount="indefinite"/>`;
    // đuôi lửa — dài theo len của từng pha spray
    const flameKnots = [{ t: 0, v: 1 }];
    for (const ph of plan.phases) {
        if (ph.kind !== "spray" || !ph.len)
            continue;
        const ext = 0.9 + (ph.len - 1) * 0.62;
        flameKnots.push({ t: ph.t0 - 0.002, v: 1 });
        flameKnots.push({ t: ph.t0 + 0.1, v: ext });
        flameKnots.push({ t: ph.t1 - 0.002, v: ext });
        flameKnots.push({ t: ph.t1, v: 1 });
    }
    const FLAME = `<animateTransform attributeName="transform" type="scale" ${emitChannel(flameKnots, total, v => `${f(v)} 1`)} dur="${f(T)}s" repeatCount="indefinite"/>`;
    /** node rider — motion + xoay theo heading của node */
    const nodeRider = (node, baseAngle, content) => {
        const kts = [], kps = [], oKts = [], oVals = [];
        const raw = [];
        const step = T > 300 ? 0.75 : T > 180 ? 0.6 : T > 90 ? 0.45 : 0.25; // chu kỳ dài → thưa mẫu cho khỏi phình file
        const steps = Math.ceil(T / step);
        for (let i = 0; i <= steps; i++)
            raw.push((i / steps) * T);
        // knot tại biên các pha ĐỨNG/YẾU hướng (stall/turn không trôi); pha move/walk đều tốc độ thì mẫu đều đủ
        for (const ph of plan.phases)
            if (ph.kind !== "move" && ph.kind !== "walk")
                raw.push(ph.t0);
        for (const ph of plan.phases) {
            if (ph.kind !== "fadein" || !ph.spinning)
                continue;
            for (let j = 1; j < 10; j++)
                raw.push(ph.t0 + (j / 10) * (ph.t1 - ph.t0)); // spin mượt
        }
        raw.sort((a, b) => a - b);
        let lastKt = -1;
        for (const t of raw) {
            const kt = f(t / T);
            if (kt <= lastKt)
                continue; // chặn keyTime trùng sau làm tròn
            lastKt = kt;
            kts.push(kt);
            kps.push(f4(Math.max(0, Math.min(1, (arcAt(plan, t) - node * SPACING) / plan.pathLen))));
            const base = node === 0
                ? aimAt(plan, t) // đầu: xoay theo aim/heading
                : unwrapAngle(oVals[oVals.length - 1] ?? 0, nodeHeading(plan, node, t) + baseAngle);
            oVals.push(fa(base + spinAt(plan.phases, t)));
            oKts.push(kt);
        }
        const rot = `<animateTransform attributeName="transform" type="rotate" values="${oVals.join(";")}" keyTimes="${oKts.join(";")}" dur="${f(T)}s" repeatCount="indefinite"/>`;
        return `<g><animateMotion dur="${f(T)}s" repeatCount="indefinite" path="${plan.pathD}" keyPoints="${kps.join(";")}" keyTimes="${kts.join(";")}" calcMode="linear"/>` +
            `<g transform="scale(${DRAGON.scale})">${OPACITY}<g>${rot}${content}</g></g></g>`;
    };
    const segs = [];
    // thân: 12 đốt — node xoay theo tiếp tuyến (+90 cho gai), 2 lớp silhouette
    const radii = [10, 9.6, 9.2, 8.7, 8.1, 7.5, 6.9, 6.3, 5.7, 5.2, 4.7, 4.3];
    for (let k = radii.length; k >= 1; k--) {
        const r = radii[k - 1];
        segs.push(nodeRider(k, 90, `<circle r="${r + 1.1}" fill="${DRAGON.shade}" stroke="${DRAGON.line}" stroke-width="1.4"/><circle r="${r}" fill="${DRAGON.body}"/>`));
    }
    for (let k = radii.length; k >= 1; k--) {
        const r = radii[k - 1];
        const spike = k <= 6
            ? `<polygon points="0,${-r + 1} 2.8,${-r - 4.6} -2.8,${-r - 4.6}" fill="${DRAGON.spike}" opacity="0.95"/>`
            : "";
        segs.push(nodeRider(k, 90, `${spike}<circle r="${r}" fill="${k % 2 === 0 ? DRAGON.body : DRAGON.shade}"/>`));
    }
    // cánh trên đốt 3
    segs.push(nodeRider(3, 0, `<g opacity="0.5"><path d="M1 -7 C -8 -18 -20 -23 -27 -18 C -20 -14 -12 -9.5 -4 -6 Z" fill="${DRAGON.shade}">` +
        `<animateTransform attributeName="transform" type="rotate" values="-13 0 -5;13 0 -5;-13 0 -5" dur="0.72s" repeatCount="indefinite"/></path></g>` +
        `<path d="M0 -6 C -8 -15 -18 -18 -23 -13.5 C -17 -10.5 -10 -7.5 -3 -4.5 Z" fill="${DRAGON.body}" stroke="${DRAGON.line}" stroke-width="1.4">` +
        `<animateTransform attributeName="transform" type="rotate" values="11 0 -5;-15 0 -5;11 0 -5" dur="0.72s" repeatCount="indefinite"/></path>`));
    // đuôi: spade hướng ngược (+180)
    segs.push(nodeRider(BODY_NODES + 1, 180, `<polygon points="-2.5,-4.5 -10,-7 -7,0 -10,7 -2.5,4.5" fill="${DRAGON.spike}" opacity="0.95"/>` +
        `<polygon points="-1.8,-3 -7,-4.2 -4.5,0 -7,4.2 -1.8,3" fill="${DRAGON.glow}" opacity="0.8"/>`));
    // ĐẦU — node 0: xoay theo vector heading, mũi + râu + lửa (bản compact)
    const head = `
  <path d="M-7 -7 C -12 -13 -18 -14 -23 -10" stroke="${DRAGON.line}" stroke-width="2.2" fill="none" stroke-linecap="round"/>
  <path d="M-3 -9 C -7 -14 -12 -16 -17 -14" stroke="${DRAGON.line}" stroke-width="1.6" fill="none" stroke-linecap="round"/>
  <ellipse cx="-3" cy="0" rx="13" ry="10.5" fill="${DRAGON.body}" stroke="${DRAGON.line}" stroke-width="1.7"/>
  <polygon points="6,-7 23,-3.5 23,3.5 6,7" fill="${DRAGON.body}" stroke="${DRAGON.line}" stroke-width="1.7"/>
  <polygon points="6,6 17,10 5,12.5" fill="${DRAGON.shade}" stroke="${DRAGON.line}" stroke-width="1.5"/>
  <polygon points="9,7.6 11.5,9.6 9.8,10.4" fill="${DRAGON.glow}" opacity="0.9"/>
  <polygon points="13,8.6 15.5,10.4 13.8,11" fill="${DRAGON.glow}" opacity="0.9"/>
  <line x1="10" y1="1.8" x2="22" y2="0.8" stroke="${DRAGON.line}" stroke-width="1.4" stroke-linecap="round"/>
  <circle cx="21" cy="-2.2" r="1.1" fill="${DRAGON.line}"/>
  <circle cx="-6" cy="-3.2" r="2.9" fill="${DRAGON.glow}"/>
  <circle cx="-5.2" cy="-3.9" r="1.05" fill="${DRAGON.line}"/>
  <g>
    <animateTransform attributeName="transform" type="rotate" values="-5 20 0;6 20 0;-5 20 0" dur="2.4s" repeatCount="indefinite"/>
    <path d="M22 -2 C 29 -6 36 -5 41 -9" stroke="${DRAGON.line}" stroke-width="1.5" fill="none" stroke-linecap="round"/>
    <path d="M22.5 2.5 C 29 5 35 4 40 7.5" stroke="${DRAGON.line}" stroke-width="1.2" fill="none" stroke-linecap="round" opacity="0.8"/>
  </g>
  <g>
    ${FLAME}
    <g>
      <animateTransform attributeName="transform" type="translate" values="25 0;28 0;25 0" dur="0.5s" repeatCount="indefinite"/>
      <path d="M0 0 C 7 -2 12 -5 17 -4.5 C 13 -1 12 2.5 8 5 C 4 6 1.5 3 0 0 Z" fill="#F97316" opacity="0.95">
        <animate attributeName="opacity" values="0.95;0.55;0.95" dur="0.4s" repeatCount="indefinite"/>
      </path>
      <path d="M0 0 C 5 -1 8.5 -2.5 12 -2.5 C 9.5 0.8 8.5 2.5 5 4.2 C 2.5 4.2 0.8 2.5 0 0 Z" fill="#FDE68A">
        <animate attributeName="opacity" values="1;0.5;1" dur="0.35s" repeatCount="indefinite"/>
      </path>
    </g>
  </g>`;
    segs.push(nodeRider(0, 0, head));
    return segs.join("");
}
// ============================================================
// board + burn state machine
// ============================================================
function renderBoard(plan, cal, theme) {
    const { width, cols } = gridSize(cal);
    const T = plan.total;
    const parts = [];
    // burnMap: lần đốt sớm nhất thắng
    const burnMap = new Map();
    for (const b of plan.burns) {
        const key = `${b.col},${b.row}`;
        if (!burnMap.has(key))
            burnMap.set(key, b);
    }
    // ===== các ô: INTACT → BURNING (flame icon 0.5s) → SCORCHED =====
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
            let iM = burn ? Math.min(0.999, (burn.t + 0.5) / T) : 0;
            let iF = burn ? Math.min(0.999, (burn.t + 0.62) / T) : 0;
            let iE = burn ? Math.min(0.999, (burn.t + 1.02) / T) : 0;
            if (iM <= iS)
                iM = Math.min(0.999, iS + 0.00002); // chu kỳ dài: khoảng cách knot sau làm tròn có thể = 0
            if (iF <= iM)
                iF = Math.min(0.999, iM + 0.00002);
            if (iE <= iF)
                iE = Math.min(0.999, iF + 0.00002);
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
    // count label
    const totalContrib = cal.weeks.flat().reduce((s2, d) => s2 + d.count, 0);
    parts.push(`<text x="${width - 14}" y="${GEO.top - 9}" text-anchor="end" font-family="${FONT}" font-size="10" fill="${theme.label}">${totalContrib} contributions — last year</text>`);
    // ===== BURNING: biểu tượng lửa trên ô 0.5s + vòng ignition =====
    for (const b of plan.burns) {
        const start = ((b.t % T) + T) % T;
        const kts = [0];
        const ops = [0];
        const scs = ["0.4 0.4"];
        const steps = 4;
        for (let i = 0; i <= steps; i++) {
            const tt = start + (i / steps) * 0.5;
            const kt = f(Math.min(0.999, tt / T));
            if (kt <= kts[kts.length - 1])
                continue; // chống knot trùng sau làm tròn (chu kỳ dài)
            kts.push(kt);
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
        const b2 = f(Math.min(0.999, Math.max((start + 0.07) / T, a + 0.00002)));
        const c2 = f(Math.min(0.999, Math.max((start + 0.3) / T, b2 + 0.00002)));
        parts.push(`<circle cx="${f(b.x)}" cy="${f(b.y)}" r="5" fill="none" stroke="${DRAGON.glow}" stroke-width="2" opacity="0">` +
            `<animate attributeName="opacity" values="0;0;0.85;0;0" keyTimes="0;${a};${b2};${c2};1" dur="${f(T)}s" repeatCount="indefinite"/>` +
            `<animate attributeName="r" values="4;4;9;12;4" keyTimes="0;${a};${b2};${c2};1" dur="${f(T)}s" repeatCount="indefinite"/></circle>`);
    }
    return parts.join("");
}
// ============================================================
// renderDragon
// ============================================================
export function renderDragon(cal, theme, opts = {}) {
    const seed = opts.seed ?? 20261025;
    const plan = buildFlightPlan(cal, seed);
    const board = renderBoard(plan, cal, theme);
    const riders = dragonRiders(plan);
    const pad = GEO.pitch * 2;
    const { width, height } = gridSize(cal);
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-pad} ${-pad} ${width + pad * 2} ${height + pad * 2}" width="100%" fill="none" role="img" aria-label="Contribution dragon">${board}${riders}</svg>`;
}
