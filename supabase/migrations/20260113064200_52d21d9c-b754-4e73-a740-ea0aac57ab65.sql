-- Table pour stocker les détails spécifiques aux demandes Bureau d'Études
CREATE TABLE IF NOT EXISTS public.be_request_details (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    code_affaire TEXT,
    num_cmde_divalto TEXT,
    num_devis_divalto TEXT,
    montant_prestation DECIMAL(12, 2),
    phase TEXT,
    facturable TEXT,
    demande_ie TEXT,
    demande_projeteur TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(task_id)
);

-- Table pour stocker les sous-processus sélectionnés par demande (multi-sélection)
CREATE TABLE IF NOT EXISTS public.be_request_sub_processes (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    sub_process_template_id UUID NOT NULL REFERENCES public.sub_process_templates(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.be_request_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.be_request_sub_processes ENABLE ROW LEVEL SECURITY;

-- Policies for be_request_details
CREATE POLICY "Users can view be_request_details for tasks they can access"
ON public.be_request_details
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.tasks t WHERE t.id = task_id AND public.can_access_task(t.id)
    )
);

CREATE POLICY "Users can insert be_request_details for their own tasks"
ON public.be_request_details
FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.tasks t WHERE t.id = task_id AND t.user_id = auth.uid()
    )
);

CREATE POLICY "Users can update be_request_details for tasks they can manage"
ON public.be_request_details
FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.tasks t WHERE t.id = task_id AND public.can_access_task(t.id)
    )
);

-- Policies for be_request_sub_processes
CREATE POLICY "Users can view be_request_sub_processes for tasks they can access"
ON public.be_request_sub_processes
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.tasks t WHERE t.id = task_id AND public.can_access_task(t.id)
    )
);

CREATE POLICY "Users can insert be_request_sub_processes for their own tasks"
ON public.be_request_sub_processes
FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.tasks t WHERE t.id = task_id AND t.user_id = auth.uid()
    )
);

CREATE POLICY "Users can delete be_request_sub_processes for tasks they can manage"
ON public.be_request_sub_processes
FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM public.tasks t WHERE t.id = task_id AND public.can_access_task(t.id)
    )
);

-- Trigger for updated_at on be_request_details
CREATE TRIGGER update_be_request_details_updated_at
BEFORE UPDATE ON public.be_request_details
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();