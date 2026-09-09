create or replace function public.refresh_monthly_ranking(p_year integer, p_month integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
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

  with base as (
    select r.referrer_id,
           count(*) filter (
             where r.status = 'converted'
               and r.converted_at >= start_ts
               and r.converted_at < end_ts
           )::int as conv_count,
           count(*) filter (
             where r.created_at >= start_ts
               and r.created_at < end_ts
               and r.status <> 'rejected'
           )::int as ref_count,
           coalesce(sum(
             case when r.status = 'converted'
                       and r.converted_at >= start_ts
                       and r.converted_at < end_ts
             then coalesce((
               select max(rr.points_per_conversion)
               from public.reward_rules rr
               where rr.campaign_id = r.campaign_id
             ), 0) else 0 end
           ), 0)::int as conv_pts
    from public.referrals r
    where (r.created_at >= start_ts and r.created_at < end_ts)
       or (r.converted_at >= start_ts and r.converted_at < end_ts)
    group by r.referrer_id
  ),
  scored as (
    select referrer_id, conv_count, (ref_count * 10 + conv_pts) as pts
    from base
    where ref_count > 0 or conv_count > 0
  ),
  ranked as (
    select referrer_id, conv_count, pts,
           row_number() over (order by pts desc, conv_count desc) as pos
    from scored
  )
  insert into public.monthly_rankings as mr
    (referrer_id, year, month, conversions_count, total_points, position)
  select referrer_id, p_year, p_month, conv_count, pts, pos from ranked
  on conflict (referrer_id, year, month) do update
     set conversions_count = excluded.conversions_count,
         total_points = excluded.total_points,
         position = excluded.position,
         updated_at = now();

  delete from public.monthly_rankings mr
   where mr.year = p_year and mr.month = p_month
     and not exists (
       select 1 from public.referrals r
       where r.referrer_id = mr.referrer_id
         and ((r.created_at >= start_ts and r.created_at < end_ts and r.status <> 'rejected')
           or (r.converted_at >= start_ts and r.converted_at < end_ts and r.status = 'converted'))
     );

  get diagnostics affected = row_count;
  return affected;
end;
$$;

create or replace function public.referrals_refresh_ranking()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ts timestamptz;
begin
  ts := coalesce(new.converted_at, new.created_at, now());
  perform public.refresh_monthly_ranking(
    extract(year from ts at time zone 'UTC')::int,
    extract(month from ts at time zone 'UTC')::int
  );
  if tg_op = 'UPDATE' and old.created_at is not null
     and date_trunc('month', old.created_at) <> date_trunc('month', ts) then
    perform public.refresh_monthly_ranking(
      extract(year from old.created_at at time zone 'UTC')::int,
      extract(month from old.created_at at time zone 'UTC')::int
    );
  end if;
  return null;
end;
$$;

drop trigger if exists trg_referrals_refresh_ranking on public.referrals;
create trigger trg_referrals_refresh_ranking
after insert or update on public.referrals
for each row execute function public.referrals_refresh_ranking();

select public.refresh_monthly_ranking(2026, 9);
select public.refresh_monthly_ranking(2026, 8);