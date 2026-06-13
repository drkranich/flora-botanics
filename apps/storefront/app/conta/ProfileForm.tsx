"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";

/**
 * Meus dados — formulário glass deslizante em 4 passos:
 * 1. Dados pessoais  2. Endereço  3. Contato & redes  4. Pagamento (informativo)
 * Cartões NUNCA são gravados aqui: ficam no Stripe (PCI-DSS), tokenizados
 * no momento da compra.
 */

type Address = {
  cep?: string; street?: string; number?: string; complement?: string;
  district?: string; city?: string; state?: string;
};
type Socials = { instagram?: string; tiktok?: string; facebook?: string; other?: string };

const STEPS = ["Pessoal", "Endereço", "Contato", "Pagamento"];

export function ProfileForm({ userId, email }: { userId: string; email: string }) {
  const [step, setStep] = useState(0);
  const [fullName, setFullName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [addr, setAddr] = useState<Address>({});
  const [soc, setSoc] = useState<Socials>({});
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    supabaseBrowser()
      .from("profiles")
      .select("full_name, avatar_url, whatsapp, address, socials")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        setFullName(data.full_name ?? "");
        setAvatarUrl(data.avatar_url ?? "");
        setWhatsapp(data.whatsapp ?? "");
        setAddr((data.address as Address) ?? {});
        setSoc((data.socials as Socials) ?? {});
      });
  }, [userId]);

  async function uploadAvatar(file: File) {
    setUploading(true);
    setErr(null);
    try {
      const supabase = supabaseBrowser();
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${userId}/avatar-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (error) {
        setErr("Não foi possível enviar a foto. Use JPG ou PNG de até 5 MB.");
        return;
      }
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      setAvatarUrl(data.publicUrl);
      // já grava no perfil para a foto valer em todo lugar
      await supabase.from("profiles").update({ avatar_url: data.publicUrl }).eq("id", userId);
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    setBusy(true);
    setErr(null);
    setSaved(false);
    try {
      const { error } = await supabaseBrowser()
        .from("profiles")
        .update({ full_name: fullName, avatar_url: avatarUrl, whatsapp, address: addr, socials: soc })
        .eq("id", userId);
      if (error) setErr("Não foi possível salvar. Tente novamente.");
      else setSaved(true);
    } finally {
      setBusy(false);
    }
  }

  async function deleteAccount() {
    const typed = window.prompt(
      "Isso apaga sua conta e seus dados de perfil para sempre. Digite EXCLUIR para confirmar:"
    );
    if (typed?.trim().toUpperCase() !== "EXCLUIR") return;
    setBusy(true);
    try {
      const supabase = supabaseBrowser();
      const { error } = await supabase.rpc("delete_my_account");
      if (error) {
        setErr("Não foi possível excluir a conta. Tente novamente.");
        return;
      }
      await supabase.auth.signOut();
      window.location.href = "/";
    } finally {
      setBusy(false);
    }
  }

  const a = (k: keyof Address) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setAddr((v) => ({ ...v, [k]: e.target.value }));
  const s = (k: keyof Socials) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setSoc((v) => ({ ...v, [k]: e.target.value }));

  const navBtn = (dir: -1 | 1, label: string) => (
    <button
      type="button"
      className="btn"
      style={{ padding: "12px 26px" }}
      onClick={() => setStep((v) => Math.min(Math.max(v + dir, 0), STEPS.length - 1))}
    >
      {label}
    </button>
  );

  return (
    <div className="pf-card">
      <div className="pf-head">
        <span className="pf-label">Meus dados</span>
        <div className="pf-dots">
          {STEPS.map((label, i) => (
            <button
              key={label}
              className={`pf-dot ${i === step ? "on" : ""}`}
              onClick={() => setStep(i)}
              title={label}
              aria-label={label}
            />
          ))}
        </div>
      </div>

      <div className="pf-viewport">
        <div className="pf-track" style={{ transform: `translateX(-${step * 100}%)` }}>
          {/* 1 · PESSOAL */}
          <div className="pf-step">
            <h3>Dados pessoais</h3>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div
                style={{
                  width: 84, height: 84, borderRadius: "50%", flexShrink: 0,
                  border: "2px solid rgba(185, 146, 77, 0.4)",
                  background: avatarUrl
                    ? `center / cover no-repeat url(${avatarUrl})`
                    : "linear-gradient(135deg, rgba(185,146,77,0.18), rgba(150,118,63,0.28))",
                  display: "grid", placeItems: "center",
                  fontSize: 26, color: "#96763f",
                }}
              >
                {!avatarUrl ? (fullName.trim().charAt(0).toUpperCase() || "✿") : null}
              </div>
              <label className="btn" style={{ cursor: "pointer", padding: "11px 20px" }}>
                {uploading ? "Enviando…" : avatarUrl ? "Trocar foto" : "Adicionar foto"}
                <input
                  type="file"
                  accept="image/png, image/jpeg, image/webp"
                  style={{ display: "none" }}
                  disabled={uploading}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadAvatar(f);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
            <label className="pf-label">Nome completo</label>
            <input className="pf-input" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Seu nome" />
            <label className="pf-label">E-mail</label>
            <input className="pf-input" value={email} readOnly title="O e-mail de acesso não pode ser alterado por aqui" />
            <div className="pf-nav">
              <span />
              {navBtn(1, "Avançar →")}
            </div>
          </div>

          {/* 2 · ENDEREÇO */}
          <div className="pf-step">
            <h3>Endereço de entrega</h3>
            <div className="pf-grid2">
              <div>
                <label className="pf-label">CEP</label>
                <input className="pf-input" value={addr.cep ?? ""} onChange={a("cep")} placeholder="00000-000" />
              </div>
              <div>
                <label className="pf-label">Cidade</label>
                <input className="pf-input" value={addr.city ?? ""} onChange={a("city")} placeholder="São Paulo" />
              </div>
            </div>
            <label className="pf-label">Rua / Avenida</label>
            <input className="pf-input" value={addr.street ?? ""} onChange={a("street")} placeholder="Rua das Flores" />
            <div className="pf-grid2">
              <div>
                <label className="pf-label">Número</label>
                <input className="pf-input" value={addr.number ?? ""} onChange={a("number")} placeholder="123" />
              </div>
              <div>
                <label className="pf-label">Complemento</label>
                <input className="pf-input" value={addr.complement ?? ""} onChange={a("complement")} placeholder="Apto 45" />
              </div>
            </div>
            <div className="pf-grid2">
              <div>
                <label className="pf-label">Bairro</label>
                <input className="pf-input" value={addr.district ?? ""} onChange={a("district")} placeholder="Jardins" />
              </div>
              <div>
                <label className="pf-label">Estado (UF)</label>
                <input className="pf-input" value={addr.state ?? ""} onChange={a("state")} placeholder="SP" maxLength={2} />
              </div>
            </div>
            <div className="pf-nav">
              {navBtn(-1, "← Voltar")}
              {navBtn(1, "Avançar →")}
            </div>
          </div>

          {/* 3 · CONTATO & REDES */}
          <div className="pf-step">
            <h3>Contato &amp; redes</h3>
            <label className="pf-label">WhatsApp</label>
            <input className="pf-input" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="(11) 99999-9999" />
            <p className="hint">Usamos só para avisos do seu pedido — nada de spam.</p>
            <div className="pf-grid2">
              <div>
                <label className="pf-label">Instagram</label>
                <input className="pf-input" value={soc.instagram ?? ""} onChange={s("instagram")} placeholder="@seuperfil" />
              </div>
              <div>
                <label className="pf-label">TikTok</label>
                <input className="pf-input" value={soc.tiktok ?? ""} onChange={s("tiktok")} placeholder="@seuperfil" />
              </div>
            </div>
            <div className="pf-grid2">
              <div>
                <label className="pf-label">Facebook</label>
                <input className="pf-input" value={soc.facebook ?? ""} onChange={s("facebook")} placeholder="seu.perfil" />
              </div>
              <div>
                <label className="pf-label">Outra rede</label>
                <input className="pf-input" value={soc.other ?? ""} onChange={s("other")} placeholder="link ou @" />
              </div>
            </div>
            <div className="pf-nav">
              {navBtn(-1, "← Voltar")}
              {navBtn(1, "Avançar →")}
            </div>
          </div>

          {/* 4 · PAGAMENTO */}
          <div className="pf-step">
            <h3>Pagamento</h3>
            <div className="pf-secure">
              <span style={{ fontSize: 20 }}>🔒</span>
              <span>
                Seus cartões são protegidos pelo <strong>Stripe</strong>, líder
                mundial em pagamentos. Os dados do cartão são criptografados no
                momento da compra e <strong>nunca passam pelos nossos
                servidores</strong> — por isso você não os cadastra aqui.
                No checkout, o Stripe pode salvar seu cartão com segurança para
                compras futuras.
              </span>
            </div>
            <div className="pf-nav">
              {navBtn(-1, "← Voltar")}
              <button type="button" className="btn" disabled={busy} onClick={save} style={{ padding: "12px 30px" }}>
                {busy ? "Salvando…" : "Salvar meus dados"}
              </button>
            </div>
            {saved ? <p className="pf-ok">✓ Dados salvos com sucesso.</p> : null}
            {err ? <p className="auth-msg">{err}</p> : null}

            <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid rgba(185, 146, 77, 0.18)" }}>
              <button
                type="button"
                disabled={busy}
                onClick={deleteAccount}
                style={{ background: "none", border: 0, cursor: "pointer", fontSize: 12, textDecoration: "underline", color: "#a05252", fontFamily: "inherit", padding: 0 }}
              >
                Excluir minha conta definitivamente
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
