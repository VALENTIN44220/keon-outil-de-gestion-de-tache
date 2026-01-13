-- Add ID_LUCCA column to profiles table for SIRH integration
ALTER TABLE public.profiles 
ADD COLUMN id_lucca text NULL;

-- Add ID_SERVICES_LUCCA column to departments table for SIRH integration
ALTER TABLE public.departments 
ADD COLUMN id_services_lucca text NULL;

-- Add indexes for faster lookups
CREATE INDEX idx_profiles_id_lucca ON public.profiles(id_lucca);
CREATE INDEX idx_departments_id_services_lucca ON public.departments(id_services_lucca);