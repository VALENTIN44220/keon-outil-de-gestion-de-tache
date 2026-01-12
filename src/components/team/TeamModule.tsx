import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TeamHierarchyView } from './TeamHierarchyView';
import { TeamWorkloadView } from './TeamWorkloadView';
import { Users, BarChart3 } from 'lucide-react';

export function TeamModule() {
  const [activeTab, setActiveTab] = useState('hierarchy');

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="hierarchy" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Organigramme
          </TabsTrigger>
          <TabsTrigger value="workload" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Charge de travail
          </TabsTrigger>
        </TabsList>

        <TabsContent value="hierarchy" className="mt-6">
          <TeamHierarchyView />
        </TabsContent>

        <TabsContent value="workload" className="mt-6">
          <TeamWorkloadView />
        </TabsContent>
      </Tabs>
    </div>
  );
}
