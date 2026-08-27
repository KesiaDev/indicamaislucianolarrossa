insert into public.notification_templates (event_key, channel, subject, body)
values
('referral_registered','whatsapp',null,
 'Olá {{referrer_first_name}}! 👋 A tua indicação *{{lead_name}}* foi registada na campanha *{{campaign_name}}*. Ganhaste +10 pontos. Continua a partilhar o teu link! 🚀'),
('referral_converted','whatsapp',null,
 'Boa, {{referrer_first_name}}! 🎉 A indicação *{{lead_name}}* converteu-se em cliente. Estás mais perto do teu próximo prémio! 🏆'),
('reward_unlocked','whatsapp',null,
 'Parabéns {{referrer_first_name}}! 🥳 Desbloqueaste um prémio: *{{reward_description}}*. Entra na plataforma para veres os detalhes. 🎁'),
('reward_paid','whatsapp',null,
 'Olá {{referrer_first_name}}! 💰 O teu prémio *{{reward_description}}* já foi pago. Obrigado por indicares! 🙌'),
('referrer_invite','whatsapp',null,
 'Olá {{referrer_first_name}}! 🚀 Estás convidado para o Indica+ Luciano Larrossa. Indica amigos, acumula pontos e ganha prémios. Acede aqui: {{invite_url}}')
on conflict (event_key, channel) do nothing;