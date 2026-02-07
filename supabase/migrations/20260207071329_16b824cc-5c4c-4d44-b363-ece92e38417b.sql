-- Add 'request' to scope_type options and create function to find/create request chat
-- Update scope_type comment to include request
COMMENT ON COLUMN public.chat_conversations.scope_type IS 'global, company, department, project, or request';

-- Function to find or create a chat conversation for a request
CREATE OR REPLACE FUNCTION public.find_or_create_request_chat(
  _request_id uuid,
  _user_id uuid
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conversation_id uuid;
  v_request_number text;
  v_request_title text;
BEGIN
  -- Get request details
  SELECT request_number, title INTO v_request_number, v_request_title
  FROM public.tasks
  WHERE id = _request_id AND task_type = 'request';
  
  IF v_request_number IS NULL THEN
    RAISE EXCEPTION 'Demande non trouvée: %', _request_id;
  END IF;

  -- Check if conversation already exists for this request
  SELECT id INTO v_conversation_id
  FROM public.chat_conversations
  WHERE scope_type = 'request' AND scope_id = _request_id
  LIMIT 1;

  -- Create conversation if it doesn't exist
  IF v_conversation_id IS NULL THEN
    INSERT INTO public.chat_conversations (
      scope_type,
      scope_id,
      type,
      title,
      created_by
    ) VALUES (
      'request',
      _request_id,
      'group',
      COALESCE(v_request_number, 'Demande') || ' - ' || COALESCE(v_request_title, 'Discussion'),
      _user_id
    )
    RETURNING id INTO v_conversation_id;

    -- Add creator as member
    INSERT INTO public.chat_members (conversation_id, user_id, role)
    VALUES (v_conversation_id, _user_id, 'owner');
  END IF;

  -- Ensure user is a member (add if not already)
  INSERT INTO public.chat_members (conversation_id, user_id, role)
  VALUES (v_conversation_id, _user_id, 'member')
  ON CONFLICT (conversation_id, user_id) DO NOTHING;

  RETURN v_conversation_id;
END;
$$;