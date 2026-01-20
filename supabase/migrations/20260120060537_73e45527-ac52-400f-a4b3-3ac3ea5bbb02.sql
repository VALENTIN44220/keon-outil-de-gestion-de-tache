-- Create table for request/task comments (chat system)
CREATE TABLE public.task_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.profiles(id),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;

-- Create policies for task comments
CREATE POLICY "Users can view comments on tasks they can see" 
ON public.task_comments 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.tasks t 
    WHERE t.id = task_id 
    AND (
      t.user_id = auth.uid() 
      OR t.assignee_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
      OR t.requester_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
      OR t.parent_request_id IN (
        SELECT id FROM public.tasks WHERE user_id = auth.uid() 
        OR requester_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
      )
    )
  )
);

CREATE POLICY "Users can create comments on accessible tasks" 
ON public.task_comments 
FOR INSERT 
WITH CHECK (
  author_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
);

CREATE POLICY "Users can update their own comments" 
ON public.task_comments 
FOR UPDATE 
USING (author_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete their own comments" 
ON public.task_comments 
FOR DELETE 
USING (author_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_task_comments_updated_at
BEFORE UPDATE ON public.task_comments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for comments
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_comments;

-- Add index for performance
CREATE INDEX idx_task_comments_task_id ON public.task_comments(task_id);
CREATE INDEX idx_task_comments_author_id ON public.task_comments(author_id);