-- ============================================================
-- Migration 13: avatares + autogestão de conta para TODOS os papéis
-- ============================================================

-- 1) Bucket de avatares: leitura pública, escrita só na própria pasta
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy avatars_public_read on storage.objects
  for select using (bucket_id = 'avatars');
create policy avatars_own_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy avatars_own_update on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy avatars_own_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- 2) Todos editam o próprio perfil (a regra antiga só permitia clientes),
--    mas papel e marca ficam protegidos por trigger contra auto-promoção
drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

create or replace function public.protect_profile_privileges()
returns trigger language plpgsql as $$
begin
  if (new.role is distinct from old.role) or (new.tenant_id is distinct from old.tenant_id) then
    if auth.uid() is null
       or public.is_platform_admin()
       or current_setting('flora.allow_role_change', true) = 'on' then
      return new;
    end if;
    raise exception 'Alteração de papel ou marca não permitida';
  end if;
  return new;
end $$;
drop trigger if exists trg_profiles_protect on public.profiles;
create trigger trg_profiles_protect before update on public.profiles
  for each row execute function public.protect_profile_privileges();

-- 3) RPCs de equipe liberam a troca de papel via flag de transação
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
  perform set_config('flora.allow_role_change', 'on', true);

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
  perform set_config('flora.allow_role_change', 'on', true);
  update public.profiles set role = new_role where id = member;
  update auth.users
     set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
         || jsonb_build_object('role', new_role)
   where id = member;
end $$;

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
  perform set_config('flora.allow_role_change', 'on', true);
  update public.profiles set role = 'customer', tenant_id = null where id = member;
  update auth.users
     set raw_app_meta_data = (coalesce(raw_app_meta_data, '{}'::jsonb) - 'role') - 'tenant_id'
   where id = member;
end $$;

-- 4) Exclusão da própria conta — qualquer papel
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Não autenticada'; end if;
  delete from auth.users where id = auth.uid();
end $$;
revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
