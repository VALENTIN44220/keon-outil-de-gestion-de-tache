-- Add is_mandatory column to sub_process_templates
ALTER TABLE public.sub_process_templates
ADD COLUMN is_mandatory boolean NOT NULL DEFAULT false;

-- Create enum for validation type
DO $$ BEGIN
  CREATE TYPE validation_type AS ENUM ('none', 'manager', 'requester', 'free');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add validation fields to task_templates
ALTER TABLE public.task_templates
ADD COLUMN validation_level_1 text DEFAULT 'none',
ADD COLUMN validation_level_2 text DEFAULT 'none',
ADD COLUMN validator_level_1_id uuid REFERENCES public.profiles(id),
ADD COLUMN validator_level_2_id uuid REFERENCES public.profiles(id);

-- Add validation tracking to tasks table
ALTER TABLE public.tasks
ADD COLUMN validation_level_1 text DEFAULT 'none',
ADD COLUMN validation_level_2 text DEFAULT 'none',
ADD COLUMN validator_level_1_id uuid REFERENCES public.profiles(id),
ADD COLUMN validator_level_2_id uuid REFERENCES public.profiles(id),
ADD COLUMN validation_1_status text DEFAULT 'pending',
ADD COLUMN validation_1_at timestamp with time zone,
ADD COLUMN validation_1_by uuid REFERENCES public.profiles(id),
ADD COLUMN validation_1_comment text,
ADD COLUMN validation_2_status text DEFAULT 'pending',
ADD COLUMN validation_2_at timestamp with time zone,
ADD COLUMN validation_2_by uuid REFERENCES public.profiles(id),
ADD COLUMN validation_2_comment text,
ADD COLUMN original_assignee_id uuid REFERENCES public.profiles(id),
ADD COLUMN is_locked_for_validation boolean DEFAULT false;