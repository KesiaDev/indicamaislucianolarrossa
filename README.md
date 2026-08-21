# Programa de Indicações

Plataforma completa de programa de indicações com gamificação, ranking mensal, níveis de fidelidade, prêmios automáticos e notificações por e-mail/WhatsApp. Marca, paleta e regras totalmente configuráveis pelo painel admin.

## 🚀 Acabou de remixar?

👉 **Leia o [REMIX.md](./REMIX.md)** — guia passo-a-passo de 5 minutos para colocar seu programa no ar.

Resumo:
1. Cadastre-se em `/login` (1º usuário vira admin).
2. Complete o assistente que abre no 1º login.
3. Configure Resend (e-mail) em **Configurações → Integrações**.
4. Crie sua 1ª campanha e convide indicadores.

## Webhooks externos

| Provedor | URL |
|---|---|
| Resend (delivered/bounced/complained) | `https://<project>.supabase.co/functions/v1/resend-webhook` |
| Twilio (status callback) | `https://<project>.supabase.co/functions/v1/twilio-status-webhook` |
| Sistema externo (confirma conversão) | `https://<project>.supabase.co/functions/v1/conversion-webhook` |

### Exemplo: confirmar conversão

```bash
curl -X POST https://<project>.supabase.co/functions/v1/conversion-webhook \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: <WEBHOOK_SECRET>" \
  -d '{
    "external_order_id": "ORDER-12345",
    "conversion_value": 199.90,
    "referral_code": "joao-silva-ab12cd",
    "lead_email": "cliente@exemplo.com"
  }'
```

## Notificações

`send-notification` é interna (auth `Bearer <SERVICE_ROLE_KEY>`) e roteia entre Resend (e-mail) e Twilio/Evolution (WhatsApp). Eventos do Resend (bounce/complaint) entram em `notifications_suppressions` e bloqueiam reenvios automaticamente.
