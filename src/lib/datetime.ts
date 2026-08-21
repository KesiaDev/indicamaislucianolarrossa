import { formatInTimeZone, toZonedTime } from "date-fns-tz";

export const SP_TZ = "America/Sao_Paulo";

export function formatBRT(value: string | Date | null | undefined, opts?: Intl.DateTimeFormatOptions): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: SP_TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    ...opts,
  }).format(d);
}

export function formatBRTDate(value: string | Date | null | undefined): string {
  return formatBRT(value, { hour: undefined, minute: undefined });
}

export function toSPZoned(value: string | Date): Date {
  const d = typeof value === "string" ? new Date(value) : value;
  return toZonedTime(d, SP_TZ);
}

export function formatSP(value: string | Date | null | undefined, fmt = "dd/MM/yyyy HH:mm"): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (isNaN(d.getTime())) return "—";
  return formatInTimeZone(d, SP_TZ, fmt);
}
