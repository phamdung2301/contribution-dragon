import { writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { fetchCalendar, fixtureCalendar } from "./fetch.js";
import { renderDragon } from "./render.js";
import { THEMES } from "./theme.js";

export interface RenderRequest {
  user?: string;
  token?: string;
  fixture?: boolean;
  theme?: "dark" | "light";
  out: string;
  showCount?: boolean;
}

export async function renderToFile(req: RenderRequest): Promise<string> {
  const theme = THEMES[req.theme ?? "dark"];
  const cal = req.fixture || !req.token
    ? fixtureCalendar()
    : await fetchCalendar(req.token, req.user ?? "");
  const svg = renderDragon(cal, theme, { showCount: req.showCount });
  await mkdir(dirname(req.out), { recursive: true });
  await writeFile(req.out, svg, "utf8");
  return req.out;
}

/** CLI: contribution-dragon --user X [--token ...|--fixture] [--theme dark] --out file.svg */
export async function cli(argv: string[]): Promise<void> {
  const get = (flag: string) => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const out = get("--out") ?? "dragon.svg";
  const theme = (get("--theme") as "dark" | "light") ?? "dark";
  const fixture = argv.includes("--fixture");
  const user = get("--user") ?? process.env.DRAGON_USER;
  const token = get("--token") ?? process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN;
  const showCount = !argv.includes("--no-count");

  if (!fixture && !token) {
    console.error("Thiếu token: dùng --fixture để render demo, hoặc cấp GH_TOKEN (scope read:user).");
    process.exit(1);
  }
  const file = await renderToFile({ user, token, fixture, theme, out, showCount });
  console.log(`🐉 ${file} (${theme})`);
}

if (process.argv[1] && process.argv[1].endsWith("cli.js")) {
  await cli(process.argv.slice(2));
}
