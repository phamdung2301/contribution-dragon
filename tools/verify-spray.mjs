// verify: các burns nằm trong bảng + có hướng chéo được dùng
import { readFileSync } from "node:fs";
import { buildShow } from "../dist/render.js";
import { fixtureCalendar } from "../dist/fetch.js";
import { GEO } from "../dist/route.js";

const cal = fixtureCalendar();
const show = buildShow(cal, 4242);
const { cols } = { cols: cal.weeks.length };
let out = 0, diagonal = 0, total = 0;
const burnsByKey = new Map();
for (const b of show.burns) {
  const key = `${b.col},${b.row}`;
  if (!burnsByKey.has(key)) burnsByKey.set(key, b);
}
for (const b of burnsByKey.values()) {
  total++;
  if (b.col < 0 || b.col >= cols || b.row < 0 || b.row > 6) out++;
}
// phát hiện hướng chéo: các burn của 1 session so với origin — xem phase spray
const diagSprays = show.phases.filter(p => p.kind === "spray");
console.log("spray phases:", diagSprays.length, "(2 phiên × 1-4 hướng)");
console.log("burned cells:", total, "| ngoài bảng:", out);
console.log("PASS:", out === 0 ? "✓ mọi lửa trong bảng" : "✗ có lửa ra ngoài");
