-- ============================================================
-- FLORA ECOSYSTEM · Migration 11: Equipe — convites e papéis
-- tenant_invites, e-mail em profiles, RPCs de gestão de equipe
-- ============================================================

-- e-mail no perfil (facilita listagem da equipe)
alter table public.profiles add column if not exists email text;
update public.profiles p set email = u.email
  from auth.users u where u.id = p.id and p.email is null;

-- convites
create table public.tenant_invites (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  email text not null,
  role text not null check (role in ('tenant_admin','tenant_editor')),
  status text not null default 'pending' check (status in ('pending','accepted','revoked')),
  invited_by uuid,
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);
create index idx_invites_tenant on public.tenant_invites(tenant_id, status);
create unique index idx_invites_pending_unique
  on public.tenant_invites(tenant_id, lower(email)) where status = 'pending';

alter table public.tenant_invites enable row level security;
create policy invites_admin_all on public.tenant_invites
  for all using (public.is_tenant_admin(tenant_id))
  with check (public.is_tenant_admin(tenant_id));

-- trigger de novo usuário: consome convite pendente pelo e-mail
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  inv record;
begin
  select * into inv from public.tenant_invites
   where lower(email) = lower(new.email) and status = 'pending'
   order by created_at desc limit 1;

  if inv.id is not null then
    insert into public.profiles (id, tenant_id, role, full_name, email)
    values (new.id, inv.tenant_id, inv.role, new.raw_user_meta_data ->> 'full_name', new.email)
    on conflict (id) do update set tenant_id = excluded.tenant_id, role = excluded.role;

    update auth.users
       set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
           || jsonb_build_object('tenant_id', inv.tenant_id::text, 'role', inv.role)
     where id = new.id;

    update public.tenant_invites
       set status = 'accepted', accepted_at = now() where id = inv.id;
  else
    insert into public.profiles (id, tenant_id, role, full_name, email)
    values (
      new.id,
      nullif(new.raw_app_meta_data ->> 'tenant_id','')::uuid,
      coalesce(nullif(new.raw_app_meta_data ->> 'role',''), 'customer'),
      new.raw_user_meta_data ->> 'full_name',
      new.email
    )
    on conflict (id) do nothing;
  end if;
  return new;
end $$;

-- lista a equipe (com e-mail) — só admins do tenant enxergam
create or replace function public.team_list(t uuid)
returns table(id uuid, email text, full_name text, role text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select p.id, coalesce(p.email, u.email)::text, p.full_name, p.role, p.created_at
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.tenant_id = t
    and p.role in ('tenant_owner','tenant_admin','tenant_editor')
    and public.is_tenant_admin(t)
  order by p.created_at
$$;

-- convida (ou aplica na hora, se a conta já existir)
create or replace function public.team_invite(t uuid, p_email text, p_role text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid;
  current_role_ text;
begin
  if not public.is_tenant_admin(t) then
    raise exception 'Sem permissão para gerenciar a equipe';
  end if;
  if p_role not in ('tenant_admin','tenant_editor') then
    raise exception 'Papel inválido';
  end if;

  select id into uid from auth.users where lower(email) = lower(p_email) limit 1;

  if uid is not null then
    select role into current_role_ from public.profiles where id = uid;
    if current_role_ in ('platform_admin','tenant_owner') then
      raise exception 'Este usuário já tem um papel superior';
    end if;

    update auth.users
       set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
           || jsonb_build_object('tenant_id', t::text, 'role', p_role)
     where id = uid;
    insert into public.profiles (id, tenant_id, role, email)
      values (uid, t, p_role, lower(p_email))
      on conflict (id) do update set tenant_id = excluded.tenant_id, role = excluded.role;
    insert into public.tenant_invites (tenant_id, email, role, status, invited_by, accepted_at)
      values (t, lower(p_email), p_role, 'accepted', auth.uid(), now());
    return jsonb_build_object('applied', true);
  end if;

  insert into public.tenant_invites (tenant_id, email, role, invited_by)
    values (t, lower(p_email), p_role);
  return jsonb_build_object('applied', false);
end $$;

-- altera o papel de um membro (owner e superadmin são intocáveis)
create or replace function public.team_set_role(member uuid, new_role text)
returns void language plpgsql security definer set search_path = public as $$
declare
  m record;
begin
  select * into m from public.profiles where id = member;
  if m.id is null then raise exception 'Membro não encontrado'; end if;
  if not public.is_tenant_admin(m.tenant_id) then raise exception 'Sem permissão'; end if;
  if m.role in ('tenant_owner','platform_admin') then
    raise exception 'O papel de proprietário não pode ser alterado por aqui';
  end if;
  if new_role not in ('tenant_admin','tenant_editor') then
    raise exception 'Papel inválido';
  end if;

  update public.profiles set role = new_role where id = member;
  update auth.users
     set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
         || jsonb_build_object('role', new_role)
   where id = member;
end $$;

-- remove um membro da equipe (vira cliente comum)
create or replace function public.team_remove(member uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  m record;
begin
  select * into m from public.profiles where id = member;
  if m.id is null then raise exception 'Membro não encontrado'; end if;
  if not public.is_tenant_admin(m.tenant_id) then raise exception 'Sem permissão'; end if;
  if m.role in ('tenant_owner','platform_admin') then
    raise exception 'O proprietário não pode ser removido';
  end if;
  if member = auth.uid() then raise exception 'Você não pode remover a si mesma'; end if;

  update public.profiles set role = 'customer', tenant_id = null where id = member;
  update auth.users
     set raw_app_meta_data = (coalesce(raw_app_meta_data, '{}'::jsonb) - 'role') - 'tenant_id'
   where id = member;
end $$;

-- revoga um convite pendente
create or replace function public.team_revoke_invite(inv uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  i record;
begin
  select * into i from public.tenant_invites where id = inv;
  if i.id is null then raise exception 'Convite não encontrado'; end if;
  if not public.is_tenant_admin(i.tenant_id) then raise exception 'Sem permissão'; end if;
  update public.tenant_invites set status = 'revoked' where id = inv;
end $$;

-- hardening: execução só para usuários autenticados
revoke execute on function public.team_list(uuid) from public, anon;
revoke execute on function public.team_invite(uuid, text, text) from public, anon;
revoke execute on function public.team_set_role(uuid, text) from public, anon;
revoke execute on function public.team_remove(uuid) from public, anon;
revoke execute on function public.team_revoke_invite(uuid) from public, anon;
grant execute on function public.team_list(uuid) to authenticated;
grant execute on function public.team_invite(uuid, text, text) to authenticated;
grant execute on function public.team_set_role(uuid, text) to authenticated;
grant execute on function public.team_remove(uuid) to authenticated;
grant execute on function public.team_revoke_invite(uuid) to authenticated;
