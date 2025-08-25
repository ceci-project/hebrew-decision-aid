-- Fix critical security vulnerability: Enable RLS and add user ownership to documents table

-- First, add user_id column to associate documents with users
ALTER TABLE public.documents 
ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Make user_id non-nullable for new rows (existing rows will need to be handled)
-- We'll set a default temporarily for existing data, then remove it
UPDATE public.documents 
SET user_id = (SELECT id FROM auth.users LIMIT 1)
WHERE user_id IS NULL;

-- Now make it non-nullable
ALTER TABLE public.documents 
ALTER COLUMN user_id SET NOT NULL;

-- Enable Row Level Security on documents table
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- Create policy for users to view only their own documents
CREATE POLICY "Users can view their own documents" 
ON public.documents 
FOR SELECT 
USING (auth.uid() = user_id);

-- Create policy for users to insert their own documents
CREATE POLICY "Users can insert their own documents" 
ON public.documents 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Create policy for users to update their own documents
CREATE POLICY "Users can update their own documents" 
ON public.documents 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Create policy for users to delete their own documents
CREATE POLICY "Users can delete their own documents" 
ON public.documents 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create index on user_id for better performance
CREATE INDEX idx_documents_user_id ON public.documents(user_id);