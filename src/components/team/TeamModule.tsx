import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TeamHierarchyView } from './TeamHierarchyView';
import { OrganizationChartView } from './OrganizationChartView';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Users, Network } from 'lucide-react';

export function TeamModule() {
  const { profile } = useAuth();
  const [canViewOrgChart, setCanViewOrgChart] = useState(false);
  const [activeTab, setActiveTab] = useState('hierarchy');

  useEffect(() => {
    const checkPermissions = async () => {
      if (!profile?.id) return;

      // Check if user is admin
      const { data: isAdmin } = await supabase
        .from('user_roles')
        .select('id')
        .eq('user_id', profile.user_id)
        .eq('role', 'admin')
        .maybeSingle();

      if (isAdmin) {
        setCanViewOrgChart(true);
        return;
      }

      // Check if user has can_view_all_tasks permission (direction level)
      const { data: permProfile } = await supabase
        .from('permission_profiles')
        .select('can_view_all_tasks')
        .eq('id', profile.permission_profile_id || '')
        .maybeSingle();

      if (permProfile?.can_view_all_tasks) {
        setCanViewOrgChart(true);
      }
    };

    checkPermissions();
  }, [profile?.id, profile?.user_id, profile?.permission_profile_id]);

  return (
    <div className="space-y-6">
      {canViewOrgChart ? (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2 lg:w-auto lg:inline-grid">
            <TabsTrigger value="hierarchy" className="gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Mon équipe</span>
            </TabsTrigger>
            <TabsTrigger value="organization" className="gap-2">
              <Network className="h-4 w-4" />
              <span className="hidden sm:inline">Organigramme complet</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="hierarchy" className="mt-4">
            <TeamHierarchyView />
          </TabsContent>

          <TabsContent value="organization" className="mt-4">
            <OrganizationChartView />
          </TabsContent>
        </Tabs>
      ) : (
        <TeamHierarchyView />
      )}
    </div>
  );
}
