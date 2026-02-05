// Chat Module Types

export interface ChatConversation {
  id: string;
  scope_type: 'global' | 'company' | 'department' | 'project';
  scope_id: string | null;
  type: 'dm' | 'group';
  title: string | null;
  avatar_url: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  last_message_at: string | null;
  last_message_preview: string | null;
}

export interface ChatMember {
  id: string;
  conversation_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member';
  joined_at: string;
  last_read_at: string;
  muted: boolean;
  // Joined data
  profile?: {
    id: string;
    display_name: string | null;
    avatar_url: string | null;
    job_title: string | null;
  };
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string | null;
  message_type: 'text' | 'file' | 'system';
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
  reply_to_message_id: string | null;
  // Joined data
  sender?: {
    id: string;
    display_name: string | null;
    avatar_url: string | null;
  };
  attachments?: ChatAttachment[];
  reply_to?: ChatMessage | null;
}

export interface ChatAttachment {
  id: string;
  message_id: string;
  conversation_id: string;
  uploader_id: string;
  storage_bucket: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
}

export interface ChatReadReceipt {
  id: string;
  message_id: string;
  user_id: string;
  read_at: string;
}

export interface ConversationWithDetails extends ChatConversation {
  members: ChatMember[];
  unread_count: number;
}

export interface SendMessageParams {
  conversation_id: string;
  content: string | null;
  message_type?: 'text' | 'file' | 'system';
  attachments?: File[];
  reply_to_message_id?: string;
}

export interface CreateGroupParams {
  title: string;
  member_ids: string[];
}
