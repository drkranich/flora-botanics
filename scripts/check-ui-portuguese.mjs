/**
 * Guarda de português visível da Flora Botanics.
 *
 * Evita que textos de interface voltem com palavras comuns sem acento.
 * A checagem é intencionalmente focada em linhas que costumam renderizar UI:
 * label, placeholder, ariaLabel, title, intro, note, description, error,
 * mensagens, csvLine e JSX textual. Nomes técnicos, slugs, rotas e variáveis
 * não são alvo desta guarda.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const DIRS = [
  "apps/admin/app",
  "apps/admin/components",
  "apps/admin/lib",
  "apps/storefront/app",
  "apps/storefront/components",
  "apps/storefront/blocks",
  "apps/storefront/lib",
];

const IGNORE = /node_modules|\.next|\.d\.ts$/;
const EXTENSIONS = new Set([".ts", ".tsx"]);

const SKIP_LINE =
  /redirect\(|params\.set|searchParams|storage_path|product_media|NEXT_PUBLIC|RESEND_|STRIPE_|SUPABASE_|voce@|@usuario|preco-menor|preco-maior|preco_atual|pct_sobre_preco|category_key|subtitulo:|descricao:|preco:/;

const RULES = [
  [/\bNao\b/, "Não"],
  [/\bnao\b/, "não"],
  [/\bVoce\b/, "Você"],
  [/\bvoce\b/, "você"],
  [/\bproprio\b/, "próprio"],
  [/\bpropria\b/, "própria"],
  [/\bpublico\b/, "público"],
  [/\bpagina\b/, "página"],
  [/\bPagina\b/, "Página"],
  [/\bpaginas\b/, "páginas"],
  [/\btitulo\b/, "título"],
  [/\bTitulo\b/, "Título"],
  [/\bsubtitulo\b/, "subtítulo"],
  [/\bdescricao\b/, "descrição"],
  [/\bDescricao\b/, "Descrição"],
  [/\bpreco\b/, "preço"],
  [/\bPreco\b/, "Preço"],
  [/\bprecificacao\b/, "precificação"],
  [/\borcamento\b/, "orçamento"],
  [/\bOrcamento\b/, "Orçamento"],
  [/\bcotacao\b/, "cotação"],
  [/\bCotacao\b/, "Cotação"],
  [/\bcenario\b/, "cenário"],
  [/\bCenario\b/, "Cenário"],
  [/\bconfiguracoes\b/, "configurações"],
  [/\bConfiguracoes\b/, "Configurações"],
  [/\bperiodo\b/, "período"],
  [/\bPeriodo\b/, "Período"],
  [/\bMes\b/, "Mês"],
  [/\bapos\b/, "após"],
  [/\bnumeros\b/, "números"],
  [/\bNumeros\b/, "Números"],
  [/\bprovisao\b/, "provisão"],
  [/\bProvisao\b/, "Provisão"],
  [/\bprovisoes\b/, "provisões"],
  [/\bProvisoes\b/, "Provisões"],
  [/\bautomatica\b/, "automática"],
  [/\bautomaticas\b/, "automáticas"],
  [/\bAutomatica\b/, "Automática"],
  [/\bAutomatico\b/, "Automático"],
  [/\blancamento\b/, "lançamento"],
  [/\bLancamento\b/, "Lançamento"],
  [/\blancamentos\b/, "lançamentos"],
  [/\bLancamentos\b/, "Lançamentos"],
  [/\bsaida\b/, "saída"],
  [/\bSaida\b/, "Saída"],
  [/\bsaidas\b/, "saídas"],
  [/\bSaidas\b/, "Saídas"],
  [/\bmodulo\b/, "módulo"],
  [/\bModulo\b/, "Módulo"],
  [/\bultimas\b/, "últimas"],
  [/\bUltimas\b/, "Últimas"],
  [/\batribuido\b/, "atribuído"],
  [/\bAtribuido\b/, "Atribuído"],
  [/\bbancarias\b/, "bancárias"],
  [/\brelatorio\b/, "relatório"],
  [/\bRelatorio\b/, "Relatório"],
  [/\brelatorios\b/, "relatórios"],
  [/\bRelatorios\b/, "Relatórios"],
  [/\bcomissao\b/, "comissão"],
  [/\bComissao\b/, "Comissão"],
  [/\blogistica\b/, "logística"],
  [/\bLogistica\b/, "Logística"],
  [/\bminimo\b/, "mínimo"],
  [/\bminima\b/, "mínima"],
  [/\bmedia\b/, "média"],
  [/\bliquida\b/, "líquida"],
  [/\bnecessario\b/, "necessário"],
  [/\bpossivel\b/, "possível"],
  [/\bvalidos\b/, "válidos"],
  [/\binvalido\b/, "inválido"],
  [/\bInvalido\b/, "Inválido"],
  [/\bobrigatorio\b/, "obrigatório"],
  [/\bObrigatorio\b/, "Obrigatório"],
  [/\bindisponivel\b/, "indisponível"],
  [/\bIndisponivel\b/, "Indisponível"],
  [/\busuario\b/, "usuário"],
  [/\bEndereco\b/, "Endereço"],
  [/\bendereco\b/, "endereço"],
  [/\bNumero\b/, "Número"],
  [/\binformacao\b/, "informação"],
  [/\batencao\b/, "atenção"],
  [/\bObservacoes\b/, "Observações"],
  [/\bobser[vv]acoes\b/, "observações"],
  [/\bCondicao\b/, "Condição"],
  [/\bcondicoes\b/, "condições"],
  [/\baprovacao\b/, "aprovação"],
  [/\bAprovacao\b/, "Aprovação"],
  [/\brevisao\b/, "revisão"],
  [/\bproducao\b/, "produção"],
  [/\bProducao\b/, "Produção"],
  [/\bfisica\b/, "física"],
  [/\bRegiao\b/, "Região"],
  [/\bAte\b/, "Até"],
  [/\binicio\b/, "início"],
  [/\bInicio\b/, "Início"],
  [/\bhistorico\b/, "histórico"],
  [/\bHistorico\b/, "Histórico"],
];

let errors = 0;

function quotedValues(line, pattern) {
  const values = [];
  for (const match of line.matchAll(pattern)) {
    values.push(match[2] ?? match[3] ?? match[4] ?? "");
  }
  return values;
}

function displaySnippets(line) {
  if (SKIP_LINE.test(line)) return [];

  const snippets = [
    ...quotedValues(line, /\b(label|placeholder|ariaLabel|title|intro|eyebrow|description|note|message|notice|error)\s*[:=]\s*(?:"([^"]*)"|'([^']*)'|`([^`]*)`)/g),
    ...quotedValues(line, /\b(?:throw new Error|jsonError)\((?:"([^"]*)"|'([^']*)'|`([^`]*)`)/g),
  ];

  if (line.includes("csvLine(")) {
    snippets.push(...quotedValues(line, /(?:"([^"]*)"|'([^']*)'|`([^`]*)`)/g));
  }

  for (const match of line.matchAll(/>\s*([^<{][^<]*?)\s*</g)) {
    snippets.push(match[1]);
  }

  return snippets.filter((value) => value.trim().length > 0);
}

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

    const ext = full.slice(full.lastIndexOf("."));
    if (!EXTENSIONS.has(ext)) continue;

    const src = readFileSync(full, "utf8");
    const lines = src.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const snippets = displaySnippets(line);
      if (!snippets.length) continue;

      for (const [pattern, correction] of RULES) {
        if (!snippets.some((snippet) => pattern.test(snippet))) continue;

        const rel = relative(ROOT, full);
        console.error(`\x1b[31mERRO PT-BR: texto visível sem acento:\x1b[0m ${rel}:${i + 1}`);
        console.error(`  ${line.trim()}`);
        console.error(`  -> Sugestão: ${correction}\n`);
        errors++;
        break;
      }
    }
  }
}

for (const dir of DIRS) {
  scanDir(join(ROOT, dir));
}

if (errors > 0) {
  console.error(`\x1b[31m${errors} problema(s) de acentuação visível encontrados.\x1b[0m`);
  process.exit(1);
}

console.log("\x1b[32mOK: textos visíveis comuns estão com acentuação pt-BR.\x1b[0m");
