-- Bucket de armazenamento para imagens de assinaturas digitais
-- Acesso via service_role apenas (a API route usa service_role para upload)

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'signatures',
  'signatures',
  false,                          -- bucket privado
  524288,                         -- 512 KB máx por arquivo
  array['image/png', 'image/jpeg', 'application/pdf']
)
on conflict (id) do nothing;

-- Apenas service_role acessa (via API route) — sem policies adicionais necessárias
-- pois o cliente do admin usa service_role para upload e leitura do bucket
