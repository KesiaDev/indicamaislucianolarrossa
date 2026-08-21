// Templates HTML para e-mails transacionais.
// Inter via Google Fonts, paleta gamificada verde primary.

const PRIMARY = "#22C55E";
const ACCENT = "#F59E0B";
const TEXT = "#0F172A";
const MUTED = "#64748B";

function shell(title: string, inner: string) {
  return `<!DOCTYPE html>
<html lang="pt-PT">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:#F1F5F9;font-family:'Inter',Arial,sans-serif;color:${TEXT};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F1F5F9;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(15,23,42,0.06);">
${inner}
<tr><td style="padding:20px 32px;background:#F8FAFC;color:${MUTED};font-size:12px;text-align:center;">
Você recebeu este e-mail porque participa do nosso programa de indicações.
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function header(title: string) {
  return `<tr><td style="background:linear-gradient(135deg,${PRIMARY},#16A34A);padding:32px;color:#FFFFFF;">
  <div style="font-size:14px;font-weight:600;letter-spacing:1px;text-transform:uppercase;opacity:.85;">Indicações</div>
  <h1 style="margin:8px 0 0;font-size:26px;line-height:1.2;font-weight:700;">${title}</h1>
</td></tr>`;
}

function button(label: string, href: string) {
  return `<a href="${href}" style="display:inline-block;background:${PRIMARY};color:#FFFFFF;text-decoration:none;font-weight:600;padding:14px 24px;border-radius:12px;font-size:15px;">${label}</a>`;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

export function rewardUnlockedHtml(opts: {
  name?: string | null;
  rewardDescription: string;
  redemptionCode?: string | null;
  rewardsUrl?: string;
}) {
  const name = escapeHtml(opts.name?.split(" ")[0] || "indicador");
  const desc = escapeHtml(opts.rewardDescription);
  const url = opts.rewardsUrl || "#";
  const codeBlock = opts.redemptionCode
    ? `<div style="margin:24px 0;padding:16px;border:1px dashed ${ACCENT};border-radius:12px;background:#FFFBEB;">
        <div style="font-size:12px;color:${MUTED};margin-bottom:6px;">Seu código</div>
        <div style="font-family:'Menlo','Monaco',monospace;font-size:20px;font-weight:700;color:${TEXT};letter-spacing:2px;">${escapeHtml(
          opts.redemptionCode,
        )}</div>
      </div>`
    : "";
  const inner = `${header("🎉 Prêmio desbloqueado!")}
<tr><td style="padding:32px;">
  <p style="margin:0 0 12px;font-size:16px;">Olá, <strong>${name}</strong>!</p>
  <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:${TEXT};">
    Você acaba de desbloquear: <strong>${desc}</strong>. Continue indicando para somar mais pontos e subir de tier.
  </p>
  ${codeBlock}
  <div style="margin-top:24px;">${button("Ver meus prêmios", url)}</div>
</td></tr>`;
  return shell("Prêmio desbloqueado", inner);
}

export function referrerInviteHtml(opts: {
  inviterName?: string | null;
  signupUrl: string;
}) {
  const inviter = escapeHtml(opts.inviterName || "nosso time");
  const inner = `${header("Bem-vindo ao programa de indicações")}
<tr><td style="padding:32px;">
  <p style="margin:0 0 12px;font-size:16px;">Olá!</p>
  <p style="margin:0 0 16px;font-size:16px;line-height:1.6;">
    ${inviter} convidou você para participar do nosso programa de indicações. Indique amigos, acumule pontos e desbloqueie prêmios.
  </p>
  <div style="margin-top:24px;">${button("Acessar minha conta", opts.signupUrl)}</div>
  <p style="margin:24px 0 0;font-size:13px;color:${MUTED};">Se o botão não funcionar, copie e cole o link no navegador:<br/><span style="word-break:break-all;color:${TEXT};">${escapeHtml(opts.signupUrl)}</span></p>
</td></tr>`;
  return shell("Convite para indicador", inner);
}
