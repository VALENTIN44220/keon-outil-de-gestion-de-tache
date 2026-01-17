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
  permission_profile_id?: string | null;
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
      // Use RPC function to bypass RLS and get all profiles for hierarchy
      const { data: members, error } = await supabase
        .rpc('get_all_profiles_for_hierarchy');

      if (error) {
        console.error('Error fetching profiles for hierarchy:', error);
        throw error;
      }
      if (!members || members.length === 0) {
        console.log('No members returned from get_all_profiles_for_hierarchy');
        return;
      }
      
      console.log('Fetched members count:', members.length);

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

      // Find direct managers (N+1, N+2, etc.) with circular reference protection
      const managersList: TeamMember[] = [];
      const visitedManagers = new Set<string>();

      let currentManager = enrichedMembers.find(m => m.id === profile.manager_id);
      while (currentManager) {
        // Break on cycles / self-manager / abnormal depth
        if (visitedManagers.has(currentManager.id)) break;
        visitedManagers.add(currentManager.id);

        managersList.push(currentManager);
        if (!currentManager.manager_id || currentManager.manager_id === currentManager.id) break;

        currentManager = enrichedMembers.find(m => m.id === currentManager.manager_id);
        if (managersList.length >= 50) break;
      }
      setManagers(managersList);

      // Find direct subordinates (all levels) with circular reference protection
      const findAllSubordinates = (managerId: string, visited: Set<string> = new Set()): TeamMember[] => {
        if (visited.has(managerId)) return []; // Prevent infinite loop
        visited.add(managerId);
        
        const direct = enrichedMembers.filter(m => m.manager_id === managerId && !visited.has(m.id));
        const all: TeamMember[] = [...direct];
        direct.forEach(sub => {
          all.push(...findAllSubordinates(sub.id, visited));
        });
        return all;
      };
      const userSubordinates = findAllSubordinates(profile.id);
      setSubordinates(userSubordinates);

      // Find peers (same manager)
      if (profile.manager_id) {
        const peersList = enrichedMembers.filter(
          m => m.manager_id === profile.manager_id && m.id !== profile.id
        );
        setPeers(peersList);
      }

      // Build hierarchy tree
      const buildTree = (member: TeamMember, membersPool: TeamMember[], visited: Set<string> = new Set()): HierarchyNode => {
        if (visited.has(member.id)) {
          // Return a node without subordinates to break the cycle
          return {
            ...member,
            subordinates: [],
            isCurrentUser: member.id === profile.id,
            relationToUser: 'other',
          };
        }
        visited.add(member.id);
        
        const isCurrentUser = member.id === profile.id;
        let relationToUser: HierarchyNode['relationToUser'] = 'other';
        
        if (isCurrentUser) {
          relationToUser = 'self';
        } else if (managersList.some(m => m.id === member.id)) {
          relationToUser = 'manager';
        } else if (userSubordinates.some(s => s.id === member.id)) {
          relationToUser = 'subordinate';
        } else if (profile.manager_id && member.manager_id === profile.manager_id) {
          relationToUser = 'peer';
        }

        const directSubs = membersPool.filter(m => m.manager_id === member.id && !visited.has(m.id));
        
        return {
          ...member,
          subordinates: directSubs.map(sub => buildTree(sub, membersPool, new Set(visited))),
          isCurrentUser,
          relationToUser,
        };
      };

      // Find root members (no manager or top of hierarchy)
      const enrichedMembersTyped = enrichedMembers as TeamMember[];
      
      // For admins with can_view_all_tasks, show everyone starting from root nodes
      // Get permission profile from the enriched members array instead of separate query
      const currentUserMember = members.find(m => m.id === profile.id) as TeamMember | undefined;

      let isAdmin = false;
      if (currentUserMember?.permission_profile_id) {
        const { data: userPermProfile } = await supabase
          .from('permission_profiles')
          .select('can_view_all_tasks')
          .eq('id', currentUserMember.permission_profile_id)
          .maybeSingle();

        isAdmin = !!userPermProfile?.can_view_all_tasks;
      }

      console.log('Is admin:', isAdmin, 'Permission profile:', currentUserMember?.permission_profile_id);
      if (isAdmin) {
        // Find all root members (those without manager or whose manager doesn't exist in the list)
        const rootMembers = enrichedMembersTyped.filter(m => 
          !m.manager_id || !enrichedMembersTyped.some(other => other.id === m.manager_id)
        );
        
        if (rootMembers.length > 0) {
          // Build a virtual root with all top-level members as subordinates
          const virtualRoot: HierarchyNode = {
            id: 'virtual-root',
            user_id: '',
            display_name: 'Organisation',
            avatar_url: null,
            job_title: null,
            job_title_id: null,
            department: null,
            department_id: null,
            company: null,
            company_id: null,
            manager_id: null,
            hierarchy_level_id: null,
            hierarchy_level: null,
            job_title_info: null,
            department_info: null,
            subordinates: rootMembers.map(m => buildTree(m, enrichedMembersTyped, new Set())),
            isCurrentUser: false,
            relationToUser: 'other',
          };
          setHierarchyTree(virtualRoot);
        }
      } else {
        // For non-admins, show their own hierarchy branch
        let rootMember: TeamMember | undefined = enrichedMembersTyped.find(m => m.id === profile.id);
        if (managersList.length > 0) {
          rootMember = managersList[managersList.length - 1];
        }
        
        if (rootMember) {
          setHierarchyTree(buildTree(rootMember, enrichedMembersTyped, new Set()));
        }
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
