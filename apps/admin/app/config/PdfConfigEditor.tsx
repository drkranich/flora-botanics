"use client";

import { useState, useTransition } from "react";
import { savePdfConfig } from "@/lib/pdf/actions";
import type { PdfConfig } from "@/lib/pdf/template";
import { buildFloraKraftPDF, openAndPrint } from "@/lib/pdf/template";

interface Props {
  initial: PdfConfig;
}

export function PdfConfigEditor({ initial }: Props) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function flash(ok: boolean, text: string) {
    if (ok) { setMsg(text); setErr(null); }
    else { setErr(text); setMsg(null); }
    setTimeout(() => { setMsg(null); setErr(null); }, 4000);
  }

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await savePdfConfig(formData);
      if (result.ok) flash(true, "Configuração de PDF salva.");
      else flash(false, result.error);
    });
  }

  function handlePreview() {
    const html = buildFloraKraftPDF({
      title: "Pré-visualização — Flora Botanics",
      subtitle: "Este é um exemplo de como os PDFs serão gerados com as configurações salvas.",
      body: `
        <div class="section">
          <div class="section-title">Exemplo de tabela</div>
          <table>
            <thead>
              <tr>
                <th>Data/Hora</th>
                <th>Descrição</th>
                <th>Valor</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>01/08/2026 14:30</td>
                <td>Pedido #1042 — Kit Botânico Premium</td>
                <td>R$ 289,90</td>
                <td>Pago</td>
              </tr>
              <tr>
                <td>01/08/2026 11:15</td>
                <td>Pedido #1041 — Cuidados Capilares</td>
                <td>R$ 154,00</td>
                <td>Em trânsito</td>
              </tr>
              <tr>
                <td>31/07/2026 16:45</td>
                <td>Pedido #1040 — Linha Orgânica</td>
                <td>R$ 312,50</td>
                <td>Entregue</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="section">
          <div class="section-title">Exemplo de dados detalhados</div>
          <pre>{ "pedido_id": "abc-123", "status": "delivered", "transportadora": "Correios PAC" }</pre>
        </div>
      `,
      config: {
        companyName: "Flora Botanics",
        address: "Rua das Flores, 123 — Bairro Jardim — São Paulo, SP 01234-567",
        cnpj: "12.345.678/0001-99",
        phone: "(11) 9 9999-9999",
        email: "contato@florabotanics.com.br",
        website: "florabotanics.com.br",
        defaultNotes: "Documento gerado para fins de controle interno.",
      },
    });
    openAndPrint(html);
  }

  return (
    <form action={handleSubmit} style={{ display: "grid", gap: 16 }}>
      {msg && (
        <p style={{ color: "#8fd486", fontSize: 12, padding: "8px 12px", background: "rgba(143,212,134,0.08)", borderRadius: 8, border: "1px solid rgba(143,212,134,0.3)" }}>
          ✓ {msg}
        </p>
      )}
      {err && (
        <p style={{ color: "#e8a0a0", fontSize: 12, padding: "8px 12px", background: "rgba(232,160,160,0.08)", borderRadius: 8, border: "1px solid rgba(232,160,160,0.3)" }}>
          ⚠️ {err}
        </p>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
        <Field label="Nome da empresa">
          <input
            className="input"
            name="companyName"
            defaultValue={initial.companyName ?? ""}
            placeholder="Flora Botanics"
          />
        </Field>
        <Field label="CNPJ">
          <input
            className="input"
            name="cnpj"
            defaultValue={initial.cnpj ?? ""}
            placeholder="12.345.678/0001-99"
          />
        </Field>
        <Field label="Telefone / WhatsApp">
          <input
            className="input"
            name="phone"
            defaultValue={initial.phone ?? ""}
            placeholder="(11) 9 9999-9999"
          />
        </Field>
        <Field label="E-mail de contato">
          <input
            className="input"
            name="email"
            defaultValue={initial.email ?? ""}
            placeholder="contato@florabotanics.com.br"
          />
        </Field>
        <Field label="Website">
          <input
            className="input"
            name="website"
            defaultValue={initial.website ?? ""}
            placeholder="florabotanics.com.br"
          />
        </Field>
      </div>

      <Field label="Endereço completo (rodapé)">
        <input
          className="input"
          name="address"
          defaultValue={initial.address ?? ""}
          placeholder="Rua das Flores, 123 — Bairro Jardim — São Paulo, SP 01234-567"
        />
      </Field>

      <Field label="Observações padrão">
        <textarea
          className="input"
          name="defaultNotes"
          defaultValue={initial.defaultNotes ?? ""}
          rows={3}
          placeholder="Texto que aparecerá em todos os PDFs gerados pelo sistema (ex.: aviso de confidencialidade, prazo de validade da proposta, etc.)"
        />
      </Field>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <button
          type="submit"
          disabled={pending}
          className="btn btn-gold"
          style={{ padding: "11px 22px", fontSize: 10 }}
        >
          {pending ? "Salvando…" : "Salvar configuração"}
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          style={{ padding: "11px 18px", fontSize: 10 }}
          onClick={handlePreview}
        >
          📄 Pré-visualizar PDF
        </button>
      </div>

      <InfoBox />
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}

function InfoBox() {
  return (
    <div style={{
      background: "rgba(185,146,77,0.06)",
      border: "1px solid rgba(185,146,77,0.2)",
      borderRadius: 10,
      padding: "12px 16px",
      fontSize: 11,
      color: "var(--cream-dim)",
      lineHeight: 1.7,
    }}>
      <p style={{ fontWeight: 700, color: "var(--gold-light)", marginBottom: 6, fontSize: 10, letterSpacing: 0.5, textTransform: "uppercase" }}>
        Sobre os documentos PDF
      </p>
      <p>
        Todos os relatórios do sistema (Auditoria de pedidos, Pipeline CRM e futuros documentos)
        são gerados com fundo <strong>papel kraft</strong> e a logo Flora Botanics como
        <strong> marca d'água tileada quase transparente</strong>.
      </p>
      <p style={{ marginTop: 6 }}>
        As informações configuradas aqui aparecem no <strong>rodapé de todos os PDFs</strong>.
        Etiquetas de envio e produto usam fundo branco para compatibilidade com impressoras térmicas.
      </p>
    </div>
  );
}
