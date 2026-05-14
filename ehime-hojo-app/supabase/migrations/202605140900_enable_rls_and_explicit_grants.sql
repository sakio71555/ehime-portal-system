-- Enable RLS and make Data API grants explicit for the public tables used by the app.
-- Public visitors can only read published/active content.
-- Authenticated admins can manage data through the existing admin screens.

grant usage on schema public to anon, authenticated, service_role;

-- Existing Data API grants. RLS policies below still decide which rows are visible/editable.
grant select on public.subsidies to anon;
grant select, insert, update, delete on public.subsidies to authenticated;
grant select, insert, update, delete on public.subsidies to service_role;

grant select on public.columns to anon;
grant select, insert, update, delete on public.columns to authenticated;
grant select, insert, update, delete on public.columns to service_role;

grant select on public.experts to anon;
grant select, insert, update, delete on public.experts to authenticated;
grant select, insert, update, delete on public.experts to service_role;

-- Needed when inserts rely on serial/identity sequences.
grant usage, select on all sequences in schema public to authenticated;
grant usage, select on all sequences in schema public to service_role;

-- Keep future migrations compatible with Supabase's explicit-grant requirement.
alter default privileges in schema public
  grant select on tables to anon;

alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;

alter default privileges in schema public
  grant select, insert, update, delete on tables to service_role;

alter default privileges in schema public
  grant usage, select on sequences to authenticated;

alter default privileges in schema public
  grant usage, select on sequences to service_role;

-- Experts visibility was added for the admin "hide expert" feature.
alter table public.experts
  add column if not exists is_active boolean not null default true;

create index if not exists experts_is_active_idx
  on public.experts (is_active);

comment on column public.experts.is_active is
  'Controls whether the expert is shown on the public experts page. false hides the expert without deleting it.';

-- subsidies
alter table public.subsidies enable row level security;

drop policy if exists "public can read published subsidies" on public.subsidies;
drop policy if exists "authenticated admins can manage subsidies" on public.subsidies;

create policy "public can read published subsidies"
  on public.subsidies
  for select
  to anon
  using (
    crawl_status = 'published'
    and is_active = true
  );

create policy "authenticated admins can manage subsidies"
  on public.subsidies
  for all
  to authenticated
  using (true)
  with check (true);

-- columns
alter table public.columns enable row level security;

drop policy if exists "public can read published columns" on public.columns;
drop policy if exists "authenticated admins can manage columns" on public.columns;

create policy "public can read published columns"
  on public.columns
  for select
  to anon
  using (is_published = true);

create policy "authenticated admins can manage columns"
  on public.columns
  for all
  to authenticated
  using (true)
  with check (true);

-- experts
alter table public.experts enable row level security;

drop policy if exists "public can read active experts" on public.experts;
drop policy if exists "authenticated admins can manage experts" on public.experts;

create policy "public can read active experts"
  on public.experts
  for select
  to anon
  using (is_active = true);

create policy "authenticated admins can manage experts"
  on public.experts
  for all
  to authenticated
  using (true)
  with check (true);
