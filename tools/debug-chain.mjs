import { readFileSync } from "node:fs";
import { buildShow, simulateChain } from "../dist/render.js";
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
const sim = simulateChain(show.phases, show.total, 0.15, 7, 14);
const { width, height } = gridSize(cal);
const colors = ["#FF2222","#FF7F00","#FFE700","#22FF22","#22FFFF","#4488FF","#8844FF","#FF44FF","#FFFFFF","#88FF88","#FF8888","#F0F0F0","#FFC0CB"];
mkdirSync("debug", { recursive: true });

const times = [];
for (let t = 0.5; t < show.total; t += 1.2) times.push(t);
times.forEach((tt, frame) => {
  const idx = Math.min(sim.n + 1, Math.round(tt / 0.15));
  let parts = [];
  for (let c = 0; c < cal.weeks.length; c++)
    for (let r = 0; r < 7; r++)
      if (cal.weeks[c]?.[r]) parts.push(`<rect x="${GEO.marginX + c*GEO.pitch}" y="${GEO.top + r*GEO.pitch}" width="11" height="11" rx="2" fill="#1B2129" opacity="0.5"/>`);
  const pts = sim.samples.map(seg => seg[Math.min(idx, seg.length - 1)]);
  const line = pts.map((p, i) => `${i ? "L" : "M"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  parts.push(`<path d="${line}" stroke="#555" stroke-width="2" stroke-dasharray="3 3"/>`);
  pts.forEach((p, i) => {
    const rr = i === 0 ? 13 : Math.max(3.5, 10 - i * 0.7);
    parts.push(`<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${rr}" fill="${colors[i % colors.length]}" opacity="0.95"/>`);
    parts.push(`<text x="${p.x + 11}" y="${p.y - 7}" font-size="9" fill="#fff" font-family="monospace">${i}${i === 0 ? "=HEAD" : ""}</text>`);
  });
  const stretch = Math.hypot(pts[0].x - pts[pts.length-1].x, pts[0].y - pts[pts.length-1].y).toFixed(0);
  parts.push(`<text x="10" y="16" font-size="13" fill="#FF2222" font-family="monospace">t=${tt.toFixed(1)}s head-to-tail=${stretch}px</text>`);
  writeFileSync(`debug/frame-${String(frame).padStart(2, "0")}.svg`,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-30} ${-30} ${width + 60} ${height + 60}">${parts.join("")}</svg>`);
});
console.log("frames:", times.length, "| total:", show.total.toFixed(1) + "s");
