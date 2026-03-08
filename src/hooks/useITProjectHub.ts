import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ITProject, ITProjectMilestone } from '@/types/itProject';
import { Task } from '@/types/task';
import { useAuth } from '@/contexts/AuthContext';
import { useRef, useCallback } from 'react';

export function useITProject(code: string | undefined) {
  return useQuery({
    queryKey: ['it-project', code],
    queryFn: async (): Promise<ITProject | null> => {
      if (!code) return null;
      const { data, error } = await supabase
        .from('it_projects')
        .select(`*, responsable_it:profiles!it_projects_responsable_it_id_fkey(id,display_name,avatar_url), chef_projet:profiles!it_projects_chef_projet_id_fkey(id,display_name,avatar_url), sponsor:profiles!it_projects_sponsor_id_fkey(id,display_name,avatar_url), entite:departments!it_projects_entite_id_fkey(id,name), chef_projet_metier:profiles!it_projects_chef_projet_metier_id_fkey(id,display_name,avatar_url), chef_projet_it:profiles!it_projects_chef_projet_it_id_fkey(id,display_name,avatar_url)`)
        .eq('code_projet_digital', code)
        .maybeSingle();
      if (error) throw error;
      return data as ITProject | null;
    },
    enabled: !!code,
  });
}

export function useITProjectTasks(projectId: string | undefined) {
  return useQuery({
    queryKey: ['it-project-tasks', projectId],
    queryFn: async (): Promise<Task[]> => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from('tasks')
        .select(`*, assignee:profiles!tasks_assignee_id_fkey(id,display_name,avatar_url), requester:profiles!tasks_requester_id_fkey(id,display_name,avatar_url)`)
        .eq('it_project_id', projectId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data as Task[]) || [];
    },
    enabled: !!projectId,
  });
}

export function useITProjectMilestones(projectId: string | undefined) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['it-project-milestones', projectId],
    queryFn: async (): Promise<ITProjectMilestone[]> => {
      if (!projectId) return [];
      const { data, error } = await supabase.from('it_project_milestones').select('*').eq('it_project_id', projectId).order('ordre', { ascending: true });
      if (error) throw error;
      return (data as ITProjectMilestone[]) || [];
    },
    enabled: !!projectId,
  });
  const addMilestone = async (milestone: Omit<ITProjectMilestone, 'id' | 'created_at' | 'updated_at'>) => {
    const { data, error } = await supabase.from('it_project_milestones').insert(milestone).select().single();
    if (error) throw error;
    queryClient.invalidateQueries({ queryKey: ['it-project-milestones', projectId] });
    return data as ITProjectMilestone;
  };
  const updateMilestone = async (id: string, updates: Partial<ITProjectMilestone>) => {
    const { data, error } = await supabase.from('it_project_milestones').update(updates).eq('id', id).select().single();
    if (error) throw error;
    queryClient.invalidateQueries({ queryKey: ['it-project-milestones', projectId] });
    return data as ITProjectMilestone;
  };
  const deleteMilestone = async (id: string) => {
    const { error } = await supabase.from('it_project_milestones').delete().eq('id', id);
    if (error) throw error;
    queryClient.invalidateQueries({ queryKey: ['it-project-milestones', projectId] });
  };
  return { ...query, addMilestone, updateMilestone, deleteMilestone };
}

export function useITProjectStats(tasks: Task[], project: ITProject | null | undefined) {
  const totalTasks = tasks.length;
  const doneTasks = tasks.filter(t => ['done', 'validated', 'closed'].includes(t.status)).length;
  const openTasks = totalTasks - doneTasks;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const overdueTasks = tasks.filter(t => {
    if (!t.due_date) return false;
    if (['done', 'validated', 'closed', 'cancelled'].includes(t.status)) return false;
    return new Date(t.due_date) < today;
  }).length;
  const progress = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
  const budgetRatio = project?.budget_previsionnel && project.budget_previsionnel > 0
    ? Math.round(((project.budget_consomme || 0) / project.budget_previsionnel) * 100)
    : null;
  return { totalTasks, openTasks, doneTasks, overdueTasks, progress, budgetRatio };
}

// =========== IT Project Conversations ===========
export interface ITProjectConversation {
  id: string;
  title: string | null;
  scope_type: string;
  scope_id: string | null;
  type: string;
  last_message_at: string | null;
  last_message_preview: string | null;
  unread_count: number;
  entity_name: string;
}

export function useITProjectConversations(projectId: string | undefined, taskIds: string[]) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const creatingRef = useRef(false);

  const query = useQuery({
    queryKey: ['it-project-conversations', projectId, taskIds.join(',')],
    queryFn: async (): Promise<ITProjectConversation[]> => {
      if (!projectId || !profile?.id) return [];

      const { data: projectConvs, error: projectError } = await supabase
        .from('chat_conversations')
        .select('*')
        .eq('scope_type', 'IT_PROJECT')
        .eq('scope_id', projectId);
      if (projectError) throw projectError;

      let taskConvs: any[] = [];
      if (taskIds.length > 0) {
        const { data, error } = await supabase
          .from('chat_conversations')
          .select('*')
          .eq('scope_type', 'TASK')
          .in('scope_id', taskIds);
        if (error) throw error;
        taskConvs = data || [];
      }

      const allConvs = [...(projectConvs || []), ...taskConvs];
      const results: ITProjectConversation[] = [];

      for (const conv of allConvs) {
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
          entity_name: conv.scope_type === 'IT_PROJECT' ? 'Général (Projet IT)' : (conv.title || 'Tâche'),
        });
      }

      return results;
    },
    enabled: !!projectId && !!profile?.id,
  });

  const ensureProjectConversation = useCallback(async (): Promise<string | null> => {
    if (!projectId || !profile?.id || creatingRef.current) return null;

    creatingRef.current = true;
    try {
      const { data: existing } = await supabase
        .from('chat_conversations')
        .select('id')
        .eq('scope_type', 'IT_PROJECT')
        .eq('scope_id', projectId)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('chat_members')
          .upsert({ conversation_id: existing.id, user_id: profile.id, role: 'member' }, { onConflict: 'conversation_id,user_id' });
        return existing.id;
      }

      const { data: projectData } = await supabase
        .from('it_projects')
        .select('code_projet_digital, nom_projet')
        .eq('id', projectId)
        .maybeSingle();

      const title = projectData
        ? `Projet IT ${projectData.code_projet_digital} — ${projectData.nom_projet}`
        : 'Discussion projet IT';

      const { data: newConv, error } = await supabase
        .from('chat_conversations')
        .insert({ scope_type: 'IT_PROJECT', scope_id: projectId, type: 'group', title, created_by: profile.id })
        .select()
        .single();

      if (error) throw error;

      await supabase
        .from('chat_members')
        .insert({ conversation_id: newConv.id, user_id: profile.id, role: 'owner' });

      queryClient.invalidateQueries({ queryKey: ['it-project-conversations'] });
      return newConv.id;
    } catch (error) {
      console.error('Error ensuring IT project conversation:', error);
      return null;
    } finally {
      creatingRef.current = false;
    }
  }, [projectId, profile?.id, queryClient]);

  return { ...query, ensureProjectConversation };
}

// =========== IT Project Files ===========
export interface ITProjectFile {
  id: string;
  file_name: string;
  file_path?: string;
  storage_path?: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
  uploader_id: string;
  source: 'task' | 'chat';
  source_entity_id: string;
  source_entity_name: string;
}

export function useITProjectFiles(
  projectId: string | undefined,
  taskIds: string[],
  conversationIds: string[]
) {
  return useQuery({
    queryKey: ['it-project-files', projectId, taskIds.join(','), conversationIds.join(',')],
    queryFn: async (): Promise<ITProjectFile[]> => {
      if (!projectId) return [];

      const files: ITProjectFile[] = [];

      if (taskIds.length > 0) {
        const { data: taskAttachments, error } = await supabase
          .from('task_attachments')
          .select('id, name, url, type, uploaded_by, created_at, task_id, task:tasks(id, title, task_number)')
          .in('task_id', taskIds);
        if (error) throw error;

        for (const att of taskAttachments || []) {
          files.push({
            id: att.id,
            file_name: att.name,
            file_path: att.url,
            mime_type: att.type || 'application/octet-stream',
            size_bytes: 0,
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

      if (conversationIds.length > 0) {
        const { data: chatAttachments, error } = await supabase
          .from('chat_attachments')
          .select('id, file_name, storage_path, mime_type, size_bytes, created_at, uploader_id, conversation_id, conversation:chat_conversations(id, title, scope_type)')
          .in('conversation_id', conversationIds);
        if (error) throw error;

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
            source_entity_name: (att.conversation as any)?.scope_type === 'IT_PROJECT'
              ? 'Discussion projet IT'
              : (att.conversation as any)?.title || 'Discussion',
          });
        }
      }

      files.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      return files;
    },
    enabled: !!projectId,
  });
}
