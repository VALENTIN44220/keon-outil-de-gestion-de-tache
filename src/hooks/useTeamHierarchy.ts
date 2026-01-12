import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface TeamMember {
  id: string;
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  job_title: string | null;
  job_title_id: string | null;
  department: string | null;
  department_id: string | null;
  company: string | null;
  company_id: string | null;
  manager_id: string | null;
  hierarchy_level_id: string | null;
  hierarchy_level?: {
    id: string;
    name: string;
    level: number;
  } | null;
  job_title_info?: {
    id: string;
    name: string;
  } | null;
  department_info?: {
    id: string;
    name: string;
  } | null;
}

export interface HierarchyNode extends TeamMember {
  subordinates: HierarchyNode[];
  isCurrentUser: boolean;
  relationToUser: 'self' | 'manager' | 'subordinate' | 'peer' | 'other';
}

export function useTeamHierarchy() {
  const { profile, user } = useAuth();
  const [allMembers, setAllMembers] = useState<TeamMember[]>([]);
  const [hierarchyTree, setHierarchyTree] = useState<HierarchyNode | null>(null);
  const [managers, setManagers] = useState<TeamMember[]>([]);
  const [subordinates, setSubordinates] = useState<TeamMember[]>([]);
  const [peers, setPeers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!profile?.id) return;
    fetchTeamData();
  }, [profile?.id]);

  const fetchTeamData = async () => {
    if (!profile?.id) return;
    
    setIsLoading(true);
    try {
      // Fetch all profiles from same company
      const { data: members, error } = await supabase
        .from('profiles')
        .select(`
          id,
          user_id,
          display_name,
          avatar_url,
          job_title,
          job_title_id,
          department,
          department_id,
          company,
          company_id,
          manager_id,
          hierarchy_level_id
        `);

      if (error) throw error;
      if (!members) return;

      // Fetch hierarchy levels
      const { data: levels } = await supabase
        .from('hierarchy_levels')
        .select('id, name, level');

      // Fetch job titles
      const { data: jobTitles } = await supabase
        .from('job_titles')
        .select('id, name');

      // Fetch departments
      const { data: departments } = await supabase
        .from('departments')
        .select('id, name');

      // Enrich members with related data
      const enrichedMembers = members.map(m => ({
        ...m,
        hierarchy_level: levels?.find(l => l.id === m.hierarchy_level_id) || null,
        job_title_info: jobTitles?.find(j => j.id === m.job_title_id) || null,
        department_info: departments?.find(d => d.id === m.department_id) || null,
      }));

      setAllMembers(enrichedMembers);

      // Find direct managers (N+1, N+2, etc.)
      const managersList: TeamMember[] = [];
      let currentManager = enrichedMembers.find(m => m.id === profile.manager_id);
      while (currentManager) {
        managersList.push(currentManager);
        currentManager = enrichedMembers.find(m => m.id === currentManager?.manager_id);
      }
      setManagers(managersList);

      // Find direct subordinates (all levels)
      const findAllSubordinates = (managerId: string): TeamMember[] => {
        const direct = enrichedMembers.filter(m => m.manager_id === managerId);
        const all: TeamMember[] = [...direct];
        direct.forEach(sub => {
          all.push(...findAllSubordinates(sub.id));
        });
        return all;
      };
      setSubordinates(findAllSubordinates(profile.id));

      // Find peers (same manager)
      if (profile.manager_id) {
        const peersList = enrichedMembers.filter(
          m => m.manager_id === profile.manager_id && m.id !== profile.id
        );
        setPeers(peersList);
      }

      // Build hierarchy tree
      const buildTree = (member: TeamMember, membersPool: TeamMember[]): HierarchyNode => {
        const isCurrentUser = member.id === profile.id;
        let relationToUser: HierarchyNode['relationToUser'] = 'other';
        
        if (isCurrentUser) {
          relationToUser = 'self';
        } else if (managersList.some(m => m.id === member.id)) {
          relationToUser = 'manager';
        } else if (subordinates.some(s => s.id === member.id) || findAllSubordinates(profile.id).some(s => s.id === member.id)) {
          relationToUser = 'subordinate';
        } else if (profile.manager_id && member.manager_id === profile.manager_id) {
          relationToUser = 'peer';
        }

        const directSubs = membersPool.filter(m => m.manager_id === member.id);
        
        return {
          ...member,
          subordinates: directSubs.map(sub => buildTree(sub, membersPool)),
          isCurrentUser,
          relationToUser,
        };
      };

      // Find root (top manager in user's hierarchy)
      const enrichedMembersTyped = enrichedMembers as TeamMember[];
      let rootMember: TeamMember | undefined = enrichedMembersTyped.find(m => m.id === profile.id);
      if (managersList.length > 0) {
        rootMember = managersList[managersList.length - 1];
      }
      
      if (rootMember) {
        setHierarchyTree(buildTree(rootMember, enrichedMembersTyped));
      }

    } catch (error) {
      console.error('Error fetching team hierarchy:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    allMembers,
    hierarchyTree,
    managers,
    subordinates,
    peers,
    isLoading,
    refetch: fetchTeamData,
  };
}
