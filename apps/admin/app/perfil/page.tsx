"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { TransferOwnership } from "./TransferOwnership";

/**
 * Meu perfil — disponível para QUALQUER papel do painel.
 * Avatar, nome e exclusão da própria conta.
 */
export default function PerfilPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [role, setRole] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const supabase = supabaseBrowser();
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) {
        router.push("/login");
        return;
      }
      setUserId(data.user.id);
      setEmail(data.user.email ?? "");
      const { data: p } = await supabase
        .from("profiles")
        .select("full_name, avatar_url, role")
        .eq("id", data.user.id)
        .maybeSingle();
      setFullName(p?.full_name ?? "");
      setAvatarUrl(p?.avatar_url ?? "");
      setRole(p?.role ?? "");
    });
  }, [router]);

  async function uploadAvatar(file: File) {
    if (!userId) return;
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
      await supabase.from("profiles").update({ avatar_url: data.publicUrl }).eq("id", userId);
      setMsg("Foto atualizada.");
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (!userId) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const { error } = await supabaseBrowser()
        .from("profiles")
        .update({ full_name: fullName, avatar_url: avatarUrl })
        .eq("id", userId);
      if (error) setErr("Não foi possível salvar.");
      else setMsg("Perfil salvo.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteAccount() {
    const typed = window.prompt(
      "Isso apaga sua conta do painel para sempre. Digite EXCLUIR para confirmar:"
    );
    if (typed?.trim().toUpperCase() !== "EXCLUIR") return;
    setBusy(true);
    try {
      const supabase = supabaseBrowser();
      const { error } = await supabase.rpc("delete_my_account");
      if (error) {
        // proprietários e superadmin recebem a regra de transferência do banco
        setErr(error.message.replace(/^.*?:\s*/, ""));
        return;
      }
      await supabase.auth.signOut();
      window.location.href = "/login";
    } finally {
      setBusy(false);
    }
  }

  const ROLE_LABEL: Record<string, string> = {
    platform_admin: "Admin da Plataforma",
    tenant_owner: "Proprietário",
    tenant_admin: "Administrador",
    tenant_editor: "Editor",
  };

  return (
    <main style={{ maxWidth: 620, margin: "0 auto", padding: "48px 28px 80px" }}>
      <header className="rise" style={{ marginBottom: 28 }}>
        <Link href="/" className="eyebrow" style={{ opacity: 0.8 }}>← Painel</Link>
        <h1 className="display" style={{ fontSize: 44, marginTop: 10 }}>Meu perfil</h1>
      </header>

      <section className="glass rise rise-1" style={{ padding: 28, display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
          <div
            style={{
              width: 92, height: 92, borderRadius: "50%", flexShrink: 0,
              border: "2px solid rgba(203, 178, 122, 0.5)",
              background: avatarUrl
                ? `center / cover no-repeat url(${avatarUrl})`
                : "linear-gradient(135deg, rgba(203,178,122,0.25), rgba(150,118,63,0.35))",
              display: "grid", placeItems: "center",
              fontSize: 30, color: "var(--gold-light)",
            }}
          >
            {!avatarUrl ? (fullName.trim().charAt(0).toUpperCase() || "✿") : null}
          </div>
          <div>
            <label className="btn btn-gold" style={{ cursor: "pointer", padding: "10px 20px" }}>
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
            <p className="muted" style={{ fontSize: 11, marginTop: 8 }}>
              {email} · {ROLE_LABEL[role] ?? role}
            </p>
          </div>
        </div>

        <div className="field">
          <label className="field-label" htmlFor="nm">Nome completo</label>
          <input id="nm" className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>

        {msg ? <p style={{ color: "var(--gold-light)", fontSize: 12 }}>{msg}</p> : null}
        {err ? <p style={{ color: "#e8a0a0", fontSize: 12 }}>{err}</p> : null}

        <div style={{ display: "flex", gap: 12 }}>
          <button className="btn btn-gold" disabled={busy} onClick={save} style={{ padding: "11px 24px" }}>
            {busy ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </section>

      {userId ? (
        <TransferOwnership userId={userId} email={email} fullName={fullName} role={role} />
      ) : null}

      <section className="glass rise rise-2" style={{ padding: 24, marginTop: 18 }}>
        <p className="eyebrow" style={{ color: "#e8a0a0", marginBottom: 8 }}>Zona de risco</p>
        <p className="muted" style={{ fontSize: 12, lineHeight: 1.7, marginBottom: 14 }}>
          Excluir sua conta apaga seu acesso e seu perfil para sempre.
          Proprietários precisam antes transferir a marca — com aprovação
          eletrônica da pessoa que assume (senha reconfirmada e termo aceito,
          tudo registrado na auditoria).
        </p>
        <button
          className="btn btn-ghost"
          disabled={busy}
          onClick={deleteAccount}
          style={{ padding: "10px 20px", color: "#e8a0a0" }}
        >
          Excluir minha conta
        </button>
      </section>
    </main>
  );
}
