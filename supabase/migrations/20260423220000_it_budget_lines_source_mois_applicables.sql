-- IT Budget lines: source (Divalto / note de frais / …) + mois applicables pour budgets mensuels

alter table public.it_budget_lines
  add column if not exists source_depense text not null default 'divalto',
  add column if not exists mois_applicables int[] null;

alter table public.it_budget_lines
  drop constraint if exists it_budget_lines_source_depense_check;
alter table public.it_budget_lines
  add constraint it_budget_lines_source_depense_check
  check (source_depense in ('divalto', 'note_de_frais', 'autre'));

alter table public.it_budget_lines
  drop constraint if exists it_budget_lines_mois_applicables_check;
alter table public.it_budget_lines
  add constraint it_budget_lines_mois_applicables_check
  check (
    mois_applicables is null
    or mois_applicables <@ array[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]::int[]
  );

comment on column public.it_budget_lines.source_depense is
  'Origine de la dépense prévue (Divalto, note de frais, autre), aligné sur it_manual_expenses.';
comment on column public.it_budget_lines.mois_applicables is
  'Pour budget_type = mensuel : mois (1–12) où le montant mensuel s''applique ; NULL ou vide = 12 mois.';
