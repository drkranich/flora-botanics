-- ============================================================
-- Help Desk: suporte a WhatsApp e Instagram
-- Migração: 20260803_helpdesk_whatsapp_instagram.sql
-- ============================================================

-- Nota: helpdesk_messages já tem channel_metadata jsonb DEFAULT '{}'
-- que armazena media_type, media_url, media_id, wa_phone_number_id, ig_psid, etc.
-- Essa migração adiciona índices e ajustes necessários.

-- ── 1. Índice para buscar conversas por canal + thread ───────────────────────
-- (já existe idx_hd_conv_external_thread, mas garantimos índice por canal/phone)

CREATE INDEX IF NOT EXISTS idx_hd_conv_wa_phone
  ON helpdesk_conversations(tenant_id, channel, contact_phone)
  WHERE channel = 'whatsapp' AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_hd_conv_ig_thread
  ON helpdesk_conversations(tenant_id, channel, external_thread_id)
  WHERE channel = 'instagram' AND deleted_at IS NULL;

-- ── 2. Índice para buscar contatos por external_id (PSID do IG) ──────────────

CREATE INDEX IF NOT EXISTS idx_hd_contacts_external_id
  ON helpdesk_contacts(tenant_id, external_id)
  WHERE external_id IS NOT NULL;

-- ── 3. Índice para webhook_events por canal ───────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_hd_wh_channel_external
  ON helpdesk_webhook_events(channel, external_id);

-- ── 4. helpdesk_contacts: garantir coluna external_id existe ─────────────────
-- (já definida na migração core, mas se vier de versão anterior)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'helpdesk_contacts' AND column_name = 'external_id'
  ) THEN
    ALTER TABLE helpdesk_contacts ADD COLUMN external_id text;
  END IF;
END$$;

-- ── 5. helpdesk_conversations: garantir coluna contact_phone existe ───────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'helpdesk_conversations' AND column_name = 'contact_phone'
  ) THEN
    ALTER TABLE helpdesk_conversations ADD COLUMN contact_phone text;
  END IF;
END$$;

-- ── 6. helpdesk_audit_log → helpdesk_audit_logs (compat) ─────────────────────
-- O schema original usa helpdesk_audit_logs (com 's').
-- Cria view de compatibilidade caso código antigo use sem 's'.

CREATE OR REPLACE VIEW helpdesk_audit_log AS
  SELECT * FROM helpdesk_audit_logs;

-- ── 7. Função helper para resolver URL de mídia WhatsApp ─────────────────────
-- (opcional — pode ser chamada por edge function para baixar mídias do WA)

-- CREATE OR REPLACE FUNCTION helpdesk_resolve_wa_media(
--   media_id text,
--   access_token text
-- ) RETURNS text LANGUAGE plpgsql AS $$
-- -- Placeholder: a resolução real é feita na edge function
-- BEGIN
--   RETURN 'https://graph.facebook.com/v19.0/' || media_id;
-- END;
-- $$;

-- ── 8. RLS: permitir service_role inserir em webhook_events ──────────────────
-- (já deve estar configurado na migração RLS, apenas garantindo)

ALTER TABLE helpdesk_webhook_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'helpdesk_webhook_events' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON helpdesk_webhook_events
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END$$;
