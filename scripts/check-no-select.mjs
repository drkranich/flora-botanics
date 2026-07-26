/**
 * Guarda de UI da Flora Botanics.
 *
 * Bloqueia controles nativos que quebram o glassmorphism ou aparecem como
 * menus/calendarios soltos no navegador. Em formularios, use sempre:
 *
 * - GlassSelect para listas/dropdowns.
 * - GlassDateInput para datas e horarios.
 * - Componentes glass proprios para escolhas de cor.
 *
 * Quando o campo estiver dentro de card, modal, tabela, painel lateral ou
 * formulario denso, use tambem o modo ancorado:
 *
 * - <GlassSelect inlineMenu ... />
 * - <GlassDateInput inlinePopover ... />
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const DIRS = [
  "apps/admin/app",
  "apps/admin/components",
  "apps/storefront/app",
  "apps/storefront/components",
  "apps/storefront/blocks",
];

const IGNORE = /node_modules|\.d\.ts$/;

const RULES = [
  {
    name: "select nativo",
    pattern: /<select[\s>]/i,
    message: "Use GlassSelect de @/components/GlassSelect.",
  },
  {
    name: "calendario/horario nativo",
    pattern: /<input\b[^>]*\btype=(["'])(date|time|datetime-local|month|week)\1/i,
    message: "Use GlassDateInput de @/components/GlassDateInput.",
  },
  {
    name: "seletor de cor nativo",
    pattern: /<input\b[^>]*\btype=(["'])color\1/i,
    message: "Use um seletor de cor glass do CMS, nao input type=\"color\" nativo.",
  },
];

let errors = 0;

function scanDir(dir) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
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
      for (const rule of RULES) {
        if (!rule.pattern.test(line)) continue;

        const rel = relative(ROOT, full);
        console.error(`\x1b[31mERRO UI: ${rule.name} encontrado:\x1b[0m ${rel}:${i + 1}`);
        console.error(`  ${line.trim()}`);
        console.error(`  -> ${rule.message}`);
        console.error("  -> Regra Flora: formularios, dropdowns, calendarios e cores devem usar glassmorphism.\n");
        errors++;
      }
    }
  }
}

for (const dir of DIRS) {
  scanDir(join(ROOT, dir));
}

if (errors > 0) {
  console.error(`\x1b[31m${errors} violacao(oes) de UI encontradas. Corrija antes de commitar.\x1b[0m`);
  process.exit(1);
}

console.log("\x1b[32mOK: nenhum controle nativo proibido encontrado.\x1b[0m");
