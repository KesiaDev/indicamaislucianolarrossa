INSERT INTO public.notification_rules (event_key, email_enabled, whatsapp_enabled)
VALUES ('reward_pending_admin', true, false)
ON CONFLICT (event_key) DO UPDATE SET email_enabled = true;

INSERT INTO public.notification_templates (event_key, channel, subject, body)
VALUES (
  'reward_pending_admin',
  'email',
  'Novo prémio à espera de aprovação',
  '<div style="font-family:Inter,Arial,sans-serif;background:#0B0B0F;padding:28px;color:#F5F5F5;border-radius:14px;"><h2 style="color:#E4B44C;margin:0 0 12px;">Prémio pendente de aprovação</h2><p style="margin:0 0 8px;"><strong>Indicador:</strong> {{referrer_name}}</p><p style="margin:0 0 8px;"><strong>Prémio(s):</strong> {{reward_description}}</p><p style="margin:0 0 20px;"><strong>Total:</strong> {{rewards_count}}</p><p style="margin:0 0 20px;"><a href="{{queue_url}}" style="background:#E4B44C;color:#0B0B0F;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;">Abrir fila de prémios</a></p><p style="font-size:12px;color:#9A9AA5;margin:0;">{{company_name}}</p></div>'
)
ON CONFLICT (event_key, channel) DO NOTHING;