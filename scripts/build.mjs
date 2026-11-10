// Validate and prepare the single production application. No frontend bundle or
// second server is produced: EJS and the TypeScript domain core deploy together.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import ejs from "ejs";
import { register } from "tsx/esm/api";
register();

const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
  entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)],
);
const copy = (source, destination) => {
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
};

// Self-host the exact UI dependencies instead of making every page wait for
// three third-party CDNs. These are deterministic files from package-lock.
for (const name of ["bootstrap.min.css", "bootstrap.rtl.min.css"]) {
  copy(`node_modules/bootstrap/dist/css/${name}`, `public/vendor/bootstrap/${name}`);
}
copy("node_modules/bootstrap/dist/js/bootstrap.bundle.min.js", "public/vendor/bootstrap/bootstrap.bundle.min.js");
copy("node_modules/@fortawesome/fontawesome-free/css/all.min.css", "public/vendor/fontawesome/css/all.min.css");
for (const file of fs.readdirSync("node_modules/@fortawesome/fontawesome-free/webfonts")) {
  copy(`node_modules/@fortawesome/fontawesome-free/webfonts/${file}`, `public/vendor/fontawesome/webfonts/${file}`);
}
const fontWeights = [400, 500, 600, 700];
const fontFamilies = ["cormorant-garamond", "hind-siliguri", "inter", "noto-serif-bengali"];
const fontCss = [];
for (const family of fontFamilies) {
  for (const weight of fontWeights) {
    const file = `node_modules/@fontsource/${family}/${weight}.css`;
    if (!fs.existsSync(file)) continue;
    let css = fs.readFileSync(file, "utf8");
    for (const match of css.matchAll(/\.\/files\/([^)"']+)/g)) {
      const name = match[1];
      const source = `node_modules/@fontsource/${family}/files/${name}`;
      if (fs.existsSync(source)) copy(source, `public/fonts/files/${name}`);
    }
    css = css.replaceAll("./files/", "/fonts/files/");
    fontCss.push(css);
  }
}
fs.mkdirSync("public/fonts", { recursive: true });
fs.writeFileSync("public/fonts/fonts.css", fontCss.join("\n"));

const scripts = walk("src/web").filter((file) => file.endsWith(".js"));
for (const file of scripts) execFileSync(process.execPath, ["--check", file]);
const templates = walk("views").filter((file) => file.endsWith(".ejs"));
for (const file of templates) ejs.compile(fs.readFileSync(file, "utf8"), { filename: path.resolve(file) });

const config = JSON.parse(fs.readFileSync("vercel.json", "utf8"));
if (config.builds || config.routes) throw new Error("Use one functions/rewrites deployment; legacy builds/routes are forbidden");
if (!config.rewrites?.some((route) => route.source === "/(.*)" && route.destination === "/app")) {
  throw new Error("Missing unified /app rewrite");
}
if (!config.functions?.["app.ts"]) throw new Error("Missing single production entrypoint");
for (const directory of ["views", "public", "src"]) {
  if (!fs.existsSync(directory)) throw new Error(`Missing deployable ${directory}/`);
}
const source = scripts.map((file) => fs.readFileSync(file, "utf8")).join("\n") + fs.readFileSync("src/application.ts", "utf8");
if (/process\.env(?:\.\s*BACKEND_URL|\[\s*["']BACKEND_URL["']\s*\])/.test(source)) throw new Error("Split-deployment BACKEND_URL dependency remains");
if (/(?:await|return|=)\s*fetch\s*\(/.test(fs.readFileSync("src/web/api.js", "utf8"))) throw new Error("SSR must not make self-HTTP requests");
const { default: createApp } = await import("../src/application.ts");
const app = createApp();
if (typeof app !== "function") throw new Error("Unified Express app could not initialize");
const { default: handler } = await import("../app.ts");
if (typeof handler !== "function") throw new Error("Missing Vercel handler");
console.log(`Unified production build passed: ${scripts.length} SSR modules, ${templates.length} EJS templates, local assets, one Vercel handler.`);
