-- Enable RLS on supplier_taxonomy
ALTER TABLE public.supplier_taxonomy ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read supplier taxonomy (reference data)
CREATE POLICY "Authenticated users can read supplier taxonomy"
ON public.supplier_taxonomy
FOR SELECT
TO authenticated
USING (true);

-- Only admins can modify supplier taxonomy
CREATE POLICY "Admins can manage supplier taxonomy"
ON public.supplier_taxonomy
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Enable RLS on supplier_categorisation
ALTER TABLE public.supplier_categorisation ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read supplier categorisation (reference data)
CREATE POLICY "Authenticated users can read supplier categorisation"
ON public.supplier_categorisation
FOR SELECT
TO authenticated
USING (true);

-- Only admins can modify supplier categorisation
CREATE POLICY "Admins can manage supplier categorisation"
ON public.supplier_categorisation
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));
