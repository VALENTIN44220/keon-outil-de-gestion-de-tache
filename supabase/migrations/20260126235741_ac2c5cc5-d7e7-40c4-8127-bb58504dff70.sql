-- Extend workflow_node_type enum to support additional workflow blocks
ALTER TYPE public.workflow_node_type ADD VALUE IF NOT EXISTS 'status_change';
ALTER TYPE public.workflow_node_type ADD VALUE IF NOT EXISTS 'assignment';
