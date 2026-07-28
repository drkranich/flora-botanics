-- ============================================================
-- FLORA ECOSYSTEM · Commercial quote operations
-- Converte orçamento/cotação/proposta aprovada em pedido, com
-- idempotência e autorização por tenant.
-- ============================================================

create or replace function public.convert_commercial_quote_to_order(
  p_quote_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_quote public.commercial_quotes%rowtype;
  v_customer_id uuid := null;
  v_order_id uuid;
  v_order_number bigint;
  v_net_revenue integer := 0;
  v_gross_revenue integer := 0;
  v_discount integer := 0;
  v_shipping_address jsonb := '{}'::jsonb;
  v_email text;
begin
  if p_quote_id is null then
    raise exception 'Documento comercial inválido.';
  end if;

  select *
  into v_quote
  from public.commercial_quotes q
  where q.id = p_quote_id
  for update;

  if not found then
    raise exception 'Documento comercial não encontrado.';
  end if;

  if not public.is_tenant_admin(v_quote.tenant_id) then
    raise exception 'Sem permissão para converter este documento.';
  end if;

  if v_quote.converted_order_id is not null then
    select o.number
    into v_order_number
    from public.orders o
    where o.id = v_quote.converted_order_id;

    return jsonb_build_object(
      'ok', true,
      'already_converted', true,
      'order_id', v_quote.converted_order_id,
      'order_number', v_order_number
    );
  end if;

  if v_quote.status <> 'approved' then
    raise exception 'Aprove o documento antes de converter em pedido.';
  end if;

  v_net_revenue := greatest(coalesce((v_quote.totals ->> 'netRevenueCents')::integer, 0), 0);
  v_gross_revenue := greatest(coalesce((v_quote.totals ->> 'grossRevenueCents')::integer, v_net_revenue), 0);
  v_discount := greatest(v_gross_revenue - v_net_revenue, 0);

  if v_net_revenue <= 0 then
    raise exception 'Documento sem valor para converter em pedido.';
  end if;

  v_email := lower(nullif(btrim(coalesce(v_quote.email, '')), ''));

  if v_email is not null then
    insert into public.customers (
      tenant_id,
      email,
      full_name,
      phone,
      tags
    )
    values (
      v_quote.tenant_id,
      v_email,
      nullif(btrim(v_quote.customer_name), ''),
      nullif(btrim(coalesce(v_quote.phone, '')), ''),
      array['orçamento', 'comercial']
    )
    on conflict (tenant_id, email) do update
      set full_name = coalesce(excluded.full_name, public.customers.full_name),
          phone = coalesce(excluded.phone, public.customers.phone),
          tags = (
            select array(
              select distinct unnest(public.customers.tags || excluded.tags)
            )
          ),
          updated_at = now()
    returning id into v_customer_id;
  end if;

  if nullif(btrim(coalesce(v_quote.address, '')), '') is not null then
    v_shipping_address := jsonb_build_object(
      'recipient', v_quote.customer_name,
      'raw_address', v_quote.address,
      'source', 'commercial_quote'
    );
  end if;

  v_order_number := public.next_order_number(v_quote.tenant_id);

  insert into public.orders (
    tenant_id,
    number,
    customer_id,
    status,
    subtotal_cents,
    discount_cents,
    shipping_cents,
    total_cents,
    currency,
    shipping_address,
    notes,
    placed_at
  )
  values (
    v_quote.tenant_id,
    v_order_number,
    v_customer_id,
    'pending',
    v_gross_revenue,
    v_discount,
    0,
    v_net_revenue,
    'BRL',
    v_shipping_address,
    concat_ws(
      E'\n',
      'Pedido convertido do documento comercial #' || v_quote.number || '.',
      nullif(v_quote.notes, ''),
      nullif(v_quote.terms, '')
    ),
    now()
  )
  returning id into v_order_id;

  insert into public.order_items (
    order_id,
    variant_id,
    product_snapshot,
    quantity,
    unit_price_cents,
    total_cents
  )
  values (
    v_order_id,
    null,
    jsonb_build_object(
      'name', 'Documento comercial #' || v_quote.number,
      'kind', v_quote.kind,
      'customer_name', v_quote.customer_name,
      'company_name', v_quote.company_name,
      'source_quote_id', v_quote.id,
      'items', v_quote.items
    ),
    1,
    v_net_revenue,
    v_net_revenue
  );

  update public.commercial_quotes
  set status = 'converted',
      converted_order_id = v_order_id,
      accepted_at = coalesce(accepted_at, now())
  where id = v_quote.id;

  insert into public.finance_audit_events (
    tenant_id,
    entity_type,
    entity_id,
    action,
    before_data,
    after_data,
    created_by
  )
  values (
    v_quote.tenant_id,
    'commercial_quote',
    v_quote.id,
    'converted_to_order',
    to_jsonb(v_quote),
    jsonb_build_object('order_id', v_order_id, 'order_number', v_order_number),
    auth.uid()
  );

  return jsonb_build_object(
    'ok', true,
    'already_converted', false,
    'order_id', v_order_id,
    'order_number', v_order_number
  );
end;
$$;

revoke all on function public.convert_commercial_quote_to_order(uuid) from public;
grant execute on function public.convert_commercial_quote_to_order(uuid) to authenticated;
