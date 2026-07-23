-- Permite que uma conta publica crie o proprio registro de cliente
-- somente dentro de um tenant ativo e usando o e-mail real da sessao.
-- Isso destrava Preferencias, dados cadastrais e endereco em /conta
-- antes do primeiro pedido.

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'customers'
      and policyname = 'customers_owner_insert'
  ) then
    create policy customers_owner_insert on public.customers
      for insert
      to authenticated
      with check (
        profile_id = (select auth.uid())
        and lower(email) = lower(coalesce((select auth.jwt()) ->> 'email', ''))
        and exists (
          select 1
          from public.tenants t
          where t.id = tenant_id
            and t.status = 'active'
        )
      );
  end if;
end $$;

-- Endurece a RPC criada para vincular cliente por tenant: apenas
-- usuarios autenticados podem executa-la.
revoke all on function public.claim_my_customer_for_tenant(uuid) from anon, public;
grant execute on function public.claim_my_customer_for_tenant(uuid) to authenticated;
