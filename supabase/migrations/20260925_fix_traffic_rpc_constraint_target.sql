-- Fix PostgreSQL ambiguity between the RPC output column "day"
-- and the traffic table primary-key column used by ON CONFLICT.
create or replace function public.increment_trouvetou_traffic(p_day date, p_unique_visitors bigint)
returns table(day date, visits bigint, unique_visitors bigint)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_day is null then
    raise exception 'day is required';
  end if;
  if p_unique_visitors not in (0, 1) then
    raise exception 'unique_visitors must be 0 or 1';
  end if;

  return query
  insert into public.trouvetou_traffic_daily (day, visits, unique_visitors)
  values (p_day, 1, p_unique_visitors)
  on conflict on constraint trouvetou_traffic_daily_pkey do update
    set visits = public.trouvetou_traffic_daily.visits + 1,
        unique_visitors = public.trouvetou_traffic_daily.unique_visitors + excluded.unique_visitors,
        updated_at = now()
  returning public.trouvetou_traffic_daily.day,
            public.trouvetou_traffic_daily.visits,
            public.trouvetou_traffic_daily.unique_visitors;
end;
$$;

revoke all on function public.increment_trouvetou_traffic(date, bigint) from public, anon, authenticated;
grant execute on function public.increment_trouvetou_traffic(date, bigint) to service_role;
