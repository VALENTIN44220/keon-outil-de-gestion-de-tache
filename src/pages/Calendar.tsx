import { useState } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { UnifiedCalendarView } from '@/components/calendar/UnifiedCalendarView';
import { useMicrosoftConnection } from '@/hooks/useMicrosoftConnection';
import { useNotifications } from '@/hooks/useNotifications';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link2, Calendar as CalendarIcon, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const CalendarPage = () => {
  const [activeView, setActiveView] = useState('calendar');
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  const { user } = useAuth();
  const { connection, isLoading: isLoadingConnection } = useMicrosoftConnection();

  // Lightweight notification fetch — only fields needed, cached 5 min
  const { data: notifTasks = [] } = useQuery({
    queryKey: ['notif-tasks', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data } = await supabase
        .from('tasks')
        .select('id, title, status, due_date, priority, assigned_to')
        .eq('assigned_to', user.id)
        .neq('status', 'completed')
        .not('due_date', 'is', null)
        .limit(100);
      return data ?? [];
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });
  const { notifications, unreadCount, hasUrgent } = useNotifications(notifTasks);

  const handleConnectMicrosoft = () => {
    navigate('/profile?tab=sync');
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar activeView={activeView} onViewChange={setActiveView} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header
          title="Calendrier"
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          notifications={notifications}
          unreadCount={unreadCount}
          hasUrgent={hasUrgent}
          onNotificationClick={() => {}}
        />

        <main className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-6">
          {isLoadingConnection ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : !connection.connected ? (
            <Card className="max-w-xl mx-auto mt-12">
              <CardHeader className="text-center">
                <div className="flex justify-center mb-4">
                  <div className="p-4 rounded-full bg-primary/10">
                    <CalendarIcon className="h-12 w-12 text-primary" />
                  </div>
                </div>
                <CardTitle className="text-xl">Connectez votre calendrier</CardTitle>
                <CardDescription>
                  Synchronisez votre calendrier Microsoft 365 pour afficher vos événements Outlook 
                  et les tâches de l'application dans une vue unifiée.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex justify-center">
                <Button onClick={handleConnectMicrosoft} className="gap-2">
                  <Link2 className="h-4 w-4" />
                  Configurer la synchronisation
                </Button>
              </CardContent>
            </Card>
          ) : (
            <UnifiedCalendarView />
          )}
        </main>
      </div>
    </div>
  );
};

export default CalendarPage;
