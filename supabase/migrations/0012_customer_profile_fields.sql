-- ============================================================
-- FLORA ECOSYSTEM · Migration 12: dados da cliente no perfil
-- endereço, whatsapp e redes sociais
-- Cartões de crédito NUNCA são armazenados aqui — ficam no
-- Stripe (PCI-DSS), tokenizados no momento do pagamento.
-- (aplicada em 2026-06-12 via MCP)
-- ============================================================

alter table public.profiles
  add column if not exists whatsapp text,
  add column if not exists address jsonb default '{}'::jsonb,
  add column if not exists socials jsonb default '{}'::jsonb;
