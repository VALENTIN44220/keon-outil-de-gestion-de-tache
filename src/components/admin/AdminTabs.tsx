import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Building2, Briefcase, Users, Layers, Shield, UserCog } from 'lucide-react';
import { CompaniesTab } from './CompaniesTab';
import { DepartmentsTab } from './DepartmentsTab';
import { JobTitlesTab } from './JobTitlesTab';
import { HierarchyLevelsTab } from './HierarchyLevelsTab';
import { PermissionProfilesTab } from './PermissionProfilesTab';
import { UsersTab } from './UsersTab';
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
  return (
    <Tabs defaultValue="users" className="space-y-6">
      <TabsList className="grid w-full grid-cols-6">
        <TabsTrigger value="users" className="flex items-center gap-2">
          <UserCog className="h-4 w-4" />
          <span className="hidden sm:inline">Utilisateurs</span>
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
        />
      </TabsContent>

      <TabsContent value="companies">
        <CompaniesTab 
          companies={props.companies} 
          onAdd={props.addCompany}
          onUpdate={props.updateCompany}
          onDelete={props.deleteCompany} 
        />
      </TabsContent>

      <TabsContent value="departments">
        <DepartmentsTab 
          departments={props.departments}
          companies={props.companies}
          onAdd={props.addDepartment}
          onUpdate={props.updateDepartment}
          onDelete={props.deleteDepartment} 
        />
      </TabsContent>

      <TabsContent value="job-titles">
        <JobTitlesTab 
          jobTitles={props.jobTitles}
          departments={props.departments}
          onAdd={props.addJobTitle}
          onUpdate={props.updateJobTitle}
          onDelete={props.deleteJobTitle} 
        />
      </TabsContent>

      <TabsContent value="hierarchy">
        <HierarchyLevelsTab 
          hierarchyLevels={props.hierarchyLevels} 
          onAdd={props.addHierarchyLevel}
          onUpdate={props.updateHierarchyLevel}
          onDelete={props.deleteHierarchyLevel} 
        />
      </TabsContent>

      <TabsContent value="permissions">
        <PermissionProfilesTab 
          permissionProfiles={props.permissionProfiles} 
          onAdd={props.addPermissionProfile}
          onUpdate={props.updatePermissionProfile}
          onDelete={props.deletePermissionProfile} 
        />
      </TabsContent>
    </Tabs>
  );
}
