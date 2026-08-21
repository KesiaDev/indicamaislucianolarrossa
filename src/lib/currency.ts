const EUR = new Intl.NumberFormat("pt-PT", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Formata um valor monetário em euros no padrão de Portugal (ex.: 1 250,00 €). */
export function formatEUR(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = typeof value === "string" ? Number(value) : value;
  if (!isFinite(n as number)) return "—";
  return EUR.format(n as number);
}

/** Formata números inteiros (pontos, contagens) no padrão de Portugal. */
export function formatNumberPT(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("pt-PT").format(value);
}
