/**
 * Bloqueia o uso de <select> nativo em componentes React do projeto.
 * Use GlassSelect (admin: @/components/GlassSelect, storefront: @/components/GlassSelect).
 *
 * Executar: node scripts/check-no-select.mjs
 * Integrado como passo de CI via "lint:select" nos package.json.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const DIRS = ["apps/admin/app", "apps/admin/components", "apps/storefront/app", "apps/storefront/components", "apps/storefront/blocks"];

// Regex para detectar <select com qualquer atributo, mas ignora comentários
const SELECT_PATTERN = /<select[\s>]/;
// Ignora arquivos de tipagem e node_modules
const IGNORE = /node_modules|\.d\.ts$/;

let errors = 0;

function scanDir(dir) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return; // diretório pode não existir
  }

  for (const entry of entries) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (!IGNORE.test(full)) scanDir(full);
      continue;
    }
    if (!full.endsWith(".tsx") && !full.endsWith(".jsx")) continue;

    const src = readFileSync(full, "utf8");
    const lines = src.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (SELECT_PATTERN.test(line)) {
        const rel = relative(ROOT, full);
        console.error(`\x1b[31m✗ <select> nativo encontrado:\x1b[0m ${rel}:${i + 1}`);
        console.error(`  ${line.trim()}`);
        console.error(`  → Use GlassSelect de @/components/GlassSelect\n`);
        errors++;
      }
    }
  }
}

for (const dir of DIRS) {
  scanDir(join(ROOT, dir));
}

if (errors > 0) {
  console.error(`\x1b[31m${errors} <select> nativo(s) encontrado(s). Substitua por GlassSelect antes de commitar.\x1b[0m`);
  process.exit(1);
} else {
  console.log("\x1b[32m✓ Nenhum <select> nativo encontrado.\x1b[0m");
}
