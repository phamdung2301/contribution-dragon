import { readFileSync } from "node:fs";
import { buildShow, simulateChain } from "../dist/render.js";
import { GEO } from "../dist/route.js";

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

const cal = calFromSvg(readFileSync("demo/dragon-real-dark.svg", "utf8"));
const show = buildShow(cal, 20261025);
const sim = simulateChain(show.phases, show.total, 0.15, 7, 14);
console.log("phases:");
show.phases.forEach((p, i) => console.log(
  `  ${i} ${p.kind} t=${p.t0.toFixed(2)}-${p.t1.toFixed(2)} from=(${p.from.x.toFixed(0)},${p.from.y.toFixed(0)}) to=(${p.to.x.toFixed(0)},${p.to.y.toFixed(0)})`
));
console.log("head trace (mỗi 1s):");
for (let s = 0; s <= show.total; s += 1) {
  const idx = Math.min(sim.n + 1, Math.round(s / 0.15));
  const h = sim.samples[0][idx];
  const ph = show.phases.find(p => s >= p.t0 && s <= p.t1) ?? show.phases[0];
  console.log(`  t=${s} ${ph.kind} head=(${h.x.toFixed(0)},${h.y.toFixed(0)})`);
}
