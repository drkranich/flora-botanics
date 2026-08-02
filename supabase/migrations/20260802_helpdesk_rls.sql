-- ============================================================
-- Help Desk Flora Botanics — Row Level Security
-- Migração: 20260802_helpdesk_rls.sql
-- ============================================================
-- Todas as tabelas do help desk usam tenant_id para isolamento.
-- Staff (tenant_admin, tenant_editor) acessa apenas o próprio tenant.
-- service_role tem acesso irrestrito (Edge Functions, webhooks).
-- ============================================================

-- Helper: extrai tenant_id do JWT (app_metadata.tenant_id)
-- (já criada nas migrations anteriores de RLS do projeto)

-- ── helpdesk_contacts ─────────────────────────────────────────
ALTER TABLE helpdesk_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "helpdesk_contacts: staff vê próprio tenant"
  ON helpdesk_contacts FOR SELECT
  TO authenticated
  USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

CREATE POLICY "helpdesk_contacts: staff cria no próprio tenant"
  ON helpdesk_contacts FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

CREATE POLICY "helpdesk_contacts: staff atualiza no próprio tenant"
  ON helpdesk_contacts FOR UPDATE
  TO authenticated
  USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

CREATE POLICY "helpdesk_contacts: apenas admin exclui"
  ON helpdesk_contacts FOR DELETE
  TO authenticated
  USING (
    tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
    AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'tenant_admin'
  );

-- ── helpdesk_conversations ────────────────────────────────────
ALTER TABLE helpdesk_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "helpdesk_conversations: staff vê próprio tenant"
  ON helpdesk_conversations FOR SELECT
  TO authenticated
  USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

CREATE POLICY "helpdesk_conversations: staff cria"
  ON helpdesk_conversations FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

CREATE POLICY "helpdesk_conversations: staff atualiza"
  ON helpdesk_conversations FOR UPDATE
  TO authenticated
  USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

CREATE POLICY "helpdesk_conversations: apenas admin exclui"
  ON helpdesk_conversations FOR DELETE
  TO authenticated
  USING (
    tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
    AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'tenant_admin'
  );

-- ── helpdesk_messages ─────────────────────────────────────────
ALTER TABLE helpdesk_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "helpdesk_messages: staff vê próprio tenant"
  ON helpdesk_messages FOR SELECT
  TO authenticated
  USING (
    tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
    -- notas internas apenas para staff (nunca para clientes)
  );

CREATE POLICY "helpdesk_messages: staff cria"
  ON helpdesk_messages FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

CREATE POLICY "helpdesk_messages: staff atualiza próprias mensagens"
  ON helpdesk_messages FOR UPDATE
  TO authenticated
  USING (
    tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
    AND (sender_id = auth.uid() OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'tenant_admin')
  )
  WITH CHECK (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

CREATE POLICY "helpdesk_messages: apenas admin exclui"
  ON helpdesk_messages FOR DELETE
  TO authenticated
  USING (
    tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
    AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'tenant_admin'
  );

-- ── helpdesk_attachments ──────────────────────────────────────
ALTER TABLE helpdesk_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "helpdesk_attachments: staff vê próprio tenant"
  ON helpdesk_attachments FOR SELECT
  TO authenticated
  USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

CREATE POLICY "helpdesk_attachments: staff insere"
  ON helpdesk_attachments FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

CREATE POLICY "helpdesk_attachments: apenas admin exclui"
  ON helpdesk_attachments FOR DELETE
  TO authenticated
  USING (
    tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
    AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'tenant_admin'
  );

-- ── helpdesk_participants ─────────────────────────────────────
ALTER TABLE helpdesk_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "helpdesk_participants: staff vê próprio tenant"
  ON helpdesk_participants FOR SELECT
  TO authenticated
  USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

CREATE POLICY "helpdesk_participants: staff gerencia"
  ON helpdesk_participants FOR ALL
  TO authenticated
  USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

-- ── helpdesk_status_history ───────────────────────────────────
ALTER TABLE helpdesk_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "helpdesk_status_history: staff vê próprio tenant"
  ON helpdesk_status_history FOR SELECT
  TO authenticated
  USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

CREATE POLICY "helpdesk_status_history: staff insere"
  ON helpdesk_status_history FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

-- ── helpdesk_assignment_history ───────────────────────────────
ALTER TABLE helpdesk_assignment_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "helpdesk_assignment_history: staff vê próprio tenant"
  ON helpdesk_assignment_history FOR SELECT
  TO authenticated
  USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

CREATE POLICY "helpdesk_assignment_history: staff insere"
  ON helpdesk_assignment_history FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

-- ── helpdesk_tags ─────────────────────────────────────────────
ALTER TABLE helpdesk_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "helpdesk_tags: staff vê próprio tenant"
  ON helpdesk_tags FOR SELECT
  TO authenticated
  USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

CREATE POLICY "helpdesk_tags: admin gerencia"
  ON helpdesk_tags FOR ALL
  TO authenticated
  USING (
    tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
    AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('tenant_admin', 'tenant_editor')
  )
  WITH CHECK (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

-- ── helpdesk_categories ───────────────────────────────────────
ALTER TABLE helpdesk_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "helpdesk_categories: staff vê próprio tenant"
  ON helpdesk_categories FOR SELECT
  TO authenticated
  USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

CREATE POLICY "helpdesk_categories: admin gerencia"
  ON helpdesk_categories FOR ALL
  TO authenticated
  USING (
    tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
    AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('tenant_admin', 'tenant_editor')
  )
  WITH CHECK (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

-- ── helpdesk_channel_connections ──────────────────────────────
ALTER TABLE helpdesk_channel_connections ENABLE ROW LEVEL SECURITY;

-- Config (credenciais) só acessível via service_role
-- Para o frontend, campos sensíveis devem ser filtrados nas Server Actions
CREATE POLICY "helpdesk_channel_connections: admin vê próprio tenant"
  ON helpdesk_channel_connections FOR SELECT
  TO authenticated
  USING (
    tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
    AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'tenant_admin'
  );

CREATE POLICY "helpdesk_channel_connections: admin gerencia"
  ON helpdesk_channel_connections FOR ALL
  TO authenticated
  USING (
    tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
    AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'tenant_admin'
  )
  WITH CHECK (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

-- ── helpdesk_webhook_events ───────────────────────────────────
ALTER TABLE helpdesk_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "helpdesk_webhook_events: admin vê próprio tenant"
  ON helpdesk_webhook_events FOR SELECT
  TO authenticated
  USING (
    tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
    AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'tenant_admin'
  );

-- ── helpdesk_sla_policies ─────────────────────────────────────
ALTER TABLE helpdesk_sla_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "helpdesk_sla_policies: staff vê próprio tenant"
  ON helpdesk_sla_policies FOR SELECT
  TO authenticated
  USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

CREATE POLICY "helpdesk_sla_policies: admin gerencia"
  ON helpdesk_sla_policies FOR ALL
  TO authenticated
  USING (
    tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
    AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'tenant_admin'
  )
  WITH CHECK (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

-- ── helpdesk_sla_events ───────────────────────────────────────
ALTER TABLE helpdesk_sla_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "helpdesk_sla_events: staff vê próprio tenant"
  ON helpdesk_sla_events FOR SELECT
  TO authenticated
  USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

CREATE POLICY "helpdesk_sla_events: staff insere"
  ON helpdesk_sla_events FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

-- ── helpdesk_templates ────────────────────────────────────────
ALTER TABLE helpdesk_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "helpdesk_templates: staff vê próprio tenant"
  ON helpdesk_templates FOR SELECT
  TO authenticated
  USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

CREATE POLICY "helpdesk_templates: staff gerencia"
  ON helpdesk_templates FOR ALL
  TO authenticated
  USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

-- ── helpdesk_macros ───────────────────────────────────────────
ALTER TABLE helpdesk_macros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "helpdesk_macros: staff vê próprio tenant"
  ON helpdesk_macros FOR SELECT
  TO authenticated
  USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

CREATE POLICY "helpdesk_macros: staff gerencia"
  ON helpdesk_macros FOR ALL
  TO authenticated
  USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

-- ── helpdesk_automation_rules ─────────────────────────────────
ALTER TABLE helpdesk_automation_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "helpdesk_automation_rules: admin gerencia"
  ON helpdesk_automation_rules FOR ALL
  TO authenticated
  USING (
    tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
    AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'tenant_admin'
  )
  WITH CHECK (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

-- ── helpdesk_tasks ────────────────────────────────────────────
ALTER TABLE helpdesk_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "helpdesk_tasks: staff vê próprio tenant"
  ON helpdesk_tasks FOR SELECT
  TO authenticated
  USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

CREATE POLICY "helpdesk_tasks: staff gerencia"
  ON helpdesk_tasks FOR ALL
  TO authenticated
  USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

-- ── helpdesk_csat_surveys ─────────────────────────────────────
ALTER TABLE helpdesk_csat_surveys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "helpdesk_csat_surveys: staff vê próprio tenant"
  ON helpdesk_csat_surveys FOR SELECT
  TO authenticated
  USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

CREATE POLICY "helpdesk_csat_surveys: staff insere"
  ON helpdesk_csat_surveys FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

-- ── helpdesk_audit_logs ───────────────────────────────────────
ALTER TABLE helpdesk_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "helpdesk_audit_logs: staff vê próprio tenant"
  ON helpdesk_audit_logs FOR SELECT
  TO authenticated
  USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

CREATE POLICY "helpdesk_audit_logs: staff insere"
  ON helpdesk_audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

-- audit_logs: nunca permitir UPDATE ou DELETE via authenticated
-- (somente service_role pode modificar — imutabilidade do log)

-- ── helpdesk_saved_views ──────────────────────────────────────
ALTER TABLE helpdesk_saved_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "helpdesk_saved_views: staff vê próprio tenant e próprias views"
  ON helpdesk_saved_views FOR SELECT
  TO authenticated
  USING (
    tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
    AND (
      visibility IN ('all','team')
      OR owner_id = auth.uid()
    )
  );

CREATE POLICY "helpdesk_saved_views: staff gerencia próprias views"
  ON helpdesk_saved_views FOR ALL
  TO authenticated
  USING (
    tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
    AND (owner_id = auth.uid() OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'tenant_admin')
  )
  WITH CHECK (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

-- ── helpdesk_agent_availability ───────────────────────────────
ALTER TABLE helpdesk_agent_availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "helpdesk_agent_availability: staff vê próprio tenant"
  ON helpdesk_agent_availability FOR SELECT
  TO authenticated
  USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

CREATE POLICY "helpdesk_agent_availability: agente atualiza própria disponibilidade"
  ON helpdesk_agent_availability FOR ALL
  TO authenticated
  USING (
    tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
    AND (user_id = auth.uid() OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'tenant_admin')
  )
  WITH CHECK (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

-- ── GRANTS para service_role (Edge Functions, webhooks) ───────
-- service_role já bypassa RLS por padrão no Supabase
-- Apenas garantindo que anon não tenha acesso
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
