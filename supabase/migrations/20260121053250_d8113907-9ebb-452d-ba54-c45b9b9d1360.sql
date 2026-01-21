-- Update the status check constraint to include all valid statuses
ALTER TABLE tasks DROP CONSTRAINT tasks_status_check;

ALTER TABLE tasks ADD CONSTRAINT tasks_status_check 
CHECK (status = ANY (ARRAY[
  'todo'::text, 
  'in-progress'::text, 
  'done'::text, 
  'to_assign'::text, 
  'pending-validation'::text, 
  'validated'::text, 
  'refused'::text, 
  'review'::text
]));