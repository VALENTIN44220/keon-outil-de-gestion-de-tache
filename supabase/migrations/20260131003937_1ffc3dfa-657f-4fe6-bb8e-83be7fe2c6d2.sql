-- Add standard sub-process node types to workflow_node_type enum
DO $$
BEGIN
  -- Only run if the enum exists
  IF EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'workflow_node_type'
  ) THEN
    ALTER TYPE public.workflow_node_type ADD VALUE IF NOT EXISTS 'sub_process_standard_direct';
    ALTER TYPE public.workflow_node_type ADD VALUE IF NOT EXISTS 'sub_process_standard_manager';
    ALTER TYPE public.workflow_node_type ADD VALUE IF NOT EXISTS 'sub_process_standard_validation1';
    ALTER TYPE public.workflow_node_type ADD VALUE IF NOT EXISTS 'sub_process_standard_validation2';
  END IF;
END $$;