DO $$
DECLARE
  v_id uuid;
  r record;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('pamela@llmidiaco.com','Pamela'),
    ('camilafaria@lucianolarrossa.com','Camila Faria')
  ) AS t(email, full_name)
  LOOP
    SELECT id INTO v_id FROM auth.users WHERE email = r.email;
    IF v_id IS NULL THEN
      v_id := gen_random_uuid();
      INSERT INTO auth.users (
        id, instance_id, aud, role, email, encrypted_password,
        email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at
      ) VALUES (
        v_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        r.email, crypt('Indica2026!', gen_salt('bf')),
        now(), '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('full_name', r.full_name),
        now(), now()
      );
      INSERT INTO auth.identities (id, user_id, provider_id, provider, identity_data, created_at, updated_at, last_sign_in_at)
      VALUES (gen_random_uuid(), v_id, v_id::text, 'email',
        jsonb_build_object('sub', v_id::text, 'email', r.email, 'email_verified', true),
        now(), now(), now());
    ELSE
      UPDATE auth.users SET encrypted_password = crypt('Indica2026!', gen_salt('bf')), email_confirmed_at = COALESCE(email_confirmed_at, now()) WHERE id = v_id;
    END IF;

    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (v_id, r.email, r.full_name, 'admin')
    ON CONFLICT (id) DO UPDATE SET role = 'admin', full_name = EXCLUDED.full_name, email = EXCLUDED.email;
  END LOOP;
END $$;