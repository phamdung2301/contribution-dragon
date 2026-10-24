import { fixtureCalendar } from "../dist/fetch.js";
import { buildShow } from "../dist/render.js";
import { simulateChain } from "../dist/render.js";
import { GEO, gridSize } from "../dist/route.js";
import { writeFileSync, mkdirSync } from "node:fs";

const cal = fixtureCalendar();
const show = buildShow(cal, 777);
const sim = simulateChain(show.phases, show.total, 0.15, 8.5, 11);
const { width, height } = gridSize(cal);
const colors = ["#FF0000","#FF7F00","#FFFF00","#00FF00","#00FFFF","#0000FF","#8B00FF","#FF00FF","#FFFFFF","#88FF88","#FF8888"];
mkdirSync("debug", { recursive: true });

[0.5, 2, 4, 6, 9, 12, 16, 20, 24, 28].forEach((tt, frame) => {
  const t = Math.min(tt, show.total - 0.01);
  const idx = Math.min(sim.n, Math.round(t / 0.15));
  let parts = [];
  // board mờ
  for (let c = 0; c < cal.weeks.length; c++)
    for (let r = 0; r < 7; r++)
      parts.push(`<rect x="${GEO.marginX + c*GEO.pitch}" y="${GEO.top + r*GEO.pitch}" width="11" height="11" rx="2" fill="#1B2129" opacity="0.5"/>`);
  // chuỗi: mỗi đốt một màu + đường nối
  const pts = sim.samples.map(seg => seg[Math.min(idx, seg.length - 1)]);
  const line = pts.map((p, i) => `${i ? "L" : "M"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  parts.push(`<path d="${line}" stroke="#444" stroke-width="2"/>`);
  pts.forEach((p, i) => {
    const rr = i === 0 ? 13 : Math.max(3, 10 - i * 0.8);
    parts.push(`<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${rr}" fill="${colors[i % colors.length]}" opacity="0.95"/>`);
    parts.push(`<text x="${p.x + 12}" y="${p.y - 8}" font-size="9" fill="#fff" font-family="monospace">${i}${i === 0 ? "=HEAD" : ""}</text>`);
  });
  writeFileSync(`debug/frame-${String(frame).padStart(2, "0")}-t${t}.svg`,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-30} ${-30} ${width + 60} ${height + 60}">${parts.join("")}</svg>`);
});
console.log("debug frames written:", 10);
