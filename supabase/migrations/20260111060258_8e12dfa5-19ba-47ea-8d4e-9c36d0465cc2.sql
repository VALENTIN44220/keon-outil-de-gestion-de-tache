-- Create task_checklists table for sub-actions
CREATE TABLE public.task_checklists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE,
  completed_by UUID REFERENCES public.profiles(id),
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.task_checklists ENABLE ROW LEVEL SECURITY;

-- Create policies - users can manage checklists of their own tasks
CREATE POLICY "Users can view checklists of their tasks"
ON public.task_checklists
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.tasks 
    WHERE tasks.id = task_checklists.task_id 
    AND tasks.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert checklists to their tasks"
ON public.task_checklists
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.tasks 
    WHERE tasks.id = task_checklists.task_id 
    AND tasks.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update checklists of their tasks"
ON public.task_checklists
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.tasks 
    WHERE tasks.id = task_checklists.task_id 
    AND tasks.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete checklists of their tasks"
ON public.task_checklists
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.tasks 
    WHERE tasks.id = task_checklists.task_id 
    AND tasks.user_id = auth.uid()
  )
);

-- Create trigger for updated_at
CREATE TRIGGER update_task_checklists_updated_at
BEFORE UPDATE ON public.task_checklists
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for performance
CREATE INDEX idx_task_checklists_task_id ON public.task_checklists(task_id);