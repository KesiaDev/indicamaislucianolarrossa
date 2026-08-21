

## Preparar projeto para remix limpo

### Decisões confirmadas
- **Auto-promote mantido**: 1º perfil cadastrado vira admin automaticamente.
- **Sem botão de reset de demo** (fica como follow-up futuro).
- **Nome default**: "Indicações".

### O que será feito

#### 1. Migration de bootstrap idempotente (`supabase/migrations/<nova>_remix_bootstrap.sql`)

Migration **essencial** que roda automaticamente em todo remix (Lovable Cloud aplica todas as migrations no banco novo). Garante:

- **`app_branding` neutro**: insere singleton com `company_name='Indicações'`, `setup_completed_at=NULL` via `ON CONFLICT DO NOTHING`. Garante que o `AdminSetupWizard` abra no 1º login do admin.
- **Tiers padrão** (Bronze/Prata/Ouro/Diamante) com `ON CONFLICT DO NOTHING` — caso a migration original 185226 não cubra todos os casos.
- **`notification_rules` completos**: garante que todos os eventos atuais (`welcome`, `referral_registered`, `reward_unlocked`, `reward_paid`, `campaign_launched`) existam com defaults sensatos (email on, whatsapp on quando aplicável).
- **`notification_templates` padrão** em pt-BR para email e WhatsApp de cada evento, via `ON CONFLICT DO NOTHING`.
- **Hardening do `handle_new_user`**: revisa o trigger para ignorar inserts vindos do fluxo `submit-referrer-signup` (que setam `raw_user_meta_data->>'signup_kind' = 'referrer'`), evitando que um indicador vire admin por acidente caso se cadastre antes do dono.

Como a migration usa `ON CONFLICT DO NOTHING` e checks de existência, é segura para rodar em projetos já em produção (não sobrescreve dados do Indica+ atual).

#### 2. Banner de "1º acesso" no `AuthSlider`

Em `src/components/auth/AuthSlider.tsx`:
- Query leve no carregamento: `select count(*) from profiles limit 1` (via `head:true count:'exact'`).
- Se `count === 0`, mostra banner acima do container: **"Bem-vindo ao seu novo programa de indicações. O primeiro a se cadastrar será o administrador."**
- Banner usa `bg-warning/10`, `border-warning/30`, ícone `Crown` ou `Sparkles`.

#### 3. Documento de remix (`REMIX.md` na raiz)

Documento markdown que o remixador lê ao abrir o projeto. Conteúdo:

- **Visão geral**: o que é a plataforma (programa de indicações com gamificação, ranking, prêmios).
- **Setup em 5 minutos**:
  1. Cadastre-se na tela inicial (`/login`) — você será o administrador.
  2. Complete o wizard de configuração (marca, logo, cores, perfil).
  3. Configure integrações em **Configurações → Integrações**:
     - **Resend** (e-mail transacional) — obrigatório para confirmação de cadastro de indicadores.
     - **Twilio ou Evolution API** (WhatsApp) — opcional.
     - **Webhook secret** — gerado automaticamente, usado para receber confirmações de conversão de sistemas externos.
  4. Crie sua 1ª campanha em `/admin/campaigns`.
  5. Convide indicadores em `/admin/referrers`.
- **Segredos que NÃO vêm no remix**: `RESEND_API_KEY`, `RESEND_FROM`, `RESEND_WEBHOOK_SECRET`, `TWILIO_*`, `EVOLUTION_*`, `WEBHOOK_SECRET`. Todos configuráveis via UI (gravados no Vault, nunca em env vars).
- **Segredos que JÁ vêm prontos**: `LOVABLE_API_KEY` (para geração de variantes de mensagem por IA).
- **Webhooks externos** (URLs prontas para integrar):
  - Resend: `https://<project>.supabase.co/functions/v1/resend-webhook`
  - Twilio: `https://<project>.supabase.co/functions/v1/twilio-status-webhook`
  - Conversão: `https://<project>.supabase.co/functions/v1/conversion-webhook`
- **Customização de marca**: paleta verde/azul/amarelo do Indica+ é o default; admin pode trocar logo, nome e cor primária pelo wizard ou aba Branding.
- **Troubleshooting**: o que fazer se o e-mail de confirmação não chegar, se o admin perdeu acesso (`bootstrap_admin('email')`), se quiser resetar o wizard (`update app_branding set setup_completed_at = null`).

#### 4. Atualizar `README.md`

Substituir o `README.md` atual por uma versão enxuta que:
- Aponta para `REMIX.md` como ponto de entrada para quem remixa.
- Mantém a seção de exemplos de webhook curl.
- Remove referências hardcoded a "Indica+" (passa a falar em "marca configurável").

#### 5. Memory update

Atualizar `mem://design/system-rules.md` para deixar claro que **a paleta é o default do template, mas o nome da marca é configurável pelo admin** — evita que futuras edições assumam "Indica+" como nome fixo.

### Arquivos a criar/editar

- **Criar** `supabase/migrations/<timestamp>_remix_bootstrap.sql` (idempotente, segura para projeto atual)
- **Criar** `REMIX.md` na raiz
- **Editar** `README.md` (apontar para REMIX.md, remover referências fixas a "Indica+")
- **Editar** `src/components/auth/AuthSlider.tsx` (banner de 1º acesso)
- **Editar** `mem://design/system-rules.md` (nota sobre marca configurável)

### Resultado esperado

- Quem remixar abre o projeto, lê o `REMIX.md`, se cadastra, vira admin, completa o wizard e tem o programa funcionando em ~5 minutos.
- A migration de bootstrap garante que branding, tiers, regras de notificação e templates **existem desde o 1º segundo** no banco do remix, sem precisar rodar nada manual.
- Risco de "indicador vira admin sem querer" eliminado pelo hardening do trigger.
- Projeto atual (Indica+) não é afetado — toda a migration é `ON CONFLICT DO NOTHING`.

