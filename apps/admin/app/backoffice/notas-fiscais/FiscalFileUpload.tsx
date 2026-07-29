"use client";

import { useRef, useState } from "react";

type UploadState =
  | { status: "idle"; message: string | null }
  | { status: "uploading"; message: string | null }
  | { status: "done"; message: string }
  | { status: "error"; message: string };

function apiPath(path: string) {
  const configuredBase = process.env.NEXT_PUBLIC_ADMIN_BASE_PATH?.replace(/\/+$/, "");
  if (configuredBase) return `${configuredBase}${path}`;

  if (
    typeof window !== "undefined" &&
    (window.location.pathname === "/admin" || window.location.pathname.startsWith("/admin/"))
  ) {
    return `/admin${path}`;
  }

  return path;
}

async function readJson<T>(res: Response): Promise<T | null> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return { error: text.slice(0, 220) } as T;
  }
}

function fileLabel(path: string) {
  const name = path.split("/").pop() ?? path;
  return name.replace(/^\d+-[0-9a-f-]+-/i, "");
}

export function FiscalFileUpload({
  name,
  label,
  kind,
  folder = "",
  accept = ".pdf,.xml,.png,.jpg,.jpeg,.webp,.csv,.xls,.xlsx,.doc,.docx,.txt",
  compact = false,
  defaultPath = "",
}: {
  name: string;
  label: string;
  kind: string;
  folder?: string;
  accept?: string;
  compact?: boolean;
  defaultPath?: string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [path, setPath] = useState(defaultPath ?? "");
  const [state, setState] = useState<UploadState>(
    defaultPath ? { status: "done", message: fileLabel(defaultPath) } : { status: "idle", message: null }
  );

  async function upload(file: File) {
    setState({ status: "uploading", message: "Enviando arquivo..." });
    const body = new FormData();
    body.set("file", file);
    body.set("kind", kind);
    if (folder) body.set("folder", folder);

    const res = await fetch(apiPath("/api/fiscal-files"), { method: "POST", body });
    const data = await readJson<{ file?: { path: string; name: string }; error?: string }>(res);

    if (!res.ok || !data?.file) {
      setState({ status: "error", message: data?.error ?? "Falha no upload." });
      return;
    }

    setPath(data.file.path);
    setState({ status: "done", message: data.file.name });
  }

  return (
    <div style={{ display: "grid", gap: 8, minWidth: 0 }}>
      <input type="hidden" name={name} value={path} />
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void upload(file);
          event.currentTarget.value = "";
        }}
      />
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => inputRef.current?.click()}
          disabled={state.status === "uploading"}
          style={{ padding: compact ? "7px 10px" : "9px 14px", fontSize: compact ? 9 : 10 }}
        >
          {state.status === "uploading" ? "Enviando..." : label}
        </button>
        {path ? (
          <a
            href={apiPath(`/api/fiscal-files?path=${encodeURIComponent(path)}`)}
            target="_blank"
            rel="noreferrer"
            className="fiscal-file-link"
          >
            Abrir
          </a>
        ) : null}
        {path ? (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              setPath("");
              setState({ status: "idle", message: null });
            }}
            style={{ padding: compact ? "7px 10px" : "9px 12px", fontSize: compact ? 9 : 10 }}
          >
            Remover
          </button>
        ) : null}
      </div>
      <span
        style={{
          minHeight: 16,
          color: state.status === "error" ? "#e8a0a0" : "var(--cream-dim)",
          fontSize: compact ? 10 : 11,
          lineHeight: 1.4,
          overflowWrap: "anywhere",
        }}
      >
        {state.status === "done" && path ? fileLabel(path) : state.message ?? "PDF, XML, imagem ou documento privado."}
      </span>
    </div>
  );
}
