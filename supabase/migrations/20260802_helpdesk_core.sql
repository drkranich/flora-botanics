-- ============================================================
-- Help Desk Flora Botanics — Tabelas Core
-- Migração: 20260802_helpdesk_core.sql
-- ============================================================

-- ── 1. ENUM TYPES ────────────────────────────────────────────

CREATE TYPE helpdesk_channel AS ENUM (
  'email', 'whatsapp', 'instagram', 'facebook',
  'chat', 'sms', 'form', 'internal', 'api', 'other'
);

CREATE TYPE helpdesk_status AS ENUM (
  'new', 'open', 'triaging', 'assigned', 'in_progress',
  'waiting_customer', 'waiting_team', 'waiting_third_party',
  'waiting_payment', 'waiting_logistics', 'waiting_stock',
  'waiting_financial', 'waiting_fiscal',
  'escalated', 'resolved', 'closed', 'reopened',
  'archived', 'spam'
);

CREATE TYPE helpdesk_priority AS ENUM (
  'low', 'normal', 'high', 'urgent', 'critical'
);

CREATE TYPE helpdesk_message_type AS ENUM (
  'inbound', 'outbound', 'note', 'event', 'system'
);

CREATE TYPE helpdesk_participant_role AS ENUM (
  'assignee', 'follower', 'cc', 'bcc', 'observer'
);

CREATE TYPE helpdesk_contact_type AS ENUM (
  'customer', 'lead', 'supplier', 'b2b', 'partner',
  'subscriber', 'internal', 'unknown'
);

CREATE TYPE helpdesk_sla_state AS ENUM (
  'ok', 'attention', 'near_breach', 'breached'
);

-- ── 2. CONTACTS ──────────────────────────────────────────────
-- Contatos centralizados do help desk (clientes, leads, fornecedores…)

CREATE TABLE helpdesk_contacts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Identificação
  name            text NOT NULL,
  email           text,
  phone           text,       -- +5511999999999 formato E.164
  whatsapp        text,
  external_id     text,       -- ID no sistema de origem (ex: customers.id)
  avatar_url      text,

  -- Classificação
  type            helpdesk_contact_type NOT NULL DEFAULT 'unknown',
  company         text,
  language        text DEFAULT 'pt-BR',
  city            text,
  state           text,
  country         text DEFAULT 'BR',

  -- Consentimentos LGPD
  email_consent   boolean DEFAULT false,
  sms_consent     boolean DEFAULT false,
  whatsapp_consent boolean DEFAULT false,
  marketing_consent boolean DEFAULT false,

  -- Métricas (desnormalizadas para performance)
  total_spent_cents   bigint DEFAULT 0,
  order_count         int DEFAULT 0,
  last_order_at       timestamptz,
  is_vip              boolean DEFAULT false,

  -- Vínculos
  customer_id     uuid,       -- FK para customers se existir
  supplier_id     uuid,

  -- Meta
  tags            text[] DEFAULT '{}',
  custom_fields   jsonb DEFAULT '{}',
  notes           text,

  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  deleted_at      timestamptz,

  UNIQUE (tenant_id, email)
);

-- ── 3. CONVERSATIONS ─────────────────────────────────────────
-- Cada atendimento / ticket / thread é uma conversation

CREATE TABLE helpdesk_conversations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Número sequencial por tenant
  number          bigserial,

  -- Contato
  contact_id      uuid REFERENCES helpdesk_contacts(id) ON DELETE SET NULL,
  contact_name    text,       -- cache para exibição rápida
  contact_email   text,
  contact_phone   text,

  -- Canal
  channel         helpdesk_channel NOT NULL DEFAULT 'email',
  channel_id      uuid,       -- FK para helpdesk_channel_connections
  external_thread_id text,    -- thread_id do e-mail, conversation_id do WA, etc.

  -- Assunto e classificação
  subject         text,
  category        text,
  subcategory     text,
  tags            text[] DEFAULT '{}',

  -- Status e prioridade
  status          helpdesk_status NOT NULL DEFAULT 'new',
  priority        helpdesk_priority NOT NULL DEFAULT 'normal',

  -- Atribuição
  assignee_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  team            text,       -- nome da equipe ('Atendimento', 'Logística', etc.)

  -- SLA
  sla_policy_id   uuid,       -- FK para helpdesk_sla_policies
  sla_state       helpdesk_sla_state DEFAULT 'ok',
  first_response_due_at   timestamptz,
  next_response_due_at    timestamptz,
  resolution_due_at       timestamptz,
  first_responded_at      timestamptz,
  last_responded_at       timestamptz,
  resolved_at             timestamptz,
  closed_at               timestamptz,

  -- Vínculos com outros módulos
  order_id        uuid,       -- pedido relacionado
  product_id      uuid,
  subscription_id uuid,
  supplier_id     uuid,
  document_id     uuid,

  -- Contexto da origem
  source_url      text,       -- página que originou o chat
  source_campaign text,
  origin          text,       -- 'chat_widget', 'email_in', 'manual', 'api', etc.
  ip_address      inet,

  -- Análise assistiva
  sentiment       text,       -- 'positive','neutral','negative','critical'
  risk_level      text,       -- 'none','low','medium','high','legal'
  ai_category_suggestion    text,
  ai_priority_suggestion    helpdesk_priority,
  ai_suggestion_reviewed    boolean DEFAULT false,

  -- Contagens (desnormalizadas)
  message_count           int DEFAULT 0,
  unread_count            int DEFAULT 0,
  last_message_at         timestamptz,
  last_message_preview    text,
  last_message_direction  helpdesk_message_type,
  has_attachments         boolean DEFAULT false,

  -- Satisfação
  csat_score      smallint CHECK (csat_score BETWEEN 1 AND 5),
  csat_comment    text,
  csat_sent_at    timestamptz,
  csat_responded_at timestamptz,

  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  deleted_at      timestamptz
);

-- Índices críticos para filas e filtros
CREATE INDEX idx_hd_conv_tenant_status     ON helpdesk_conversations(tenant_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_hd_conv_tenant_assignee   ON helpdesk_conversations(tenant_id, assignee_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_hd_conv_tenant_priority   ON helpdesk_conversations(tenant_id, priority) WHERE deleted_at IS NULL;
CREATE INDEX idx_hd_conv_tenant_channel    ON helpdesk_conversations(tenant_id, channel) WHERE deleted_at IS NULL;
CREATE INDEX idx_hd_conv_tenant_contact    ON helpdesk_conversations(tenant_id, contact_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_hd_conv_last_message      ON helpdesk_conversations(tenant_id, last_message_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_hd_conv_sla_state        ON helpdesk_conversations(tenant_id, sla_state) WHERE deleted_at IS NULL AND status NOT IN ('resolved','closed','archived');
CREATE INDEX idx_hd_conv_order            ON helpdesk_conversations(order_id) WHERE order_id IS NOT NULL;
CREATE UNIQUE INDEX idx_hd_conv_external_thread ON helpdesk_conversations(tenant_id, channel, external_thread_id) WHERE external_thread_id IS NOT NULL AND deleted_at IS NULL;

-- ── 4. MESSAGES ──────────────────────────────────────────────

CREATE TABLE helpdesk_messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES helpdesk_conversations(id) ON DELETE CASCADE,

  -- Tipo e direção
  type            helpdesk_message_type NOT NULL DEFAULT 'inbound',

  -- Remetente
  sender_id       uuid REFERENCES auth.users(id) ON DELETE SET NULL,  -- agente
  sender_name     text NOT NULL DEFAULT '',
  sender_email    text,
  sender_is_contact boolean DEFAULT false,  -- true = mensagem do cliente

  -- Conteúdo
  subject         text,
  body            text NOT NULL DEFAULT '',
  body_html       text,
  excerpt         text,       -- primeiros 150 chars para preview

  -- Canal específico
  external_id     text,       -- message-id do email, id da msg do WA, etc.
  channel_metadata jsonb DEFAULT '{}', -- headers, status de entrega, etc.

  -- Anexos (referências)
  has_attachments boolean DEFAULT false,

  -- Status de entrega
  delivered_at    timestamptz,
  read_at         timestamptz,
  failed_at       timestamptz,
  failure_reason  text,

  -- E-mail específico
  email_from      text,
  email_to        text[],
  email_cc        text[],
  email_bcc       text[],
  email_message_id text,      -- Message-ID header
  email_in_reply_to text,     -- In-Reply-To header

  -- Nota interna
  is_internal_note boolean DEFAULT false,
  mentioned_user_ids uuid[] DEFAULT '{}',

  -- Evento de sistema
  event_type      text,       -- 'status_changed', 'assigned', 'sla_breached', etc.
  event_payload   jsonb DEFAULT '{}',

  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  deleted_at      timestamptz
);

CREATE INDEX idx_hd_msg_conversation ON helpdesk_messages(conversation_id, created_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_hd_msg_tenant       ON helpdesk_messages(tenant_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_hd_msg_external     ON helpdesk_messages(tenant_id, external_id) WHERE external_id IS NOT NULL;
CREATE INDEX idx_hd_msg_email_msgid  ON helpdesk_messages(email_message_id) WHERE email_message_id IS NOT NULL;

-- ── 5. ATTACHMENTS ───────────────────────────────────────────

CREATE TABLE helpdesk_attachments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES helpdesk_conversations(id) ON DELETE CASCADE,
  message_id      uuid REFERENCES helpdesk_messages(id) ON DELETE SET NULL,

  filename        text NOT NULL,
  content_type    text NOT NULL DEFAULT 'application/octet-stream',
  size_bytes      bigint NOT NULL DEFAULT 0,
  storage_path    text NOT NULL,  -- path no Supabase Storage
  public_url      text,

  -- Vínculo com cofre documental
  vault_document_id uuid,

  uploaded_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX idx_hd_attach_conversation ON helpdesk_attachments(conversation_id);
CREATE INDEX idx_hd_attach_message      ON helpdesk_attachments(message_id);

-- ── 6. PARTICIPANTS ──────────────────────────────────────────

CREATE TABLE helpdesk_participants (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES helpdesk_conversations(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role            helpdesk_participant_role NOT NULL DEFAULT 'follower',
  last_read_at    timestamptz,
  added_at        timestamptz DEFAULT now(),

  UNIQUE (conversation_id, user_id)
);

CREATE INDEX idx_hd_part_user ON helpdesk_participants(user_id, conversation_id);

-- ── 7. STATUS HISTORY ────────────────────────────────────────

CREATE TABLE helpdesk_status_history (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES helpdesk_conversations(id) ON DELETE CASCADE,
  from_status     helpdesk_status,
  to_status       helpdesk_status NOT NULL,
  changed_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_by_name text,
  reason          text,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX idx_hd_status_hist_conv ON helpdesk_status_history(conversation_id, created_at DESC);

-- ── 8. ASSIGNMENTS HISTORY ───────────────────────────────────

CREATE TABLE helpdesk_assignment_history (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES helpdesk_conversations(id) ON DELETE CASCADE,
  from_assignee   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  to_assignee     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  from_team       text,
  to_team         text,
  assigned_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_by_name text,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX idx_hd_assign_hist_conv ON helpdesk_assignment_history(conversation_id, created_at DESC);

-- ── 9. TAGS CATALOG ──────────────────────────────────────────

CREATE TABLE helpdesk_tags (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        text NOT NULL,
  color       text DEFAULT '#6b7280',
  description text,
  created_at  timestamptz DEFAULT now(),
  UNIQUE (tenant_id, name)
);

-- ── 10. CATEGORIES CATALOG ───────────────────────────────────

CREATE TABLE helpdesk_categories (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  parent_id       uuid REFERENCES helpdesk_categories(id) ON DELETE SET NULL,
  name            text NOT NULL,
  description     text,
  icon            text,
  default_priority helpdesk_priority DEFAULT 'normal',
  default_team    text,
  sort_order      int DEFAULT 0,
  active          boolean DEFAULT true,
  created_at      timestamptz DEFAULT now(),
  UNIQUE (tenant_id, parent_id, name)
);

-- Seed de categorias padrão (inseridas por tenant na primeira configuração, não aqui)

-- ── 11. TRIGGER: updated_at ──────────────────────────────────

CREATE OR REPLACE FUNCTION helpdesk_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_hd_contacts_updated_at
  BEFORE UPDATE ON helpdesk_contacts
  FOR EACH ROW EXECUTE FUNCTION helpdesk_set_updated_at();

CREATE TRIGGER trg_hd_conv_updated_at
  BEFORE UPDATE ON helpdesk_conversations
  FOR EACH ROW EXECUTE FUNCTION helpdesk_set_updated_at();

CREATE TRIGGER trg_hd_msg_updated_at
  BEFORE UPDATE ON helpdesk_messages
  FOR EACH ROW EXECUTE FUNCTION helpdesk_set_updated_at();

-- ── 12. TRIGGER: atualizar contadores na conversa ────────────

CREATE OR REPLACE FUNCTION helpdesk_update_conversation_counters()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.deleted_at IS NULL AND NOT NEW.is_internal_note) THEN
    UPDATE helpdesk_conversations
    SET
      message_count         = message_count + 1,
      last_message_at       = NEW.created_at,
      last_message_preview  = left(NEW.body, 150),
      last_message_direction = NEW.type,
      has_attachments       = (has_attachments OR NEW.has_attachments),
      -- unread_count só sobe para mensagens inbound
      unread_count = CASE WHEN NEW.type = 'inbound' THEN unread_count + 1 ELSE unread_count END,
      updated_at            = now()
    WHERE id = NEW.conversation_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_hd_msg_update_conv
  AFTER INSERT ON helpdesk_messages
  FOR EACH ROW EXECUTE FUNCTION helpdesk_update_conversation_counters();
