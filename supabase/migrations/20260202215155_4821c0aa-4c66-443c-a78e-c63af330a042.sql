-- Update the tasks_status_check constraint to include 'cancelled' status
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_status_check;

ALTER TABLE public.tasks ADD CONSTRAINT tasks_status_check 
CHECK (status = ANY (ARRAY[
  'todo'::text, 
  'in-progress'::text, 
  'done'::text, 
  'to_assign'::text, 
  'pending-validation'::text,
  'pending_validation_1'::text,
  'pending_validation_2'::text,
  'validated'::text, 
  'refused'::text, 
  'review'::text,
  'cancelled'::text
]));