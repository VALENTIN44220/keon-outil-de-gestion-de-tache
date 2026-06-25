import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Monitor } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { ITProjectForm } from '@/components/it/ITProjectForm';

export default function ITProjectCreate() {
  const navigate = useNavigate();
  const backToList = () => navigate('/it/projects');

  return (
    <Layout>
      <div className="flex flex-col h-full">
        <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-6 py-4">
          <button onClick={backToList} className="mb-2 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Projets IT
          </button>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Monitor className="h-6 w-6 text-violet-600" />
            Nouveau projet IT
          </h1>
        </div>
        <div className="flex-1 overflow-auto p-4 sm:p-6">
          <div className="max-w-5xl mx-auto">
            <ITProjectForm
              onCancel={backToList}
              onSaved={() => {
                toast.success('Projet créé');
                backToList();
              }}
            />
          </div>
        </div>
      </div>
    </Layout>
  );
}
