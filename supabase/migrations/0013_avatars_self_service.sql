-- ============================================================
-- FLORA ECOSYSTEM · Migration 13: avatares + autogestão de conta
-- Bucket de avatares, edição do próprio perfil para todos os
-- papéis (com proteção anti auto-promoção) e exclusão de conta.
-- (aplicada em 2026-06-12 via MCP)
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

-- 3) RPCs de equipe (0011) redefinidas com a flag de transação
--    set_config('flora.allow_role_change','on',true) antes das trocas
--    de papel — ver definição completa aplicada no banco.
--    (team_invite, team_set_role, team_remove)

-- 4) Exclusão da própria conta — qualquer papel
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Não autenticada'; end if;
  delete from auth.users where id = auth.uid();
end $$;
revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
