import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { BEProject } from '@/types/beProject';
import { Task } from '@/types/task';
import { useRef, useCallback } from 'react';

// =========== useBEProjectByCode ===========
export function useBEProjectByCode(code: string | undefined) {
  return useQuery({
    queryKey: ['be-project', code],
    queryFn: async () => {
      if (!code) throw new Error('Code projet manquant');
      
      const { data, error } = await supabase
        .from('be_projects')
        .select('*')
        .eq('code_projet', code)
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error(`Projet non trouvé: ${code}`);
      
      return data as BEProject;
    },
    enabled: !!code,
  });
}

// =========== useBEProjectTasks ===========
// Fetches all tasks linked to a project: direct (be_project_id) + child tasks (parent_request_id)
export function useBEProjectTasks(projectId: string | undefined) {
  return useQuery({
    queryKey: ['be-project-tasks', projectId],
    queryFn: async () => {
      if (!projectId) return [];

      // 1. Get direct project tasks (requests + tasks with be_project_id)
      const { data: directTasks, error: directError } = await supabase
        .from('tasks')
        .select(`
          *,
          assignee:profiles!tasks_assignee_id_fkey(id, display_name, avatar_url),
          requester:profiles!tasks_requester_id_fkey(id, display_name)
        `)
        .eq('be_project_id', projectId)
        .order('created_at', { ascending: false });

      if (directError) throw directError;

      const allTasks = [...(directTasks || [])] as Task[];
      
      // 2. Get child tasks of requests (they may not have be_project_id set)
      const requestIds = allTasks.filter(t => t.type === 'request').map(t => t.id);
      
      if (requestIds.length > 0) {
        const { data: childTasks, error: childError } = await supabase
          .from('tasks')
          .select(`
            *,
            assignee:profiles!tasks_assignee_id_fkey(id, display_name, avatar_url),
            requester:profiles!tasks_requester_id_fkey(id, display_name)
          `)
          .in('parent_request_id', requestIds)
          .order('created_at', { ascending: false });

        if (childError) throw childError;

        // Add child tasks that aren't already in the list
        const existingIds = new Set(allTasks.map(t => t.id));
        for (const child of (childTasks || [])) {
          if (!existingIds.has(child.id)) {
            allTasks.push(child as Task);
          }
        }
      }

      return allTasks;
    },
    enabled: !!projectId,
  });
}

// =========== useBEProjectStats ===========
export function useBEProjectStats(projectId: string | undefined, tasks: Task[]) {
  const totalTasks = tasks.length;
  const doneTasks = tasks.filter(t => ['done', 'validated', 'closed'].includes(t.status)).length;
  const openTasks = totalTasks - doneTasks;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const overdueTasks = tasks.filter(t => {
    if (!t.due_date) return false;
    if (['done', 'validated', 'closed', 'cancelled'].includes(t.status)) return false;
    return new Date(t.due_date) < today;
  }).length;

  // Calculate progress (simple weighted average)
  const progress = totalTasks > 0 
    ? Math.round((doneTasks / totalTasks) * 100)
    : 0;

  return { totalTasks, openTasks, doneTasks, overdueTasks, progress };
}

// =========== useBEProjectConversations ===========
export interface ProjectConversation {
  id: string;
  title: string | null;
  scope_type: string;
  scope_id: string | null;
  type: string;
  last_message_at: string | null;
  last_message_preview: string | null;
  unread_count: number;
  entity_name: string; // "Général" or task title
}

export function useBEProjectConversations(projectId: string | undefined, taskIds: string[]) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const creatingRef = useRef(false);

  const query = useQuery({
    queryKey: ['be-project-conversations', projectId, taskIds.join(',')],
    queryFn: async (): Promise<ProjectConversation[]> => {
      if (!projectId || !profile?.id) return [];

      // 1. Get project-level conversation
      const { data: projectConvs, error: projectError } = await supabase
        .from('chat_conversations')
        .select('*')
        .eq('scope_type', 'BE_PROJECT')
        .eq('scope_id', projectId);

      if (projectError) throw projectError;

      // 2. Get task-level conversations if there are tasks
      let taskConvs: any[] = [];
      if (taskIds.length > 0) {
        const { data: taskConvsData, error: taskError } = await supabase
          .from('chat_conversations')
          .select('*')
          .eq('scope_type', 'TASK')
          .in('scope_id', taskIds);

        if (taskError) throw taskError;
        taskConvs = taskConvsData || [];
      }

      const allConvs = [...(projectConvs || []), ...taskConvs];
      
      // Calculate unread counts for each conversation
      const results: ProjectConversation[] = [];
      
      for (const conv of allConvs) {
        // Check if user is a member
        const { data: membership } = await supabase
          .from('chat_members')
          .select('last_read_at')
          .eq('conversation_id', conv.id)
          .eq('user_id', profile.id)
          .maybeSingle();

        let unreadCount = 0;
        if (membership) {
          const { count } = await supabase
            .from('chat_messages')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', conv.id)
            .neq('sender_id', profile.id)
            .gt('created_at', membership.last_read_at)
            .is('deleted_at', null);
          
          unreadCount = count || 0;
        }

        results.push({
          id: conv.id,
          title: conv.title,
          scope_type: conv.scope_type,
          scope_id: conv.scope_id,
          type: conv.type,
          last_message_at: conv.last_message_at,
          last_message_preview: conv.last_message_preview,
          unread_count: unreadCount,
          entity_name: conv.scope_type === 'BE_PROJECT' ? 'Général (Projet)' : (conv.title || 'Tâche'),
        });
      }

      return results;
    },
    enabled: !!projectId && !!profile?.id,
  });

  // Ensure project conversation exists
  const ensureProjectConversation = useCallback(async (): Promise<string | null> => {
    if (!projectId || !profile?.id || creatingRef.current) return null;

    creatingRef.current = true;
    try {
      // Check if exists
      const { data: existing } = await supabase
        .from('chat_conversations')
        .select('id')
        .eq('scope_type', 'BE_PROJECT')
        .eq('scope_id', projectId)
        .maybeSingle();

      if (existing) {
        // Ensure user is member
        await supabase
          .from('chat_members')
          .upsert({
            conversation_id: existing.id,
            user_id: profile.id,
            role: 'member',
          }, { onConflict: 'conversation_id,user_id' });
        
        return existing.id;
      }

      // Create new conversation
      const { data: projectData } = await supabase
        .from('be_projects')
        .select('code_projet, nom_projet')
        .eq('id', projectId)
        .maybeSingle();

      const title = projectData 
        ? `Projet ${projectData.code_projet} — ${projectData.nom_projet}`
        : 'Discussion projet';

      const { data: newConv, error } = await supabase
        .from('chat_conversations')
        .insert({
          scope_type: 'BE_PROJECT',
          scope_id: projectId,
          type: 'group',
          title,
          created_by: profile.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Add user as owner
      await supabase
        .from('chat_members')
        .insert({
          conversation_id: newConv.id,
          user_id: profile.id,
          role: 'owner',
        });

      queryClient.invalidateQueries({ queryKey: ['be-project-conversations'] });
      return newConv.id;
    } catch (error) {
      console.error('Error ensuring project conversation:', error);
      return null;
    } finally {
      creatingRef.current = false;
    }
  }, [projectId, profile?.id, queryClient]);

  return {
    ...query,
    ensureProjectConversation,
  };
}

// =========== useBEProjectFiles ===========
export interface ProjectFile {
  id: string;
  file_name: string;
  file_path?: string;
  storage_path?: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
  uploader_id: string;
  uploader_name?: string;
  source: 'task' | 'chat';
  source_entity_id: string;
  source_entity_name: string;
}

export function useBEProjectFiles(
  projectId: string | undefined,
  taskIds: string[],
  conversationIds: string[]
) {
  return useQuery({
    queryKey: ['be-project-files', projectId, taskIds.join(','), conversationIds.join(',')],
    queryFn: async (): Promise<ProjectFile[]> => {
      if (!projectId) return [];

      const files: ProjectFile[] = [];

      // 1. Get task attachments
      if (taskIds.length > 0) {
        const { data: taskAttachments, error: taskError } = await supabase
          .from('task_attachments')
          .select(`
            id,
            name,
            url,
            type,
            uploaded_by,
            created_at,
            task_id,
            task:tasks(id, title, task_number)
          `)
          .in('task_id', taskIds);

        if (taskError) throw taskError;

        for (const att of taskAttachments || []) {
          files.push({
            id: att.id,
            file_name: att.name,
            file_path: att.url,
            mime_type: att.type || 'application/octet-stream',
            size_bytes: 0, // Not stored in this table
            created_at: att.created_at,
            uploader_id: att.uploaded_by,
            source: 'task',
            source_entity_id: att.task_id,
            source_entity_name: (att.task as any)?.task_number 
              ? `${(att.task as any).task_number} — ${(att.task as any).title}`
              : (att.task as any)?.title || 'Tâche',
          });
        }
      }

      // 2. Get chat attachments
      if (conversationIds.length > 0) {
        const { data: chatAttachments, error: chatError } = await supabase
          .from('chat_attachments')
          .select(`
            id,
            file_name,
            storage_path,
            mime_type,
            size_bytes,
            created_at,
            uploader_id,
            conversation_id,
            conversation:chat_conversations(id, title, scope_type)
          `)
          .in('conversation_id', conversationIds);

        if (chatError) throw chatError;

        for (const att of chatAttachments || []) {
          files.push({
            id: att.id,
            file_name: att.file_name,
            storage_path: att.storage_path,
            mime_type: att.mime_type,
            size_bytes: att.size_bytes,
            created_at: att.created_at,
            uploader_id: att.uploader_id,
            source: 'chat',
            source_entity_id: att.conversation_id,
            source_entity_name: (att.conversation as any)?.scope_type === 'BE_PROJECT'
              ? 'Discussion projet'
              : (att.conversation as any)?.title || 'Discussion',
          });
        }
      }

      // Sort by date descending
      files.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      return files;
    },
    enabled: !!projectId,
  });
}

// =========== useBEProjectRecentActivity ===========
export interface RecentActivity {
  id: string;
  type: 'comment' | 'message' | 'file';
  content: string;
  created_at: string;
  author_name: string;
  entity_name: string;
}

export function useBEProjectRecentActivity(projectId: string | undefined, taskIds: string[]) {
  return useQuery({
    queryKey: ['be-project-activity', projectId, taskIds.join(',')],
    queryFn: async (): Promise<RecentActivity[]> => {
      if (!projectId) return [];

      const activities: RecentActivity[] = [];

      // 1. Get recent task comments
      if (taskIds.length > 0) {
        const { data: comments } = await supabase
          .from('task_comments')
          .select(`
            id,
            content,
            created_at,
            user:profiles!task_comments_user_id_fkey(display_name),
            task:tasks(title, task_number)
          `)
          .in('task_id', taskIds)
          .order('created_at', { ascending: false })
          .limit(10);

        for (const c of comments || []) {
          activities.push({
            id: c.id,
            type: 'comment',
            content: c.content || '',
            created_at: c.created_at,
            author_name: (c.user as any)?.display_name || 'Utilisateur',
            entity_name: (c.task as any)?.task_number 
              ? `${(c.task as any).task_number}`
              : 'Tâche',
          });
        }
      }

      // 2. Get recent chat messages from project conversation
      const { data: projectConv } = await supabase
        .from('chat_conversations')
        .select('id')
        .eq('scope_type', 'BE_PROJECT')
        .eq('scope_id', projectId)
        .maybeSingle();

      if (projectConv) {
        const { data: messages } = await supabase
          .from('chat_messages')
          .select(`
            id,
            content,
            created_at,
            sender:profiles!chat_messages_sender_id_fkey(display_name)
          `)
          .eq('conversation_id', projectConv.id)
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(10);

        for (const m of messages || []) {
          activities.push({
            id: m.id,
            type: 'message',
            content: m.content || '',
            created_at: m.created_at,
            author_name: (m.sender as any)?.display_name || 'Utilisateur',
            entity_name: 'Discussion projet',
          });
        }
      }

      // Sort by date and take top 15
      activities.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      return activities.slice(0, 15);
    },
    enabled: !!projectId,
  });
}
