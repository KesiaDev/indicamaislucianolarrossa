import * as React from 'npm:react@18.3.1'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { WebhookError, verifyWebhookRequest } from 'npm:@lovable.dev/webhooks-js@0.1.0'
import { sendEmail } from '../_shared/resend.ts'
import { SignupEmail } from '../_shared/email-templates/signup.tsx'
import { InviteEmail } from '../_shared/email-templates/invite.tsx'
import { MagicLinkEmail } from '../_shared/email-templates/magic-link.tsx'
import { RecoveryEmail } from '../_shared/email-templates/recovery.tsx'
import { EmailChangeEmail } from '../_shared/email-templates/email-change.tsx'
import { ReauthenticationEmail } from '../_shared/email-templates/reauthentication.tsx'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-lovable-signature, x-lovable-timestamp, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

// Configuration
const SITE_NAME = "Programa Indica + Luciano Larrossa"
const ROOT_DOMAIN = "lucianolarrossa.com"
const SITE_URL = `https://${ROOT_DOMAIN}`

// Template mapping for preview mode
const EMAIL_TEMPLATES: Record<string, React.ComponentType<any>> = {
  signup: SignupEmail,
  invite: InviteEmail,
  magiclink: MagicLinkEmail,
  recovery: RecoveryEmail,
  email_change: EmailChangeEmail,
  reauthentication: ReauthenticationEmail,
}

// Sample data for preview mode ONLY (not used in actual email sending).
// URLs are baked in at scaffold time from the project's real data.
// The sample email uses a fixed placeholder (RFC 6761 .test TLD) so the Go backend
// can always find-and-replace it with the actual recipient when sending test emails,
// even if the project's domain has changed since the template was scaffolded.
const SAMPLE_PROJECT_URL = "https://indicamaislucianolarrossa.lovable.app"
const SAMPLE_EMAIL = "user@example.test"
const SAMPLE_DATA: Record<string, object> = {
  signup: {
    siteName: SITE_NAME,
    siteUrl: SAMPLE_PROJECT_URL,
    recipient: SAMPLE_EMAIL,
    confirmationUrl: SAMPLE_PROJECT_URL,
  },
  magiclink: {
    siteName: SITE_NAME,
    confirmationUrl: SAMPLE_PROJECT_URL,
  },
  recovery: {
    siteName: SITE_NAME,
    confirmationUrl: SAMPLE_PROJECT_URL,
  },
  invite: {
    siteName: SITE_NAME,
    siteUrl: SAMPLE_PROJECT_URL,
    confirmationUrl: SAMPLE_PROJECT_URL,
  },
  email_change: {
    siteName: SITE_NAME,
    oldEmail: SAMPLE_EMAIL,
    email: SAMPLE_EMAIL,
    newEmail: SAMPLE_EMAIL,
    confirmationUrl: SAMPLE_PROJECT_URL,
  },
  reauthentication: {
    token: '123456',
  },
}

// Preview endpoint handler - returns rendered HTML without sending email
async function handlePreview(req: Request): Promise<Response> {
  const previewCorsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, content-type',
  }

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: previewCorsHeaders })
  }

  const apiKey = Deno.env.get('LOVABLE_API_KEY')
  const authHeader = req.headers.get('Authorization')

  if (!apiKey || authHeader !== `Bearer ${apiKey}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...previewCorsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let type: string
  try {
    const body = await req.json()
    type = body.type
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Invalid JSON in request body' }), {
      status: 400,
      headers: { ...previewCorsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const EmailTemplate = EMAIL_TEMPLATES[type]

  if (!EmailTemplate) {
    return new Response(JSON.stringify({ error: `Unknown email type: ${type}` }), {
      status: 400,
      headers: { ...previewCorsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const sampleData = SAMPLE_DATA[type] || {}
  const html = await renderAsync(React.createElement(EmailTemplate, sampleData))

  return new Response(html, {
    status: 200,
    headers: { ...previewCorsHeaders, 'Content-Type': 'text/html; charset=utf-8' },
  })
}

// Verificação do webhook fica a cargo do SDK; o envio é feito pela conta Resend
// ligada por conector (remetente fixo cursos@lucianolarrossa.com).
type AuthEmailData = {
  email: string
  action_type: string
  url?: string
  token?: string
  old_email?: string
  new_email?: string
}

const AUTH_EMAILS: Record<
  string,
  { subject: string; render: (data: AuthEmailData) => React.ReactElement }
> = {
  signup: {
    subject: 'Confirma o teu e-mail',
    render: (data) =>
      React.createElement(SignupEmail, {
        siteName: SITE_NAME,
        siteUrl: SITE_URL,
        recipient: data.email,
        confirmationUrl: data.url,
      }),
  },
  invite: {
    subject: 'Foste convidado(a) para o programa de indicações',
    render: (data) =>
      React.createElement(InviteEmail, {
        siteName: SITE_NAME,
        siteUrl: SITE_URL,
        confirmationUrl: data.url,
      }),
  },
  magiclink: {
    subject: 'O teu link de entrada',
    render: (data) =>
      React.createElement(MagicLinkEmail, {
        siteName: SITE_NAME,
        confirmationUrl: data.url,
      }),
  },
  recovery: {
    subject: 'Recuperar a tua palavra-passe',
    render: (data) =>
      React.createElement(RecoveryEmail, {
        siteName: SITE_NAME,
        confirmationUrl: data.url,
      }),
  },
  email_change: {
    subject: 'Confirma o teu novo e-mail',
    render: (data) =>
      React.createElement(EmailChangeEmail, {
        siteName: SITE_NAME,
        oldEmail: data.old_email ?? '',
        email: data.email,
        newEmail: data.new_email ?? '',
        confirmationUrl: data.url,
      }),
  },
  reauthentication: {
    subject: 'O teu código de verificação',
    render: (data) =>
      React.createElement(ReauthenticationEmail, { token: data.token ?? '' }),
  },
}

async function handleAuthEmail(req: Request): Promise<Response> {
  const apiKey = Deno.env.get('LOVABLE_API_KEY')
  if (!apiKey) {
    return Response.json({ error: 'Missing LOVABLE_API_KEY' }, { status: 500 })
  }

  let payload: any
  try {
    const verified = await verifyWebhookRequest({
      req,
      secret: apiKey,
      parser: (body: string) => JSON.parse(body),
    })
    payload = verified.payload
  } catch (error) {
    if (error instanceof WebhookError) {
      return Response.json({ error: error.message }, { status: 401 })
    }
    console.error('auth webhook verification failed:', error)
    return Response.json({ error: 'Webhook verification failed' }, { status: 500 })
  }

  const data = (payload?.data ?? {}) as AuthEmailData
  const definition = AUTH_EMAILS[data.action_type]
  if (!definition) {
    return Response.json(
      { error: `Unknown auth email action type: ${data.action_type}` },
      { status: 400 },
    )
  }

  const element = definition.render(data)
  const html = await renderAsync(element)
  const text = await renderAsync(element, { plainText: true })

  const sent = await sendEmail({
    to: data.email,
    subject: definition.subject,
    html,
    text,
  })

  if (!sent.ok) {
    return Response.json(
      { error: 'Failed to send email', status: sent.status, details: sent.error },
      { status: sent.status === 401 || sent.status === 403 ? 400 : 500 },
    )
  }

  return Response.json({ success: true, sent: true })
}

Deno.serve(async (req) => {
  const url = new URL(req.url)

  // Handle CORS preflight for main endpoint
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  // Route to preview handler for /preview path
  if (url.pathname.endsWith('/preview')) {
    return handlePreview(req)
  }

  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405, headers: { Allow: 'POST' } })
  }

  return handleAuthEmail(req)
})
