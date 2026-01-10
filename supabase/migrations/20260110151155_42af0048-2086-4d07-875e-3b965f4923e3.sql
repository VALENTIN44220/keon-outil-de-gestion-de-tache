-- Table des modèles de processus (ensemble de tâches)
CREATE TABLE public.process_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  user_id UUID NOT NULL,
  company TEXT,
  department TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table des modèles de tâches
CREATE TABLE public.task_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  process_template_id UUID REFERENCES public.process_templates(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT NOT NULL DEFAULT 'medium',
  category TEXT,
  default_duration_days INTEGER DEFAULT 7,
  order_index INTEGER DEFAULT 0,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.process_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_templates ENABLE ROW LEVEL SECURITY;

-- Policies for process_templates
CREATE POLICY "Users can view their own process templates"
ON public.process_templates FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own process templates"
ON public.process_templates FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own process templates"
ON public.process_templates FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own process templates"
ON public.process_templates FOR DELETE
USING (auth.uid() = user_id);

-- Policies for task_templates
CREATE POLICY "Users can view their own task templates"
ON public.task_templates FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own task templates"
ON public.task_templates FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own task templates"
ON public.task_templates FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own task templates"
ON public.task_templates FOR DELETE
USING (auth.uid() = user_id);

-- Triggers for updated_at
CREATE TRIGGER update_process_templates_updated_at
BEFORE UPDATE ON public.process_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_task_templates_updated_at
BEFORE UPDATE ON public.task_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();