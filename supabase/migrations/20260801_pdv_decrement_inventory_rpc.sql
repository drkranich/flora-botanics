-- Função para decrementar estoque de uma variante (usada pelo PDV)
create or replace function public.decrement_inventory(
  p_variant_id uuid,
  p_quantity    integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.inventory
  set
    quantity   = greatest(0, quantity - p_quantity),
    updated_at = now()
  where variant_id = p_variant_id;
end;
$$;

-- Permissão: staff autenticado pode chamar
grant execute on function public.decrement_inventory(uuid, integer) to authenticated;
