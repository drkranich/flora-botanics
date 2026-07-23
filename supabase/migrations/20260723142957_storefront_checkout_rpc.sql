-- ============================================================
-- FLORA ECOSYSTEM · Storefront checkout RPC
-- Cria funcoes publicas controladas para validar cupom e
-- converter carrinho anonimo em pedido sem expor tabelas internas.
-- ============================================================

create or replace function public.validate_storefront_coupon(
  p_tenant_id uuid,
  p_code text,
  p_subtotal_cents integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_code text := upper(left(btrim(coalesce(p_code, '')), 40));
  v_coupon public.coupons%rowtype;
  v_subtotal integer := greatest(coalesce(p_subtotal_cents, 0), 0);
  v_discount integer := 0;
  v_free_shipping boolean := false;
begin
  if p_tenant_id is null or not exists (
    select 1 from public.tenants t
    where t.id = p_tenant_id and t.status = 'active'
  ) then
    return jsonb_build_object('ok', false, 'error', 'Site invalido.');
  end if;

  if v_code = '' then
    return jsonb_build_object('ok', false, 'error', 'Informe um cupom.');
  end if;

  select *
  into v_coupon
  from public.coupons c
  where c.tenant_id = p_tenant_id
    and upper(c.code) = v_code
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'Cupom nao encontrado.');
  end if;

  if v_coupon.status <> 'active'
    or (v_coupon.starts_at is not null and v_coupon.starts_at > now())
    or (v_coupon.ends_at is not null and v_coupon.ends_at < now())
    or (v_coupon.max_uses is not null and v_coupon.used_count >= v_coupon.max_uses) then
    return jsonb_build_object('ok', false, 'error', 'Cupom indisponivel.');
  end if;

  if v_coupon.min_subtotal_cents is not null and v_subtotal < v_coupon.min_subtotal_cents then
    return jsonb_build_object(
      'ok', false,
      'error', 'Cupom valido para compras acima de R$ ' || replace(to_char(v_coupon.min_subtotal_cents / 100.0, 'FM999G999G990D00'), '.', ',') || '.'
    );
  end if;

  if v_coupon.type = 'free_shipping' then
    v_free_shipping := true;
  elsif v_coupon.type = 'percent' then
    v_discount := least(v_subtotal, greatest(round(v_subtotal * least(greatest(v_coupon.value, 0), 100) / 100.0)::integer, 0));
  elsif v_coupon.type = 'fixed' then
    v_discount := least(v_subtotal, greatest(round(v_coupon.value * 100)::integer, 0));
  end if;

  return jsonb_build_object(
    'ok', true,
    'code', v_coupon.code,
    'discount_cents', v_discount,
    'free_shipping', v_free_shipping
  );
end;
$$;

revoke all on function public.validate_storefront_coupon(uuid, text, integer) from public;
grant execute on function public.validate_storefront_coupon(uuid, text, integer) to anon, authenticated;

create or replace function public.create_storefront_order(
  p_tenant_id uuid,
  p_session_id text,
  p_customer_email text,
  p_customer_name text default null,
  p_customer_phone text default null,
  p_accepts_marketing boolean default false,
  p_shipping_address jsonb default '{}'::jsonb,
  p_coupon_code text default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_cart public.carts%rowtype;
  v_item jsonb;
  v_variant_id uuid;
  v_variant_id_text text;
  v_quantity integer;
  v_variant record;
  v_items jsonb := '[]'::jsonb;
  v_line_total integer;
  v_subtotal integer := 0;
  v_discount integer := 0;
  v_shipping integer := 0;
  v_total integer := 0;
  v_currency text := null;
  v_email text := lower(btrim(coalesce(p_customer_email, '')));
  v_name text := nullif(btrim(coalesce(p_customer_name, '')), '');
  v_phone text := nullif(btrim(coalesce(p_customer_phone, '')), '');
  v_coupon_code text := upper(left(btrim(coalesce(p_coupon_code, '')), 40));
  v_coupon public.coupons%rowtype;
  v_coupon_id uuid := null;
  v_customer_id uuid;
  v_address_id uuid;
  v_order_id uuid;
  v_order_number bigint;
  v_shipping_address jsonb;
  v_recipient text;
  v_street text;
  v_number text;
  v_complement text;
  v_district text;
  v_city text;
  v_state text;
  v_zip text;
  v_country text;
begin
  if p_tenant_id is null or not exists (
    select 1 from public.tenants t
    where t.id = p_tenant_id and t.status = 'active'
  ) then
    raise exception 'Site invalido.';
  end if;

  if nullif(btrim(coalesce(p_session_id, '')), '') is null then
    raise exception 'Sessao do carrinho invalida.';
  end if;

  if v_email !~* '^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$' then
    raise exception 'Informe um e-mail valido.';
  end if;

  if jsonb_typeof(coalesce(p_shipping_address, '{}'::jsonb)) <> 'object' then
    raise exception 'Endereco invalido.';
  end if;

  v_recipient := nullif(btrim(coalesce(p_shipping_address ->> 'recipient', '')), '');
  v_street := nullif(btrim(coalesce(p_shipping_address ->> 'street', '')), '');
  v_number := nullif(btrim(coalesce(p_shipping_address ->> 'number', '')), '');
  v_complement := nullif(btrim(coalesce(p_shipping_address ->> 'complement', '')), '');
  v_district := nullif(btrim(coalesce(p_shipping_address ->> 'district', '')), '');
  v_city := nullif(btrim(coalesce(p_shipping_address ->> 'city', '')), '');
  v_state := upper(left(btrim(coalesce(p_shipping_address ->> 'state', '')), 2));
  v_zip := regexp_replace(coalesce(p_shipping_address ->> 'zip', ''), '\D', '', 'g');
  v_country := upper(left(btrim(coalesce(p_shipping_address ->> 'country', 'BR')), 2));

  if v_recipient is null or v_street is null or v_city is null or length(v_state) <> 2 or length(v_zip) < 8 then
    raise exception 'Preencha nome, rua, cidade, estado e CEP.';
  end if;

  select *
  into v_cart
  from public.carts c
  where c.tenant_id = p_tenant_id
    and c.session_id = p_session_id
    and c.status = 'active'
  for update;

  if not found then
    raise exception 'Carrinho ativo nao encontrado.';
  end if;

  if jsonb_typeof(v_cart.items) <> 'array' or jsonb_array_length(v_cart.items) = 0 then
    raise exception 'Carrinho vazio.';
  end if;

  for v_item in select value from jsonb_array_elements(v_cart.items)
  loop
    v_variant_id_text := coalesce(v_item ->> 'variant_id', '');
    if v_variant_id_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      raise exception 'Item invalido no carrinho.';
    end if;

    v_variant_id := v_variant_id_text::uuid;

    if coalesce(v_item ->> 'quantity', '') ~ '^[0-9]+$' then
      v_quantity := least(99, greatest((v_item ->> 'quantity')::integer, 1));
    else
      v_quantity := 1;
    end if;

    select
      pv.id as variant_id,
      pv.product_id,
      pv.sku,
      pv.name as variant_name,
      pv.price_cents,
      pv.currency,
      p.name as product_name,
      p.slug as product_slug,
      p.type as product_type,
      p.subtitle as product_subtitle
    into v_variant
    from public.product_variants pv
    join public.products p on p.id = pv.product_id
    where pv.id = v_variant_id
      and pv.tenant_id = p_tenant_id
      and p.tenant_id = p_tenant_id
      and p.status = 'published'
      and p.deleted_at is null
    limit 1;

    if not found then
      raise exception 'Um produto do carrinho nao esta mais disponivel.';
    end if;

    if v_currency is null then
      v_currency := coalesce(v_variant.currency, 'BRL');
    elsif v_currency <> coalesce(v_variant.currency, 'BRL') then
      raise exception 'Carrinho com moedas diferentes.';
    end if;

    v_line_total := v_variant.price_cents * v_quantity;
    v_subtotal := v_subtotal + v_line_total;

    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'product_id', v_variant.product_id,
      'variant_id', v_variant.variant_id,
      'sku', v_variant.sku,
      'name', coalesce(v_variant.product_name, v_variant.variant_name, 'Produto'),
      'slug', v_variant.product_slug,
      'type', v_variant.product_type,
      'subtitle', v_variant.product_subtitle,
      'variant_name', v_variant.variant_name,
      'image', nullif(v_item ->> 'image', ''),
      'quantity', v_quantity,
      'unit_price_cents', v_variant.price_cents,
      'total_cents', v_line_total
    ));
  end loop;

  if v_subtotal <= 0 then
    raise exception 'Carrinho sem valor para finalizar.';
  end if;

  if v_coupon_code <> '' then
    select *
    into v_coupon
    from public.coupons c
    where c.tenant_id = p_tenant_id
      and upper(c.code) = v_coupon_code
    for update;

    if not found then
      raise exception 'Cupom nao encontrado.';
    end if;

    if v_coupon.status <> 'active'
      or (v_coupon.starts_at is not null and v_coupon.starts_at > now())
      or (v_coupon.ends_at is not null and v_coupon.ends_at < now())
      or (v_coupon.max_uses is not null and v_coupon.used_count >= v_coupon.max_uses) then
      raise exception 'Cupom indisponivel.';
    end if;

    if v_coupon.min_subtotal_cents is not null and v_subtotal < v_coupon.min_subtotal_cents then
      raise exception 'Subtotal abaixo do minimo para este cupom.';
    end if;

    if v_coupon.type = 'free_shipping' then
      v_shipping := 0;
    elsif v_coupon.type = 'percent' then
      v_discount := least(v_subtotal, greatest(round(v_subtotal * least(greatest(v_coupon.value, 0), 100) / 100.0)::integer, 0));
    elsif v_coupon.type = 'fixed' then
      v_discount := least(v_subtotal, greatest(round(v_coupon.value * 100)::integer, 0));
    end if;

    v_coupon_id := v_coupon.id;
    update public.coupons
    set used_count = used_count + 1
    where id = v_coupon.id;
  end if;

  v_total := greatest(v_subtotal - v_discount + v_shipping, 0);
  v_shipping_address := jsonb_build_object(
    'recipient', v_recipient,
    'street', v_street,
    'number', v_number,
    'complement', v_complement,
    'district', v_district,
    'city', v_city,
    'state', v_state,
    'zip', v_zip,
    'country', coalesce(nullif(v_country, ''), 'BR')
  );

  insert into public.customers (
    tenant_id,
    profile_id,
    email,
    full_name,
    phone,
    accepts_marketing,
    tags
  )
  values (
    p_tenant_id,
    auth.uid(),
    v_email,
    v_name,
    v_phone,
    coalesce(p_accepts_marketing, false),
    array['checkout']
  )
  on conflict (tenant_id, email) do update
  set
    profile_id = coalesce(public.customers.profile_id, excluded.profile_id),
    full_name = coalesce(excluded.full_name, public.customers.full_name),
    phone = coalesce(excluded.phone, public.customers.phone),
    accepts_marketing = public.customers.accepts_marketing or excluded.accepts_marketing,
    tags = (
      select array_agg(distinct tag)
      from unnest(coalesce(public.customers.tags, '{}'::text[]) || excluded.tags) as merged(tag)
    ),
    updated_at = now()
  returning id into v_customer_id;

  insert into public.addresses (
    tenant_id,
    customer_id,
    label,
    recipient,
    street,
    number,
    complement,
    district,
    city,
    state,
    zip,
    country,
    is_default_shipping,
    is_default_billing
  )
  values (
    p_tenant_id,
    v_customer_id,
    'checkout',
    v_recipient,
    v_street,
    v_number,
    v_complement,
    v_district,
    v_city,
    v_state,
    v_zip,
    coalesce(nullif(v_country, ''), 'BR'),
    true,
    true
  )
  returning id into v_address_id;

  v_order_number := public.next_order_number(p_tenant_id);

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
    billing_address,
    coupon_id,
    notes,
    placed_at
  )
  values (
    p_tenant_id,
    v_order_number,
    v_customer_id,
    'pending',
    v_subtotal,
    v_discount,
    v_shipping,
    v_total,
    coalesce(v_currency, 'BRL'),
    v_shipping_address,
    v_shipping_address,
    v_coupon_id,
    nullif(btrim(coalesce(p_notes, '')), ''),
    now()
  )
  returning id into v_order_id;

  for v_item in select value from jsonb_array_elements(v_items)
  loop
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
      (v_item ->> 'variant_id')::uuid,
      v_item - 'quantity' - 'unit_price_cents' - 'total_cents',
      (v_item ->> 'quantity')::integer,
      (v_item ->> 'unit_price_cents')::integer,
      (v_item ->> 'total_cents')::integer
    );
  end loop;

  update public.carts
  set
    customer_id = v_customer_id,
    customer_email = v_email,
    customer_name = coalesce(v_name, v_cart.customer_name),
    status = 'converted',
    last_activity_at = now(),
    updated_at = now()
  where id = v_cart.id;

  if coalesce(p_accepts_marketing, false) then
    insert into public.leads (
      tenant_id,
      email,
      name,
      phone,
      source,
      consent_at,
      converted_customer_id,
      tags
    )
    values (
      p_tenant_id,
      v_email,
      v_name,
      v_phone,
      'checkout',
      now(),
      v_customer_id,
      array['checkout']
    )
    on conflict (tenant_id, email) do update
    set
      name = coalesce(excluded.name, public.leads.name),
      phone = coalesce(excluded.phone, public.leads.phone),
      consent_at = coalesce(public.leads.consent_at, excluded.consent_at),
      converted_customer_id = coalesce(public.leads.converted_customer_id, excluded.converted_customer_id),
      tags = (
        select array_agg(distinct tag)
        from unnest(coalesce(public.leads.tags, '{}'::text[]) || excluded.tags) as merged(tag)
      );
  end if;

  return jsonb_build_object(
    'ok', true,
    'order_id', v_order_id,
    'order_number', v_order_number,
    'customer_id', v_customer_id,
    'address_id', v_address_id,
    'subtotal_cents', v_subtotal,
    'discount_cents', v_discount,
    'shipping_cents', v_shipping,
    'total_cents', v_total,
    'currency', coalesce(v_currency, 'BRL')
  );
end;
$$;

revoke all on function public.create_storefront_order(
  uuid,
  text,
  text,
  text,
  text,
  boolean,
  jsonb,
  text,
  text
) from public;
grant execute on function public.create_storefront_order(
  uuid,
  text,
  text,
  text,
  text,
  boolean,
  jsonb,
  text,
  text
) to anon, authenticated;
