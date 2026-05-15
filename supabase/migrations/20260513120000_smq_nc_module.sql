-- Module SMQ — Non-Conformités (NC) et Actions Correctives
-- Reproduit le formulaire SharePoint existant + workflow état + pont vers tasks
-- (Voir le fichier sql complet appliqué via MCP Supabase le 2026-05-13)

-- Voir migration appliquée directement en DB via MCP.
-- Cette migration sert de référence dans le repo pour les déploiements ultérieurs.

CREATE TABLE IF NOT EXISTS public.nc_declarations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nc_number text UNIQUE,
  title text NOT NULL,
  description_problem text,
  date_constat date NOT NULL DEFAULT CURRENT_DATE,
  date_cloture_souhaitee date,
  declarant_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  pilote_id   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  processus_code text,
  metier_code text,
  societe_code text,
  identification text CHECK (identification IS NULL OR identification IN (
    'points_vigilance', 'nc_qualite', 'axe_amelioration', 'nc_fournisseur', 'incident_site'
  )),
  apparition_ailleurs text CHECK (apparition_ailleurs IS NULL OR apparition_ailleurs IN (
    'oui', 'non', 'ne_sais_pas', 'non_concerne'
  )),
  fournisseur_nom text,
  code_projet text,
  causes_racines text,
  actions_correctives text,
  actions_preventives text,
  status text NOT NULL DEFAULT 'nouvelle' CHECK (status IN (
    'nouvelle', 'affectee', 'en_cours', 'cloturee'
  )),
  efficacite_action text CHECK (efficacite_action IS NULL OR efficacite_action IN (
    'efficace', 'a_ameliorer', 'inefficace'
  )),
  cloturee_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_nc_status ON public.nc_declarations(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_nc_pilote ON public.nc_declarations(pilote_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_nc_declarant ON public.nc_declarations(declarant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_nc_processus ON public.nc_declarations(processus_code) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.nc_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nc_id uuid NOT NULL REFERENCES public.nc_declarations(id) ON DELETE CASCADE,
  name text NOT NULL,
  url text NOT NULL,
  type text,
  uploaded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_nc_attachments_nc ON public.nc_attachments(nc_id);

CREATE TABLE IF NOT EXISTS public.nc_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nc_id uuid NOT NULL REFERENCES public.nc_declarations(id) ON DELETE CASCADE,
  from_status text,
  to_status text NOT NULL,
  changed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  comment text,
  changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_nc_history_nc ON public.nc_status_history(nc_id, changed_at);

CREATE TABLE IF NOT EXISTS public.nc_process_pilots (
  processus_code text PRIMARY KEY,
  pilote_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.nc_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nc_id uuid NOT NULL REFERENCES public.nc_declarations(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('corrective', 'preventive')),
  title text NOT NULL,
  description text,
  assignee_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  due_date date,
  status text NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done')),
  linked_task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  done_at timestamptz,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_nc_actions_nc ON public.nc_actions(nc_id);
CREATE INDEX IF NOT EXISTS idx_nc_actions_assignee ON public.nc_actions(assignee_id);

-- Fonctions & triggers : voir migration appliquée
-- RLS policies : voir migration appliquée
