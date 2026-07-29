export type FiscalGovernmentProviderKey =
  | "receita_ecac"
  | "dctfweb"
  | "pgdas_simples"
  | "sefaz_sp_icms"
  | "gnre"
  | "prefeitura_iss"
  | "fgts_digital";

export type FiscalGovernmentProvider = {
  key: FiscalGovernmentProviderKey;
  title: string;
  shortTitle: string;
  scope: string;
  description: string;
  guideTypes: string[];
  requiredAccess: string[];
  syncAction: string;
  docsUrl?: string;
};

export const FISCAL_GOVERNMENT_PROVIDERS: FiscalGovernmentProvider[] = [
  {
    key: "receita_ecac",
    title: "Receita Federal / e-CAC",
    shortTitle: "e-CAC",
    scope: "Federal",
    description: "Base para débitos federais, caixa postal, procuração RFB, DARF e pendências fiscais autorizadas.",
    guideTypes: ["DARF", "DCTFWeb", "MIT", "EFD-Reinf", "eSocial"],
    requiredAccess: ["Procuração RFB ou certificado digital", "CNPJ da empresa", "Referência segura das credenciais"],
    syncAction: "sync_ecac_debts",
    docsUrl: "https://www.gov.br/receitafederal/pt-br/canais_atendimento/atendimento-virtual",
  },
  {
    key: "dctfweb",
    title: "DCTFWeb / MIT",
    shortTitle: "DCTFWeb",
    scope: "Federal",
    description: "Consolidação de débitos vindos de eSocial/EFD-Reinf/MIT e geração de DARF numerado.",
    guideTypes: ["DARF DCTFWeb", "INSS", "IRRF", "PIS", "COFINS", "CSLL"],
    requiredAccess: ["Certificado/procuração habilitada", "Escriturações transmitidas", "Ambiente de produção"],
    syncAction: "sync_dctfweb_guides",
    docsUrl: "https://www.gov.br/receitafederal/pt-br/assuntos/orientacao-tributaria/declaracoes-e-demonstrativos/dctfweb",
  },
  {
    key: "pgdas_simples",
    title: "PGDAS-D / Simples Nacional",
    shortTitle: "PGDAS",
    scope: "Federal",
    description: "Apuração mensal do Simples, DAS, vencimentos, pagamentos e histórico de competências.",
    guideTypes: ["DAS", "Simples Nacional"],
    requiredAccess: ["Código de acesso/certificado autorizado", "CNPJ e regime tributário", "Procuração quando aplicável"],
    syncAction: "sync_pgdas_guides",
    docsUrl: "https://www8.receita.fazenda.gov.br/SimplesNacional/",
  },
  {
    key: "sefaz_sp_icms",
    title: "SEFAZ SP / ICMS",
    shortTitle: "SEFAZ ICMS",
    scope: "Estadual",
    description: "ICMS, ICMS-ST, DIFAL, FCP, GIA/EFD ICMS/IPI e guias estaduais conforme autorização.",
    guideTypes: ["ICMS", "ICMS-ST", "DIFAL", "FCP"],
    requiredAccess: ["Inscrição estadual", "Certificado digital", "Permissão no portal estadual"],
    syncAction: "sync_state_tax_guides",
    docsUrl: "https://portal.fazenda.sp.gov.br/",
  },
  {
    key: "gnre",
    title: "GNRE",
    shortTitle: "GNRE",
    scope: "Estadual",
    description: "Guias nacionais de tributos estaduais em operações interestaduais, com código de barras e linha digitável.",
    guideTypes: ["GNRE", "ICMS-ST", "DIFAL", "FCP"],
    requiredAccess: ["UF destino", "Dados da operação", "Permissão/certificado quando exigido"],
    syncAction: "sync_gnre_guides",
    docsUrl: "https://www.gnre.pe.gov.br/",
  },
  {
    key: "prefeitura_iss",
    title: "Prefeitura / ISS e NFS-e",
    shortTitle: "ISS/NFS-e",
    scope: "Municipal",
    description: "Guias municipais, ISS e NFS-e conforme provedor da prefeitura configurada.",
    guideTypes: ["ISS", "NFS-e", "Guia municipal"],
    requiredAccess: ["Município", "Inscrição municipal", "Credencial do provedor NFS-e"],
    syncAction: "sync_municipal_tax_guides",
  },
  {
    key: "fgts_digital",
    title: "FGTS Digital",
    shortTitle: "FGTS Digital",
    scope: "Trabalhista",
    description: "Guias de FGTS, vencimentos e situação de pagamento para folha quando autorizado.",
    guideTypes: ["FGTS", "Folha"],
    requiredAccess: ["Procuração/certificado", "Dados de folha", "Acesso ao FGTS Digital"],
    syncAction: "sync_fgts_guides",
    docsUrl: "https://www.gov.br/trabalho-e-emprego/pt-br/servicos/empregador/fgtsdigital",
  },
];

export function fiscalGovernmentProvider(key: string | null | undefined) {
  return FISCAL_GOVERNMENT_PROVIDERS.find((provider) => provider.key === key);
}
