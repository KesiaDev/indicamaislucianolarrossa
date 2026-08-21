
create or replace function public.refresh_monthly_ranking(p_year integer, p_month integer)
 returns integer
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  start_ts timestamptz;
  end_ts timestamptz;
  affected int;
begin
  if p_year is null or p_month is null or p_month < 1 or p_month > 12 then
    raise exception 'invalid_period';
  end if;

  start_ts := make_timestamptz(p_year, p_month, 1, 0, 0, 0);
  end_ts := start_ts + interval '1 month';

  with conv as (
    select r.referrer_id,
           count(*)::int as conv_count,
           coalesce(sum((
             select max(rr.points_per_conversion)
             from public.reward_rules rr
             where rr.campaign_id = r.campaign_id
           )), 0)::int as pts
    from public.referrals r
    where r.status = 'converted'
      and r.converted_at >= start_ts
      and r.converted_at <  end_ts
    group by r.referrer_id
  ),
  ranked as (
    select referrer_id, conv_count, pts,
           row_number() over (order by conv_count desc, pts desc) as pos
    from conv
  )
  insert into public.monthly_rankings as mr
    (referrer_id, year, month, conversions_count, total_points, position)
  select referrer_id, p_year, p_month, conv_count, pts, pos from ranked
  on conflict (referrer_id, year, month) do update
     set conversions_count = excluded.conversions_count,
         total_points = excluded.total_points,
         position = excluded.position,
         updated_at = now();

  get diagnostics affected = row_count;
  return affected;
end;
$function$;
