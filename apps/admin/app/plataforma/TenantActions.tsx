"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setActiveTenant, createTenant } from "@/lib/platform/actions";

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
