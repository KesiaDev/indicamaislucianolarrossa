CREATE OR REPLACE FUNCTION public.list_integration_status()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb := '{}'::jsonb;
  names text[] := ARRAY[
    'WEBHOOK_SECRET',
    'RESEND_API_KEY','RESEND_FROM','RESEND_WEBHOOK_SECRET',
    'WHATSAPP_PROVIDER',
    'CLINT_API_KEY','CLINT_CHANNEL_ACCOUNT_ID'
  ];
  n text;
  v_provider text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  FOREACH n IN ARRAY names LOOP
    result := result || jsonb_build_object(
      n,
      EXISTS (SELECT 1 FROM vault.secrets WHERE name = n)
    );
  END LOOP;

  SELECT decrypted_secret INTO v_provider
    FROM vault.decrypted_secrets
    WHERE name = 'WHATSAPP_PROVIDER'
    LIMIT 1;
  result := result || jsonb_build_object('whatsapp_provider_value', v_provider);

  RETURN result;
END;
$$;