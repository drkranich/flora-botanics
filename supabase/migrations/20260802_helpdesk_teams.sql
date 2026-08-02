-- ============================================================
-- Help Desk Flora Botanics — Equipes + Horário + Assinatura
-- Migração: 20260802_helpdesk_teams.sql
-- ============================================================

-- ── 1. EQUIPES ────────────────────────────────────────────────

CREATE TABLE helpdesk_teams (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        text NOT NULL,
  description text,
  color       text DEFAULT '#4ade80',  -- cor do chip no inbox
  active      boolean DEFAULT true,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

CREATE INDEX idx_hd_teams_tenant ON helpdesk_teams(tenant_id) WHERE active = true;

-- Membros de equipe (many-to-many: profiles × teams)
CREATE TABLE helpdesk_team_members (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  team_id    uuid NOT NULL REFERENCES helpdesk_teams(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role       text DEFAULT 'agent',   -- 'agent' | 'lead'
  created_at timestamptz DEFAULT now(),
  UNIQUE (team_id, profile_id)
);

CREATE INDEX idx_hd_team_members_team ON helpdesk_team_members(team_id);
CREATE INDEX idx_hd_team_members_profile ON helpdesk_team_members(profile_id);

-- ── 2. HORÁRIO DE ATENDIMENTO ─────────────────────────────────

CREATE TABLE helpdesk_business_hours (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  day_of_week int NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),  -- 0=Dom,6=Sáb
  open        boolean DEFAULT true,
  start_time  text NOT NULL DEFAULT '08:00',
  end_time    text NOT NULL DEFAULT '18:00',
  timezone    text NOT NULL DEFAULT 'America/Sao_Paulo',
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now(),
  UNIQUE (tenant_id, day_of_week)
);

CREATE INDEX idx_hd_biz_hours_tenant ON helpdesk_business_hours(tenant_id);

-- ── 3. ASSINATURA DE E-MAIL ────────────────────────────────────

CREATE TABLE helpdesk_email_signatures (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  profile_id  uuid REFERENCES profiles(id) ON DELETE CASCADE,  -- NULL = padrão do tenant
  name        text NOT NULL DEFAULT 'Padrão',
  body        text NOT NULL DEFAULT '',
  is_default  boolean DEFAULT false,
  active      boolean DEFAULT true,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

CREATE INDEX idx_hd_signatures_tenant ON helpdesk_email_signatures(tenant_id);

-- ── 4. TRIGGERS updated_at ───────────────────────────────────

CREATE TRIGGER trg_hd_teams_updated_at
  BEFORE UPDATE ON helpdesk_teams
  FOR EACH ROW EXECUTE FUNCTION helpdesk_set_updated_at();

CREATE TRIGGER trg_hd_biz_hours_updated_at
  BEFORE UPDATE ON helpdesk_business_hours
  FOR EACH ROW EXECUTE FUNCTION helpdesk_set_updated_at();

CREATE TRIGGER trg_hd_signatures_updated_at
  BEFORE UPDATE ON helpdesk_email_signatures
  FOR EACH ROW EXECUTE FUNCTION helpdesk_set_updated_at();

-- ── 5. RLS ───────────────────────────────────────────────────

ALTER TABLE helpdesk_teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hd_teams: staff vê próprio tenant"
  ON helpdesk_teams FOR SELECT
  USING (tenant_id = (auth.jwt()->'app_metadata'->>'tenant_id')::uuid);
CREATE POLICY "hd_teams: admin gerencia"
  ON helpdesk_teams FOR ALL
  USING (tenant_id = (auth.jwt()->'app_metadata'->>'tenant_id')::uuid
    AND (auth.jwt()->'app_metadata'->>'role') IN ('tenant_owner','tenant_admin'));

ALTER TABLE helpdesk_team_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hd_team_members: staff vê próprio tenant"
  ON helpdesk_team_members FOR SELECT
  USING (tenant_id = (auth.jwt()->'app_metadata'->>'tenant_id')::uuid);
CREATE POLICY "hd_team_members: admin gerencia"
  ON helpdesk_team_members FOR ALL
  USING (tenant_id = (auth.jwt()->'app_metadata'->>'tenant_id')::uuid
    AND (auth.jwt()->'app_metadata'->>'role') IN ('tenant_owner','tenant_admin'));

ALTER TABLE helpdesk_business_hours ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hd_biz_hours: staff vê próprio tenant"
  ON helpdesk_business_hours FOR SELECT
  USING (tenant_id = (auth.jwt()->'app_metadata'->>'tenant_id')::uuid);
CREATE POLICY "hd_biz_hours: admin gerencia"
  ON helpdesk_business_hours FOR ALL
  USING (tenant_id = (auth.jwt()->'app_metadata'->>'tenant_id')::uuid
    AND (auth.jwt()->'app_metadata'->>'role') IN ('tenant_owner','tenant_admin'));

ALTER TABLE helpdesk_email_signatures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hd_signatures: staff vê próprio tenant"
  ON helpdesk_email_signatures FOR SELECT
  USING (tenant_id = (auth.jwt()->'app_metadata'->>'tenant_id')::uuid);
CREATE POLICY "hd_signatures: admin gerencia"
  ON helpdesk_email_signatures FOR ALL
  USING (tenant_id = (auth.jwt()->'app_metadata'->>'tenant_id')::uuid
    AND (auth.jwt()->'app_metadata'->>'role') IN ('tenant_owner','tenant_admin'));

-- ── 6. SEED HORÁRIO COMERCIAL PADRÃO (via função) ────────────

-- Não faz seed automático: o admin configura via UI.
-- A UI faz upsert por (tenant_id, day_of_week) ao salvar.
