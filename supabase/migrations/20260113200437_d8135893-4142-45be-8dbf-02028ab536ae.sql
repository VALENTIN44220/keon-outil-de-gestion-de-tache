-- Table for public holidays (jours fériés)
CREATE TABLE public.holidays (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL,
  name TEXT NOT NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  is_national BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(date, company_id)
);

-- Enable RLS
ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;

-- Everyone can read holidays
CREATE POLICY "Holidays are viewable by authenticated users" 
ON public.holidays FOR SELECT 
TO authenticated
USING (true);

-- Only admins can manage holidays
CREATE POLICY "Admins can manage holidays" 
ON public.holidays FOR ALL 
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Table for user leave/absences (congés)
CREATE TABLE public.user_leaves (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  start_half_day TEXT DEFAULT 'morning' CHECK (start_half_day IN ('morning', 'afternoon')),
  end_half_day TEXT DEFAULT 'afternoon' CHECK (end_half_day IN ('morning', 'afternoon')),
  leave_type TEXT NOT NULL DEFAULT 'paid' CHECK (leave_type IN ('paid', 'unpaid', 'sick', 'rtt', 'other')),
  description TEXT,
  status TEXT NOT NULL DEFAULT 'declared' CHECK (status IN ('declared', 'cancelled')),
  id_lucca TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_leaves ENABLE ROW LEVEL SECURITY;

-- Users can view their own leaves and team leaves
CREATE POLICY "Users can view relevant leaves" 
ON public.user_leaves FOR SELECT 
TO authenticated
USING (
  user_id = public.current_profile_id()
  OR public.has_role(auth.uid(), 'admin')
  OR EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.id = user_leaves.user_id 
    AND p.manager_id = public.current_profile_id()
  )
);

-- Users can manage their own leaves
CREATE POLICY "Users can manage their own leaves" 
ON public.user_leaves FOR INSERT 
TO authenticated
WITH CHECK (user_id = public.current_profile_id());

CREATE POLICY "Users can update their own leaves" 
ON public.user_leaves FOR UPDATE 
TO authenticated
USING (user_id = public.current_profile_id());

CREATE POLICY "Users can delete their own leaves" 
ON public.user_leaves FOR DELETE 
TO authenticated
USING (user_id = public.current_profile_id());

-- Table for workload planning slots (créneaux de planification)
CREATE TABLE public.workload_slots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  half_day TEXT NOT NULL CHECK (half_day IN ('morning', 'afternoon')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(task_id, user_id, date, half_day)
);

-- Enable RLS
ALTER TABLE public.workload_slots ENABLE ROW LEVEL SECURITY;

-- Users can view their own slots and team slots
CREATE POLICY "Users can view relevant workload slots" 
ON public.workload_slots FOR SELECT 
TO authenticated
USING (
  user_id = public.current_profile_id()
  OR public.has_role(auth.uid(), 'admin')
  OR EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.id = workload_slots.user_id 
    AND p.manager_id = public.current_profile_id()
  )
);

-- Users can manage their own slots
CREATE POLICY "Users can create their own slots" 
ON public.workload_slots FOR INSERT 
TO authenticated
WITH CHECK (
  user_id = public.current_profile_id()
  OR public.has_role(auth.uid(), 'admin')
  OR EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.id = workload_slots.user_id 
    AND p.manager_id = public.current_profile_id()
  )
);

CREATE POLICY "Users can update relevant slots" 
ON public.workload_slots FOR UPDATE 
TO authenticated
USING (
  user_id = public.current_profile_id()
  OR public.has_role(auth.uid(), 'admin')
  OR EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.id = workload_slots.user_id 
    AND p.manager_id = public.current_profile_id()
  )
);

CREATE POLICY "Users can delete relevant slots" 
ON public.workload_slots FOR DELETE 
TO authenticated
USING (
  user_id = public.current_profile_id()
  OR public.has_role(auth.uid(), 'admin')
  OR EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.id = workload_slots.user_id 
    AND p.manager_id = public.current_profile_id()
  )
);

-- Indexes for performance
CREATE INDEX idx_holidays_date ON public.holidays(date);
CREATE INDEX idx_user_leaves_user_id ON public.user_leaves(user_id);
CREATE INDEX idx_user_leaves_dates ON public.user_leaves(start_date, end_date);
CREATE INDEX idx_workload_slots_user_date ON public.workload_slots(user_id, date);
CREATE INDEX idx_workload_slots_task ON public.workload_slots(task_id);

-- Triggers for updated_at
CREATE TRIGGER update_holidays_updated_at
BEFORE UPDATE ON public.holidays
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_leaves_updated_at
BEFORE UPDATE ON public.user_leaves
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_workload_slots_updated_at
BEFORE UPDATE ON public.workload_slots
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();