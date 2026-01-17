import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Building2, Briefcase, Users, Layers, Shield, UserCog, Route, FolderTree, Download, FolderSync, UsersRound, CloudUpload } from 'lucide-react';
import { CompaniesTab } from './CompaniesTab';
import { DepartmentsTab } from './DepartmentsTab';
import { JobTitlesTab } from './JobTitlesTab';
import { HierarchyLevelsTab } from './HierarchyLevelsTab';
import { PermissionProfilesTab } from './PermissionProfilesTab';
import { UsersTab } from './UsersTab';
import { AssignmentRulesTab } from './AssignmentRulesTab';
import { CategoriesProcessTab } from './CategoriesProcessTab';
import { DataExportTab } from './DataExportTab';
import { GovernanceSyncTab } from './GovernanceSyncTab';
import { CollaboratorGroupsTab } from './CollaboratorGroupsTab';
import { FabricLakehouseSyncTab } from './FabricLakehouseSyncTab';
import { DatabaseResetDialog } from './DatabaseResetDialog';
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

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <DatabaseResetDialog onReset={props.refetch} />
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-12">
          <TabsTrigger value="users" className="flex items-center gap-2">
            <UserCog className="h-4 w-4" />
            <span className="hidden sm:inline">Utilisateurs</span>
          </TabsTrigger>
          <TabsTrigger value="groups" className="flex items-center gap-2">
            <UsersRound className="h-4 w-4" />
            <span className="hidden sm:inline">Groupes</span>
          </TabsTrigger>
          <TabsTrigger value="companies" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            <span className="hidden sm:inline">Sociétés</span>
          </TabsTrigger>
          <TabsTrigger value="departments" className="flex items-center gap-2">
            <Briefcase className="h-4 w-4" />
            <span className="hidden sm:inline">Services</span>
          </TabsTrigger>
          <TabsTrigger value="job-titles" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Postes</span>
          </TabsTrigger>
          <TabsTrigger value="hierarchy" className="flex items-center gap-2">
            <Layers className="h-4 w-4" />
            <span className="hidden sm:inline">Hiérarchie</span>
          </TabsTrigger>
          <TabsTrigger value="permissions" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            <span className="hidden sm:inline">Droits</span>
          </TabsTrigger>
          <TabsTrigger value="assignment-rules" className="flex items-center gap-2">
            <Route className="h-4 w-4" />
            <span className="hidden sm:inline">Affectation</span>
          </TabsTrigger>
          <TabsTrigger value="categories-process" className="flex items-center gap-2">
            <FolderTree className="h-4 w-4" />
            <span className="hidden sm:inline">Catégories</span>
          </TabsTrigger>
          <TabsTrigger value="export" className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Export</span>
          </TabsTrigger>
          <TabsTrigger value="sharepoint" className="flex items-center gap-2">
            <FolderSync className="h-4 w-4" />
            <span className="hidden sm:inline">SharePoint</span>
          </TabsTrigger>
          <TabsTrigger value="fabric" className="flex items-center gap-2">
            <CloudUpload className="h-4 w-4" />
            <span className="hidden sm:inline">Fabric</span>
          </TabsTrigger>
        </TabsList>

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

      <TabsContent value="permissions">
        <PermissionProfilesTab 
          permissionProfiles={props.permissionProfiles} 
          onAdd={props.addPermissionProfile}
          onUpdate={props.updatePermissionProfile}
          onDelete={props.deletePermissionProfile}
          onRefresh={props.refetch}
        />
      </TabsContent>

      <TabsContent value="assignment-rules">
        <AssignmentRulesTab 
          departments={props.departments}
          users={props.users}
        />
      </TabsContent>

      <TabsContent value="categories-process">
        <CategoriesProcessTab />
      </TabsContent>

      <TabsContent value="export">
        <DataExportTab />
      </TabsContent>

      <TabsContent value="sharepoint">
        <GovernanceSyncTab />
      </TabsContent>

      <TabsContent value="fabric">
        <FabricLakehouseSyncTab />
      </TabsContent>
    </Tabs>
    </div>
  );
}
