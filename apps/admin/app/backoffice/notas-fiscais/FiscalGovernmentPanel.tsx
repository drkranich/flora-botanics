import { GlassSelect } from "@/components/GlassSelect";
import {
  FISCAL_GOVERNMENT_PROVIDERS,
  type FiscalGovernmentProviderKey,
} from "@/lib/fiscal/government-providers";
import {
  configureFiscalGovernmentConnection,
  requestFiscalGovernmentSync,
  seedFiscalGovernmentConnections,
} from "./actions";

type ConnectionRow = {
  provider_key: string;
  display_name: string | null;
  environment: string;
  status: string;
  credentials_status: string;
  credentials_ref: string | null;
  auto_sync_enabled: boolean;
  sync_interval_minutes: number;
  last_sync_at: string | null;
  last_error: string | null;
  settings: Record<string, unknown> | null;
};

const environmentOptions = [
  { value: "production", label: "Produção" },
  { value: "test", label: "Teste" },
];

function formatDateTime(iso: string | null) {
  if (!iso) return "Nunca";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(iso));
}

function connectionTone(connection: ConnectionRow | undefined) {
  if (!connection) return "draft";
  if (connection.status === "online") return "ok";
  if (connection.status === "error") return "danger";
  if (connection.status === "pending_auth") return "warn";
  return "draft";
}

function credentialsLabel(value: string | undefined) {
  if (value === "stored") return "Referência segura informada";
  if (value === "expired") return "Credencial vencida";
  if (value === "invalid") return "Credencial inválida";
  return "Sem credencial";
}

export function FiscalGovernmentPanel({ connections }: { connections: ConnectionRow[] }) {
  const byProvider = new Map(connections.map((connection) => [connection.provider_key, connection]));

  return (
    <section id="governo" className="glass" style={{ padding: 22, display: "grid", gap: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
        <div>
          <p className="eyebrow" style={{ marginBottom: 7 }}>Conexão com Governo</p>
          <h2 className="display" style={{ fontSize: 30, lineHeight: 1.05 }}>
            Débitos, guias e tributos vindos dos órgãos oficiais
          </h2>
          <p className="muted" style={{ maxWidth: 820, lineHeight: 1.7, marginTop: 10 }}>
            Configure os acessos oficiais uma vez para que DCTFWeb, DARF, DAS, ICMS, GNRE, ISS,
            FGTS e obrigações relacionadas entrem na plataforma por sincronização, sem depender de
            anexar cada guia manualmente.
          </p>
        </div>
        <form action={seedFiscalGovernmentConnections}>
          <button className="btn btn-gold" style={{ padding: "10px 16px", fontSize: 10 }}>
            Preparar conexões
          </button>
        </form>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))",
          gap: 14,
          alignItems: "start",
        }}
      >
        {FISCAL_GOVERNMENT_PROVIDERS.map((provider) => {
          const connection = byProvider.get(provider.key);
          const tone = connectionTone(connection);

          return (
            <article
              key={provider.key}
              className="glass"
              style={{
                padding: 18,
                display: "grid",
                gap: 14,
                borderColor: tone === "danger" ? "rgba(232,160,160,0.42)" : tone === "warn" ? "rgba(var(--gold-rgb),0.42)" : "var(--glass-border)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                <div>
                  <span className="eyebrow">{provider.scope}</span>
                  <h3 style={{ margin: "7px 0 6px", color: "var(--cream)", fontSize: 19 }}>{provider.title}</h3>
                  <p className="muted" style={{ margin: 0, lineHeight: 1.55, fontSize: 12.5 }}>
                    {provider.description}
                  </p>
                </div>
                <span className={`fiscal-chip fiscal-chip-${tone}`}>{connection?.status ?? "offline"}</span>
              </div>

              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {provider.guideTypes.map((guide) => (
                  <span key={guide} className="fiscal-chip fiscal-chip-draft">{guide}</span>
                ))}
              </div>

              <div style={{ display: "grid", gap: 4 }}>
                <small className="muted">Credenciais: {credentialsLabel(connection?.credentials_status)}</small>
                <small className="muted">Última sincronização: {formatDateTime(connection?.last_sync_at ?? null)}</small>
                {connection?.last_error ? <small style={{ color: "#e8a0a0", lineHeight: 1.5 }}>{connection.last_error}</small> : null}
              </div>

              <form action={configureFiscalGovernmentConnection} style={{ display: "grid", gap: 9 }}>
                <input type="hidden" name="provider_key" value={provider.key} />
                <GlassSelect name="environment" options={environmentOptions} defaultValue={connection?.environment ?? "production"} inlineMenu />
                <div style={formGridStyle}>
                  <input name="cnpj" className="input" placeholder="CNPJ monitorado" defaultValue={String(connection?.settings?.cnpj ?? "")} />
                  <input name="state_registration" className="input" placeholder="Inscrição estadual" defaultValue={String(connection?.settings?.state_registration ?? "")} />
                  <input name="municipal_registration" className="input" placeholder="Inscrição municipal" defaultValue={String(connection?.settings?.municipal_registration ?? "")} />
                  <input name="state" className="input" placeholder="UF" defaultValue={String(connection?.settings?.state ?? "")} />
                  <input name="city" className="input" placeholder="Município" defaultValue={String(connection?.settings?.city ?? "")} />
                  <input name="credentials_ref" className="input" placeholder="Secret/ref. segura" defaultValue={String(connection?.credentials_ref ?? "")} />
                  <input name="certificate_ref" className="input" placeholder="Certificado A1/A3 ref." defaultValue={String(connection?.settings?.certificate_ref ?? "")} />
                  <input name="proxy_ref" className="input" placeholder="Procuração/ref. e-CAC" defaultValue={String(connection?.settings?.proxy_ref ?? "")} />
                  <input name="sync_interval_minutes" className="input" placeholder="Intervalo em minutos" defaultValue={String(connection?.sync_interval_minutes ?? 360)} />
                  <input name="sync_window_days" className="input" placeholder="Janela de busca em dias" defaultValue={String(connection?.settings?.sync_window_days ?? 45)} />
                </div>
                <label style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--cream-dim)", fontSize: 12 }}>
                  <input type="checkbox" name="auto_sync_enabled" defaultChecked={connection?.auto_sync_enabled ?? false} />
                  Sincronizar automaticamente
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--cream-dim)", fontSize: 12 }}>
                  <input type="checkbox" name="auto_create_guides" defaultChecked={Boolean(connection?.settings?.auto_create_guides ?? true)} />
                  Criar/atualizar guias automaticamente
                </label>
                <textarea name="notes" rows={2} className="input" placeholder="Observações de acesso, contador, certificado ou regra fiscal." defaultValue={String(connection?.settings?.notes ?? "")} />
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button className="btn btn-gold" style={{ padding: "9px 14px", fontSize: 10 }}>
                    Salvar conexão
                  </button>
                  <button
                    formAction={requestFiscalGovernmentSync.bind(null, provider.key as FiscalGovernmentProviderKey)}
                    className="btn btn-ghost"
                    style={{ padding: "9px 14px", fontSize: 10 }}
                  >
                    Sincronizar agora
                  </button>
                </div>
              </form>

              <div style={{ display: "grid", gap: 4 }}>
                <strong style={{ color: "var(--cream)", fontSize: 12 }}>Acesso necessário</strong>
                {provider.requiredAccess.map((item) => (
                  <small key={item} className="muted">• {item}</small>
                ))}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

const formGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
  gap: 8,
};
