// generate-message-variants: gera variantes de mensagem WhatsApp via Lovable AI
import { z } from "https://esm.sh/zod@3.23.8";
import { corsHeaders } from "../_shared/cors.ts";

const Body = z.object({
  campaign_name: z.string().trim().min(1).max(200),
  campaign_description: z.string().trim().max(1000).optional().or(z.literal("")),
  count: z.number().int().min(1).max(5).optional(),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: "invalid_body" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { campaign_name, campaign_description, count = 3 } = parsed.data;
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "lovable_ai_not_configured" }), {
        status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `Você gera mensagens curtas e naturais em português do Brasil para serem usadas no WhatsApp por uma pessoa indicando um produto/serviço a um amigo. Cada mensagem deve ter no máximo 280 caracteres, soar humana (não publicitária), e variar o tom entre as opções (ex: amigável, direto, curioso, urgente, divertido). Pode incluir 0-1 emoji discreto. NÃO inclua o link (será adicionado depois automaticamente).`;

    const userPrompt = `Campanha: "${campaign_name}".${campaign_description ? `\nDescrição: ${campaign_description}` : ""}\nGere ${count} variantes distintas, cada uma com um label curto descrevendo o tom (ex: "Amigável", "Direto", "Curioso").`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "return_variants",
            description: "Retorna as variantes geradas",
            parameters: {
              type: "object",
              properties: {
                variants: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      label: { type: "string", description: "Tom curto, 1-3 palavras" },
                      content: { type: "string", description: "Mensagem ≤280 chars, sem link" },
                    },
                    required: ["label", "content"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["variants"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "return_variants" } },
      }),
    });

    if (aiRes.status === 429) {
      return new Response(JSON.stringify({ error: "rate_limited", message: "Muitas requisições. Tente em alguns segundos." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (aiRes.status === 402) {
      return new Response(JSON.stringify({ error: "payment_required", message: "Créditos do AI Gateway esgotados." }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!aiRes.ok) {
      const t = await aiRes.text();
      console.error("ai gateway error", aiRes.status, t);
      return new Response(JSON.stringify({ error: "ai_error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await aiRes.json();
    const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
    const args = toolCall?.function?.arguments;
    let variants: { label: string; content: string }[] = [];
    if (args) {
      try {
        const parsedArgs = JSON.parse(args);
        variants = Array.isArray(parsedArgs.variants) ? parsedArgs.variants : [];
      } catch (e) {
        console.error("failed to parse tool args", e);
      }
    }

    return new Response(JSON.stringify({ variants }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-message-variants error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
