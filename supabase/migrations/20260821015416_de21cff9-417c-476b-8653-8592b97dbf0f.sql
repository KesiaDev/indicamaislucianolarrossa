CREATE TABLE IF NOT EXISTS public.clint_channel_accounts (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  identifier text,
  team_name text,
  type text,
  status text,
  avatar text,
  is_enabled boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.clint_channel_accounts TO authenticated;
GRANT ALL ON public.clint_channel_accounts TO service_role;

ALTER TABLE public.clint_channel_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage clint channel accounts" ON public.clint_channel_accounts;
CREATE POLICY "Admins manage clint channel accounts"
ON public.clint_channel_accounts FOR ALL TO authenticated
USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP TRIGGER IF EXISTS trg_clint_channel_accounts_updated_at ON public.clint_channel_accounts;
CREATE TRIGGER trg_clint_channel_accounts_updated_at
BEFORE UPDATE ON public.clint_channel_accounts
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();