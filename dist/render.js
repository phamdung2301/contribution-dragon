import { cellCenter, GEO, gridSize, MONTHS } from "./route.js";
const ESC = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const FONT = "ui-monospace,SFMono-Regular,'JetBrains Mono',Consolas,monospace";
/**
 * Con rồng v3 — "teleport hunter":
 * hiện ra ngoài boundary → bay đường thẳng ngắn nhất tới ô sáng nhất →
 * dừng ăn (lửa phun) → mờ dần → trượt vô hình tới vùng khác → hiện ra.
 * Thân = 8 đốt KHÔNG viền (chồng khít thành hình thon liền mạch, hết rết),
 * đầu to rõ. Hướng bay: lật ngang mượt (squish-flip) khi đổi phương.
 */
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
/** Chọn các mục tiêu sáng nhất + điểm đến ngoài boundary, seed ổn định. */
function planHunt(cal) {
    const { width, height, cols, rows } = gridSize(cal);
    const center = { x: width / 2, y: GEO.top + (rows * GEO.pitch) / 2 };
    let s = 987654321 >>> 0;
    const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
    const bright = [];
    for (let c = 0; c < cols; c++)
        for (let r = 0; r < 7; r++) {
            const day = cal.weeks[c][r];
            if (day.level >= 3)
                bright.push({ p: cellCenter(c, r), count: day.count });
        }
    if (bright.length < 4)
        for (let c = 0; c < cols; c += 3)
            for (let r = 0; r < 7; r += 2)
                bright.push({ p: cellCenter(c, r), count: 1 });
    bright.sort((a, b) => b.count - a.count);
    const targets = [];
    let cur = center;
    const N = Math.min(8, Math.max(5, Math.ceil(bright.length / 4)));
    for (let i = 0; i < N; i++) {
        const pool = bright
            .filter(b => dist(b.p, cur) > GEO.pitch * 3 && !targets.some(tg => tg.x === b.p.x && tg.y === b.p.y))
            .slice(0, 8);
        const pick = pool.length ? pool[Math.floor(rnd() * pool.length)] : bright[i % bright.length];
        targets.push(pick.p);
        cur = pick.p;
    }
    // điểm hiện ra: 1.4 ô NGOÀI boundary theo hướng từ tâmgrid → mục tiêu
    const arrivals = targets.map(tg => {
        const dx = tg.x - center.x, dy = tg.y - center.y;
        const len = Math.max(1, Math.hypot(dx, dy));
        return {
            x: Math.min(width - GEO.marginX + GEO.pitch, Math.max(GEO.marginX - GEO.pitch, tg.x + (dx / len) * GEO.pitch * 1.4)),
            y: Math.min(GEO.top + 7 * GEO.pitch + GEO.pitch * 0.6, Math.max(GEO.top - GEO.pitch * 0.6, tg.y + (dy / len) * GEO.pitch * 1.4)),
        };
    });
    return { targets, arrivals };
}
function buildTimeline(cal) {
    const { targets, arrivals } = planHunt(cal);
    const phases = [];
    const vertices = [arrivals[0]];
    let t = 0;
    const push = (kind, from, to, dur) => {
        phases.push({ t0: t, t1: t + dur, from, to, kind });
        t += dur;
        if (kind !== "eat" && kind !== "fadeout" && (vertices[vertices.length - 1].x !== to.x || vertices[vertices.length - 1].y !== to.y))
            vertices.push(to);
    };
    for (let i = 0; i < targets.length; i++) {
        const target = targets[i];
        const arrival = arrivals[i];
        push("move", arrival, target, Math.max(0.8, dist(arrival, target) / 110)); // bay vào ăn
        push("eat", target, target, 0.55); // dừng — lửa phun
        push("fadeout", target, target, 0.32); // mờ dần
        const nextArrival = arrivals[(i + 1) % targets.length];
        push("slide", target, nextArrival, 0.45 + dist(target, nextArrival) / 320); // trượt vô hình
        push("fadein", nextArrival, nextArrival, 0.32); // hiện ra
    }
    // tổng hợp path + chiều dài (eat/fadeout đứng yên — không thêm đỉnh)
    let pathD = `M ${f(vertices[0].x)} ${f(vertices[0].y)}`;
    let length = 0;
    for (let i = 1; i < vertices.length; i++) {
        length += dist(vertices[i - 1], vertices[i]);
        pathD += ` L ${f(vertices[i].x)} ${f(vertices[i].y)}`;
    }
    pathD += " Z";
    length += dist(vertices[vertices.length - 1], vertices[0]);
    return { phases, total: t, pathD, length, vertices };
}
/** d(t): quãng đường theo path tại thời điểm t (piecewise linear). */
function distanceAt(phases, lengths, t) {
    const T = phases[phases.length - 1].t1;
    const tt = ((t % T) + T) % T;
    let d = 0;
    for (let i = 0; i < phases.length; i++) {
        const ph = phases[i];
        if (tt <= ph.t1) {
            if (ph.kind === "move") {
                const k = (tt - ph.t0) / Math.max(0.0001, ph.t1 - ph.t0);
                return d + lengths[i] * k;
            }
            return d;
        }
        d += lengths[i];
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
function flipAt(phases, t) {
    const T = phases[phases.length - 1].t1;
    const tt = ((t % T) + T) % T;
    let last = 1;
    for (const ph of phases) {
        if (tt >= ph.t0 && tt <= ph.t1) {
            if (ph.kind === "move") {
                const dx = ph.to.x - ph.from.x;
                if (Math.abs(dx) > 2)
                    last = dx > 0 ? 1 : -1;
            }
            return last;
        }
    }
    return last;
}
/** sinht hệ keyTimes/keyPoints từ các mốc ranh giới phase. */
function motionKeys(phases, lengths, total, delay, pathLen) {
    const bounds = [0, ...phases.map(p => p.t1)];
    const seen = new Set();
    const kts = [];
    const kps = [];
    for (const b of bounds) {
        const lt = ((b + delay) % total) / total;
        const key = lt.toFixed(4);
        if (seen.has(key))
            continue;
        seen.add(key);
        kts.push(lt);
        kps.push(Math.min(1, distanceAt(phases, lengths, b) / pathLen));
    }
    // đóng vòng: sắp xếp + đảm bảo 0 và 1
    const pairs = kts.map((kt, i) => ({ kt, kp: kps[i] })).sort((a, b) => a.kt - b.kt);
    const outKt = [], outKp = [];
    for (const p of pairs) {
        outKt.push(f(p.kt));
        outKp.push(f(p.kp));
    }
    if (outKt[0] > 0.0001) {
        outKt.unshift(0);
        outKp.unshift(outKp[outKp.length - 1]);
    }
    if (outKt[outKt.length - 1] < 0.9999) {
        outKt.push(1);
        outKp.push(outKp[1] ?? 0);
    }
    return { keyTimes: outKt.join(";"), keyPoints: outKp.join(";") };
}
function dragonRiders(cal, _t) {
    const tl = buildTimeline(cal);
    const lengths = tl.phases.map(p => (p.kind === "move" || p.kind === "slide") ? dist(p.from, p.to) : 0);
    const total = tl.total;
    // opacity chung cho cả rồng (fade theo phase)
    const oBounds = [0, ...tl.phases.map(p => p.t1)];
    const oVals = [], oKts = [];
    for (const b of oBounds) {
        oVals.push(f(opacityAt(tl.phases, b)));
        oKts.push(f(b / total));
    }
    const OPACITY = `<animate attributeName="opacity" values="${oVals.join(";")}" keyTimes="${oKts.join(";")}" dur="${f(total)}s" repeatCount="indefinite"/>`;
    // lật hướng theo phương bay (squish-flip qua 0)
    const fVals = [], fKts = [];
    let lastFlip = 1;
    for (const b of oBounds) {
        const flip = flipAt(tl.phases, b);
        if (flip !== lastFlip) {
            fVals.push("0 1");
            fKts.push(f(Math.max(0, b / total - 0.004)));
        }
        fVals.push(`${flip} 1`);
        fKts.push(f(b / total));
        lastFlip = flip;
    }
    const FLIP = `<animateTransform attributeName="transform" type="scale" values="${fVals.join(";")}" keyTimes="${fKts.join(";")}" dur="${f(total)}s" repeatCount="indefinite" additive="replace"/>`;
    const rider = (delay, content) => {
        const { keyTimes, keyPoints } = motionKeys(tl.phases, lengths, total, delay, tl.length);
        return `<g><animateMotion dur="${f(total)}s" repeatCount="indefinite" path="${tl.pathD}" keyPoints="${keyPoints}" keyTimes="${keyTimes}" calcMode="linear"/>` +
            `<g transform="scale(${DRAGON.scale})">${OPACITY}${FLIP}${content}</g></g>`;
    };
    const segs = [];
    // ===== RIGID SPRITE: toàn thân là MỘT hình vẽ liền theo đầu =====
    // Thân ribbon cong chữ S thuôn dần về đuôi (một path duy nhất → một
    // đường viền liền mạch, không bao giờ thành rết), gai dọc sống lưng,
    // cánh vẫy, vây đuôi. Đầu to nhất, đứng trên cùng.
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
    const head = `
  <path d="M-4 -9 C -12 -17 -22 -18 -28 -12" stroke="${DRAGON.line}" stroke-width="2.4" fill="none" stroke-linecap="round"/>
  <path d="M0 -10 C -6 -18 -14 -20 -20 -17" stroke="${DRAGON.line}" stroke-width="1.8" fill="none" stroke-linecap="round"/>
  <path d="M24 -1 C 30 -3 34 0 38 -2" stroke="${DRAGON.line}" stroke-width="1.3" fill="none" opacity="0.8"/>
  <path d="M24 3 C 29 5 33 3 36 6" stroke="${DRAGON.line}" stroke-width="1.1" fill="none" opacity="0.6"/>
  <polygon points="5,5 20,9 7,14" fill="${DRAGON.shade}" stroke="${DRAGON.line}" stroke-width="1.6"/>
  <polygon points="6,-8 24,-3 24,3 6,6" fill="${DRAGON.body}" stroke="${DRAGON.line}" stroke-width="1.8"/>
  <ellipse cx="-4" cy="0" rx="15" ry="11.5" fill="${DRAGON.body}" stroke="${DRAGON.line}" stroke-width="1.8"/>
  <polygon points="10,0 22,1 22,2.5 10,3.5" fill="${DRAGON.line}"/>
  <circle cx="20" cy="0" r="1" fill="${DRAGON.line}"/>
  <circle cx="-2" cy="-4" r="3" fill="${DRAGON.glow}"/>
  <circle cx="-1" cy="-4.9" r="1.05" fill="${DRAGON.line}"/>
  <g transform="translate(28,2)">
    <animateTransform attributeName="transform" type="translate" values="28 2;32 2;28 2" dur="0.5s" repeatCount="indefinite"/>
    <path d="M0 0 C 8 -2 14 -6 20 -5 C 15 -1 14 3 9 6 C 5 7 2 4 0 0 Z" fill="#F97316" opacity="0.95">
      <animate attributeName="opacity" values="0.95;0.55;0.95" dur="0.4s" repeatCount="indefinite"/>
    </path>
    <path d="M0 0 C 6 -1 10 -3 14 -3 C 11 1 10 3 6 5 C 3 5 1 3 0 0 Z" fill="#FDE68A">
      <animate attributeName="opacity" values="1;0.5;1" dur="0.35s" repeatCount="indefinite"/>
    </path>
  </g>`;
    // một rider duy nhất mang cả con rồng
    const { keyTimes, keyPoints } = motionKeys(tl.phases, lengths, total, 0, tl.length);
    segs.push(`<g><animateMotion dur="${f(total)}s" repeatCount="indefinite" path="${tl.pathD}" keyPoints="${keyPoints}" keyTimes="${keyTimes}" calcMode="linear"/>` +
        `<g transform="scale(${DRAGON.scale})">${OPACITY}${FLIP}${body}${head}</g></g>`);
    return segs.join("");
}
export function renderDragon(cal, theme, opts = {}) {
    const { width, height, cols } = gridSize(cal);
    const total = cal.weeks.flat().reduce((s, d) => s + d.count, 0);
    const parts = [];
    for (let c = 0; c < cols; c++) {
        for (let r = 0; r < 7; r++) {
            const day = cal.weeks[c][r];
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
    parts.push(dragonRiders(cal, theme));
    // nới viewBox để rồng bay được ra NGOÀI boundary (1+ ô) mà không bị cắt
    const pad = GEO.pitch * 2;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-pad} ${-pad} ${width + pad * 2} ${height + pad * 2}" width="100%" fill="none" role="img" aria-label="Contribution dragon — ${total} contributions in the last year">${parts.join("")}</svg>`;
}
