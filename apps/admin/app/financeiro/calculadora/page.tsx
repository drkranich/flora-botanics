/**
 * /financeiro/calculadora — Calculadora de custos e formação de preços
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { getStaffSession } from "@/lib/supabase/server";
import { FinanceCalculatorForm } from "../FinanceCalculatorForm";

export const dynamic = "force-dynamic";

export default async function CalculadoraPage() {
  const session = await getStaffSession();
  if (!session) redirect("/login");
  if (session.role === "tenant_editor") redirect("/");

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: "48px 28px 80px" }}>
      <nav style={{ fontSize: 13, color: "var(--cream-dim, #a09880)", marginBottom: 20, display: "flex", gap: 8 }}>
        <Link href="/financeiro" style={{ color: "inherit", textDecoration: "none" }}>Financeiro</Link>
        <span>/</span>
        <span style={{ color: "var(--color-heading, #f1ede5)" }}>Calculadora</span>
      </nav>
      <header style={{ marginBottom: 28 }}>
        <h1 className="display" style={{ fontSize: 38 }}>Calculadora de Custos</h1>
        <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>
          Monte cenários de precificação com margens, impostos, comissões, frete e canal de venda.
        </p>
      </header>

      <FinanceCalculatorForm />
    </main>
  );
}
