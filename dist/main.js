/**
 * Entry cho GitHub Action (node20). Inputs đọc từ env INPUT_*:
 *   user, token, out-dark, out-light (tuỳ chọn), show-count ("true"/"false")
 * Output: files — danh sách file SVG đã render (ghi vào $GITHUB_OUTPUT).
 */
import { renderToFile } from "./cli.js";
const env = (k) => process.env[`INPUT_${k.replace(/-/g, "_").toUpperCase()}`] ?? undefined;
const jobs = [];
const produced = [];
const outDark = env("OUT_DARK");
if (outDark)
    jobs.push(renderToFile({ user: env("USER"), token: env("TOKEN"), theme: "dark", out: outDark })
        .then(f => produced.push(f)));
const outLight = env("OUT_LIGHT");
if (outLight)
    jobs.push(renderToFile({ user: env("USER"), token: env("TOKEN"), theme: "light", out: outLight })
        .then(f => produced.push(f)));
if (jobs.length === 0) {
    jobs.push(renderToFile({ user: env("USER"), token: env("TOKEN"), theme: "dark", out: "dragon.svg" })
        .then(f => produced.push(f)));
}
await Promise.all(jobs);
if (process.env.GITHUB_OUTPUT) {
    const { appendFile } = await import("node:fs/promises");
    await appendFile(process.env.GITHUB_OUTPUT, `files<<EOF\n${produced.join("\n")}\nEOF\n`);
}
console.log("🐉 contribution-dragon:", produced.join(", "));
