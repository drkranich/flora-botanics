"use client";

import { SeoMetaEditor } from "@/components/SeoMetaEditor";
import type { SeoMeta, EntityType } from "@/app/seo/actions";

interface Props {
  pageId: string;
  pageName: string;
  initialSeo: SeoMeta;
  onSave: (meta: SeoMeta) => Promise<{ ok: boolean }>;
  onGenerate: (ctx: {
    entityType: EntityType;
    name: string;
    description?: string;
    keywords?: string[];
    category?: string;
  }) => Promise<SeoMeta & { faq?: { q: string; a: string }[] }>;
  onAudit: () => Promise<{ score: number; issues: { code: string; severity: string; message: string }[] }>;
}

export function PageSeoEditor({ pageId, pageName, initialSeo, onSave, onGenerate, onAudit }: Props) {
  return (
    <div>
      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: "#7a5c1e" }}>
        Editando SEO: <span style={{ color: "#1a1a1a" }}>{pageName}</span>
      </h2>
      <SeoMetaEditor
        entityType="page"
        entityId={pageId}
        entityName={pageName}
        initial={initialSeo}
        onSave={onSave}
        onAiGenerate={onGenerate}
        onRunAudit={onAudit}
      />
    </div>
  );
}
