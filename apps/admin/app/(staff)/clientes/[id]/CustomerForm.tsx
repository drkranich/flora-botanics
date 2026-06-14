"use client";

import { useActionState } from "react";
import { updateCustomer } from "./actions";

interface CustomerFormProps {
  customerId: string;
  birthday: string | null;
  whatsapp: string | null;
  notes: string | null;
  tags: string[];
  acceptsMarketing: boolean;
}

type FormState = { error?: string; success?: boolean };

export function CustomerForm({
  customerId,
  birthday,
  whatsapp,
  notes,
  tags,
  acceptsMarketing,
}: CustomerFormProps) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    async (_prev, formData) => updateCustomer(customerId, formData),
    {},
  );

  return (
    <form action={formAction} style={{ display: "grid", gap: 14 }}>
      <div style={fieldGroup}>
        <label style={labelStyle} htmlFor="birthday">
          Aniversário
        </label>
        <input
          id="birthday"
          name="birthday"
          type="date"
          defaultValue={birthday ?? ""}
          style={inputStyle}
        />
      </div>

      <div style={fieldGroup}>
        <label style={labelStyle} htmlFor="whatsapp">
          WhatsApp
        </label>
        <input
          id="whatsapp"
          name="whatsapp"
          type="text"
          placeholder="+55 11 99999-9999"
          defaultValue={whatsapp ?? ""}
          style={inputStyle}
        />
      </div>

      <div style={fieldGroup}>
        <label style={labelStyle} htmlFor="tags">
          Tags (separadas por vírgula)
        </label>
        <input
          id="tags"
          name="tags"
          type="text"
          placeholder="vip, recorrente, b2b"
          defaultValue={tags.join(", ")}
          style={inputStyle}
        />
      </div>

      <div style={fieldGroup}>
        <label style={labelStyle} htmlFor="notes">
          Notas internas
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={4}
          defaultValue={notes ?? ""}
          style={{ ...inputStyle, resize: "vertical" }}
        />
      </div>

      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
        <input
          type="checkbox"
          name="accepts_marketing"
          defaultChecked={acceptsMarketing}
        />
        Aceita receber promoções e novidades
      </label>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button type="submit" disabled={pending} style={buttonStyle}>
          {pending ? "Salvando..." : "Salvar alterações"}
        </button>
        {state.success && (
          <span style={{ color: "#2f6b4a", fontSize: 13, fontWeight: 600 }}>Salvo com sucesso.</span>
        )}
        {state.error && (
          <span style={{ color: "#9a3232", fontSize: 13, fontWeight: 600 }}>{state.error}</span>
        )}
      </div>
    </form>
  );
}

const fieldGroup: React.CSSProperties = {
  display: "grid",
  gap: 4,
};

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: "#6b6354",
  textTransform: "uppercase",
  letterSpacing: 0.5,
};

const inputStyle: React.CSSProperties = {
  border: "1px solid #e6ddc9",
  borderRadius: 8,
  padding: "8px 12px",
  fontSize: 14,
  fontFamily: "inherit",
  color: "#28251d",
  background: "#fcfaf5",
};

const buttonStyle: React.CSSProperties = {
  background: "#28251d",
  color: "#fdfbf6",
  border: "none",
  borderRadius: 8,
  padding: "10px 20px",
  fontSize: 14,
  fontWeight: 700,
  cursor: "pointer",
};
