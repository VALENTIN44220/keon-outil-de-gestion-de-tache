-- =============================================
-- CHAT MODULE - Database Schema
-- =============================================

-- 1) CONVERSATIONS TABLE
CREATE TABLE public.chat_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_type TEXT NOT NULL DEFAULT 'global' CHECK (scope_type IN ('global', 'company', 'department', 'project')),
  scope_id UUID NULL,
  type TEXT NOT NULL CHECK (type IN ('dm', 'group')),
  title TEXT NULL,
  avatar_url TEXT NULL,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_message_at TIMESTAMPTZ NULL,
  last_message_preview TEXT NULL
);

-- Indexes for conversations
CREATE INDEX idx_chat_conversations_scope ON public.chat_conversations(scope_type, scope_id);
CREATE INDEX idx_chat_conversations_updated ON public.chat_conversations(updated_at DESC);
CREATE INDEX idx_chat_conversations_last_message ON public.chat_conversations(last_message_at DESC NULLS LAST);

-- 2) MEMBERS TABLE
CREATE TABLE public.chat_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  muted BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT chat_members_unique UNIQUE (conversation_id, user_id)
);

-- Indexes for members
CREATE INDEX idx_chat_members_user ON public.chat_members(user_id);
CREATE INDEX idx_chat_members_conversation ON public.chat_members(conversation_id);

-- 3) MESSAGES TABLE
CREATE TABLE public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NULL,
  message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'file', 'system')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  edited_at TIMESTAMPTZ NULL,
  deleted_at TIMESTAMPTZ NULL,
  reply_to_message_id UUID NULL REFERENCES public.chat_messages(id) ON DELETE SET NULL
);

-- Indexes for messages
CREATE INDEX idx_chat_messages_conversation ON public.chat_messages(conversation_id, created_at DESC);
CREATE INDEX idx_chat_messages_sender ON public.chat_messages(sender_id);
CREATE INDEX idx_chat_messages_created ON public.chat_messages(created_at DESC);

-- 4) ATTACHMENTS TABLE
CREATE TABLE public.chat_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  uploader_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  storage_bucket TEXT NOT NULL DEFAULT 'chat-attachments',
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for attachments
CREATE INDEX idx_chat_attachments_message ON public.chat_attachments(message_id);
CREATE INDEX idx_chat_attachments_conversation ON public.chat_attachments(conversation_id);

-- 5) READ RECEIPTS TABLE (for group read status - V2)
CREATE TABLE public.chat_read_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chat_read_receipts_unique UNIQUE (message_id, user_id)
);

CREATE INDEX idx_chat_read_receipts_message ON public.chat_read_receipts(message_id);

-- =============================================
-- HELPER FUNCTIONS
-- =============================================

-- Function to check if user is member of conversation
CREATE OR REPLACE FUNCTION public.is_chat_member(_user_id UUID, _conversation_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chat_members
    WHERE conversation_id = _conversation_id
      AND user_id = _user_id
  )
$$;

-- Function to check if user is admin/owner of conversation
CREATE OR REPLACE FUNCTION public.is_chat_admin(_user_id UUID, _conversation_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chat_members
    WHERE conversation_id = _conversation_id
      AND user_id = _user_id
      AND role IN ('owner', 'admin')
  )
$$;

-- Function to get unread count for a user in a conversation
CREATE OR REPLACE FUNCTION public.get_unread_count(_user_id UUID, _conversation_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COUNT(*)::INTEGER
  FROM public.chat_messages m
  JOIN public.chat_members cm ON cm.conversation_id = m.conversation_id AND cm.user_id = _user_id
  WHERE m.conversation_id = _conversation_id
    AND m.sender_id != _user_id
    AND m.created_at > cm.last_read_at
    AND m.deleted_at IS NULL
$$;

-- Function to get total unread count for a user
CREATE OR REPLACE FUNCTION public.get_total_unread_count(_user_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(SUM(
    (SELECT COUNT(*)::INTEGER
     FROM public.chat_messages m
     WHERE m.conversation_id = cm.conversation_id
       AND m.sender_id != _user_id
       AND m.created_at > cm.last_read_at
       AND m.deleted_at IS NULL)
  ), 0)::INTEGER
  FROM public.chat_members cm
  WHERE cm.user_id = _user_id
    AND cm.muted = false
$$;

-- Function to find or create DM conversation
CREATE OR REPLACE FUNCTION public.find_or_create_dm(_user_a UUID, _user_b UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_conversation_id UUID;
BEGIN
  -- Find existing DM between these two users
  SELECT c.id INTO v_conversation_id
  FROM public.chat_conversations c
  WHERE c.type = 'dm'
    AND EXISTS (SELECT 1 FROM public.chat_members WHERE conversation_id = c.id AND user_id = _user_a)
    AND EXISTS (SELECT 1 FROM public.chat_members WHERE conversation_id = c.id AND user_id = _user_b)
  LIMIT 1;
  
  -- If not found, create new DM
  IF v_conversation_id IS NULL THEN
    INSERT INTO public.chat_conversations (type, created_by)
    VALUES ('dm', _user_a)
    RETURNING id INTO v_conversation_id;
    
    -- Add both users as members
    INSERT INTO public.chat_members (conversation_id, user_id, role)
    VALUES 
      (v_conversation_id, _user_a, 'owner'),
      (v_conversation_id, _user_b, 'member');
  END IF;
  
  RETURN v_conversation_id;
END;
$$;

-- Function to create group conversation
CREATE OR REPLACE FUNCTION public.create_group_conversation(_title TEXT, _member_ids UUID[], _created_by UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_conversation_id UUID;
  v_member_id UUID;
BEGIN
  -- Create the group
  INSERT INTO public.chat_conversations (type, title, created_by)
  VALUES ('group', _title, _created_by)
  RETURNING id INTO v_conversation_id;
  
  -- Add creator as owner
  INSERT INTO public.chat_members (conversation_id, user_id, role)
  VALUES (v_conversation_id, _created_by, 'owner');
  
  -- Add other members
  FOREACH v_member_id IN ARRAY _member_ids
  LOOP
    IF v_member_id != _created_by THEN
      INSERT INTO public.chat_members (conversation_id, user_id, role)
      VALUES (v_conversation_id, v_member_id, 'member')
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
  
  RETURN v_conversation_id;
END;
$$;

-- Trigger to update conversation on new message
CREATE OR REPLACE FUNCTION public.update_conversation_on_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.chat_conversations
  SET 
    updated_at = now(),
    last_message_at = NEW.created_at,
    last_message_preview = LEFT(NEW.content, 100)
  WHERE id = NEW.conversation_id;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_update_conversation_on_message
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_conversation_on_message();

-- =============================================
-- RLS POLICIES
-- =============================================

-- Enable RLS
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_read_receipts ENABLE ROW LEVEL SECURITY;

-- CONVERSATIONS POLICIES
CREATE POLICY "Users can view conversations they are members of"
  ON public.chat_conversations FOR SELECT
  USING (public.is_chat_member(public.get_my_profile_id(), id));

CREATE POLICY "Users can create conversations"
  ON public.chat_conversations FOR INSERT
  WITH CHECK (created_by = public.get_my_profile_id());

CREATE POLICY "Admins can update their conversations"
  ON public.chat_conversations FOR UPDATE
  USING (public.is_chat_admin(public.get_my_profile_id(), id));

-- MEMBERS POLICIES
CREATE POLICY "Users can view members of their conversations"
  ON public.chat_members FOR SELECT
  USING (public.is_chat_member(public.get_my_profile_id(), conversation_id));

CREATE POLICY "Admins can add members"
  ON public.chat_members FOR INSERT
  WITH CHECK (
    public.is_chat_admin(public.get_my_profile_id(), conversation_id)
    OR (
      -- Or the conversation was just created (for initial members)
      EXISTS (
        SELECT 1 FROM public.chat_conversations c
        WHERE c.id = conversation_id
          AND c.created_by = public.get_my_profile_id()
          AND c.created_at > now() - interval '5 seconds'
      )
    )
  );

CREATE POLICY "Admins can remove members"
  ON public.chat_members FOR DELETE
  USING (
    public.is_chat_admin(public.get_my_profile_id(), conversation_id)
    OR user_id = public.get_my_profile_id() -- Users can leave
  );

CREATE POLICY "Users can update their own membership"
  ON public.chat_members FOR UPDATE
  USING (user_id = public.get_my_profile_id());

-- MESSAGES POLICIES
CREATE POLICY "Users can view messages in their conversations"
  ON public.chat_messages FOR SELECT
  USING (public.is_chat_member(public.get_my_profile_id(), conversation_id));

CREATE POLICY "Members can send messages"
  ON public.chat_messages FOR INSERT
  WITH CHECK (
    sender_id = public.get_my_profile_id()
    AND public.is_chat_member(public.get_my_profile_id(), conversation_id)
  );

CREATE POLICY "Senders can edit their messages"
  ON public.chat_messages FOR UPDATE
  USING (sender_id = public.get_my_profile_id());

-- ATTACHMENTS POLICIES
CREATE POLICY "Users can view attachments in their conversations"
  ON public.chat_attachments FOR SELECT
  USING (public.is_chat_member(public.get_my_profile_id(), conversation_id));

CREATE POLICY "Members can upload attachments"
  ON public.chat_attachments FOR INSERT
  WITH CHECK (
    uploader_id = public.get_my_profile_id()
    AND public.is_chat_member(public.get_my_profile_id(), conversation_id)
  );

-- READ RECEIPTS POLICIES
CREATE POLICY "Users can view read receipts in their conversations"
  ON public.chat_read_receipts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_messages m
      WHERE m.id = message_id
        AND public.is_chat_member(public.get_my_profile_id(), m.conversation_id)
    )
  );

CREATE POLICY "Users can mark messages as read"
  ON public.chat_read_receipts FOR INSERT
  WITH CHECK (user_id = public.get_my_profile_id());

-- =============================================
-- REALTIME
-- =============================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_members;

-- =============================================
-- STORAGE BUCKET
-- =============================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-attachments', 'chat-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for chat attachments
CREATE POLICY "Members can view chat attachments"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'chat-attachments'
    AND EXISTS (
      SELECT 1 FROM public.chat_attachments ca
      WHERE ca.storage_path = name
        AND public.is_chat_member(public.get_my_profile_id(), ca.conversation_id)
    )
  );

CREATE POLICY "Members can upload chat attachments"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'chat-attachments'
    AND auth.uid() IS NOT NULL
  );

CREATE POLICY "Uploaders can delete their attachments"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'chat-attachments'
    AND EXISTS (
      SELECT 1 FROM public.chat_attachments ca
      WHERE ca.storage_path = name
        AND ca.uploader_id = public.get_my_profile_id()
    )
  );