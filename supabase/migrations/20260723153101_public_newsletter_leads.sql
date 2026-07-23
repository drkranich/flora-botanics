-- Captura publica de newsletter/avise-me.
-- A leitura continua restrita ao staff; publico so pode inserir lead consentido.

drop policy if exists leads_public_newsletter_insert on public.leads;

create policy leads_public_newsletter_insert on public.leads
  for insert
  to anon, authenticated
  with check (
    source = 'newsletter'
    and consent_at is not null
    and converted_customer_id is null
    and coalesce(array_length(tags, 1), 0) <= 10
  );

grant insert on public.leads to anon, authenticated;
