# 📘 Guia de Utilização — Plataforma de Indicações Luciano Larrossa

Este guia tem duas partes:

1. **Para a equipa (admin)** — como criar campanhas e acompanhar resultados.
2. **Para o aluno (indicador)** — como funciona, como começar e como indicar.

---

# 🧑‍💼 PARTE 1 — Guia do Admin

## 1. Criar uma campanha (passo a passo)

1. Entra em **`/login`** com a tua conta de administrador.
2. No menu lateral, vai a **Campanhas** (`/admin/campaigns`).
3. Clica em **Nova campanha** e preenche:
   - **Nome** — ex.: *Mentoria Gestor de Tráfego — Indica e Ganha*.
   - **Slug** — gerado automaticamente (é o link público da campanha).
   - **Datas de início e fim** — definem o período do ranking mensal.
   - **Landing page** — para onde o indicado é enviado ao clicar no link.
   - **Mensagem pré-escrita** — texto base que o aluno partilha no WhatsApp.
4. Guarda e depois abre a campanha para configurar as **regras de prémio**.

## 2. Configurar prémios e pontuação

Dentro da campanha, em **Regras de prémio**, adiciona cada recompensa:

| Regra | Exemplo |
|---|---|
| Pontos por indicação registada | 10 pontos |
| Pontos por venda/conversão | 500 pontos |
| 200 pontos | 5% de cashback |
| 1 venda | 90€ |
| 1º do ranking | Mentoria individual com o Luciano |
| Top 5 do ranking | Mentoria em grupo |
| 250 pontos | Consultoria |
| 100 pontos | Kit digital |

Dicas:
- Cada regra pode ser por **pontos acumulados**, por **nº de vendas** ou por **posição no ranking**.
- Podes usar a **IA** para gerar variações da mensagem de divulgação (tom formal, divertido, urgente) — o aluno escolhe a que mais gosta na hora de partilhar.

## 3. Convidar alunos (indicadores)

1. Vai a **Indicadores** (`/admin/referrers`) → **Convidar**.
2. Cola **nome + e-mail** do aluno.
3. O aluno recebe um e-mail (via Resend, remetente `cursos@lucianolarrossa.com`) para definir a palavra-passe e entrar.
4. Alternativa: partilha o link público **`/quero-indicar`** — o aluno regista-se sozinho.

## 4. Acompanhar resultados

- **Dashboard** (`/admin/dashboard`) — KPIs gerais: cliques, indicações, conversões e ranking do mês.
- **Campanha → detalhe** — performance por campanha e por variante de mensagem.
- **Fila de prémios** (`/admin/rewards`) — quando um aluno desbloqueia um prémio, ele aparece aqui para **Aprovar** ou **Rejeitar**. Ao aprovar, o aluno é notificado por e-mail/WhatsApp.
- **Ranking** — visível para admin e alunos, reinicia por período da campanha.

## 5. Como as conversões entram

Quando o indicado compra, a venda é confirmada de 2 formas:

1. **Manual**: na lista de indicações, marca a indicação como convertida.
2. **Automática (webhook)**: o sistema de vendas chama:
   ```
   POST /functions/v1/conversion-webhook
   Header: X-Webhook-Secret: <o teu segredo>
   Body: { "external_order_id": "...", "conversion_value": 997.00, "referral_code": "..." }
   ```
A conversão atribui os pontos, atualiza o nível (Bronze → Diamante) e dispara as notificações.

## 6. Notificações (e-mail + WhatsApp)

- **E-mail**: enviado via Resend (conector já configurado).
- **WhatsApp**: enviado via **Clint (API Oficial da Meta)**, com rotação entre os números conectados (API Comercial 01–04, Marketing, Suporte).
- Em **Definições → Notificações** editas os textos de cada evento (convite, indicação registada, conversão, prémio aprovado).
- ⚠️ **Regra da Meta**: a 1ª mensagem de WhatsApp para um contacto tem de ser um **template aprovado** na Clint. Preenche o campo **"Template da Clint"** em cada evento com o nome exato do template. Se o aluno já falou convosco nas últimas 24h, o texto livre funciona diretamente.

---

# 🎓 PARTE 2 — Guia do Aluno (visão do indicador)

## Como funciona em 3 passos

```text
┌─────────────────┐   ┌──────────────────┐   ┌─────────────────┐
│ 1. PARTILHA     │ → │ 2. AMIGO COMPRA  │ → │ 3. GANHAS PRÉMIO│
│ o teu link no   │   │ pelo teu link e  │   │ Pontos sobem e  │
│ WhatsApp/redes  │   │ a venda conta p/ │   │ desbloqueias    │
│                 │   │ ti na hora       │   │ recompensas 🎁  │
└─────────────────┘   └──────────────────┘   └─────────────────┘
```

## Começar a usar

1. **Recebe o convite** por e-mail e define a tua palavra-passe (ou regista-te em `/quero-indicar`).
2. **Entra em `/app`** — este é o teu painel.
3. Na aba **Partilhar**, escolhe a campanha ativa. Vais ver:
   - O teu **link exclusivo** com **QR Code**;
   - Botões para **WhatsApp**, **Copiar link** e **Partilhar**;
   - **Variações de mensagem** (escolhe o tom que combina contigo);
   - Os teus números: **cliques, indicações e amigos convertidos**.

## Indicar = ganhar pontos

- **Indicação registada** (o amigo deixa nome/contacto no teu link): **+10 pontos**.
- **Venda confirmada**: **+500 pontos**.
- Os pontos sobem o teu **nível de fidelidade**: 🥉 Bronze → 🥈 Prata → 🥇 Ouro → 💎 Diamante.

## Prémios que podes desbloquear

| Conquista | Prémio |
|---|---|
| 100 pontos | Kit digital |
| 200 pontos | 5% de cashback |
| 250 pontos | Consultoria |
| 1 venda | 90€ |
| Top 5 do ranking | Mentoria em grupo |
| 1º do ranking | Mentoria individual com o Luciano 🏆 |

## Acompanhar o teu progresso

- **Dashboard** (`/app`) — anel de progresso até ao próximo prémio, os teus pontos e o teu nível.
- **Ranking** — vê a tua posição no mês e quem está à tua frente (gamificação pura 🔥).
- **Prémios** — lista dos prémios desbloqueados e o estado (pendente → aprovado → pago/entregue).
- **Perfil** — atualiza foto e telefone (importante para receberes as notificações no WhatsApp).

## Dicas para indicar melhor

- Partilha no **WhatsApp** com a mensagem personalizada — converte muito mais que o link seco.
- Usa o **QR Code** em stories, aulas ou eventos presenciais.
- Lembra os amigos de usarem o **teu link** na compra — é assim que a venda conta para ti.

---

## ❓ Dúvidas rápidas

**O aluno não recebeu o e-mail de convite?**
Verifica o spam; se persistir, reenvia o convite em Indicadores → Convidar.

**O WhatsApp não chegou?**
A 1ª mensagem precisa de template aprovado na Clint, ou o contacto precisa de ter falado convosco nas últimas 24h.

**A venda não contou?**
Confirma que a compra foi feita pelo link do aluno (`/r/codigo`) ou envia a conversão via webhook com o `referral_code`.
