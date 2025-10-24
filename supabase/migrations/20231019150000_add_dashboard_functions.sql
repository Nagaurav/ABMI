-- Function to get dashboard KPIs
create or replace function public.get_dashboard_kpis(user_id uuid)
returns table (
  interviews_completed bigint,
  average_score numeric,
  latest_improvement_area text
) 
language plpgsql
security definer
as $$
begin
  return query
  with interview_stats as (
    select 
      count(ar.id) as total_interviews,
      avg(ar.overall_score) as avg_score,
      (select key_improvement_area 
       from public.analysis_reports 
       where user_id = $1 
       order by created_at desc 
       limit 1) as improvement_area
    from public.analysis_reports ar
    where ar.user_id = $1
  )
  select 
    coalesce(total_interviews, 0)::bigint as interviews_completed,
    round(coalesce(avg_score, 0)::numeric, 2) as average_score,
    coalesce(improvement_area, 'N/A') as latest_improvement_area
  from interview_stats;
end;
$$;

-- Function to get performance history
create or replace function public.get_performance_history(
  user_id uuid,
  limit_count integer default 10
)
returns table (
  date timestamp with time zone,
  score numeric
)
language plpgsql
security definer
as $$
begin
  return query
  select 
    s.created_at as date,
    ar.overall_score as score
  from public.interview_sessions s
  join public.analysis_reports ar on s.id = ar.session_id
  where s.user_id = $1
  order by s.created_at desc
  limit $2;
end;
$$;

-- Function to get recent interviews
create or replace function public.get_recent_interviews(
  user_id uuid,
  limit_count integer default 5
)
returns table (
  session_id uuid,
  date timestamp with time zone,
  score numeric
)
language plpgsql
security definer
as $$
begin
  return query
  select 
    s.id as session_id,
    s.created_at as date,
    ar.overall_score as score
  from public.interview_sessions s
  join public.analysis_reports ar on s.id = ar.session_id
  where s.user_id = $1
  order by s.created_at desc
  limit $2;
end;
$$;

-- Grant execute permissions to authenticated users
grant execute on function public.get_dashboard_kpis(uuid) to authenticated;
grant execute on function public.get_performance_history(uuid, integer) to authenticated;
grant execute on function public.get_recent_interviews(uuid, integer) to authenticated;
