alter table public.experts
  add column if not exists is_active boolean not null default true;

comment on column public.experts.is_active is
  'Controls whether the expert is shown on the public experts page. false hides the expert without deleting it.';

create index if not exists experts_is_active_idx
  on public.experts (is_active);
