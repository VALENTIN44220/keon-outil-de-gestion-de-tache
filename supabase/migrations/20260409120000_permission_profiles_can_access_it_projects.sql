-- Écran dédié « Projets IT » : indépendant de can_access_projects (BE / SPV).

alter table public.permission_profiles
  add column if not exists can_access_it_projects boolean not null default false;

alter table public.user_permission_overrides
  add column if not exists can_access_it_projects boolean null;

-- Conserver le comportement historique : accès IT si voir IT + accès module « Projets » (BE/SPV/IT).
update public.permission_profiles
set can_access_it_projects =
  coalesce(can_view_it_projects, false)
  and coalesce(can_access_projects, false);

comment on column public.permission_profiles.can_access_it_projects is 'Menu et routes /it/projects ; complété par can_view_it_projects côté appli.';
