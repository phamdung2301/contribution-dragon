import { readFileSync } from "node:fs";
const s = readFileSync("demo/live-dragon.svg", "utf8");
const vb = s.match(/viewBox="([^"]*)"/)[1].split(/\s+/).map(Number);
const cells = [...s.matchAll(/<rect x="([\d.-]+)" y="([\d.-]+)" width="11" height="11" rx="2" fill="#1B2129"\/>/g)];
const xs = cells.map(m => Number(m[1])), ys = cells.map(m => Number(m[2]));
const gridL = Math.min(...xs) - 7, gridR = Math.max(...xs) + 18;
const gridT = Math.min(...ys) - 7, gridB = Math.max(...ys) + 18;
console.log("grid bounds: x", gridL, "-", gridR, "| y", gridT, "-", gridB, "| ô trống:", cells.length);

const motions = [...s.matchAll(/<animateMotion([^>]*)>/g)];
const head = motions[motions.length - 1][1];
const path = head.match(/path="([^"]*)"/)[1];
const kps = head.match(/keyPoints="([^"]*)"/)[1].split(";").map(Number);
const kts = head.match(/keyTimes="([^"]*)"/)[1].split(";").map(Number);
const cmds = path.match(/[ML] [\d.-]+ [\d.-]+/g).map(c => c.split(/\s+/).slice(1).map(Number));
const cum = [0];
for (let i = 1; i < cmds.length; i++) cum.push(cum[i-1] + Math.hypot(cmds[i][0]-cmds[i-1][0], cmds[i][1]-cmds[i-1][1]));
const totalLen = cum[cum.length-1];
const posAt = (frac) => {
  const d = frac * totalLen;
  let i = 1; while (i < cum.length && cum[i] < d) i++;
  const k = (d - cum[i-1]) / Math.max(0.0001, cum[i] - cum[i-1]);
  return { x: cmds[i-1][0] + (cmds[i][0]-cmds[i-1][0])*k, y: cmds[i-1][1] + (cmds[i][1]-cmds[i-1][1])*k };
};
const T = kts[kts.length-1] * 35;  // chu kỳ thực (dur=35 baked)
let inside = 0, totalN = 0;
const rows = [];
for (let sec = 0; sec <= Math.round(T); sec++) {
  let frac = kps[kps.length-1];
  for (let i = 1; i < kts.length; i++) {
    if (sec <= kts[i] * T) {
      const k = (sec - kts[i-1]*T) / ((kts[i]-kts[i-1])*T || 1);
      frac = kps[i-1] + (kps[i]-kps[i-1])*k;
      break;
    }
  }
  const p = posAt(frac);
  const inNow = p.x >= gridL && p.x <= gridR && p.y >= gridT && p.y <= gridB;
  totalN++; if (inNow) inside++;
  rows.push(`t=${sec}s x=${p.x.toFixed(0)} y=${p.y.toFixed(0)} ${inNow ? "IN" : "OUT"}`);
}
console.log("TỈ LỆ ĐẦU RỒNG TRONG BẢNG:", (inside/totalN*100).toFixed(0) + "%", "| chu kỳ ~", T.toFixed(0) + "s");
rows.forEach(r => console.log(r));
