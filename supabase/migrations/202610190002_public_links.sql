-- Additive public participation support. Existing response rows remain surveyor sourced.
alter table public.responses alter column surveyor_id drop not null;
alter table public.responses add column source text not null default 'surveyor'
  check (source in ('surveyor','public_link','qr'));

create table public.public_survey_links (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  survey_id uuid not null,
  version integer not null,
  active boolean not null default true,
  anonymous_allowed boolean not null default true,
  expires_at timestamptz,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  foreign key (survey_id, version) references public.survey_versions(survey_id, version)
);
alter table public.public_survey_links enable row level security;
create policy admin_read on public.public_survey_links for select to authenticated using (public.is_admin());
create index public_links_survey_idx on public.public_survey_links(survey_id, version);
alter table public.responses add column public_link_id uuid references public.public_survey_links(id);

create table private.public_attempts (
  key text primary key check (key ~ '^[a-f0-9]{64}$'),
  attempts integer not null default 0,
  window_start timestamptz not null default now()
);
revoke all on private.public_attempts from public, anon, authenticated;
create function public.reserve_public_attempt(attempt_key text, max_attempts integer)
returns boolean language plpgsql security definer set search_path='' as $$
declare n integer;
begin
  if attempt_key !~ '^[a-f0-9]{64}$' or max_attempts<1 or max_attempts>1000 then raise exception 'Invalid rate-limit request'; end if;
  insert into private.public_attempts(key,attempts) values(attempt_key,1)
  on conflict(key) do update set attempts=case when private.public_attempts.window_start<now()-interval '15 minutes' then 1 else private.public_attempts.attempts+1 end,
    window_start=case when private.public_attempts.window_start<now()-interval '15 minutes' then now() else private.public_attempts.window_start end
  returning attempts into n;
  return n<=max_attempts;
end $$;
revoke all on function public.reserve_public_attempt(text,integer) from public,anon,authenticated;
grant execute on function public.reserve_public_attempt(text,integer) to service_role;
revoke all on public.public_survey_links from public, anon, authenticated;
grant select on public.public_survey_links to authenticated;

-- Anonymous inserts enter only through this service-role RPC, after Edge Function
-- validation and rate limiting. No client role can call it or read token hashes.
create function public.submit_public_response(link_hash text, doc jsonb, response_source text)
returns uuid language plpgsql security definer set search_path='' as $$
declare l public.public_survey_links; sv public.surveys; rid uuid := (doc->>'id')::uuid; item record;
begin
  if response_source not in ('public_link','qr') then raise exception 'Invalid response source'; end if;
  if coalesce((doc->>'consent')::boolean,false) is not true or doc->>'status'<>'completed' or doc->'answers'->>'consent'<>'I agree to participate' then raise exception 'Explicit consent is required'; end if;
  select * into l from public.public_survey_links where token_hash=link_hash for update;
  if not found or not l.active or (l.expires_at is not null and l.expires_at<=now()) then raise exception 'This survey link is inactive or expired'; end if;
  if not l.anonymous_allowed then raise exception 'This link does not allow anonymous responses'; end if;
  if l.survey_id<>(doc->>'survey_id')::uuid or l.version<>(doc->>'version')::int then raise exception 'Survey version does not match this link'; end if;
  select * into sv from public.surveys where id=l.survey_id;
  if sv.status<>'published' or (sv.start_at is not null and now()<sv.start_at) or (sv.end_at is not null and now()>sv.end_at) then raise exception 'Survey is not open'; end if;
  if sv.quota is not null and (select count(*) from public.responses where survey_id=l.survey_id)>=sv.quota then raise exception 'Survey quota reached'; end if;
  if exists(select 1 from public.responses where id=rid) then
    if exists(select 1 from public.responses where id=rid and survey_id=l.survey_id and version=l.version and answers=doc->'answers' and public_link_id=l.id and source=response_source) then return rid; end if;
    raise exception 'Idempotency conflict';
  end if;
  insert into public.responses(id,survey_id,version,surveyor_id,collected_at,geography,state,district,mode,answers,consent,status,synthetic,source,public_link_id)
  values(rid,l.survey_id,l.version,null,(doc->>'created_at')::timestamptz,coalesce(doc->>'geography',''),coalesce(doc->>'state',''),coalesce(doc->>'district',''),'Public link',doc->'answers',true,'completed',false,response_source,l.id);
  for item in select * from jsonb_each(doc->'answers') loop
    insert into public.response_answers(response_id,question_key,value) values(rid,item.key,item.value);
  end loop;
  insert into public.audit_logs(actor,action) values('Public respondent','Anonymous response submitted: '||rid);
  return rid;
end $$;
revoke all on function public.submit_public_response(text,jsonb,text) from public,anon,authenticated;
grant execute on function public.submit_public_response(text,jsonb,text) to service_role;
