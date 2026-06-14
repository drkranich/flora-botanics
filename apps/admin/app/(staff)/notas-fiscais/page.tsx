import { PagePlaceholder } from "@/components/PagePlaceholder";

export default function NotasFiscaisPage() {
  return (
    <PagePlaceholder
      title="Notas Fiscais"
      description="Emissão e gestão de NF-e em sistema próprio (sem Bling). Tabelas `fiscal_configs` e `nfe_documents` já existem no banco. A integração com a SEFAZ depende do certificado digital A1/A3 do CNPJ — ver Seção 14 do blueprint."
    />
  );
}
