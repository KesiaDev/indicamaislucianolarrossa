create or replace function public.get_monthly_ranking(p_year integer, p_month integer)
returns table (
  referrer_id uuid,
  rank_position integer,
  conversions_count integer,
  total_points integer,
  full_name text,
  email text,
  avatar_url text,
  tier_name text,
  tier_color text,
  tier_icon text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    mr.referrer_id,
    mr.position,
    mr.conversions_count,
    mr.total_points,
    p.full_name,
    p.email,
    p.avatar_url,
    t.name,
    t.color,
    t.icon
  from public.monthly_rankings mr
  join public.profiles p on p.id = mr.referrer_id
  left join public.loyalty_tiers t on t.id = p.tier_id
  where mr.year = p_year
    and mr.month = p_month
  order by mr.position asc nulls last, mr.total_points desc
  limit 50
$$;

revoke all on function public.get_monthly_ranking(integer, integer) from public;
grant execute on function public.get_monthly_ranking(integer, integer) to authenticated;