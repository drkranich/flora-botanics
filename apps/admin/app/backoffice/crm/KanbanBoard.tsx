"use client";

import { useState, useRef, useTransition } from "react";
import Link from "next/link";
import { updateCrmStage } from "./actions";
import { type CrmStage } from "./crm-constants";

export interface KanbanCustomer {
  id: string;
  full_name: string | null;
  email: string;
  whatsapp: string | null;
  tags: string[];
  crm_stage: CrmStage;
  order_count?: number;
}

const STAGES: { id: CrmStage; label: string; emoji: string; color: string; accent: string }[] = [
  { id: "lead", label: "Lead", emoji: "🌱", color: "rgba(143,212,134,0.08)", accent: "rgba(143,212,134,0.35)" },
  { id: "contato", label: "Contato", emoji: "💬", color: "rgba(127,184,196,0.08)", accent: "rgba(127,184,196,0.35)" },
  { id: "proposta", label: "Proposta", emoji: "📋", color: "rgba(185,146,77,0.08)", accent: "rgba(185,146,77,0.35)" },
  { id: "cliente", label: "Cliente", emoji: "✅", color: "rgba(159,141,224,0.08)", accent: "rgba(159,141,224,0.35)" },
  { id: "fidelizado", label: "Fidelizado", emoji: "⭐", color: "rgba(224,160,176,0.08)", accent: "rgba(224,160,176,0.35)" },
];

function initials(name: string | null, email: string): string {
  if (name) {
    return name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  }
  return email[0].toUpperCase();
}

function CustomerCard({
  customer,
  accent,
  onDragStart,
}: {
  customer: KanbanCustomer;
  accent: string;
  onDragStart: (id: string) => void;
}) {
  const abbrev = initials(customer.full_name, customer.email);

  return (
    <div
      draggable
      onDragStart={() => onDragStart(customer.id)}
      style={{
        background: "rgba(10,22,11,0.48)",
        border: "1px solid var(--glass-border)",
        borderRadius: 12,
        padding: "12px 14px",
        cursor: "grab",
        userSelect: "none",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        boxShadow: "0 2px 12px rgba(0,0,0,0.28)",
        transition: "box-shadow 0.15s, transform 0.15s",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = "0 6px 24px rgba(0,0,0,0.45)";
        (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = "0 2px 12px rgba(0,0,0,0.28)";
        (e.currentTarget as HTMLDivElement).style.transform = "";
      }}
    >
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        {/* avatar */}
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            background: accent,
            display: "grid",
            placeItems: "center",
            fontWeight: 800,
            fontSize: 13,
            flexShrink: 0,
            color: "var(--cream)",
          }}
        >
          {abbrev}
        </div>
        <div style={{ minWidth: 0 }}>
          <Link
            href={`/backoffice/clientes/${customer.id}`}
            style={{
              fontWeight: 700,
              fontSize: 13,
              color: "var(--cream)",
              display: "block",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {customer.full_name ?? customer.email}
          </Link>
          {customer.full_name && (
            <span
              style={{
                fontSize: 11,
                color: "var(--cream-dim)",
                display: "block",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {customer.email}
            </span>
          )}
        </div>
      </div>

      {customer.tags?.length > 0 && (
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 9 }}>
          {customer.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              style={{
                fontSize: 10,
                fontWeight: 700,
                padding: "2px 7px",
                borderRadius: 999,
                background: "rgba(185,146,77,0.15)",
                border: "1px solid rgba(185,146,77,0.3)",
                color: "var(--gold-light)",
                letterSpacing: 0.3,
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {customer.whatsapp && (
        <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 5 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" style={{ color: "#8fd486", flexShrink: 0 }}>
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.27h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 8.91a16 16 0 0 0 8 8l.91-.91a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92Z" />
          </svg>
          <span style={{ fontSize: 11, color: "var(--cream-dim)" }}>{customer.whatsapp}</span>
        </div>
      )}
    </div>
  );
}

export function KanbanBoard({ customers: initial }: { customers: KanbanCustomer[] }) {
  const [customers, setCustomers] = useState<KanbanCustomer[]>(initial);
  const [overStage, setOverStage] = useState<CrmStage | null>(null);
  const dragId = useRef<string | null>(null);
  const [, startTransition] = useTransition();

  function onDragStart(id: string) {
    dragId.current = id;
  }

  function onDragOver(e: React.DragEvent, stageId: CrmStage) {
    e.preventDefault();
    setOverStage(stageId);
  }

  function onDrop(stageId: CrmStage) {
    const id = dragId.current;
    dragId.current = null;
    setOverStage(null);
    if (!id) return;

    const customer = customers.find((c) => c.id === id);
    if (!customer || customer.crm_stage === stageId) return;

    // optimistic update
    setCustomers((prev) =>
      prev.map((c) => (c.id === id ? { ...c, crm_stage: stageId } : c))
    );

    startTransition(() => {
      updateCrmStage(id, stageId);
    });
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${STAGES.length}, minmax(220px, 1fr))`,
        gap: 14,
        overflowX: "auto",
        paddingBottom: 24,
      }}
    >
      {STAGES.map((stage) => {
        const cards = customers.filter((c) => c.crm_stage === stage.id);
        const isOver = overStage === stage.id;

        return (
          <div
            key={stage.id}
            onDragOver={(e) => onDragOver(e, stage.id)}
            onDragLeave={() => setOverStage((s) => (s === stage.id ? null : s))}
            onDrop={() => onDrop(stage.id)}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              background: isOver ? stage.color : "rgba(10,22,11,0.18)",
              border: `1px solid ${isOver ? stage.accent : "var(--glass-border)"}`,
              borderRadius: 16,
              padding: "14px 12px",
              minHeight: 200,
              transition: "background 0.15s, border-color 0.15s",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
            }}
          >
            {/* column header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 6,
                paddingBottom: 10,
                borderBottom: `1px solid ${stage.accent}`,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <span style={{ fontSize: 16 }}>{stage.emoji}</span>
                <span style={{ fontWeight: 800, fontSize: 12, letterSpacing: 0.4, textTransform: "uppercase" }}>
                  {stage.label}
                </span>
              </div>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  background: stage.accent,
                  display: "grid",
                  placeItems: "center",
                  color: "var(--cream)",
                }}
              >
                {cards.length}
              </span>
            </div>

            {/* cards */}
            {cards.map((c) => (
              <CustomerCard
                key={c.id}
                customer={c}
                accent={stage.accent}
                onDragStart={onDragStart}
              />
            ))}

            {cards.length === 0 && (
              <div
                style={{
                  flex: 1,
                  display: "grid",
                  placeItems: "center",
                  color: "var(--cream-dim)",
                  fontSize: 11,
                  border: "1px dashed var(--glass-border)",
                  borderRadius: 10,
                  padding: 20,
                  minHeight: 80,
                  textAlign: "center",
                  lineHeight: 1.5,
                }}
              >
                {isOver ? "⬇ Soltar aqui" : "Arraste cards aqui"}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
