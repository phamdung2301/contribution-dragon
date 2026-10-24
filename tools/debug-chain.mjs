import { readFileSync } from "node:fs";
import { buildShow } from "../dist/render.js";
import { GEO, gridSize } from "../dist/route.js";
import { writeFileSync, mkdirSync } from "node:fs";

// dựng calendar từ chính SVG render thật (rect fill = màu level)
function calFromSvg(svg) {
  const cells = [...svg.matchAll(/<rect x="([\d.-]+)" y="([\d.-]+)" width="11" height="11" rx="2" fill="([^"]*)"/g)]
    .map(m => ({ x: +m[1], y: +m[2], fill: m[3] }));
  const x0 = Math.min(...cells.map(c => c.x)), y0 = Math.min(...cells.map(c => c.y));
  const cols = Math.round((Math.max(...cells.map(c => c.x)) - x0) / GEO.pitch) + 1;
  const weeks = [];
  for (let c = 0; c < cols; c++) {
    const week = [];
    for (let r = 0; r < 7; r++) {
      const cell = cells.find(cc => Math.abs(cc.x - (x0 + c * GEO.pitch)) < 1 && Math.abs(cc.y - (y0 + r * GEO.pitch)) < 1);
      const level = !cell ? 0 : cell.fill === "#1B2129" ? 0 : cell.fill === "#123B33" ? 1 : cell.fill === "#0C6B5C" ? 2 : cell.fill === "#0C9F8A" ? 3 : 4;
      week.push({ date: "", count: level * 3, level });
    }
    weeks.push(week);
  }
  return { weeks };
}

const svg = readFileSync("demo/dragon-real-dark.svg", "utf8");
const cal = calFromSvg(svg);
const show = buildShow(cal, 20261025);
const { width, height } = gridSize(cal);
const colors = ["#FF2222","#FF7F00","#FFE700","#22FF22","#22FFFF","#4488FF","#8844FF","#FF44FF","#FFFFFF","#88FF88","#FF8888","#F0F0F0","#FFC0CB"];

// polyline của đầu + cumulative
const verts = show.vertices;
const cum = [0];
for (let i = 1; i < verts.length; i++) cum.push(cum[i-1] + Math.hypot(verts[i].x - verts[i-1].x, verts[i].y - verts[i-1].y));
const pointAtDist = (d) => {
  const dd = Math.max(0, Math.min(show.pathLen, d));
  let i = 1; while (i < cum.length && cum[i] < dd) i++;
  const k = (dd - cum[i-1]) / Math.max(0.0001, cum[i] - cum[i-1]);
  return { x: verts[i-1].x + (verts[i].x - verts[i-1].x) * k, y: verts[i-1].y + (verts[i].y - verts[i-1].y) * k };
};
const segLens = show.phases.map(p => (p.kind === "move" || p.kind === "walk" || p.kind === "slide") ? Math.hypot(p.to.x - p.from.x, p.to.y - p.from.y) : 0);
const distAt = (t) => {
  const T = show.phases[show.phases.length - 1].t1;
  const tt = ((t % T) + T) % T;
  let d = 0;
  for (let i = 0; i < show.phases.length; i++) {
    const ph = show.phases[i];
    if (tt <= ph.t1) {
      if (["move","walk","slide"].includes(ph.kind)) { const k = (tt - ph.t0) / Math.max(0.0001, ph.t1 - ph.t0); return d + segLens[i] * k; }
      return d;
    }
    d += segLens[i];
  }
  return d;
};

mkdirSync("debug", { recursive: true });
const times = [];
for (let t = 0.5; t < show.total; t += 1.2) times.push(t);
times.forEach((tt, frame) => {
  let parts = [];
  for (let c = 0; c < cal.weeks.length; c++)
    for (let r = 0; r < 7; r++)
      if (cal.weeks[c]?.[r]) parts.push(`<rect x="${GEO.marginX + c*GEO.pitch}" y="${GEO.top + r*GEO.pitch}" width="11" height="11" rx="2" fill="#1B2129" opacity="0.5"/>`);
  const dHead = distAt(tt);
  const pts = [];
  for (let k = 0; k < 13; k++) pts.push(pointAtDist(dHead - k * 7));   // chuỗi arc-offset
  const line = pts.map((p, i) => `${i ? "L" : "M"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  parts.push(`<path d="${line}" stroke="#555" stroke-width="2" stroke-dasharray="3 3"/>`);
  pts.forEach((p, i) => {
    const rr = i === 0 ? 13 : Math.max(3.5, 10 - i * 0.7);
    parts.push(`<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${rr}" fill="${colors[i % colors.length]}" opacity="0.95"/>`);
    parts.push(`<text x="${p.x + 11}" y="${p.y - 7}" font-size="9" fill="#fff" font-family="monospace">${i}${i === 0 ? "=HEAD" : ""}</text>`);
  });
  const stretch = Math.hypot(pts[0].x - pts[pts.length-1].x, pts[0].y - pts[pts.length-1].y).toFixed(0);
  parts.push(`<text x="10" y="16" font-size="13" fill="#FF2222" font-family="monospace">t=${tt.toFixed(1)}s head-to-tail=${stretch}px (tự nhiên ≤ 91px)</text>`);
  writeFileSync(`debug/frame-${String(frame).padStart(2, "0")}.svg`,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-30} ${-30} ${width + 60} ${height + 60}">${parts.join("")}</svg>`);
});
console.log("frames:", times.length, "| total:", show.total.toFixed(1) + "s");
