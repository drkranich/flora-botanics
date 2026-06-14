-- Migration 12: dados da cliente no perfil
-- endereço, whatsapp e redes sociais (cartões ficam no Stripe, nunca aqui)
alter table public.profiles
  add column if not exists whatsapp text,
  add column if not exists address jsonb default '{}'::jsonb,
  add column if not exists socials jsonb default '{}'::jsonb;
