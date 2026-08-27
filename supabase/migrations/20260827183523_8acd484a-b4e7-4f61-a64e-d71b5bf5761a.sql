create or replace function public.get_referral_landing(p_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v jsonb;
begin
  if p_code is null or length(trim(p_code)) = 0 then
    return null;
  end if;

  select jsonb_build_object(
    'code', rl.code,
    'referrer_name', p.full_name,
    'campaign', jsonb_build_object(
      'id', c.id,
      'name', c.name,
      'description', c.description,
      'landing_page_url', c.landing_page_url,
      'status', c.status
    ),
    'branding', (
      select jsonb_build_object('company_name', b.company_name, 'logo_url', b.logo_url)
      from public.app_branding b where b.id = 'singleton'
    )
  )
  into v
  from public.referral_links rl
  join public.campaigns c on c.id = rl.campaign_id
  left join public.profiles p on p.id = rl.referrer_id
  where rl.code = p_code
    and c.status = 'active';

  return v;
end;
$$;

grant execute on function public.get_referral_landing(text) to anon, authenticated;