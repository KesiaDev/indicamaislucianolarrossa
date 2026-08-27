CREATE OR REPLACE FUNCTION public.get_referrer_dashboard(p_referrer_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  uid uuid := coalesce(p_referrer_id, auth.uid());
  result jsonb;
  v_profile jsonb;
  v_summary jsonb;
  v_campaigns jsonb;
  v_recent jsonb;
  v_next_tier jsonb;
  v_total_points int;
begin
  if uid is null then raise exception 'not_authenticated'; end if;

  select jsonb_build_object(
    'id', p.id,
    'full_name', p.full_name,
    'email', p.email,
    'total_points', p.total_points,
    'tier', case when t.id is null then null else jsonb_build_object(
      'id', t.id, 'name', t.name, 'color', t.color, 'icon', t.icon, 'perks', t.perks
    ) end
  ), p.total_points
  into v_profile, v_total_points
  from public.profiles p
  left join public.loyalty_tiers t on t.id = p.tier_id
  where p.id = uid;

  select jsonb_build_object(
    'total_clicks', coalesce((select sum(clicks_count) from public.referral_links where referrer_id = uid), 0),
    'total_referrals', (select count(*) from public.referrals where referrer_id = uid),
    'total_conversions', (select count(*) from public.referrals where referrer_id = uid and status = 'converted'),
    'total_pending', (select count(*) from public.referrals where referrer_id = uid and status = 'pending'),
    'total_rewards_pending', (select count(*) from public.rewards where referrer_id = uid and status = 'pending')
  ) into v_summary;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id,
    'name', c.name,
    'status', c.status,
    'link_code', rl.code,
    'clicks', coalesce(rl.clicks_count, 0),
    'referrals', (select count(*) from public.referrals where referrer_id = uid and campaign_id = c.id),
    'conversions', (select count(*) from public.referrals where referrer_id = uid and campaign_id = c.id and status = 'converted'),
    'next_reward', (
      select jsonb_build_object(
        'rule_name', rr.name,
        'progress', (select count(*) from public.referrals where referrer_id = uid and campaign_id = c.id and status = 'converted'),
        'target', rr.trigger_count
      )
      from public.reward_rules rr
      where rr.campaign_id = c.id
      order by rr.trigger_count asc
      limit 1
    )
  ) order by c.created_at desc), '[]'::jsonb)
  into v_campaigns
  from public.campaigns c
  left join public.referral_links rl
    on rl.campaign_id = c.id and rl.referrer_id = uid
  where c.status = 'active' or rl.id is not null;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.unlocked_at desc), '[]'::jsonb)
  into v_recent
  from (
    select * from public.rewards
    where referrer_id = uid
    order by unlocked_at desc
    limit 5
  ) x;

  select jsonb_build_object(
    'name', t.name,
    'min_points', t.min_points,
    'points_to_go', t.min_points - coalesce(v_total_points, 0)
  )
  into v_next_tier
  from public.loyalty_tiers t
  where t.min_points > coalesce(v_total_points, 0)
  order by t.min_points asc
  limit 1;

  result := jsonb_build_object(
    'profile', v_profile,
    'summary', v_summary,
    'campaigns', v_campaigns,
    'recent_rewards', v_recent,
    'next_tier', v_next_tier
  );
  return result;
end;
$function$;