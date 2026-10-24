import { Calendar } from "./theme.js";

export interface Pt { x: number; y: number }

export const GEO = {
  cell: 11,
  gap: 3,
  get pitch() { return this.cell + this.gap; },
  marginX: 14,
  top: 30,
  padBottom: 10,
};

export function gridSize(cal: Calendar) {
  const cols = cal.weeks.length;
  const rows = 7;
  return {
    cols,
    rows,
    width: GEO.marginX * 2 + cols * GEO.pitch,
    height: GEO.top + rows * GEO.pitch + GEO.padBottom,
  };
}

export function cellCenter(col: number, row: number): Pt {
  return { x: GEO.marginX + col * GEO.pitch + GEO.cell / 2, y: GEO.top + row * GEO.pitch + GEO.cell / 2 };
}

/**
 * Lộ trình của rồng: quét TỪNG CỘT (tuần), đổi chiều lên/xuống xen kẽ
 * (boustrophedon dọc) — rồng chỉ bao giờ đi xuống, sang phải, hoặc lên,
 * KHÔNG bao giờ đi lùi sang trái → head dùng rotate="auto" không bao giờ
 * bị lộn ngược. Ô không có đóng góp thì bay qua.
 */
export function buildRoute(cal: Calendar): { points: Pt[]; pathD: string; length: number } {
  const cols = cal.weeks.length;
  const points: Pt[] = [];
  let dir = 1; // 1: đi xuống, -1: đi lên
  for (let c = 0; c < cols; c++) {
    const rows = [0, 1, 2, 3, 4, 5, 6].sort((a, b) => dir === 1 ? a - b : b - a);
    let colHasContent = false;
    for (const r of rows) {
      if (cal.weeks[c][r].level === 0) continue;
      const p = cellCenter(c, r);
      // bỏ qua điểm trùng (sau cú nhảy chéo có thể trùng đầu cột)
      const last = points[points.length - 1];
      if (!last || last.x !== p.x || last.y !== p.y) points.push(p);
      colHasContent = true;
    }
    if (colHasContent) dir = -dir;
  }
  if (points.length < 2) {
    // fallback: rồng bay sin khi lịch trống
    const { width } = gridSize(cal);
    for (let x = GEO.marginX; x <= width - GEO.marginX; x += 12) {
      points.push({ x, y: GEO.top + 3 * GEO.pitch + Math.sin(x / 40) * GEO.pitch * 2 });
    }
  }
  return { points, ...toPath(points) };
}

/** Nối điểm thành path bo góc nhẹ (quadratic tại khúc cua) + tính tổng chiều dài. */
export function toPath(points: Pt[], radius = 4): { pathD: string; length: number } {
  let d = `M ${f(points[0].x)} ${f(points[0].y)}`;
  let length = 0;
  for (let i = 1; i < points.length; i++) {
    const p = points[i], prev = points[i - 1];
    length += Math.hypot(p.x - prev.x, p.y - prev.y);
    const isCorner = i < points.length - 1 && isTurn(points[i - 1], points[i], points[i + 1]);
    if (!isCorner || radius <= 0) {
      d += ` L ${f(p.x)} ${f(p.y)}`;
      continue;
    }
    // vào khúc cua: dừng trước r, rẽ qua đỉnh bằng Q, đi tiếp sau r
    const inLen = Math.hypot(p.x - prev.x, p.y - prev.y);
    const outLen = Math.hypot(points[i + 1].x - p.x, points[i + 1].y - p.y);
    const r = Math.min(radius, inLen / 2, outLen / 2);
    const inPt = lerp(p, prev, r / inLen);
    const outPt = lerp(p, points[i + 1], r / outLen);
    d += ` L ${f(inPt.x)} ${f(inPt.y)} Q ${f(p.x)} ${f(p.y)} ${f(outPt.x)} ${f(outPt.y)}`;
    // đoán thêm chiều dài đoạn cong ≈ đi qua đỉnh (bỏ sai lệch nhỏ)
    length += 0; // giữ tuyến tính — sai số nhỏ, không ảnh hưởng nhịp thân
  }
  return { pathD: d, length };
}

const f = (n: number) => Math.round(n * 100) / 100;
const lerp = (a: Pt, b: Pt, t: number): Pt => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
function isTurn(a: Pt, b: Pt, c: Pt): boolean {
  return Math.abs((b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x)) > 0.01;
}

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
