-- Add missing values to workflow_node_type enum for parallel execution support

ALTER TYPE public.workflow_node_type ADD VALUE IF NOT EXISTS 'sub_process';
ALTER TYPE public.workflow_node_type ADD VALUE IF NOT EXISTS 'fork';
ALTER TYPE public.workflow_node_type ADD VALUE IF NOT EXISTS 'join';