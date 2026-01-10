import { useState } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { AdminHeader } from '@/components/layout/AdminHeader';
import { useUserRole } from '@/hooks/useUserRole';
import { useAdminData } from '@/hooks/useAdminData';
import { AdminTabs } from '@/components/admin/AdminTabs';
import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

export default function Admin() {
  const [activeView, setActiveView] = useState('admin');
  const { isAdmin, isLoading: roleLoading } = useUserRole();
  const adminData = useAdminData();

  if (roleLoading || adminData.isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar activeView={activeView} onViewChange={setActiveView} />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <AdminHeader 
          title="Administration" 
          subtitle="Gérez la structure organisationnelle"
        />
        
        <main className="flex-1 overflow-auto p-6">
          <AdminTabs {...adminData} />
        </main>
      </div>
    </div>
  );
}
