-- IT Budget: manual expenses enhancements
-- - it_project_id becomes optional (nullable)
-- - add source_depense (divalto/note_de_frais/…)
-- - add mode_decaissement (annuel/mensuel)
-- - add mois_applicables (int[] of months 1..12)
-- - align fields with it_budget_lines (categorie, sous_categorie, type_depense, nature_depense, fournisseur_prevu)

alter table if exists public.it_manual_expenses
  alter column it_project_id drop not null;

alter table if exists public.it_manual_expenses
  add column if not exists source_depense text not null default 'divalto',
  add column if not exists mode_decaissement text not null default 'annuel',
  add column if not exists mois_applicables int[] null,
  add column if not exists categorie text null,
  add column if not exists sous_categorie text null,
  add column if not exists type_depense text null,
  add column if not exists nature_depense text null,
  add column if not exists fournisseur_prevu text null;

alter table public.it_manual_expenses
  drop constraint if exists it_manual_expenses_source_depense_check;
alter table public.it_manual_expenses
  add constraint it_manual_expenses_source_depense_check
  check (source_depense in ('divalto', 'note_de_frais', 'autre'));

alter table public.it_manual_expenses
  drop constraint if exists it_manual_expenses_mode_decaissement_check;
alter table public.it_manual_expenses
  add constraint it_manual_expenses_mode_decaissement_check
  check (mode_decaissement in ('annuel', 'mensuel'));

alter table public.it_manual_expenses
  drop constraint if exists it_manual_expenses_mois_applicables_check;
alter table public.it_manual_expenses
  add constraint it_manual_expenses_mois_applicables_check
  check (
    mois_applicables is null
    or mois_applicables <@ array[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]::int[]
  );

