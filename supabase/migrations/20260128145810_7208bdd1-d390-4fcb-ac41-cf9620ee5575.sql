-- ================================================
-- WORKFLOW VARIABLES SYSTEM
-- ================================================

-- Variable types enum
DO $$ BEGIN
    CREATE TYPE workflow_variable_type AS ENUM ('text', 'boolean', 'integer', 'decimal', 'datetime', 'autonumber');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Workflow variables table
CREATE TABLE IF NOT EXISTS public.workflow_variables (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    workflow_id UUID NOT NULL REFERENCES public.workflow_templates(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    variable_type workflow_variable_type NOT NULL DEFAULT 'text',
    default_value JSONB,
    expression TEXT,
    scope TEXT NOT NULL DEFAULT 'workflow',
    -- Autonumber settings
    autonumber_prefix TEXT,
    autonumber_padding INTEGER DEFAULT 5,
    autonumber_reset TEXT DEFAULT 'never',
    -- Datetime settings
    datetime_mode TEXT DEFAULT 'execution',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(workflow_id, name)
);

-- Runtime variable instances (for actual workflow runs)
CREATE TABLE IF NOT EXISTS public.workflow_variable_instances (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    run_id UUID NOT NULL REFERENCES public.workflow_runs(id) ON DELETE CASCADE,
    variable_id UUID NOT NULL REFERENCES public.workflow_variables(id) ON DELETE CASCADE,
    current_value JSONB,
    computed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(run_id, variable_id)
);

-- Autonumber sequences (for atomic number generation)
CREATE TABLE IF NOT EXISTS public.workflow_autonumber_sequences (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    variable_id UUID NOT NULL REFERENCES public.workflow_variables(id) ON DELETE CASCADE,
    current_value BIGINT NOT NULL DEFAULT 0,
    last_reset_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(variable_id)
);

-- ================================================
-- DATALAKE SYNC SYSTEM
-- ================================================

-- Sync direction enum
DO $$ BEGIN
    CREATE TYPE datalake_sync_direction AS ENUM ('app_to_datalake', 'datalake_to_app');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Sync mode enum
DO $$ BEGIN
    CREATE TYPE datalake_sync_mode AS ENUM ('full', 'incremental');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Upsert strategy enum
DO $$ BEGIN
    CREATE TYPE datalake_upsert_strategy AS ENUM ('insert_only', 'upsert', 'overwrite');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Table catalog for datalake sync
CREATE TABLE IF NOT EXISTS public.datalake_table_catalog (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    table_name TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    description TEXT,
    primary_key_column TEXT NOT NULL DEFAULT 'id',
    sync_enabled BOOLEAN NOT NULL DEFAULT true,
    last_sync_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Datalake sync logs
CREATE TABLE IF NOT EXISTS public.workflow_datalake_sync_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    run_id UUID REFERENCES public.workflow_runs(id) ON DELETE SET NULL,
    node_id UUID REFERENCES public.workflow_nodes(id) ON DELETE SET NULL,
    direction datalake_sync_direction NOT NULL,
    mode datalake_sync_mode NOT NULL DEFAULT 'full',
    tables_synced TEXT[] NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'queued',
    rows_read INTEGER DEFAULT 0,
    rows_written INTEGER DEFAULT 0,
    duration_ms INTEGER,
    error_message TEXT,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ================================================
-- ADD NEW NODE TYPES TO ENUM
-- ================================================
DO $$ BEGIN
    ALTER TYPE workflow_node_type ADD VALUE IF NOT EXISTS 'set_variable';
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TYPE workflow_node_type ADD VALUE IF NOT EXISTS 'datalake_sync';
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ================================================
-- RLS POLICIES
-- ================================================

-- Workflow variables
ALTER TABLE public.workflow_variables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view workflow variables" 
ON public.workflow_variables FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Template managers can manage workflow variables" 
ON public.workflow_variables FOR ALL 
USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    EXISTS (
        SELECT 1 FROM profiles p
        JOIN permission_profiles pp ON p.permission_profile_id = pp.id
        WHERE p.user_id = auth.uid() AND pp.can_manage_templates = true
    )
);

-- Variable instances
ALTER TABLE public.workflow_variable_instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "System can manage variable instances" 
ON public.workflow_variable_instances FOR ALL 
USING (auth.uid() IS NOT NULL);

-- Autonumber sequences
ALTER TABLE public.workflow_autonumber_sequences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "System can manage autonumber sequences" 
ON public.workflow_autonumber_sequences FOR ALL 
USING (auth.uid() IS NOT NULL);

-- Datalake table catalog
ALTER TABLE public.datalake_table_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view datalake catalog" 
ON public.datalake_table_catalog FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage datalake catalog" 
ON public.datalake_table_catalog FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Sync logs
ALTER TABLE public.workflow_datalake_sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view sync logs" 
ON public.workflow_datalake_sync_logs FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "System can insert sync logs" 
ON public.workflow_datalake_sync_logs FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "System can update sync logs" 
ON public.workflow_datalake_sync_logs FOR UPDATE 
USING (auth.uid() IS NOT NULL);

-- ================================================
-- SEED DEFAULT DATALAKE CATALOG
-- ================================================
INSERT INTO public.datalake_table_catalog (table_name, display_name, description, primary_key_column) VALUES
    ('tasks', 'Tâches', 'Toutes les tâches et demandes', 'id'),
    ('profiles', 'Utilisateurs', 'Profils des utilisateurs', 'id'),
    ('departments', 'Services', 'Services/Départements', 'id'),
    ('companies', 'Sociétés', 'Sociétés', 'id'),
    ('categories', 'Catégories', 'Catégories de demandes', 'id'),
    ('subcategories', 'Sous-catégories', 'Sous-catégories', 'id'),
    ('process_templates', 'Modèles de processus', 'Modèles de processus', 'id'),
    ('sub_process_templates', 'Modèles de sous-processus', 'Modèles de sous-processus', 'id'),
    ('task_templates', 'Modèles de tâches', 'Modèles de tâches', 'id'),
    ('be_projects', 'Projets BE', 'Projets Bureau d''Études', 'id'),
    ('workflow_runs', 'Exécutions de workflow', 'Historique des exécutions', 'id'),
    ('user_leaves', 'Absences', 'Absences des utilisateurs', 'id'),
    ('holidays', 'Jours fériés', 'Jours fériés', 'id')
ON CONFLICT (table_name) DO NOTHING;

-- ================================================
-- FUNCTION: Get next autonumber atomically
-- ================================================
CREATE OR REPLACE FUNCTION get_next_autonumber(p_variable_id UUID, p_reset_mode TEXT DEFAULT 'never')
RETURNS BIGINT AS $$
DECLARE
    v_current BIGINT;
    v_last_reset TIMESTAMP WITH TIME ZONE;
    v_should_reset BOOLEAN := FALSE;
BEGIN
    -- Lock the row for update
    SELECT current_value, last_reset_at INTO v_current, v_last_reset
    FROM workflow_autonumber_sequences
    WHERE variable_id = p_variable_id
    FOR UPDATE;
    
    -- Initialize if not exists
    IF v_current IS NULL THEN
        INSERT INTO workflow_autonumber_sequences (variable_id, current_value, last_reset_at)
        VALUES (p_variable_id, 1, now())
        RETURNING current_value INTO v_current;
        RETURN v_current;
    END IF;
    
    -- Check if reset is needed
    CASE p_reset_mode
        WHEN 'daily' THEN
            v_should_reset := DATE(now()) > DATE(v_last_reset);
        WHEN 'monthly' THEN
            v_should_reset := DATE_TRUNC('month', now()) > DATE_TRUNC('month', v_last_reset);
        WHEN 'yearly' THEN
            v_should_reset := DATE_TRUNC('year', now()) > DATE_TRUNC('year', v_last_reset);
        ELSE
            v_should_reset := FALSE;
    END CASE;
    
    IF v_should_reset THEN
        UPDATE workflow_autonumber_sequences 
        SET current_value = 1, last_reset_at = now(), updated_at = now()
        WHERE variable_id = p_variable_id;
        RETURN 1;
    ELSE
        UPDATE workflow_autonumber_sequences 
        SET current_value = current_value + 1, updated_at = now()
        WHERE variable_id = p_variable_id;
        RETURN v_current + 1;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;