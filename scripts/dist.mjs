// Copies only the public site files into dist/ (no build tools, tests or docs source).
import { cpSync, rmSync, mkdirSync, readdirSync } from "node:fs";

rmSync("dist", { recursive: true, force: true });
mkdirSync("dist");
for (const file of readdirSync(".")) {
  if (file.endsWith(".html") || file === "favicon.svg") cpSync(file, `dist/${file}`);
}
cpSync("css", "dist/css", { recursive: true });
cpSync("js", "dist/js", { recursive: true });
console.log("dist/ ready:", readdirSync("dist").join(", "));
