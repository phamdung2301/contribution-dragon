// msg-filter cho git filter-branch: đọc message từ stdin, map theo repo, ghi stdout
import { readFileSync } from "node:fs";
const repo = process.argv[2];
const MAPS = {
  dragon: [
    ["feat: contribution-dragon v1 — rồng neon bay trên contribution graph (TS, zero-dep, SMIL, GitHub Action)",
     "feat: contribution-dragon v1 — neon dragon over the contribution graph (TS, zero-dep, SMIL, GitHub Action)"],
    ["fix(action): đọc input có gạch ngang đúng chuẩn GitHub (INPUT_OUT-DARK)",
     "fix(action): read dashed inputs the standard GitHub way (INPUT_OUT-DARK)"],
    ["fix(action): ưu tiên đọc DRAGON_* env — đường truyền input chắc chắn nhất",
     "fix(action): prefer DRAGON_* env vars — the most reliable input channel"],
    ["feat: rồng v4 — rigid sprite (thân ribbon liền mạch) + teleport hunter: ẩn/hiện ngẫu nhiên, ăn ô sáng theo đường ngắn nhất, bay ra ngoài boundary",
     "feat: dragon v4 — rigid sprite (seamless ribbon body) + teleport hunter: random fades, eats bright cells via shortest path, flies outside the grid"],
  ],
  profile: [
    ["feat: viết lại profile — 1 gradient xuyên suốt, card hòa nền, sửa heading + code fence",
     "feat: redesign profile — one continuous gradient, blended cards, fixed headings + code fence"],
    ["feat: divider giữa mọi section, thống nhất heading, stats hòa nền — thêm section 3D skyline",
     "feat: divider between every section, unified headings, blended stats — add 3D skyline section"],
    ["ci: workflow skyline 3D đóng góp (dispatch + hàng tháng)",
     "ci: 3D contribution skyline workflow (dispatch + monthly)"],
    ["feat: header máy tính isometric, solar-system stack, 4 build card động — toàn bộ SMIL",
     "feat: isometric computer header, solar-system stack, 4 animated build cards — all SMIL"],
    ["feat: header voxel isometric + divider hairline tự vẽ — rewrite profile v3 'terminal garden'",
     "feat: isometric voxel header + hand-drawn hairline divider — profile v3 'terminal garden' rewrite"],
    ["fix: link builds — eyewear-art-mu + vahn-tattoo vercel (do user cung cấp)",
     "fix: build links — eyewear-art-mu + vahn-tattoo vercel (provided by user)"],
    ["feat: builds lên 6 dự án (thêm lumiere, vahn, insurance — bỏ erp), link vercel thay github",
     "feat: builds up to 6 projects (add lumiere, vahn, insurance — drop erp), vercel links instead of github"],
    ["refactor: bỏ dòng 'more' ở builds — bỏ hẳn section 3D kèm workflow + skyline files",
     "refactor: drop the 'more' line in builds — remove the whole 3D section with workflow + skyline files"],
    ["feat: header workstation v3 — màn hình chạy shader plasma (feTurbulence), scanline quét, keycap riêng, quạt case quay",
     "feat: workstation header v3 — shader plasma screen (feTurbulence), scanline sweep, individual keycaps, spinning case fan"],
    ["feat: thay snake bằng RỒNG — generator tự viết contribution-dragon",
     "feat: replace snake with a DRAGON — self-built contribution-dragon generator"],
    ["fix(ci): truyền input qua env DRAGON_* — tránh quirk đặt tên INPUT của runner",
     "fix(ci): pass inputs via DRAGON_* env — dodge the runner's INPUT naming quirk"],
    ["docs: README mô tả dự án + cách chạy",
     "docs: README with project description and usage"],
  ],
};
let msg = "";
process.stdin.setEncoding("utf8");
for await (const chunk of process.stdin) msg += chunk;
const map = MAPS[repo] ?? [];
for (const [vi, en] of map) if (msg.trimStart().startsWith(vi.slice(0, 40)) || msg.includes(vi)) { msg = msg.replace(vi, en); break; }
process.stdout.write(msg);
