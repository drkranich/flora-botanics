// Configuração do OpenNext para Cloudflare Workers.
// Cache incremental (ISR via R2) será adicionado depois — por enquanto
// as páginas revalidam a cada requisição quando o cache não está disponível.
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig();
