/** Constantes do CRM — importáveis em Server e Client components. */

export const CRM_STAGES = ["lead", "contato", "proposta", "cliente", "fidelizado"] as const;
export type CrmStage = (typeof CRM_STAGES)[number];
