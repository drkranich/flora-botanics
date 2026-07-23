-- Conteudo editorial por produto para a pagina publica.
-- Mantem os blocos de produto editaveis no Catalogo do admin:
-- cards de beneficios/rotina/compra e FAQ da pagina de produto.

alter table public.products
  add column if not exists editorial_content jsonb not null default '{}'::jsonb;

comment on column public.products.editorial_content is
  'JSON editavel pelo admin para detalhes editoriais da pagina publica do produto: cards e FAQ.';
