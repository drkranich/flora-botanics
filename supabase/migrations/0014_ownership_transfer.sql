-- ============================================================
-- FLORA ECOSYSTEM · Migration 14: transferência de propriedade
-- Proprietários não excluem a própria conta diretamente:
-- precisam transferir a marca, com aprovação eletrônica do
-- outro proprietário (senha reconfirmada + termo aceito +
-- trilha completa em audit_logs).
-- (aplicada em 2026-06-12 via MCP)
-- ============================================================

create table public.ownership_transfers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  from_owner uuid not null,
  to_user uuid not null,
  status text not null default 'pending'
    check (status in ('pending','approved','rejected','cancelled')),
  term_text text not null,
  requested_at timestamptz not null default now(),
  decided_at timestamptz
);
create index idx_ownership_transfers_tenant on public.ownership_transfers(tenant_id, status);

alter table public.ownership_transfers enable row level security;
create policy ownership_transfers_staff_read on public.ownership_transfers
  for select using (public.is_tenant_staff(tenant_id));

-- pedido de transferência (requer senha reconfirmada no cliente antes da chamada)
create or replace function public.request_ownership_transfer(target uuid, term text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  me record;
  tgt record;
  tid uuid;
begin
  select * into me from public.profiles where id = auth.uid();
  if me.id is null or me.role <> 'tenant_owner' then
    raise exception 'Apenas proprietários podem solicitar transferência';
  end if;
  select * into tgt from public.profiles where id = target;
  if tgt.id is null or tgt.tenant_id is distinct from me.tenant_id
     or tgt.role not in ('tenant_owner','tenant_admin') then
    raise exception 'O destino precisa ser proprietário ou administrador da mesma marca';
  end if;
  if exists (select 1 from public.ownership_transfers
              where tenant_id = me.tenant_id and status = 'pending') then
    raise exception 'Já existe uma transferência pendente para esta marca';
  end if;

  insert into public.ownership_transfers (tenant_id, from_owner, to_user, term_text)
  values (me.tenant_id, me.id, target, term)
  returning id into tid;

  insert into public.audit_logs (tenant_id, actor_id, action, entity_type, entity_id, diff)
  values (me.tenant_id, me.id, 'ownership_transfer_requested', 'ownership_transfer', tid::text,
          jsonb_build_object('to_user', target, 'term', term));
  return tid;
end $$;

-- decisão do outro proprietário/destino (aprova ou recusa, com senha reconfirmada)
create or replace function public.decide_ownership_transfer(transfer uuid, approve boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  t record;
begin
  select * into t from public.ownership_transfers where id = transfer;
  if t.id is null or t.status <> 'pending' then
    raise exception 'Transferência não encontrada ou já decidida';
  end if;
  if auth.uid() is distinct from t.to_user then
    raise exception 'Apenas a pessoa destinatária pode decidir';
  end if;

  if approve then
    perform set_config('flora.allow_role_change', 'on', true);
    update public.profiles set role = 'tenant_owner' where id = t.to_user;
    update auth.users
       set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
           || jsonb_build_object('role', 'tenant_owner')
     where id = t.to_user;
    update public.profiles set role = 'tenant_admin' where id = t.from_owner;
    update auth.users
       set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
           || jsonb_build_object('role', 'tenant_admin')
     where id = t.from_owner;
    update public.ownership_transfers
       set status = 'approved', decided_at = now() where id = transfer;
  else
    update public.ownership_transfers
       set status = 'rejected', decided_at = now() where id = transfer;
  end if;

  insert into public.audit_logs (tenant_id, actor_id, action, entity_type, entity_id, diff)
  values (t.tenant_id, auth.uid(),
          case when approve then 'ownership_transfer_approved' else 'ownership_transfer_rejected' end,
          'ownership_transfer', transfer::text,
          jsonb_build_object('from_owner', t.from_owner, 'to_user', t.to_user));
end $$;

-- proprietários e superadmin não se excluem diretamente
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public as $$
declare
  r record;
begin
  if auth.uid() is null then raise exception 'Não autenticada'; end if;
  select role into r from public.profiles where id = auth.uid();
  if r.role = 'tenant_owner' then
    raise exception 'Proprietários precisam transferir a marca primeiro: peça a aprovação do outro proprietário (ou promova alguém a proprietário) antes de excluir a conta.';
  end if;
  if r.role = 'platform_admin' then
    raise exception 'A conta de superadmin não pode ser excluída por aqui.';
  end if;
  delete from auth.users where id = auth.uid();
end $$;

-- cancelamento de transferência pendente (só quem pediu)
create or replace function public.cancel_ownership_transfer(transfer uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  t record;
begin
  select * into t from public.ownership_transfers where id = transfer;
  if t.id is null or t.status <> 'pending' then
    raise exception 'Transferência não encontrada ou já decidida';
  end if;
  if auth.uid() is distinct from t.from_owner then
    raise exception 'Apenas quem solicitou pode cancelar';
  end if;
  update public.ownership_transfers
     set status = 'cancelled', decided_at = now() where id = transfer;
  insert into public.audit_logs (tenant_id, actor_id, action, entity_type, entity_id, diff)
  values (t.tenant_id, auth.uid(), 'ownership_transfer_cancelled', 'ownership_transfer',
          transfer::text, jsonb_build_object('to_user', t.to_user));
end $$;

revoke execute on function public.request_ownership_transfer(uuid, text) from public, anon;
revoke execute on function public.decide_ownership_transfer(uuid, boolean) from public, anon;
revoke execute on function public.cancel_ownership_transfer(uuid) from public, anon;
grant execute on function public.request_ownership_transfer(uuid, text) to authenticated;
grant execute on function public.decide_ownership_transfer(uuid, boolean) to authenticated;
grant execute on function public.cancel_ownership_transfer(uuid) to authenticated;
