-- Add start_date column to tasks table
ALTER TABLE public.tasks ADD COLUMN start_date DATE;

-- Backfill: for existing tasks with due_date, set start_date based on created_at date
UPDATE public.tasks 
SET start_date = created_at::date
WHERE due_date IS NOT NULL AND start_date IS NULL;