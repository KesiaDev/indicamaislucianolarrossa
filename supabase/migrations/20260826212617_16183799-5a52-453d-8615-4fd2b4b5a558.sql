ALTER TABLE public.notification_templates
  ADD COLUMN IF NOT EXISTS whatsapp_template text;

COMMENT ON COLUMN public.notification_templates.whatsapp_template IS 'Nome do template aprovado na Clint/Meta usado como 1ª mensagem quando a janela de 24h está fechada (apenas canal whatsapp).';