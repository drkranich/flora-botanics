import { notFound } from "next/navigation";
import { getMenu, getSiteSetting } from "@flora/db";
import { SiteFooter, SiteHeader } from "@/blocks/chrome";
import { currentTenant, db } from "@/lib/tenant";
import { updateMarketingPreferences } from "./actions";

export const revalidate = 0;

type PreferenceRow = {
  token: string;
  email: string | null;
  phone: string | null;
  email_marketing: boolean;
  sms_marketing: boolean;
  whatsapp_marketing: boolean;
  transactional_messages: boolean;
  ads_personalization: boolean;
  remarketing: boolean;
  frequency: string;
  interests: string[];
};

export default async function PreferenceCenterPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const tenant = await currentTenant();
  const client = db();

  const [{ data }, menu, logoSetting] = await Promise.all([
    client.rpc("get_marketing_preferences", { preference_token: token }),
    getMenu(client, tenant.tenantId, "header"),
    getSiteSetting<{ image: string; width?: number; height?: number; color?: string }>(client, tenant.tenantId, "logo"),
  ]);

  const preference = ((data ?? []) as PreferenceRow[])[0];
  if (!preference) notFound();

  const action = updateMarketingPreferences.bind(null, token);

  return (
    <>
      <div className="hero subpage-hero subpage-hero-compact">
        <SiteHeader
          menu={menu}
          logoUrl={logoSetting?.image ?? ""}
          logoWidth={logoSetting?.width ?? 160}
          logoHeight={logoSetting?.height ?? 48}
          logoColor={logoSetting?.color ?? ""}
        />
      </div>
      <main className="account-page">
        <div className="container account-page-inner">
          <section className="account-auth-layout single">
            <div className="account-form-card preference-center-card">
              <span className="account-kicker">Preferências Flora</span>
              <h1>Controle suas comunicações</h1>
              <p>
                Escolha como a Flora pode falar com você. Mensagens essenciais de pedido ficam separadas
                de marketing para preservar segurança, rastreio e atendimento.
              </p>

              <form action={action} className="account-form preference-form">
                <div className="preference-contact">
                  <strong>{preference.email ?? preference.phone ?? "Contato Flora"}</strong>
                  <span>{preference.phone ?? "Sem telefone cadastrado"}</span>
                </div>

                <PreferenceToggle name="email_marketing" label="Promoções e lançamentos por e-mail" defaultChecked={preference.email_marketing} />
                <PreferenceToggle name="sms_marketing" label="SMS de campanhas autorizadas" defaultChecked={preference.sms_marketing} />
                <PreferenceToggle name="whatsapp_marketing" label="WhatsApp Business para relacionamento" defaultChecked={preference.whatsapp_marketing} />
                <PreferenceToggle name="ads_personalization" label="Personalização e anúncios" defaultChecked={preference.ads_personalization} />
                <PreferenceToggle name="remarketing" label="Remarketing e recuperação de carrinho" defaultChecked={preference.remarketing} />
                <PreferenceToggle name="transactional_messages" label="Mensagens essenciais de pedido e rastreamento" defaultChecked={preference.transactional_messages} />

                <div>
                  <label>Frequência</label>
                  <div className="preference-frequency">
                    {[
                      ["low", "Baixa"],
                      ["normal", "Normal"],
                      ["high", "Alta"],
                      ["paused", "Pausar marketing"],
                    ].map(([value, label]) => (
                      <label key={value} className="preference-radio">
                        <input type="radio" name="frequency" value={value} defaultChecked={preference.frequency === value} />
                        <span>{label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <label>
                  Temas de interesse
                  <input name="interests" defaultValue={(preference.interests ?? []).join(", ")} placeholder="skincare, kits, lançamentos" />
                </label>

                <button className="account-primary-button">Salvar preferências</button>
              </form>
            </div>
          </section>
        </div>
      </main>
      <SiteFooter
        logoUrl={logoSetting?.image ?? ""}
        logoWidth={logoSetting?.width ?? 160}
        logoHeight={logoSetting?.height ?? 48}
        logoColor={logoSetting?.color ?? ""}
      />
    </>
  );
}

function PreferenceToggle({
  name,
  label,
  defaultChecked,
}: {
  name: string;
  label: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="account-toggle preference-toggle">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} />
      <span>{label}</span>
    </label>
  );
}
