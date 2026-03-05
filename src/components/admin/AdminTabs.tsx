import { useCallback, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Building2, Briefcase, Users, Layers, Shield, UserCog, Download,
  UsersRound, UserRoundCog, Workflow, Database,
  FolderKanban, Tags, MonitorSmartphone
} from 'lucide-react';
import { CompaniesTab } from './CompaniesTab';
import { DepartmentsTab } from './DepartmentsTab';
import { JobTitlesTab } from './JobTitlesTab';
import { HierarchyLevelsTab } from './HierarchyLevelsTab';
import { AccessRightsTab } from './AccessRightsTab'; // ← NOUVEAU (remplace les 3 ci-dessous)
// import { PermissionProfilesTab } from './PermissionProfilesTab'; // ← SUPPRIMÉ
// import { PermissionMatrixTab } from './PermissionMatrixTab';     // ← SUPPRIMÉ
// import { UserPermissionViewerTab } from './UserPermissionViewerTab'; // ← SUPPRIMÉ
import { UsersTab } from './UsersTab';
import { DataExportTab } from './DataExportTab';
import { CollaboratorGroupsTab } from './CollaboratorGroupsTab';

import { DatabaseResetDialog } from './DatabaseResetDialog';
import { UserSimulationSelector } from './UserSimulationSelector';
import { StandardWorkflowConfigTab } from './StandardWorkflowConfigTab';
import { TableLookupConfigTab } from './TableLookupConfigTab';
import { ServiceGroupsTab } from './ServiceGroupsTab';
import { CategoriesManagementTab } from './CategoriesManagementTab';
import { PageDeviceVisibilityTab } from './PageDeviceVisibilityTab';
import type { Company, Department, JobTitle, HierarchyLevel, PermissionProfile, UserProfile } from '@/types/admin';

interface AdminTabsProps {
  companies: Company[];
  departments: Department[];
  jobTitles: JobTitle[];
  hierarchyLevels: HierarchyLevel[];
  permissionProfiles: PermissionProfile[];
  users: UserProfile[];
  refetch: () => void;
  addCompany: (name: string, description?: string) => Promise<Company>;
  updateCompany: (id: string, name: string, description?: string) => Promise<Company>;
  deleteCompany: (id: string) => Promise<void>;
  addDepartment: (name: string, company_id?: string, description?: string) => Promise<Department>;
  updateDepartment: (id: string, name: string, company_id?: string, description?: string) => Promise<Department>;
  deleteDepartment: (id: string) => Promise<void>;
  addJobTitle: (name: string, department_id?: string, description?: string) => Promise<JobTitle>;
  updateJobTitle: (id: string, name: string, department_id?: string, description?: string) => Promise<JobTitle>;
  deleteJobTitle: (id: string) => Promise<void>;
  addHierarchyLevel: (name: string, level: number, description?: string) => Promise<HierarchyLevel>;
  updateHierarchyLevel: (id: string, name: string, level: number, description?: string) => Promise<HierarchyLevel>;
  deleteHierarchyLevel: (id: string) => Promise<void>;
  addPermissionProfile: (profile: Omit<PermissionProfile, 'id' | 'created_at' | 'updated_at'>) => Promise<PermissionProfile>;
  updatePermissionProfile: (id: string, profile: Partial<Omit<PermissionProfile, 'id' | 'created_at' | 'updated_at'>>) => Promise<PermissionProfile>;
  deletePermissionProfile: (id: string) => Promise<void>;
}

export function AdminTabs(props: AdminTabsProps) {
  const [activeTab, setActiveTab] = useState('users');

  const handleTabChange = useCallback((next: string) => {
    setActiveTab((prev) => (prev === next ? prev : next));
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <DatabaseResetDialog onReset={props.refetch} />
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList className="h-auto p-1 flex flex-wrap justify-start">

          {/* ── Organisation ── */}
          <TabsTrigger value="users" className="px-2 py-1.5" title="Utilisateurs">
            <UserCog className="h-4 w-4" />
          </TabsTrigger>
          <TabsTrigger value="groups" className="px-2 py-1.5" title="Groupes">
            <UsersRound className="h-4 w-4" />
          </TabsTrigger>
          <TabsTrigger value="companies" className="px-2 py-1.5" title="Sociétés">
            <Building2 className="h-4 w-4" />
          </TabsTrigger>
          <TabsTrigger value="departments" className="px-2 py-1.5" title="Services">
            <Briefcase className="h-4 w-4" />
          </TabsTrigger>
          <TabsTrigger value="service-groups" className="px-2 py-1.5" title="Groupes de services">
            <FolderKanban className="h-4 w-4" />
          </TabsTrigger>
          <TabsTrigger value="job-titles" className="px-2 py-1.5" title="Postes">
            <Users className="h-4 w-4" />
          </TabsTrigger>
          <TabsTrigger value="hierarchy" className="px-2 py-1.5" title="Hiérarchie">
            <Layers className="h-4 w-4" />
          </TabsTrigger>

          {/* ── Droits (1 seul onglet au lieu de 3) ── */}
          <TabsTrigger value="access-rights" className="px-2 py-1.5" title="Droits & Accès">
            <Shield className="h-4 w-4" />
          </TabsTrigger>

          {/* ── Outils ── */}
          <TabsTrigger value="export" className="px-2 py-1.5" title="Export de données">
            <Download className="h-4 w-4" />
          </TabsTrigger>
          <TabsTrigger value="simulation" className="px-2 py-1.5" title="Simulation utilisateur">
            <UserRoundCog className="h-4 w-4" />
          </TabsTrigger>
          <TabsTrigger value="workflow-migration" className="px-2 py-1.5" title="Workflow Standard">
            <Workflow className="h-4 w-4" />
          </TabsTrigger>
          <TabsTrigger value="table-lookup" className="px-2 py-1.5" title="Champs table">
            <Database className="h-4 w-4" />
          </TabsTrigger>
          <TabsTrigger value="categories" className="px-2 py-1.5" title="Catégories">
            <Tags className="h-4 w-4" />
          </TabsTrigger>
          <TabsTrigger value="device-visibility" className="px-2 py-1.5" title="Visibilité par appareil">
            <MonitorSmartphone className="h-4 w-4" />
          </TabsTrigger>

        </TabsList>

        {/* ── Contenu des onglets ── */}

        <TabsContent value="users">
          <UsersTab
            users={props.users}
            companies={props.companies}
            departments={props.departments}
            jobTitles={props.jobTitles}
            hierarchyLevels={props.hierarchyLevels}
            permissionProfiles={props.permissionProfiles}
            onUserCreated={props.refetch}
            onUserUpdated={props.refetch}
            onRefresh={props.refetch}
          />
        </TabsContent>

        <TabsContent value="groups">
          <CollaboratorGroupsTab
            companies={props.companies}
            departments={props.departments}
            users={props.users}
            onRefresh={props.refetch}
          />
        </TabsContent>

        <TabsContent value="companies">
          <CompaniesTab
            companies={props.companies}
            onAdd={props.addCompany}
            onUpdate={props.updateCompany}
            onDelete={props.deleteCompany}
            onRefresh={props.refetch}
          />
        </TabsContent>

        <TabsContent value="departments">
          <DepartmentsTab
            departments={props.departments}
            companies={props.companies}
            onAdd={props.addDepartment}
            onUpdate={props.updateDepartment}
            onDelete={props.deleteDepartment}
            onRefresh={props.refetch}
          />
        </TabsContent>

        <TabsContent value="service-groups">
          <ServiceGroupsTab departments={props.departments} />
        </TabsContent>

        <TabsContent value="job-titles">
          <JobTitlesTab
            jobTitles={props.jobTitles}
            departments={props.departments}
            companies={props.companies}
            onAdd={props.addJobTitle}
            onUpdate={props.updateJobTitle}
            onDelete={props.deleteJobTitle}
            onRefresh={props.refetch}
          />
        </TabsContent>

        <TabsContent value="hierarchy">
          <HierarchyLevelsTab
            hierarchyLevels={props.hierarchyLevels}
            onAdd={props.addHierarchyLevel}
            onUpdate={props.updateHierarchyLevel}
            onDelete={props.deleteHierarchyLevel}
            onRefresh={props.refetch}
          />
        </TabsContent>

        {/* ── Onglet unifié Droits & Accès ── */}
        <TabsContent value="access-rights">
          <AccessRightsTab
            permissionProfiles={props.permissionProfiles}
            users={props.users}
            onAdd={props.addPermissionProfile}
            onUpdate={props.updatePermissionProfile}
            onDelete={props.deletePermissionProfile}
            onRefresh={props.refetch}
          />
        </TabsContent>

        <TabsContent value="export">
          <DataExportTab />
        </TabsContent>


        <TabsContent value="simulation">
          <div className="max-w-lg">
            <UserSimulationSelector />
          </div>
        </TabsContent>

        <TabsContent value="workflow-migration">
          <StandardWorkflowConfigTab />
        </TabsContent>

        <TabsContent value="table-lookup">
          <TableLookupConfigTab />
        </TabsContent>

        <TabsContent value="categories">
          <CategoriesManagementTab />
        </TabsContent>

        <TabsContent value="device-visibility">
          <PageDeviceVisibilityTab />
        </TabsContent>

      </Tabs>
    </div>
  );
}
