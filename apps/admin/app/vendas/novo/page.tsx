import Link from "next/link";
import { redirect } from "next/navigation";
import { effectiveTenantId } from "@/lib/cms/actions";
import { getStaffSession, supabaseServer } from "@/lib/supabase/server";
import { ManualOrderForm, type ProductOption } from "./ManualOrderForm";

type VariantRow = {
  id: string;
  sku: string;
  name: string | null;
  price_cents: number;
  product_id: string;
  products: { name: string; type: string; status: string } | null;
};

export default async function NovoPedidoPage() {
  const session = await getStaffSession();
  if (!session) redirect("/login");
  if (session.role === "tenant_editor") redirect("/");

  const tenantId = await effectiveTenantId();
  const supabase = await supabaseServer();

  const { data: variants } = await supabase
    .from("product_variants")
    .select("id, sku, name, price_cents, product_id, products(name, type, status)")
    .eq("tenant_id", tenantId)
    .order("sku", { ascending: true })
    .limit(300);

  const productOptions: ProductOption[] = ((variants ?? []) as unknown as VariantRow[])
    .filter((row) => row.products?.status !== "archived")
    .map((row) => {
      const productName = row.products?.name ?? row.name ?? row.sku;
      const variantName = row.name && row.name !== productName ? ` · ${row.name}` : "";
      return {
        value: row.id,
        label: `${productName}${variantName} · ${row.sku}`,
        name: productName,
        sku: row.sku,
        priceCents: row.price_cents ?? 0,
        kind: row.products?.type ?? "simple",
      };
    });

  return (
    <main style={{ maxWidth: 1120, margin: "0 auto", padding: "48px 28px 120px" }}>
      <header className="rise" style={{ marginBottom: 26 }}>
        <Link href="/vendas" className="eyebrow" style={{ opacity: 0.8 }}>← Vendas</Link>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap", marginTop: 10 }}>
          <div>
            <h1 className="display" style={{ fontSize: 42, lineHeight: 1 }}>Criar pedido manual</h1>
            <p className="muted" style={{ marginTop: 8, maxWidth: 760, lineHeight: 1.7 }}>
              Registre vendas assistidas, B2B, WhatsApp, loja física, feiras, cortesias, amostras e pedidos internos com cliente, itens, entrega, pagamento, fiscal e comissões.
            </p>
          </div>
          <Link href="/vendas" className="btn btn-ghost" style={{ padding: "10px 18px", fontSize: 10 }}>
            Voltar para pedidos
          </Link>
        </div>
      </header>

      <ManualOrderForm productOptions={productOptions} />
    </main>
  );
}
