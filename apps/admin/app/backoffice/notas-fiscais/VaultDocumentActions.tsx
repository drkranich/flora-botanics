"use client";

import type { CSSProperties } from "react";
import { GlassDateInput } from "@/components/GlassDateInput";
import { GlassSelect, type GlassSelectOption } from "@/components/GlassSelect";
import { archiveVaultDocument, registerVaultDocumentPayment } from "./actions";
import { FiscalFileUpload } from "./FiscalFileUpload";

const paymentStatuses: GlassSelectOption[] = [
  { value: "paid", label: "Pago" },
  { value: "partial", label: "Pagamento parcial" },
  { value: "scheduled", label: "Agendado" },
  { value: "waiting_receipt", label: "Aguardando comprovante" },
  { value: "receipt_review", label: "Comprovante em verificação" },
  { value: "reconciled", label: "Conciliado" },
  { value: "divergent", label: "Divergente" },
  { value: "cancelled", label: "Cancelado" },
];

export function VaultDocumentActions({
  documentId,
  compact = false,
}: {
  documentId: string;
  compact?: boolean;
}) {
  return (
    <div style={compact ? compactShellStyle : shellStyle}>
      <form action={registerVaultDocumentPayment.bind(null, documentId)} style={formStyle}>
        <GlassSelect name="payment_status" options={paymentStatuses} defaultValue="paid" inlineMenu />
        <GlassDateInput name="payment_date" placeholder="Data" inlinePopover />
        <input name="paid" placeholder="Valor" className="input" style={inputStyle} />
        <input name="payment_method" placeholder="PIX, boleto, cartão..." className="input" style={inputStyle} />
        <input name="bank_account" placeholder="Banco ou conta" className="input" style={inputStyle} />
        <FiscalFileUpload name="receipt_path" label="Comprovante" kind="comprovantes" compact />
        <textarea
          name="notes"
          rows={2}
          placeholder="Observação da baixa, conciliação ou divergência..."
          className="input"
          style={{ ...inputStyle, resize: "vertical" }}
        />
        <button className="btn btn-gold" style={buttonStyle}>Salvar financeiro</button>
      </form>

      <form action={archiveVaultDocument.bind(null, documentId)} style={archiveStyle}>
        <input name="reason" placeholder="Motivo do arquivamento" className="input" style={inputStyle} />
        <button className="btn btn-ghost" style={buttonStyle}>Arquivar</button>
      </form>
    </div>
  );
}

const shellStyle: CSSProperties = {
  display: "grid",
  gap: 10,
  minWidth: 260,
  width: "min(100%, 360px)",
};

const compactShellStyle: CSSProperties = {
  ...shellStyle,
  width: "min(100%, 420px)",
};

const formStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(120px, 1fr))",
  gap: 8,
  alignItems: "start",
};

const archiveStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(160px, 1fr) auto",
  gap: 8,
  alignItems: "center",
};

const inputStyle: CSSProperties = {
  minHeight: 38,
  fontSize: 11,
};

const buttonStyle: CSSProperties = {
  minHeight: 38,
  padding: "8px 12px",
  fontSize: 9,
  whiteSpace: "nowrap",
};
