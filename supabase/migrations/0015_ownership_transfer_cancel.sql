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
revoke execute on function public.cancel_ownership_transfer(uuid) from public, anon;
grant execute on function public.cancel_ownership_transfer(uuid) to authenticated;
