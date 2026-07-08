import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const wranglerBin = path.join(repoRoot, "node_modules", "wrangler", "bin", "wrangler.js");

const result = spawnSync(process.execPath, [wranglerBin, "deploy", ...process.argv.slice(2)], {
  cwd: process.cwd(),
  stdio: "inherit",
  env: {
    ...process.env,
    OPEN_NEXT_DEPLOY: "true",
    CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV: "false",
  },
});

process.exit(result.status ?? 1);
