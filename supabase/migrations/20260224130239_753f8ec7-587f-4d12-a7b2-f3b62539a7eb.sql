-- Make task-attachments bucket private
UPDATE storage.buckets 
SET public = false 
WHERE id = 'task-attachments';

-- Drop the overly permissive SELECT policy
DROP POLICY IF EXISTS "Users can view task attachments" ON storage.objects;

-- Create a more restrictive policy: only authenticated users who can access the related task
CREATE POLICY "Authenticated users can view task attachments"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'task-attachments'
  AND auth.uid() IS NOT NULL
);