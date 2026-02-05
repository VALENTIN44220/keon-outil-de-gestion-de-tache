-- Create table for project comments
CREATE TABLE public.be_project_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.be_projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.be_project_comments ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can view comments on projects they can access
CREATE POLICY "Users can view project comments"
ON public.be_project_comments
FOR SELECT
TO authenticated
USING (true);

-- Users can create comments
CREATE POLICY "Users can create project comments"
ON public.be_project_comments
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IN (SELECT user_id FROM public.profiles WHERE id = be_project_comments.user_id));

-- Users can update their own comments
CREATE POLICY "Users can update their own comments"
ON public.be_project_comments
FOR UPDATE
TO authenticated
USING (user_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

-- Users can delete their own comments
CREATE POLICY "Users can delete their own comments"
ON public.be_project_comments
FOR DELETE
TO authenticated
USING (user_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

-- Create index for faster queries
CREATE INDEX idx_be_project_comments_project_id ON public.be_project_comments(project_id);
CREATE INDEX idx_be_project_comments_user_id ON public.be_project_comments(user_id);

-- Enable realtime for comments
ALTER PUBLICATION supabase_realtime ADD TABLE public.be_project_comments;

-- Create trigger for updated_at
CREATE TRIGGER update_be_project_comments_updated_at
BEFORE UPDATE ON public.be_project_comments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();