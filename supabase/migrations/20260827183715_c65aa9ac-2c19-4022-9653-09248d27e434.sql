create or replace function public.normalize_br_phone(p_phone text)
returns text
language plpgsql
immutable
set search_path to 'public'
as $function$
DECLARE
  digits text;
BEGIN
  IF p_phone IS NULL OR length(trim(p_phone)) = 0 THEN
    RETURN NULL;
  END IF;

  digits := regexp_replace(p_phone, '[^0-9]', '', 'g');
  IF digits IS NULL OR length(digits) = 0 THEN
    RETURN NULL;
  END IF;

  -- Já tem DDI Portugal (351 + 9 dígitos)
  IF length(digits) = 12 AND left(digits, 3) = '351' THEN
    RETURN '+' || digits;
  END IF;

  -- Já tem DDI Brasil (55 + DDD + número)
  IF length(digits) IN (12, 13) AND left(digits, 2) = '55' THEN
    RETURN '+' || digits;
  END IF;

  -- 9 dígitos começados por 9 -> telemóvel português
  IF length(digits) = 9 AND left(digits, 1) = '9' THEN
    RETURN '+351' || digits;
  END IF;

  -- 10 ou 11 dígitos -> DDD + número brasileiro
  IF length(digits) IN (10, 11) THEN
    RETURN '+55' || digits;
  END IF;

  IF length(digits) BETWEEN 8 AND 15 THEN
    RETURN '+' || digits;
  END IF;

  RETURN NULL;
END;
$function$;