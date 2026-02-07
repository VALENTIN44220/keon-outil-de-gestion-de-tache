create or replace function public.next_entity_number(
  p_project_code text,
  p_entity_type text
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next_value bigint;
  v_prefix text;
  v_padding int;
  v_result text;
  v_seed bigint;
begin
  case p_entity_type
    when 'request' then v_prefix := 'D';  v_padding := 5;
    when 'sub_process' then v_prefix := 'SP'; v_padding := 5;
    when 'task' then v_prefix := 'T';  v_padding := 4;
    else raise exception 'Type d''entité invalide: %', p_entity_type;
  end case;

  -- Seed depuis la table de trace : évite tout doublon même si number_counters a été vidé
  if p_entity_type = 'request' then
    select coalesce(max(nullif(split_part(request_number, '-', 3), '')::bigint), 0) + 1
      into v_seed
      from public.request_trace_numbers
     where request_number like ('D-' || p_project_code || '-%');
  elsif p_entity_type = 'sub_process' then
    select coalesce(max(nullif(split_part(sub_process_number, '-', 3), '')::bigint), 0) + 1
      into v_seed
      from public.request_trace_numbers
     where sub_process_number like ('SP-' || p_project_code || '-%');
  else
    select coalesce(max(nullif(split_part(task_number, '-', 3), '')::bigint), 0) + 1
      into v_seed
      from public.request_trace_numbers
     where task_number like ('T-' || p_project_code || '-%');
  end if;

  insert into public.number_counters (project_code, entity_type, last_value, updated_at)
  values (p_project_code, p_entity_type, v_seed, now())
  on conflict (project_code, entity_type)
  do update set
    last_value = public.number_counters.last_value + 1,
    updated_at = now()
  returning last_value into v_next_value;

  v_result := v_prefix || '-' || p_project_code || '-' || lpad(v_next_value::text, v_padding, '0');
  return v_result;
end;
$$;
