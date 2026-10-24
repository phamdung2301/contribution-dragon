# -*- coding: utf-8 -*-
"""Install arc-offset chain riders: all segments ride the head's shared path
at fixed arc-length delays (game-motion: follow-the-leader without coiling)."""
p = 'src/render.ts'
s = open(p, encoding='utf8').read()

# A. Show thêm vertices
s = s.replace(
    '  pathLen: number;\n  burns: Burn[];\n}',
    '  pathLen: number;\n  burns: Burn[];\n  vertices: Pt[];\n}'
)
s = s.replace(
    '  return { phases, total: t, pathD, pathLen, burns };',
    '  return { phases, total: t, pathD, pathLen, burns, vertices };'
)

# B. xoá simulateChain + ChainSim + segMotion (thay bằng arc-offset riders)
start = s.index('interface ChainSim')
end = s.index('// ============================================================\n// dragon assembly')
s = s[:start] + s[end:]

# C. dragonRiders mới — arc-offset riders trên path chung
start = s.index('function dragonRiders(show: Show, seed: number): string {')
end = s.index('function emitChannel(')
new_riders = '''function dragonRiders(show: Show): string {
  const total = show.total;
  const segLens = show.phases.map(p => (p.kind === "move" || p.kind === "walk" || p.kind === "slide") ? dist(p.from, p.to) : 0);
  const bounds = [0, ...show.phases.map(p => p.t1)];

  // polyline của đầu: vertices + cumulative distances
  const verts = show.vertices;
  const cum: number[] = [0];
  for (let i = 1; i < verts.length; i++) cum.push(cum[i - 1] + dist(verts[i - 1], verts[i]));
  const pointAtDist = (d: number): Pt => {
    const dd = Math.max(0, Math.min(show.pathLen, d));
    let i = 1;
    while (i < cum.length && cum[i] < dd) i++;
    const k = (dd - cum[i - 1]) / Math.max(0.0001, cum[i] - cum[i - 1]);
    return lerpPt(verts[i - 1], verts[i], k);
  };
  const distAt = (t: number) => {
    const T = show.phases[show.phases.length - 1].t1;
    const tt = ((t % T) + T) % T;
    let d = 0;
    for (let i = 0; i < show.phases.length; i++) {
      const ph = show.phases[i];
      if (tt <= ph.t1) {
        if (ph.kind === "move" || ph.kind === "walk" || ph.kind === "slide") {
          const k = (tt - ph.t0) / Math.max(0.0001, ph.t1 - ph.t0);
          return d + segLens[i] * k;
        }
        return d;
      }
      d += segLens[i];
    }
    return d;
  };

  const OPACITY = `<animate attributeName="opacity" ${linEmit(
    bounds.map(b => b / total), bounds.map(b => f(opacityAt(show.phases, b))), v => String(f(v)))} dur="${f(total)}s" repeatCount="indefinite"/>`;

  // heading của đầu — từ vector vận tốc (sample mỗi 0.3s)
  const headPts: Pt[] = [], headTs: number[] = [];
  for (let t = 0; t <= total; t += 0.3) { headPts.push(pointAtDist(distAt(t))); headTs.push(t); }
  const { angles, flips, kts: hKts } = headingChannel(headPts, 0.3, 0.3);
  const ROT = `<animateTransform attributeName="transform" type="rotate" ${linEmit(hKts, angles, v => String(f(v)))} dur="${f(total)}s" repeatCount="indefinite"/>`;
  const FLIP = `<animateTransform attributeName="transform" type="scale" ${snapEmit(hKts, flips, v => `${f(v)} 1`)} dur="${f(total)}s" repeatCount="indefinite"/>`;

  // đuôi lửa — dài theo len của từng pha spray
  const flameKnots: { t: number; v: number }[] = [{ t: 0, v: 1 }];
  for (const ph of show.phases) {
    if (ph.kind !== "spray" || !ph.len) continue;
    const ext = 0.9 + (ph.len - 1) * 0.62;
    flameKnots.push({ t: ph.t0 - 0.002, v: 1 });
    flameKnots.push({ t: ph.t0 + 0.1, v: ext });
    flameKnots.push({ t: ph.t1 - 0.002, v: ext });
    flameKnots.push({ t: ph.t1, v: 1 });
  }
  const FLAME = `<animateTransform attributeName="transform" type="scale" ${emitChannel(
    flameKnots, total, v => `${f(v)} 1`)} dur="${f(total)}s" repeatCount="indefinite"/>`;

  /** rider trễ arcDelay px dọc path chung — keyPoints = (d(t) - arcDelay)/len */
  const rider = (arcDelay: number, content: string) => {
    const kps = bounds.map(b => f(Math.max(0, Math.min(1, (distAt(b) - arcDelay) / show.pathLen))));
    const kts = bounds.map(b => f(b / total));
    return `<g><animateMotion dur="${f(total)}s" repeatCount="indefinite" path="${show.pathD}" keyPoints="${kps.join(";")}" keyTimes="${kts.join(";")}" calcMode="linear"/>` +
      `<g transform="scale(${DRAGON.scale})">${OPACITY}${content}</g></g>`;
  };

  const segs: string[] = [];

  // thân: 12 đốt — MỖI ĐỐT 2 LỚP: viền mint (r+1.2) trước, fill đậm sau →
  // silhouette mint LIÊN MẠCH bao toàn chuỗi (không đường chia đốt)
  const radii = [11, 10.6, 10.2, 9.7, 9.2, 8.6, 8, 7.4, 6.8, 6.2, 5.6, 5];
  for (let k = radii.length; k >= 1; k--) {
    const r = radii[k - 1];
    segs.push(rider(k * 7,
      `<circle r="${r + 1.2}" fill="${DRAGON.shade}" stroke="${DRAGON.line}" stroke-width="1.5"/>`));
  }
  for (let k = radii.length; k >= 1; k--) {
    const r = radii[k - 1];
    const spike = k <= 7
      ? `<polygon points="0,${-r + 1} 3.4,${-r - 5.5} -3.4,${-r - 5.5}" fill="${DRAGON.spike}" opacity="0.95"/>`
      : "";
    segs.push(rider(k * 7,
      `${spike}<circle r="${r}" fill="${k % 2 === 0 ? DRAGON.body : DRAGON.shade}"/>`));
  }

  // cánh trên đốt 3
  segs.push(rider(3 * 7,
    `<g opacity="0.5"><path d="M2 -8 C -10 -24 -27 -30 -35 -24 C -27 -19 -17 -13 -5 -7 Z" fill="${DRAGON.shade}">` +
    `<animateTransform attributeName="transform" type="rotate" values="-13 0 -5;13 0 -5;-13 0 -5" dur="0.72s" repeatCount="indefinite"/></path></g>` +
    `<path d="M0 -7 C -11 -20 -25 -24 -31 -18 C -23 -13 -13 -9 -4 -5 Z" fill="${DRAGON.body}" stroke="${DRAGON.line}" stroke-width="1.4">` +
    `<animateTransform attributeName="transform" type="rotate" values="11 0 -5;-15 0 -5;11 0 -5" dur="0.72s" repeatCount="indefinite"/></path>` +
    `<g transform="translate(2,2)"><path d="M0 0 C 5 -1 9 -3 13 -2 C 10 1 9 3 5 4 Z" fill="#F97316" opacity="0.9"/></g>`
  ));

  // đuôi: spade lớn trên đốt cuối (trễ nhất)
  segs.push(rider(13 * 7,
    `<circle r="5" fill="${DRAGON.shade}" stroke="${DRAGON.line}" stroke-width="1.5"/>` +
    `<polygon points="-2,-4 -10,-7 -7,0 -10,7 -2,4" fill="${DRAGON.spike}" opacity="0.95"/>` +
    `<polygon points="-1,-2.5 -7,-4 -4,0 -7,4 -1,2.5" fill="${DRAGON.glow}" opacity="0.8"/>`
  ));

  // ĐẦU — xoay theo vector heading; râu + lửa
  const head = `
  <path d="M-4 -9 C -12 -17 -22 -18 -28 -12" stroke="${DRAGON.line}" stroke-width="2.4" fill="none" stroke-linecap="round"/>
  <path d="M0 -10 C -6 -18 -14 -20 -20 -17" stroke="${DRAGON.line}" stroke-width="1.8" fill="none" stroke-linecap="round"/>
  <g>
    <animateTransform attributeName="transform" type="rotate" values="-5 24 0;6 24 0;-5 24 0" dur="2.4s" repeatCount="indefinite"/>
    <path d="M26 -2 C 34 -8 44 -6 52 -12 C 56 -15 60 -14 63 -16" stroke="${DRAGON.line}" stroke-width="1.7" fill="none" stroke-linecap="round"/>
    <path d="M27 3 C 35 7 43 5 50 10 C 54 13 58 12 62 14" stroke="${DRAGON.line}" stroke-width="1.3" fill="none" stroke-linecap="round" opacity="0.8"/>
  </g>
  <path d="M-7 -7 L 3 -9" stroke="${DRAGON.line}" stroke-width="1.6" stroke-linecap="round"/>
  <polygon points="5,5 20,9 7,14" fill="${DRAGON.shade}" stroke="${DRAGON.line}" stroke-width="1.6"/>
  <polygon points="9,7 12,9.5 10,10" fill="${DRAGON.glow}" opacity="0.9"/>
  <polygon points="14,8.2 17,10.5 15,11" fill="${DRAGON.glow}" opacity="0.9"/>
  <polygon points="6,-8 24,-3 24,3 6,6" fill="${DRAGON.body}" stroke="${DRAGON.line}" stroke-width="1.8"/>
  <ellipse cx="-4" cy="0" rx="15" ry="11.5" fill="${DRAGON.body}" stroke="${DRAGON.line}" stroke-width="1.8"/>
  <polygon points="10,0 22,1 22,2.5 10,3.5" fill="${DRAGON.line}"/>
  <circle cx="20" cy="0" r="1" fill="${DRAGON.line}"/>
  <circle cx="-2" cy="-4" r="3" fill="${DRAGON.glow}"/>
  <circle cx="-1" cy="-4.9" r="1.05" fill="${DRAGON.line}"/>
  <g>
    ${FLAME}
    <g>
      <animateTransform attributeName="transform" type="translate" values="28 2;31 2;28 2" dur="0.5s" repeatCount="indefinite"/>
      <path d="M0 0 C 8 -2 14 -6 20 -5 C 15 -1 14 3 9 6 C 5 7 2 4 0 0 Z" fill="#F97316" opacity="0.95">
        <animate attributeName="opacity" values="0.95;0.55;0.95" dur="0.4s" repeatCount="indefinite"/>
      </path>
      <path d="M0 0 C 6 -1 10 -3 14 -3 C 11 1 10 3 6 5 C 3 5 1 3 0 0 Z" fill="#FDE68A">
        <animate attributeName="opacity" values="1;0.5;1" dur="0.35s" repeatCount="indefinite"/>
      </path>
    </g>
  </g>`;
  segs.push(rider(0, head));

  return segs.join("");
}

'''
s = s[:start] + new_riders + s[end:]

# D. renderDragon: dragonRiders(show) — bỏ seed param
s = s.replace('parts.push(dragonRiders(show, seed));', 'parts.push(dragonRiders(show));')

open(p, 'w', encoding='utf8').write(s)
print('arc-offset chain riders installed')
