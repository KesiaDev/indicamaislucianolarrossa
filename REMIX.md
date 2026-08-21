# 🎁 Programa de Indicações — Guia do Remix

Bem-vindo(a)! Você acaba de remixar uma plataforma completa de **programa de indicações com gamificação**: ranking mensal, níveis de fidelidade (Bronze → Diamante), prêmios automáticos, convite de indicadores, notificações por e-mail e WhatsApp.

Este documento é o **único passo-a-passo** que você precisa para colocar o seu programa no ar.

---

## ✅ O que já vem pronto

- Banco de dados configurado (Lovable Cloud).
- Marca padrão **"Indicações"** (renomeie no wizard).
- Níveis de fidelidade Bronze / Prata / Ouro / Diamante já cadastrados.
- Regras e modelos de notificação em pt-BR (e-mail + WhatsApp).
- IA para gerar variações de mensagem de divulgação (`LOVABLE_API_KEY` já configurada).

## ⚠️ O que **não** vem no remix (você configura via UI)

Nenhum segredo de provedor externo é copiado. Tudo é configurado pelo painel admin (gravado cifrado no cofre, **não** em `.env`):

| Segredo | Onde configurar | Obrigatório? |
|---|---|---|
| `RESEND_API_KEY`, `RESEND_FROM` | Configurações → Integrações → Resend | **Sim** (e-mail de confirmação de indicador) |
| `RESEND_WEBHOOK_SECRET` | Configurações → Integrações → Resend | Opcional (recomendado) |
| `WEBHOOK_SECRET` | Configurações → Integrações → Webhook de conversão | **Sim** (se for receber conversão de sistema externo) |
| `TWILIO_*` ou `EVOLUTION_*` | Configurações → Integrações → WhatsApp | Opcional |

---

## ✔️ Smoke checklist pós-remix (2 minutos)

Faça estes 4 testes logo após cadastrar o 1º admin para garantir que o remix subiu saudável:

1. **Trigger de profiles ativo**: o cadastro do 1º usuário deve ter criado um registro em `profiles` automaticamente com `role='admin'`. Se não criou, a migration `remix_hardening` não rodou — peça reaplicação.
2. **Wizard salva**: complete o passo "Marca" e clique Próximo. O nome da empresa deve persistir ao reabrir o wizard.
3. **Cadastro de indicador**: abra `/quero-indicar` numa aba anônima, cadastre-se. O profile deve ser criado com `role='referrer'` (não admin).
4. **Login do indicador**: confirme o e-mail (se Resend estiver configurado) e logue. Deve cair em `/app` sem erro.

Se todos passarem, prossiga. Se algum falhar, leia a seção **Troubleshooting**.

---

## 🚀 Setup em 5 minutos

### 1. Cadastre-se na tela inicial

Acesse `/login` e crie sua conta. **O 1º usuário cadastrado vira o administrador automaticamente.**

> ⚠️ Importante: o 1º acesso ao app deve ser do administrador, **não de um indicador**. Cadastros feitos pelo formulário de indicador (`/quero-indicar`) são marcados como `referrer` e nunca viram admin por acidente.

### 2. Complete o assistente de configuração

Após o 1º login do admin, o **AdminSetupWizard** abre automaticamente com **5 passos**:

1. **Marca**: nome da empresa, logo, hero.
2. **Seu perfil**: avatar, telefone.
3. **Webhook de conversão**: gere o `WEBHOOK_SECRET` (botão "Gerar aleatório").
4. **E-mails (Resend)**: API key + remetente verificado.
5. **WhatsApp** (opcional): escolha Twilio ou Evolution API e cole as credenciais. Pode pular.

Cada passo tem opção de pular — você configura depois em **Configurações → Integrações**.

### 3. Crie sua 1ª campanha

Vá em `/admin/campaigns` → **Nova campanha**. Defina nome, datas, landing page e regras de prêmio.

### 4. Convide indicadores

Em `/admin/referrers` → **Convidar**. Cole nome + e-mail. Ele recebe link de confirmação e define a senha.

---

## 🔌 Webhooks externos

URLs prontas (também aparecem no card "URLs úteis" da aba Integrações):

| Provedor | URL |
|---|---|
| Resend (delivered/bounced/complained) | `https://<project>.supabase.co/functions/v1/resend-webhook` |
| Twilio (status callback) | `https://<project>.supabase.co/functions/v1/twilio-status-webhook` |
| Evolution API (status callback) | `https://<project>.supabase.co/functions/v1/evolution-status-webhook` |
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

Resolução do referral:
1. Se `referral_code` for fornecido, busca o link e a indicação pendente mais recente.
2. Senão, usa `lead_email` (case-insensitive).
3. Se nada bater: `422 cannot_resolve_referral` (mas o evento é registrado em `conversion_webhooks`).

---

## 🎨 Customização de marca

A paleta padrão (verde + azul elétrico + amarelo, estilo gamificado) é só o ponto de partida. Pelo painel admin você troca:

- **Logo, nome e cor primária** → wizard ou aba Branding.
- **Tokens visuais avançados** (sombras, superfícies, fontes) → `src/index.css` e `tailwind.config.ts`.

---

## 🛟 Troubleshooting

**Cadastrei o 1º usuário mas ele não virou admin (ou não tem profile)**
A migration `remix_hardening` cria o trigger `on_auth_user_created`. Se o trigger faltou, rode no SQL editor:
```sql
-- Backfill de profiles + promoção do 1º admin
insert into public.profiles (id, role, email, full_name)
select u.id,
       case when not exists (select 1 from public.profiles where role='admin')
            then 'admin'::user_role else 'referrer'::user_role end,
       u.email,
       coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name')
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id)
on conflict (id) do nothing;
```

**Wizard zera os dados ao reabrir**
Significa que o usuário logado não tem `role='admin'` (RLS do `app_branding` exige isso). Rode `select public.bootstrap_admin('seu-email@dominio.com');`.

**E-mail de confirmação não chega**
- Verifique se `RESEND_API_KEY` foi configurada e se o `RESEND_FROM` está com domínio verificado no Resend.
- Veja os logs da função `submit-referrer-signup`.

**Perdi acesso de admin**
```sql
select public.bootstrap_admin('seu-email@dominio.com');
```
Funciona apenas enquanto não houver nenhum admin no projeto.

**Quero rodar o wizard de novo**
```sql
update public.app_branding set setup_completed_at = null where id = 'singleton';
```

**Quero rotacionar o webhook secret**
Configurações → Integrações → Webhook de conversão → "Gerar novo".

---

## 📚 Próximos passos sugeridos

- Compartilhar `/quero-indicar` (link público de cadastro de indicadores).
- Configurar a campanha mensal e divulgar o ranking em `/admin/dashboard`.
- Personalizar templates de e-mail/WhatsApp em **Configurações → Notificações**.

Boas indicações! 🚀
