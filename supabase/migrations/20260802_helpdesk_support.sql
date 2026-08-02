-- ============================================================
-- Help Desk Flora Botanics — Tabelas de Suporte
-- Migração: 20260802_helpdesk_support.sql
-- ============================================================

-- ── 1. CHANNEL CONNECTIONS ───────────────────────────────────
-- Configuração de cada canal conectado ao tenant

CREATE TABLE helpdesk_channel_connections (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  channel         helpdesk_channel NOT NULL,
  name            text NOT NULL,        -- "E-mail principal", "WhatsApp Flora"
  identifier      text,                 -- e-mail, número WhatsApp, page_id, etc.
  active          boolean DEFAULT true,

  -- Credenciais e configuração (nunca expor via RLS ao cliente)
  config          jsonb DEFAULT '{}',   -- { api_key, webhook_secret, … } — server-side only

  -- Status operacional
  status          text DEFAULT 'disconnected', -- 'connected','disconnected','error'
  last_sync_at    timestamptz,
  last_error      text,
  last_error_at   timestamptz,
  webhook_url     text,
  webhook_verified_at timestamptz,

  -- Limites e uso
  daily_send_limit  int,
  daily_sent_count  int DEFAULT 0,
  reset_at          timestamptz,

  -- Configurações operacionais
  default_assignee_id   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  default_team          text,
  auto_reply_enabled    boolean DEFAULT false,
  auto_reply_message    text,
  business_hours_only   boolean DEFAULT true,
  signature             text,

  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  deleted_at      timestamptz,

  UNIQUE (tenant_id, channel, identifier)
);

CREATE INDEX idx_hd_chan_tenant_active ON helpdesk_channel_connections(tenant_id, channel) WHERE active = true AND deleted_at IS NULL;

-- ── 2. WEBHOOK EVENTS ────────────────────────────────────────
-- Log de eventos recebidos via webhook (idempotência, replay, debug)

CREATE TABLE helpdesk_webhook_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid REFERENCES tenants(id) ON DELETE CASCADE,
  channel_id      uuid REFERENCES helpdesk_channel_connections(id) ON DELETE SET NULL,
  channel         helpdesk_channel NOT NULL,

  external_id     text NOT NULL,        -- ID único do evento no canal externo
  event_type      text NOT NULL,        -- 'message.received', 'status.delivered', etc.
  payload         jsonb NOT NULL DEFAULT '{}',
  processed       boolean DEFAULT false,
  processed_at    timestamptz,
  error           text,
  retry_count     int DEFAULT 0,

  created_at      timestamptz DEFAULT now(),

  UNIQUE (channel, external_id)
);

CREATE INDEX idx_hd_wh_unprocessed ON helpdesk_webhook_events(channel, processed, created_at) WHERE processed = false;
CREATE INDEX idx_hd_wh_tenant      ON helpdesk_webhook_events(tenant_id, created_at DESC);

-- ── 3. SLA POLICIES ──────────────────────────────────────────

CREATE TABLE helpdesk_sla_policies (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name            text NOT NULL,
  description     text,
  active          boolean DEFAULT true,

  -- Prazos em minutos (null = sem SLA para aquele nível)
  -- Por prioridade: low, normal, high, urgent, critical
  first_response_minutes  jsonb DEFAULT '{"low":480,"normal":240,"high":60,"urgent":30,"critical":15}',
  next_response_minutes   jsonb DEFAULT '{"low":1440,"normal":480,"high":120,"urgent":60,"critical":30}',
  resolution_minutes      jsonb DEFAULT '{"low":10080,"normal":2880,"high":480,"urgent":240,"critical":60}',

  -- Horário comercial
  business_hours_only     boolean DEFAULT true,
  business_hours_start    time DEFAULT '08:00',
  business_hours_end      time DEFAULT '18:00',
  business_days           int[] DEFAULT '{1,2,3,4,5}', -- 1=Mon … 7=Sun

  -- Escalonamento
  escalate_at_percent     int DEFAULT 80, -- escalar quando atingir X% do prazo
  escalate_to_user_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  escalate_to_team        text,

  -- Aplicação
  applies_to_channels     helpdesk_channel[],
  applies_to_categories   text[],
  applies_to_teams        text[],

  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- ── 4. SLA EVENTS LOG ────────────────────────────────────────

CREATE TABLE helpdesk_sla_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES helpdesk_conversations(id) ON DELETE CASCADE,
  policy_id       uuid REFERENCES helpdesk_sla_policies(id) ON DELETE SET NULL,

  event_type      text NOT NULL, -- 'first_response_met','first_response_breached','resolved_met','breached', etc.
  priority        helpdesk_priority NOT NULL,
  due_at          timestamptz NOT NULL,
  occurred_at     timestamptz NOT NULL DEFAULT now(),
  minutes_delta   int,          -- positivo = dentro do prazo, negativo = atrasado

  created_at      timestamptz DEFAULT now()
);

CREATE INDEX idx_hd_sla_events_conv ON helpdesk_sla_events(conversation_id, created_at DESC);

-- ── 5. TEMPLATES ─────────────────────────────────────────────

CREATE TABLE helpdesk_templates (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  name            text NOT NULL,
  category        text,          -- 'boas_vindas','pedido_expedido','troca', etc.
  subject         text,
  body            text NOT NULL,
  body_html       text,
  variables       text[] DEFAULT '{}', -- ['{{customer.first_name}}', …]

  -- Canais onde pode ser usado
  channels        helpdesk_channel[] DEFAULT '{email,whatsapp,chat}',

  -- Aprovação para canais que exigem (WhatsApp)
  wa_template_name    text,
  wa_template_status  text,      -- 'pending','approved','rejected'
  wa_language_code    text DEFAULT 'pt_BR',

  active          boolean DEFAULT true,
  use_count       int DEFAULT 0,

  created_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- ── 6. MACROS ────────────────────────────────────────────────

CREATE TABLE helpdesk_macros (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name            text NOT NULL,
  description     text,
  active          boolean DEFAULT true,
  visibility      text DEFAULT 'all', -- 'all','team','private'
  created_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Sequência de ações a executar
  -- Cada ação: { type: 'set_status'|'set_priority'|'assign'|'add_tag'|'send_reply'|'send_note'|'create_task', params: {} }
  actions         jsonb NOT NULL DEFAULT '[]',

  use_count       int DEFAULT 0,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- ── 7. AUTOMATION RULES ──────────────────────────────────────

CREATE TABLE helpdesk_automation_rules (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name            text NOT NULL,
  description     text,
  active          boolean DEFAULT true,
  sort_order      int DEFAULT 0,

  -- Gatilho
  trigger_type    text NOT NULL,
  -- 'conversation_created','message_received','status_changed',
  -- 'sla_near_breach','sla_breached','keyword_detected',
  -- 'priority_changed','no_reply_after','vip_contact', etc.

  trigger_config  jsonb DEFAULT '{}',

  -- Condições (AND entre elas)
  -- Cada condição: { field: 'channel'|'priority'|'category'|'contact_type'|..., op: 'eq'|'contains'|'gt'|..., value: … }
  conditions      jsonb DEFAULT '[]',

  -- Ações (executadas em ordem)
  -- Mesma estrutura das macros
  actions         jsonb NOT NULL DEFAULT '[]',

  -- Controle de execução
  stop_on_match   boolean DEFAULT false,  -- parar de checar outras regras
  run_count       bigint DEFAULT 0,
  last_run_at     timestamptz,

  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE INDEX idx_hd_auto_tenant_active ON helpdesk_automation_rules(tenant_id, sort_order) WHERE active = true;

-- ── 8. TICKET TASKS ──────────────────────────────────────────

CREATE TABLE helpdesk_tasks (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES helpdesk_conversations(id) ON DELETE CASCADE,

  title           text NOT NULL,
  description     text,
  type            text DEFAULT 'followup', -- 'call','email','followup','logistics','financial','other'

  status          text DEFAULT 'pending',  -- 'pending','in_progress','done','cancelled'
  priority        helpdesk_priority DEFAULT 'normal',

  assignee_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  due_at          timestamptz,
  remind_at       timestamptz,
  completed_at    timestamptz,

  created_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE INDEX idx_hd_tasks_conv    ON helpdesk_tasks(conversation_id);
CREATE INDEX idx_hd_tasks_assignee ON helpdesk_tasks(assignee_id, due_at) WHERE status != 'done';

-- ── 9. SATISFACTION SURVEYS ──────────────────────────────────

CREATE TABLE helpdesk_csat_surveys (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES helpdesk_conversations(id) ON DELETE CASCADE,

  sent_at         timestamptz NOT NULL DEFAULT now(),
  responded_at    timestamptz,
  score           smallint CHECK (score BETWEEN 1 AND 5),
  comment         text,
  agent_rating    smallint CHECK (agent_rating BETWEEN 1 AND 5),
  would_recommend boolean,

  agent_id        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  token           uuid NOT NULL DEFAULT gen_random_uuid(), -- token único para link público

  UNIQUE (conversation_id)
);

CREATE UNIQUE INDEX idx_hd_csat_token ON helpdesk_csat_surveys(token);

-- ── 10. AUDIT LOG ────────────────────────────────────────────

CREATE TABLE helpdesk_audit_logs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES helpdesk_conversations(id) ON DELETE SET NULL,
  message_id      uuid REFERENCES helpdesk_messages(id) ON DELETE SET NULL,

  actor_id        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_name      text,
  actor_type      text DEFAULT 'user',  -- 'user','system','automation','api'

  action          text NOT NULL,
  -- 'conversation_created','message_sent','message_received','status_changed',
  -- 'assigned','transferred','priority_changed','tag_added','note_added',
  -- 'attachment_uploaded','sla_breached','resolved','reopened','archived',
  -- 'macro_executed','automation_triggered','template_sent', etc.

  entity_type     text,
  entity_id       uuid,
  before_state    jsonb,
  after_state     jsonb,
  metadata        jsonb DEFAULT '{}',

  created_at      timestamptz DEFAULT now()
);

CREATE INDEX idx_hd_audit_conv    ON helpdesk_audit_logs(conversation_id, created_at DESC);
CREATE INDEX idx_hd_audit_tenant  ON helpdesk_audit_logs(tenant_id, created_at DESC);
CREATE INDEX idx_hd_audit_actor   ON helpdesk_audit_logs(actor_id, created_at DESC);

-- ── 11. SAVED VIEWS ──────────────────────────────────────────
-- Visualizações salvas pelos agentes

CREATE TABLE helpdesk_saved_views (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  owner_id        uuid REFERENCES auth.users(id) ON DELETE CASCADE,

  name            text NOT NULL,
  description     text,
  icon            text,
  visibility      text DEFAULT 'private', -- 'private','team','all'

  -- Filtros serializados (mesma estrutura da query da lista)
  filters         jsonb NOT NULL DEFAULT '{}',
  sort_by         text DEFAULT 'last_message_at',
  sort_desc       boolean DEFAULT true,

  sort_order      int DEFAULT 0,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- ── 12. TEAM AVAILABILITY ────────────────────────────────────

CREATE TABLE helpdesk_agent_availability (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  status          text DEFAULT 'offline', -- 'online','busy','away','offline'
  status_message  text,
  away_reason     text,

  -- Capacidade de atendimento simultâneo
  max_conversations int DEFAULT 10,
  current_conversations int DEFAULT 0,

  -- Ausência programada
  away_from       timestamptz,
  away_until      timestamptz,

  updated_at      timestamptz DEFAULT now(),

  UNIQUE (tenant_id, user_id)
);

-- ── 13. TRIGGERS: updated_at ─────────────────────────────────

CREATE TRIGGER trg_hd_chan_updated_at
  BEFORE UPDATE ON helpdesk_channel_connections
  FOR EACH ROW EXECUTE FUNCTION helpdesk_set_updated_at();

CREATE TRIGGER trg_hd_sla_updated_at
  BEFORE UPDATE ON helpdesk_sla_policies
  FOR EACH ROW EXECUTE FUNCTION helpdesk_set_updated_at();

CREATE TRIGGER trg_hd_tpl_updated_at
  BEFORE UPDATE ON helpdesk_templates
  FOR EACH ROW EXECUTE FUNCTION helpdesk_set_updated_at();

CREATE TRIGGER trg_hd_macro_updated_at
  BEFORE UPDATE ON helpdesk_macros
  FOR EACH ROW EXECUTE FUNCTION helpdesk_set_updated_at();

CREATE TRIGGER trg_hd_auto_updated_at
  BEFORE UPDATE ON helpdesk_automation_rules
  FOR EACH ROW EXECUTE FUNCTION helpdesk_set_updated_at();

CREATE TRIGGER trg_hd_tasks_updated_at
  BEFORE UPDATE ON helpdesk_tasks
  FOR EACH ROW EXECUTE FUNCTION helpdesk_set_updated_at();
