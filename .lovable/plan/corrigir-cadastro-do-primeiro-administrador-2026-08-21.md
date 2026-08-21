## Corrigir cadastro do primeiro administrador

### Diagnóstico (verificado no banco)

- O usuário `kesiawnandi@gmail.com` **foi criado** na autenticação (1 usuário existe).
- A tabela `profiles` está **vazia** (0 linhas) — o perfil nunca foi criado.
- Motivo: o gatilho `on_auth_user_created` que executa `handle_new_user()` **não existe** neste projeto remixado. A função existe, mas o gatilho não foi copiado no remix.
- Consequência: após o login o app busca o perfil, não encontra, e desloga (visível nos logs: login 200 → perfil vazio → logout).
- Bônus verificado: `app_branding` também está vazia (0 linhas), então o assistente de configuração inicial não tem registro base.

### O que será feito

1. **Migration de correção**
   - Recriar o gatilho `on_auth_user_created` em usuários novos, executando `handle_new_user()` (mantendo a regra: primeiro cadastro que não vem do fluxo de indicador vira admin).
   - **Backfill**: criar o perfil faltante para o usuário já existente (`kesiawnandi@gmail.com`) com papel `admin`, nome e e-mail vindos da conta de autenticação. Idempotente (`ON CONFLICT DO NOTHING`).
   - Inserir o registro singleton em `app_branding` (nome padrão "Indicações", `setup_completed_at` nulo) para o assistente abrir no primeiro login.

2. **Robustez na edge function `submit-referrer-signup`**
   - No caminho de bootstrap do primeiro admin, trocar o `UPDATE profiles` (que hoje não faz nada quando o perfil não existe) por um **upsert** do perfil com `role='admin'`, garantindo que o cadastro funcione mesmo se o gatilho falhar.

### Resultado esperado

- Kesia consegue entrar em `/login` com a senha já cadastrada e cai no painel admin com o assistente de configuração.
- Novos cadastros passam a criar o perfil automaticamente.

### Observação

A senha usada foi sinalizada como fraca/vazada pelo provedor de autenticação; vale trocá-la depois pelo perfil.
