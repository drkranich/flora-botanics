export function PagePlaceholder({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div>
      <h1 style={{ fontWeight: 900, letterSpacing: -1, marginBottom: 8 }}>{title}</h1>
      <p style={{ lineHeight: 1.6, color: "var(--cream-dim)", maxWidth: 560 }}>{description}</p>
    </div>
  );
}
