-- Add duration unit to task_templates (days or hours)
ALTER TABLE public.task_templates 
ADD COLUMN IF NOT EXISTS default_duration_unit text NOT NULL DEFAULT 'days' 
CHECK (default_duration_unit IN ('days', 'hours'));

-- Allow 0 as duration value
ALTER TABLE public.task_templates 
ALTER COLUMN default_duration_days SET DEFAULT 1;

-- Add duration_hours to tasks for tracking actual hour-based duration
ALTER TABLE public.tasks
ADD COLUMN IF NOT EXISTS duration_hours numeric DEFAULT NULL;

-- Add duration_hours to workload_slots for hour-based slot tracking
ALTER TABLE public.workload_slots
ADD COLUMN IF NOT EXISTS duration_hours numeric NOT NULL DEFAULT 8;

-- Update existing workload_slots: half_day slots = 4h, full slots inferred as 8h per day
-- (existing slots are half-day based, so each slot = 4h)
UPDATE public.workload_slots SET duration_hours = 4;