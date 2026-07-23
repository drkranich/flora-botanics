-- Vincula clientes/pedidos de checkout ao login publico apenas dentro do tenant atual.
-- Evita que a area /conta de um site carregue registros de outro tenant do SaaS.

create or replace function public.claim_my_customer_for_tenant(p_tenant_id uuid)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  updated int;
  current_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if auth.uid() is null then
    raise exception 'Usuario nao autenticado.';
  end if;

  if p_tenant_id is null or not exists (
    select 1 from public.tenants t
    where t.id = p_tenant_id and t.status = 'active'
  ) then
    raise exception 'Site invalido.';
  end if;

  if current_email = '' then
    raise exception 'E-mail da sessao nao encontrado.';
  end if;

  update public.customers c
  set
    profile_id = auth.uid(),
    updated_at = now()
  where c.tenant_id = p_tenant_id
    and c.profile_id is null
    and lower(c.email) = current_email;

  get diagnostics updated = row_count;
  return updated;
end;
$$;

revoke all on function public.claim_my_customer_for_tenant(uuid) from anon, public;
grant execute on function public.claim_my_customer_for_tenant(uuid) to authenticated;
