import { PagePlaceholder } from "@/components/PagePlaceholder";

export default function LogsPage() {
  return (
    <PagePlaceholder
      title="Logs"
      description="Erros e eventos do sistema (checkout, sincronização de marketplaces, NF-e, automações). Tabela `system_logs` já existe no banco."
    />
  );
}
