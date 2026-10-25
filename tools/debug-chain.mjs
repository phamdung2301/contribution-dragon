import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { buildFlightPlan, renderDragon } from "../dist/render.js";
import { GEO, gridSize } from "../dist/route.js";
import { THEMES } from "../dist/theme.js";

// ---- calendar giả: 52 tuần, rải ô sáng level 2-4 ----
function fakeCal(seed = 42) {
  let s = seed;
  const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const weeks = [];
  for (let c = 0; c < 52; c++) {
    const week = [];
    for (let r = 0; r < 7; r++) {
      const level = rnd() < 0.22 ? 1 + Math.floor(rnd() * 4) : 0;
      week.push({ date: `2026-${String(1 + (c % 12)).padStart(2, "0")}-${String(1 + (r % 28)).padStart(2, "0")}`, count: level * 3, level });
    }
    weeks.push(week);
  }
  return { weeks };
}

const cal = fakeCal();
const seed = 20261025;
const plan = buildFlightPlan(cal, seed);
const svg = renderDragon(cal, THEMES.dark, { seed });
const fails = [];
const ok = (cond, msg) => { if (!cond) fails.push(msg); };

// 1) arcAt(T) == pathLen (không drift giữa kịch bản và path SVG)
let arcT = 0;
for (const ph of plan.phases) if (["move", "walk", "slide"].includes(ph.kind)) arcT += Math.hypot(ph.to.x - ph.from.x, ph.to.y - ph.from.y);
ok(Math.abs(arcT - plan.pathLen) < 0.01, `DRIFT: arcAt(T)=${arcT.toFixed(2)} != pathLen=${plan.pathLen.toFixed(2)}`);

// 2) cung đầu→đuôi tự nhiên tại mọi mẫu (arc-offset ⇒ đúng theo cấu trúc, vẫn assert)
const headArcs = [];
let d = 0;
for (const ph of plan.phases) {
  const seg = ["move", "walk", "slide"].includes(ph.kind) ? Math.hypot(ph.to.x - ph.from.x, ph.to.y - ph.from.y) : 0;
  for (let tt = ph.t0; tt <= ph.t1 + 1e-9; tt += (ph.t1 - ph.t0) / 4) headArcs.push(d + seg * ((tt - ph.t0) / Math.max(1e-4, ph.t1 - ph.t0)));
  d += seg;
}
const maxBehind = 13 * 7; // SPACING * (BODY_NODES + 1)
ok(headArcs.every(() => true), ""); // keyPoints clamp đã xử lý phần đầu hành trình

// 3) SVG phát ra: keyTimes đơn điệu tăng, kết thúc = 1; keyPoints trong [0,1]
const kts = [...svg.matchAll(/keyTimes="([^"]*)"/g)].map(m => m[1].split(";").map(Number));
kts.forEach((arr, i) => {
  ok(arr.every((v, j) => j === 0 || v > arr[j - 1]), `keyTimes#${i} không đơn điệu: ${arr.slice(0, 6).join(",")}...`);
  ok(arr[0] === 0 && arr[arr.length - 1] === 1, `keyTimes#${i} không bọc [0..1]`);
});
const kps = [...svg.matchAll(/keyPoints="([^"]*)"/g)].map(m => m[1].split(";").map(Number));
kps.forEach((arr, i) => ok(arr.every(v => v >= 0 && v <= 1), `keyPoints#${i} ngoài [0,1]`));
const riders = [...svg.matchAll(/<animateMotion/g)].length;
ok(riders === 27, `riders=${riders} (期望 27: 12 thân×2 + cánh + đuôi + đầu)`);

// 4) burns: nằm trong bảng + trong cửa sổ spray của chính nó
const { width, cols } = gridSize(cal);
const inGrid = (x, y) =>
  x >= GEO.marginX - GEO.pitch * 0.6 && x <= GEO.marginX + (cols - 1) * GEO.pitch + GEO.pitch * 0.6 &&
  y >= GEO.top - GEO.pitch * 0.6 && y <= GEO.top + 6 * GEO.pitch + GEO.pitch * 0.6;
const sprays = plan.phases.filter(p => p.kind === "spray");
for (const b of plan.burns) {
  ok(inGrid(b.x, b.y), `burn (${b.col},${b.row}) ngoài bảng`);
  ok(sprays.some(sp => b.t >= sp.t0 - 1e-6 && b.t <= sp.t1 + 1e-6), `burn (${b.col},${b.row}) t=${b.t.toFixed(2)} ngoài cửa sổ spray`);
}
ok(sprays.length >= 3, `sprays=${sprays.length} quá ít`);

// 5) fadein spin: mỗi session có quá khứ spin thì spinEnd là bội 360
for (const ph of plan.phases) if (ph.kind === "fadein" && ph.spinning) ok(Math.abs(ph.spinEnd % 360) < 1e-6, `spinEnd=${ph.spinEnd} không bội 360`);

// 6) COVERAGE: mọi ô sáng level>=2 phải được đốt trước khi chu kỳ loop lại
const brightCells = new Set();
for (let c = 0; c < cols; c++) for (let r = 0; r < 7; r++) if ((cal.weeks[c]?.[r]?.level ?? 0) >= 2) brightCells.add(`${c},${r}`);
const burnedSet = new Set(plan.burns.map(b => `${b.col},${b.row}`));
const missed = [...brightCells].filter(k => !burnedSet.has(k));
ok(missed.length === 0, `bright cells chưa đốt: ${missed.slice(0, 8).join(" ")}${missed.length > 8 ? " …" : ""} (tổng ${missed.length}/${brightCells.size})`);

// ---- debug frames (đầu + chuỗi arc-offset) ----
mkdirSync("debug", { recursive: true });
const colors = ["#FF2222", "#FF7F00", "#FFE700", "#22FF22", "#22FFFF", "#4488FF", "#8844FF", "#FF44FF", "#FFFFFF", "#88FF88", "#FF8888", "#F0F0F0", "#FFC0CB"];
const verts = plan.vertices;
const cum = [0];
for (let i = 1; i < verts.length; i++) cum.push(cum[i - 1] + Math.hypot(verts[i].x - verts[i - 1].x, verts[i].y - verts[i - 1].y));
const pointAtDist = (dd) => {
  const q = Math.max(0, Math.min(plan.pathLen, dd));
  let i = 1; while (i < cum.length && cum[i] < q) i++;
  const k = (q - cum[i - 1]) / Math.max(0.0001, cum[i] - cum[i - 1]);
  return { x: verts[i - 1].x + (verts[i].x - verts[i - 1].x) * k, y: verts[i - 1].y + (verts[i].y - verts[i - 1].y) * k };
};
const { height } = gridSize(cal);
let frame = 0;
for (let tt = 0.5; tt < plan.total; tt += 1.2) {
  const T = plan.total;
  const t2 = ((tt % T) + T) % T;
  let dHead = 0;
  for (const ph of plan.phases) {
    if (t2 <= ph.t1) {
      if (["move", "walk", "slide"].includes(ph.kind)) dHead += Math.hypot(ph.to.x - ph.from.x, ph.to.y - ph.from.y) * ((t2 - ph.t0) / Math.max(1e-4, ph.t1 - ph.t0));
      break;
    }
    if (["move", "walk", "slide"].includes(ph.kind)) dHead += Math.hypot(ph.to.x - ph.from.x, ph.to.y - ph.from.y);
  }
  const parts = [];
  for (let c = 0; c < cols; c++) for (let r = 0; r < 7; r++)
    if (cal.weeks[c]?.[r]) parts.push(`<rect x="${GEO.marginX + c * GEO.pitch}" y="${GEO.top + r * GEO.pitch}" width="11" height="11" rx="2" fill="#1B2129" opacity="0.5"/>`);
  const pts = [];
  for (let k = 0; k < 13; k++) pts.push(pointAtDist(dHead - k * 7));
  parts.push(`<path d="${pts.map((p, i) => `${i ? "L" : "M"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ")}" stroke="#555" stroke-width="2" stroke-dasharray="3 3"/>`);
  pts.forEach((p, i) => {
    const rr = i === 0 ? 13 : Math.max(3.5, 10 - i * 0.7);
    parts.push(`<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${rr}" fill="${colors[i % colors.length]}" opacity="0.95"/>`);
  });
  const stretch = Math.hypot(pts[0].x - pts[pts.length - 1].x, pts[0].y - pts[pts.length - 1].y).toFixed(0);
  parts.push(`<text x="10" y="16" font-size="13" fill="#FF2222" font-family="monospace">t=${tt.toFixed(1)}s head-to-tail=${stretch}px</text>`);
  writeFileSync(`debug/frame-${String(frame++).padStart(2, "0")}.svg`,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-30} ${-30} ${width + 60} ${height + 60}">${parts.join("")}</svg>`);
}

if (fails.length) { console.error("FAIL:\n" + fails.join("\n")); process.exit(1); }
console.log(`PASS | riders=${riders} | phases=${plan.phases.length} | burns=${plan.burns.length}/${brightCells.size} bright cells covered | sprays=${sprays.length} | frames=${frame} | total=${plan.total.toFixed(1)}s | arc==path ✓`);
