// Helper para criar negócios (deals) na Clint a partir das indicações.
// Todos os indicados entram no funil "Programa Indicação Luciano Larrossa",
// na etapa "Indicado".
import { vaultGet } from "./vault.ts";

const CLINT_BASE = "https://api.clint.digital";

// Defaults do funil de indicações (podem ser sobrepostos por segredos no cofre)
const DEFAULT_ORIGIN_ID = "83da6150-0088-4863-a2c5-d5430ff4f31f";
const DEFAULT_STAGE_ID = "daa3abec-da53-42d9-9fea-7840fd6f75b7";

export interface ClintDealInput {
  name: string;
  email?: string | null;
  phone?: string | null;
  fields?: Record<string, string | number | null>;
}

/** Separa DDI (default 351 - Portugal) do número. */
function splitPhone(raw?: string | null): { ddi: string; phone: string } | null {
  if (!raw) return null;
  const digits = raw.replace(/[^0-9]/g, "");
  if (!digits) return null;
  // DDI explícito
  if (digits.length === 12 && digits.startsWith("351")) {
    return { ddi: "351", phone: digits.slice(3) };
  }
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) {
    return { ddi: "55", phone: digits.slice(2) };
  }
  // Telemóvel português (9 dígitos, começa por 9)
  if (digits.length === 9 && digits.startsWith("9")) {
    return { ddi: "351", phone: digits };
  }
  // DDD + número brasileiro
  if (digits.length === 10 || digits.length === 11) {
    return { ddi: "55", phone: digits };
  }
  return { ddi: "351", phone: digits };
}


/** Best-effort: nunca lança, apenas registra o erro. */
export async function createClintDeal(input: ClintDealInput): Promise<string | null> {
  try {
    const apiKey = await vaultGet("CLINT_API_KEY");
    if (!apiKey) {
      console.warn("createClintDeal skipped: CLINT_API_KEY not configured");
      return null;
    }

    const originId = (await vaultGet("CLINT_ORIGIN_ID")) ?? DEFAULT_ORIGIN_ID;
    const stageId = (await vaultGet("CLINT_STAGE_ID")) ?? DEFAULT_STAGE_ID;

    const phone = splitPhone(input.phone);
    const body: Record<string, unknown> = {
      origin_id: originId,
      stage_id: stageId,
      name: input.name,
    };
    if (input.email) body.email = input.email;
    if (phone) {
      body.phone = phone.phone;
      body.ddi = phone.ddi;
    }
    if (input.fields) body.fields = input.fields;

    const res = await fetch(`${CLINT_BASE}/v2/deals`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "api-token": apiKey },
      body: JSON.stringify(body),
    });

    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error("createClintDeal failed", res.status, JSON.stringify(payload));
      return null;
    }
    return (payload as any)?.data?.id ?? null;
  } catch (e) {
    console.error("createClintDeal error", (e as Error).message);
    return null;
  }
}
