import { buildRoute, GEO, gridSize, MONTHS } from "./route.js";
const ESC = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const FONT = "ui-monospace,SFMono-Regular,'JetBrains Mono',Consolas,monospace";
/**
 * Con rồng: đầu vẽ hướng +x tại gốc (0,0) — animateMotion rotate="auto"
 * sẽ xoá đầu rồng theo lộ trình. Thân = chuỗi rider trễ pha dần trên
 * CÙNG path (begin âm) → thân uốn theo như dây chuyền.
 * Phong cách neon: thân emerald đậm viền mint — nổi trên cả ô sáng lẫn tối.
 */
const DRAGON = {
    scale: 1.18,
    body: "#0B3B33",
    shade: "#062E26",
    line: "#00F5D4",
    spike: "#00F5D4",
    glow: "#E6FFFB",
};
function dragonRiders(cal, t) {
    const { pathD, length } = buildRoute(cal);
    const speed = 105; // px/s
    const dur = Math.min(40, Math.max(12, length / speed));
    const spacing = 15;
    const segs = [];
    // thân: 14 đốt thon dần
    const radii = [11, 11, 10.5, 10, 9.5, 9, 8.5, 8, 7.5, 7, 6.3, 5.7, 5, 4.4];
    for (let k = radii.length - 1; k >= 0; k--) {
        const r = radii[k];
        const begin = f(-(k * spacing) / speed);
        const fill = k % 2 === 0 ? DRAGON.body : DRAGON.shade;
        const spike = k >= 1 && k <= 9
            ? `<polygon points="0,${-r - 0.5} 3.6,${-r - 6} -3.6,${-r - 6}" fill="${DRAGON.spike}" opacity="0.95"/>`
            : "";
        segs.push(`<g><animateMotion dur="${f(dur)}s" begin="${begin}s" repeatCount="indefinite" rotate="auto" path="${pathD}"/>` +
            `<g transform="scale(${DRAGON.scale})">${spike}<circle r="${r}" fill="${fill}" stroke="${DRAGON.line}" stroke-width="1.6"/></g></g>`);
    }
    // cánh trên đốt thứ 5 (vẫy)
    const wingBegin = f(-(5 * spacing) / speed);
    segs.push(`<g><animateMotion dur="${f(dur)}s" begin="${wingBegin}s" repeatCount="indefinite" rotate="auto" path="${pathD}"/>` +
        `<g transform="scale(${DRAGON.scale})">` +
        `<g opacity="0.55"><path d="M2 -9 C -10 -26 -28 -32 -36 -26 C -28 -20 -18 -14 -6 -8 Z" fill="${DRAGON.shade}" stroke="${DRAGON.line}" stroke-width="1.3">` +
        `<animateTransform attributeName="transform" type="rotate" values="-14 0 -6;12 0 -6;-14 0 -6" dur="0.7s" repeatCount="indefinite"/></path></g>` +
        `<g><path d="M0 -8 C -12 -22 -26 -26 -32 -20 C -24 -15 -14 -10 -4 -6 Z" fill="${DRAGON.body}" stroke="${DRAGON.line}" stroke-width="1.6">` +
        `<animateTransform attributeName="transform" type="rotate" values="10 0 -5;-16 0 -5;10 0 -5" dur="0.7s" repeatCount="indefinite"/></path></g></g></g>`);
    // đuôi
    const tailBegin = f(-(13 * spacing) / speed);
    segs.push(`<g><animateMotion dur="${f(dur)}s" begin="${tailBegin}s" repeatCount="indefinite" rotate="auto" path="${pathD}"/>` +
        `<g transform="scale(${DRAGON.scale})"><polygon points="-9,0 3,-5 3,5" fill="${DRAGON.spike}" opacity="0.9"/></g></g>`);
    // ĐẦU: sọ + mõm + sừng + mắt + ria + LỬA phun
    const head = `
<g><animateMotion dur="${f(dur)}s" repeatCount="indefinite" rotate="auto" path="${pathD}"/>
<g transform="scale(${DRAGON.scale})">
  <path d="M-4 -9 C -12 -17 -22 -18 -28 -12" stroke="${DRAGON.line}" stroke-width="2.4" fill="none" stroke-linecap="round"/>
  <path d="M0 -10 C -6 -18 -14 -20 -20 -17" stroke="${DRAGON.line}" stroke-width="1.8" fill="none" stroke-linecap="round"/>
  <path d="M24 -1 C 30 -3 34 0 38 -2" stroke="${DRAGON.line}" stroke-width="1.3" fill="none" opacity="0.8"/>
  <path d="M24 3 C 29 5 33 3 36 6" stroke="${DRAGON.line}" stroke-width="1.1" fill="none" opacity="0.6"/>

  <polygon points="5,5 20,9 7,14" fill="${DRAGON.shade}" stroke="${DRAGON.line}" stroke-width="1.6"/>
  <polygon points="6,-8 24,-3 24,3 6,6" fill="${DRAGON.body}" stroke="${DRAGON.line}" stroke-width="1.8"/>
  <ellipse cx="-4" cy="0" rx="12" ry="10" fill="${DRAGON.body}" stroke="${DRAGON.line}" stroke-width="1.8"/>
  <polygon points="10,0 22,1 22,2.5 10,3.5" fill="${DRAGON.line}"/>
  <circle cx="20" cy="0" r="1" fill="${DRAGON.line}"/>
  <circle cx="-2" cy="-4" r="2.6" fill="${DRAGON.glow}"/>
  <circle cx="-1.4" cy="-4.8" r="0.9" fill="${DRAGON.line}"/>

  <g transform="translate(27,2)">
    <animateTransform attributeName="transform" type="translate" values="27 2;31 2;27 2" dur="0.5s" repeatCount="indefinite"/>
    <path d="M0 0 C 8 -2 14 -6 20 -5 C 15 -1 14 3 9 6 C 5 7 2 4 0 0 Z" fill="#F97316" opacity="0.95">
      <animate attributeName="opacity" values="0.95;0.55;0.95" dur="0.4s" repeatCount="indefinite"/>
    </path>
    <path d="M0 0 C 6 -1 10 -3 14 -3 C 11 1 10 3 6 5 C 3 5 1 3 0 0 Z" fill="#FDE68A">
      <animate attributeName="opacity" values="1;0.5;1" dur="0.35s" repeatCount="indefinite"/>
    </path>
  </g>
</g></g>`;
    // sơn từ đuôi → đầu để đầu rồng nằm trên cùng
    return segs.join("") + head;
}
export function renderDragon(cal, theme, opts = {}) {
    const { width, height, cols } = gridSize(cal);
    const total = cal.weeks.flat().reduce((s, d) => s + d.count, 0);
    const parts = [];
    // ===== bảng ô contribution — thiết kế lại: bo góc, glow L4, month labels =====
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
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" fill="none" role="img" aria-label="Contribution dragon — ${total} contributions in the last year">${parts.join("")}</svg>`;
}
const f = (n) => Math.round(n * 100) / 100;
