alter table public.columns
  add column if not exists quality_review jsonb not null default '{}'::jsonb;

comment on column public.columns.quality_review is
  'AI記事のルール採点、LLMレビュー、公式根拠、人間確認状態を保存する管理用メタ情報';

notify pgrst, 'reload schema';
