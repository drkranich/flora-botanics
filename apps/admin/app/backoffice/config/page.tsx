import { createClient } from "@/lib/supabase/server";
import { currentStaff, ROLE_LABELS } from "@/lib/auth";
import { FiscalConfigForm } from "./FiscalConfigForm";
import { updateChannelDisplayName } from "./actions";

const CHANNEL_LABELS: Record<string, string> = {
  site: "Site próprio",
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  email: "E-mail",
  mercado_livre: "Mercado Livre",
  shopee: "Shopee",
  amazon: "Amazon",
  tiktok: "TikTok",
  google_merchant: "Google Merchant",
  facebook: "Facebook",
};

const STATUS_LABELS: Record<string, string> = {
  connected: "Conectado",
  disconnected: "Desconectado",
  error: "Erro",
  pending_auth: "Aguardando autenticação",
};

function statusBadgeStyle(status: string): React.CSSProperties {
  const colors: Record<string, { bg: string; fg: string }> = {
    connected: { bg: "#e6f0ea", fg: "#2f6b4a" },
    disconnected: { bg: "#f2ecdf", fg: "#6b6354" },
    error: { bg: "#fbeaea", fg: "#9a3232" },
    pending_auth: { bg: "#fbf0d9", fg: "#8a6512" },
  };
  const c = colors[status] ?? colors.disconnected;
  return {
    fontSize: 11,
    fontWeight: 700,
    padding: "2px 8px",
    borderRadius: 6,
    background: c.bg,
    color: c.fg,
    whiteSpace: "nowrap",
  };
}

interface FiscalConfigRow {
  cnpj: string;
  razao_social: string;
  nome_fantasia: string | null;
  inscricao_estadual: string | null;
  inscricao_municipal: string | null;
  regime_tributario: string;
  ambiente: string;
  serie_nfe: number;
  proximo_numero_nfe: number;
  endereco: {
    cep?: string;
    logradouro?: string;
    numero?: string;
    complemento?: string;
    bairro?: string;
    cidade?: string;
    uf?: string;
  } | null;
}

interface ChannelAccountRow {
  id: string;
  channel: string;
  status: string;
  display_name: string | null;
  last_sync_at: string | null;
  last_error: string | null;
}

export default async function ConfigPage() {
  const staff = await currentStaff();
  if (!staff) return null;

  const supabase = await createClient();

  const [fiscalRes, channelsRes] = await Promise.all([
    supabase
      .from("fiscal_configs")
      .select(
        "cnpj, razao_social, nome_fantasia, inscricao_estadual, inscricao_municipal, regime_tributario, ambiente, serie_nfe, proximo_numero_nfe, endereco",
      )
      .eq("tenant_id", staff.tenantId)
      .maybeSingle(),
    supabase
      .from("channel_accounts")
      .select("id, channel, status, display_name, last_sync_at, last_error")
      .eq("tenant_id", staff.tenantId)
      .order("channel"),
  ]);

  const fiscal = fiscalRes.data as FiscalConfigRow | null;
  const channels = (channelsRes.data ?? []) as ChannelAccountRow[];

  const endereco = {
    cep: fiscal?.endereco?.cep ?? "",
    logradouro: fiscal?.endereco?.logradouro ?? "",
    numero: fiscal?.endereco?.numero ?? "",
    complemento: fiscal?.endereco?.complemento ?? "",
    bairro: fiscal?.endereco?.bairro ?? "",
    cidade: fiscal?.endereco?.cidade ?? "",
    uf: fiscal?.endereco?.uf ?? "",
  };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div>
        <h1 style={{ fontWeight: 900, letterSpacing: -1, marginBottom: 4 }}>Configurações</h1>
        <p style={{ margin: 0, color: "#6b6354", fontSize: 14 }}>
          Dados fiscais do tenant, canais conectados e preferências gerais.
        </p>
      </div>

      <section style={cardStyle}>
        <h2 style={sectionTitleStyle}>Sua conta</h2>
        <p style={{ margin: 0, fontSize: 14 }}>
          {staff.fullName ?? staff.email} · {ROLE_LABELS[staff.role]}
        </p>
      </section>

      <section style={cardStyle}>
        <h2 style={sectionTitleStyle}>Dados fiscais</h2>
        <FiscalConfigForm
          cnpj={fiscal?.cnpj ?? ""}
          razaoSocial={fiscal?.razao_social ?? ""}
          nomeFantasia={fiscal?.nome_fantasia ?? ""}
          inscricaoEstadual={fiscal?.inscricao_estadual ?? ""}
          inscricaoMunicipal={fiscal?.inscricao_municipal ?? ""}
          regimeTributario={fiscal?.regime_tributario ?? "simples"}
          ambiente={fiscal?.ambiente ?? "homologacao"}
          serieNfe={fiscal?.serie_nfe ?? 1}
          proximoNumeroNfe={fiscal?.proximo_numero_nfe ?? 1}
          endereco={endereco}
        />
      </section>

      <section style={cardStyle}>
        <h2 style={sectionTitleStyle}>Canais conectados</h2>
        {channels.length === 0 ? (
          <p style={emptyStyle}>Nenhum canal registrado ainda.</p>
        ) : (
          <ul style={listStyle}>
            {channels.map((c) => (
              <li key={c.id} style={{ ...listItemStyle, alignItems: "flex-start", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center" }}>
                  <strong>{CHANNEL_LABELS[c.channel] ?? c.channel}</strong>
                  <span style={statusBadgeStyle(c.status)}>{STATUS_LABELS[c.status] ?? c.status}</span>
                </div>
                <form action={updateChannelDisplayName.bind(null, c.id)} style={{ display: "flex", gap: 8, width: "100%" }}>
                  <input
                    name="display_name"
                    type="text"
                    placeholder="Nome de exibição"
                    defaultValue={c.display_name ?? ""}
                    style={inputStyle}
                  />
                  <button type="submit" style={saveButtonStyle}>Salvar</button>
                </form>
                {c.last_error && (
                  <span style={{ fontSize: 12, color: "#9a3232" }}>Último erro: {c.last_error}</span>
                )}
              </li>
            ))}
          </ul>
        )}
        <p style={{ fontSize: 12, color: "#6b6354", margin: "12px 0 0" }}>
          A conexão de credenciais/API (Shopee, Instagram/WhatsApp, Mercado Livre) será feita em uma
          etapa futura — esses canais aparecem aqui pré-cadastrados e poderão ser conectados pela
          página Marketplaces sem precisar de ajuda externa quando a integração estiver pronta.
        </p>
      </section>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e6ddc9",
  borderRadius: 12,
  padding: 20,
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 700,
  margin: "0 0 12px",
};

const listStyle: React.CSSProperties = {
  listStyle: "none",
  margin: 0,
  padding: 0,
  display: "grid",
  gap: 12,
};

const listItemStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  fontSize: 14,
  borderBottom: "1px solid #f2ecdf",
  paddingBottom: 12,
};

const emptyStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 13,
  color: "#6b6354",
};

const inputStyle: React.CSSProperties = {
  border: "1px solid #e6ddc9",
  borderRadius: 8,
  padding: "6px 10px",
  fontSize: 13,
  fontFamily: "inherit",
  color: "#28251d",
  background: "#fcfaf5",
  flex: 1,
};

const saveButtonStyle: React.CSSProperties = {
  background: "#f2ecdf",
  border: "1px solid #e6ddc9",
  borderRadius: 8,
  padding: "6px 14px",
  fontSize: 13,
  fontWeight: 700,
  color: "#28251d",
  cursor: "pointer",
};
