"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setActiveTenant, createTenant, updateTenant, deleteTenant } from "@/lib/platform/actions";

export function OperateButton({ tenantId, active }: { tenantId: string; active: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  if (active) return <span className="chip chip-live">Operando</span>;
  return (
    <button
      className="btn btn-ghost"
      disabled={pending}
      style={{ padding: "9px 16px", fontSize: 9.5 }}
      onClick={() =>
        startTransition(async () => {
          await setActiveTenant(tenantId);
          router.push("/");
          router.refresh();
        })
      }
    >
      {pending ? "…" : "Operar"}
    </button>
  );
}

export function NewTenantForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  if (!open) {
    return (
      <button className="btn btn-gold" onClick={() => setOpen(true)} style={{ padding: "11px 22px" }}>
        + Nova marca
      </button>
    );
  }

  return (
    <form
      style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}
      onSubmit={(e) => {
        e.preventDefault();
        setErr(null);
        startTransition(async () => {
          try {
            const id = await createTenant({ name });
            await setActiveTenant(id);
            router.push("/");
            router.refresh();
          } catch (er) {
            setErr(er instanceof Error ? er.message : "Erro");
          }
        });
      }}
    >
      <input
        className="input"
        placeholder="Nome da marca (ex.: Flora Men)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        style={{ width: 240 }}
      />
      <button type="submit" disabled={pending} className="btn btn-gold" style={{ padding: "11px 20px" }}>
        {pending ? "Criando…" : "Criar e operar"}
      </button>
      <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)} style={{ padding: "11px 16px" }}>
        Cancelar
      </button>
      {err ? <p style={{ color: "#e8a0a0", fontSize: 12, width: "100%" }}>{err}</p> : null}
    </form>
  );
}

/* ---------- editar / excluir marca ---------- */

type TenantInfo = { id: string; name: string; slug: string; status: string };

export function TenantManage({ tenant, isRoot }: { tenant: TenantInfo; isRoot: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<null | "edit" | "delete">(null);
  const [name, setName] = useState(tenant.name);
  const [slug, setSlug] = useState(tenant.slug);
  const [status, setStatus] = useState(tenant.status === "active" ? "active" : "suspended");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function close() {
    setMode(null);
    setErr(null);
    setConfirm("");
  }

  return (
    <>
      <div style={{ display: "flex", gap: 6 }}>
        <button className="btn btn-ghost" title="Editar marca" style={{ padding: "9px 12px", fontSize: 12 }} onClick={() => setMode("edit")}>
          ✎
        </button>
        {!isRoot ? (
          <button className="btn btn-ghost" title="Excluir marca" style={{ padding: "9px 12px", fontSize: 12, color: "#e8a0a0" }} onClick={() => setMode("delete")}>
            🗑
          </button>
        ) : null}
      </div>

      {mode ? (
        <div
          onClick={close}
          style={{
            position: "fixed", inset: 0, zIndex: 220,
            background: "rgba(5, 12, 6, 0.6)", backdropFilter: "blur(8px)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
          }}
        >
          <div
            className="glass rise"
            onClick={(e) => e.stopPropagation()}
            style={{ width: "min(440px, 100%)", padding: 28, background: "rgba(15, 32, 18, 0.94)" }}
          >
            {mode === "edit" ? (
              <form
                style={{ display: "flex", flexDirection: "column", gap: 12 }}
                onSubmit={(e) => {
                  e.preventDefault();
                  setErr(null);
                  startTransition(async () => {
                    try {
                      await updateTenant(tenant.id, { name, slug, status: status as "active" | "suspended" });
                      close();
                      router.refresh();
                    } catch (er) {
                      setErr(er instanceof Error ? er.message : "Erro");
                    }
                  });
                }}
              >
                <p className="eyebrow">Editar marca</p>
                <label className="muted" style={{ fontSize: 11 }}>Nome</label>
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
                <label className="muted" style={{ fontSize: 11 }}>Slug (endereço interno: slug.floraecosystem.app)</label>
                <input className="input" value={slug} onChange={(e) => setSlug(e.target.value)} required />
                <label className="muted" style={{ fontSize: 11 }}>Status</label>
                <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="active">Ativa</option>
                  <option value="suspended">Suspensa</option>
                </select>
                {err ? <p style={{ color: "#e8a0a0", fontSize: 12 }}>{err}</p> : null}
                <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                  <button type="submit" className="btn btn-gold" disabled={pending} style={{ padding: "11px 22px" }}>
                    {pending ? "Salvando…" : "Salvar"}
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={close} style={{ padding: "11px 18px" }}>
                    Cancelar
                  </button>
                </div>
              </form>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <p className="eyebrow" style={{ color: "#e8a0a0" }}>Excluir marca</p>
                <p style={{ fontSize: 13, lineHeight: 1.7 }}>
                  Isso apaga <strong>{tenant.name}</strong> e todos os seus dados — páginas,
                  produtos, pedidos, clientes e mídia. <strong>Não há como desfazer.</strong>
                </p>
                <label className="muted" style={{ fontSize: 11 }}>
                  Digite <strong>{tenant.name}</strong> para confirmar
                </label>
                <input className="input" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder={tenant.name} />
                {err ? <p style={{ color: "#e8a0a0", fontSize: 12 }}>{err}</p> : null}
                <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                  <button
                    className="btn"
                    disabled={pending || confirm.trim() !== tenant.name}
                    style={{ padding: "11px 22px", background: "rgba(180, 60, 60, 0.85)", color: "#fff", border: 0, opacity: confirm.trim() !== tenant.name ? 0.45 : 1 }}
                    onClick={() => {
                      setErr(null);
                      startTransition(async () => {
                        try {
                          await deleteTenant(tenant.id);
                          close();
                          router.refresh();
                        } catch (er) {
                          setErr(er instanceof Error ? er.message : "Erro");
                        }
                      });
                    }}
                  >
                    {pending ? "Excluindo…" : "Excluir definitivamente"}
                  </button>
                  <button className="btn btn-ghost" onClick={close} style={{ padding: "11px 18px" }}>
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
