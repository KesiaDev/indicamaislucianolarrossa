# Migrar o envio de e-mails para a conta Resend ligada por conector

Acabaste de ligar a conta **Resend LLMidia** pelo módulo de conectores. Essa conta já tem o domínio **lucianolarrossa.com** verificado (a verificar agora: estado "verified", envio ativo). Ou seja, não é preciso criar domínio novo nem mexer em DNS — abandonamos a via `notify.llmidiaco.com`.

## O que existe hoje (verificado no projeto)

- Os envios de e-mail usam uma chave Resend guardada manualmente no cofre (`RESEND_API_KEY` + `RESEND_FROM`), em três sítios: notificações do programa, convite a indicadores e registo de aluno.
- Existe ainda a estrutura de e-mails de autenticação criada na tentativa anterior, apontada ao remetente `notify.llmidiaco.com` (domínio sem DNS, logo bloqueado).
- O remetente atual (`@llmidiaco.com`) é rejeitado pelo Resend por não estar verificado — é essa a causa dos erros 502 nos testes.

## O que vai ser feito

1. **Ligar a conexão Resend ao projeto** (o cartão de ligação aparece no chat; escolhes a conexão "Resend LLMidia").
2. **Passar todos os envios pelo conector**: um único ponto central de envio, autenticado pela conexão, sem chaves guardadas à mão.
3. **Remetente fixo e verificado**: todos os e-mails saem SEMPRE de `cursos@lucianolarrossa.com` (`Indica+ Luciano Larrossa <cursos@lucianolarrossa.com>`).
4. **E-mails de autenticação** (confirmação de registo, recuperação de palavra-passe, convite, etc.): mantêm-se os modelos já desenhados nas cores dourado/escuro, mas passam a ser enviados pela mesma conta Resend ligada, em vez do domínio `notify.llmidiaco.com`.
5. **Limpeza**: remover a dependência do domínio `notify.llmidiaco.com` e as instruções de DNS que já não se aplicam.
6. **Definições → Integrações**: o cartão do Resend deixa de pedir chave API; mostra que a conta está ligada por conector e permite apenas editar o remetente. O teste de envio continua a existir.
7. **Teste real**: envio de teste para `kesiawnandi@gmail.com` e verificação do resultado nos registos.

Nada muda no WhatsApp da Clint, nas campanhas, pontuações ou prémios.

## Detalhes técnicos

- Novo `supabase/functions/_shared/resend.ts`: helper `sendEmail()` que chama `https://connector-gateway.lovable.dev/resend/emails` com `Authorization: Bearer ${LOVABLE_API_KEY}` e `X-Connection-Api-Key: ${RESEND_API_KEY}` (variável injetada pela ligação do conector), devolvendo estado + corpo de erro do provedor tal como vêm.
- Remetente resolvido por `RESEND_FROM` do cofre com fallback para `Indica+ Luciano Larrossa <indica@lucianolarrossa.com>`; migração para atualizar o valor guardado.
- Atualizar para usar o helper: `send-notification/index.ts` (bloco do canal email), `invite-referrer/index.ts`, `submit-referrer-signup/index.ts`. Manter a escrita em `notifications_log` e a verificação de supressões.
- `auth-email-hook/index.ts`: manter `createAuthEmailHandler` e os seis modelos, mas trocar o transporte para o helper Resend e substituir `SENDER_DOMAIN`/`FROM_DOMAIN` por `lucianolarrossa.com`.
- `IntegrationsTab.tsx` e `AdminSetupWizard.tsx`: cartão Resend passa a "ligado por conector"; campo de chave API removido, campo de remetente mantido; ajustar `list_integration_status()` por migração para refletir o novo estado.
- Deploy das funções afetadas no fim: `send-notification`, `invite-referrer`, `submit-referrer-signup`, `auth-email-hook`.
