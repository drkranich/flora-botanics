-- Adiciona campo barcode em product_variants para leitores HID no PDV
alter table public.product_variants
  add column if not exists barcode text;

create index if not exists idx_product_variants_barcode
  on public.product_variants(barcode)
  where barcode is not null;
