-- ============================================================
-- FLORA ECOSYSTEM · Migration 10: vínculo cliente ↔ login
-- (aplicada em 2026-06-12 via MCP)
-- Quando a cliente faz login no site, vincula os registros de
-- customers (criados pelo checkout, por e-mail) ao seu usuário,
-- liberando a leitura dos próprios pedidos via RLS.
-- ============================================================

create or replace function public.claim_my_customer()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  updated int;
begin
  update public.customers c
  set profile_id = auth.uid()
  where c.profile_id is null
    and lower(c.email) = lower(coalesce(auth.jwt()->>'email', ''))
    and auth.uid() is not null;
  get diagnostics updated = row_count;
  return updated;
end $$;

-- apenas usuários logados podem reivindicar (e só o próprio e-mail)
revoke execute on function public.claim_my_customer() from anon, public;
grant execute on function public.claim_my_customer() to authenticated;
