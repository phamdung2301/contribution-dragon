import { fixtureCalendar } from "../dist/fetch.js";
import { buildShow, simulateChain } from "../dist/render.js";
import { GEO, gridSize } from "../dist/route.js";
import { writeFileSync, mkdirSync } from "node:fs";

const cal = fixtureCalendar();
const show = buildShow(cal, 777);
const sim = simulateChain(show.phases, show.total, 0.15, 8.5, 11);
const { width, height } = gridSize(cal);
const colors = ["#FF2222","#FF7F00","#FFE700","#22FF22","#22FFFF","#4488FF","#8844FF","#FF44FF","#FFFFFF","#88FF88","#FF8888"];
mkdirSync("debug", { recursive: true });

const times = [];
for (let t = 0.5; t < show.total; t += 1.2) times.push(t);
times.forEach((tt, frame) => {
  const idx = Math.min(sim.n + 1, Math.round(tt / 0.15));
  let parts = [];
  for (let c = 0; c < cal.weeks.length; c++)
    for (let r = 0; r < 7; r++)
      parts.push(`<rect x="${GEO.marginX + c*GEO.pitch}" y="${GEO.top + r*GEO.pitch}" width="11" height="11" rx="2" fill="#1B2129" opacity="0.5"/>`);
  const pts = sim.samples.map(seg => seg[Math.min(idx, seg.length - 1)]);
  const line = pts.map((p, i) => `${i ? "L" : "M"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  parts.push(`<path d="${line}" stroke="#555" stroke-width="2" stroke-dasharray="3 3"/>`);
  pts.forEach((p, i) => {
    const rr = i === 0 ? 13 : Math.max(3, 10 - i * 0.8);
    parts.push(`<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${rr}" fill="${colors[i % colors.length]}" opacity="0.95"/>`);
    parts.push(`<text x="${p.x + 11}" y="${p.y - 7}" font-size="9" fill="#fff" font-family="monospace">${i}${i === 0 ? "=HEAD" : ""}</text>`);
  });
  // đo độ giãn: khoảng cách đầu↔đốt cuối
  const stretch = Math.hypot(pts[0].x - pts[pts.length-1].x, pts[0].y - pts[pts.length-1].y).toFixed(0);
  parts.push(`<text x="10" y="16" font-size="13" fill="#FF2222" font-family="monospace">t=${tt.toFixed(1)}s head-to-tail=${stretch}px ${Number(stretch) > 100 ? "!! STRETCHED !!" : ""}</text>`);
  writeFileSync(`debug/frame-${String(frame).padStart(2, "0")}.svg`,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-30} ${-30} ${width + 60} ${height + 60}">${parts.join("")}</svg>`);
});
console.log("frames:", times.length, "| total:", show.total.toFixed(1) + "s");
