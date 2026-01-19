import { useState, useEffect, useCallback, useMemo } from 'react';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useWorkloadPlanning } from '@/hooks/useWorkloadPlanning';
import { WorkloadFilters } from '@/components/workload/WorkloadFilters';
import { GanttView } from '@/components/workload/GanttView';
import { WorkloadCalendarView } from '@/components/workload/WorkloadCalendarView';
import { WorkloadSummaryView } from '@/components/workload/WorkloadSummaryView';
import { LeaveManagement } from '@/components/workload/LeaveManagement';
import { HolidayManagement } from '@/components/workload/HolidayManagement';
import { TeamWorkloadView } from '@/components/team/TeamWorkloadView';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Loader2, GanttChart, CalendarDays, BarChart3, Palmtree, CalendarCheck, Download, RefreshCw, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Task } from '@/types/task';
import { WorkloadSlot } from '@/types/workload';
import { toast } from 'sonner';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';

export default function Workload() {
  const { profile } = useAuth();
  const [activeView, setActiveView] = useState('workload');
  const [activeTab, setActiveTab] = useState('gantt');
  const [viewMode, setViewMode] = useState<'week' | 'month' | 'quarter'>('month');
  const [startDate, setStartDate] = useState(() => startOfMonth(new Date()));
  const [endDate, setEndDate] = useState(() => endOfMonth(new Date()));
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [selectedProcessId, setSelectedProcessId] = useState<string | null>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [selectedCalendarUserId, setSelectedCalendarUserId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);

  const {
    workloadData,
    slots,
    holidays,
    leaves,
    teamMembers,
    isLoading,
    addSlot,
    addMultipleSlots,
    removeSlot,
    moveSlot,
    segmentTaskSlots,
    isHalfDayAvailable,
    getTaskSlotsCount,
    refetch,
  } = useWorkloadPlanning({
    startDate,
    endDate,
    userIds: selectedUserIds.length > 0 ? selectedUserIds : undefined,
    processTemplateId: selectedProcessId || undefined,
    companyId: selectedCompanyId || undefined,
  });

  // Fetch tasks for assignment
  useEffect(() => {
    const fetchTasks = async () => {
      if (!profile?.id) return;
      
      const { data } = await supabase
        .from('tasks')
        .select('*')
        .in('assignee_id', teamMembers.map(m => m.id))
        .not('status', 'in', '("done","validated")');
      
      setTasks((data || []) as Task[]);
    };
    
    if (teamMembers.length > 0) {
      fetchTasks();
    }
  }, [profile?.id, teamMembers]);

  const handleDateRangeChange = (start: Date, end: Date, mode?: 'week' | 'month' | 'quarter') => {
    setStartDate(start);
    setEndDate(end);
    if (mode) {
      setViewMode(mode);
    }
  };

  const handleAddSlot = async (taskId: string, userId: string, date: string, halfDay: 'morning' | 'afternoon') => {
    try {
      await addSlot(taskId, userId, date, halfDay);
      toast.success('Créneau ajouté');
    } catch (error: any) {
      if (error.code === '23505') {
        toast.error('Ce créneau est déjà occupé');
      } else {
        toast.error('Erreur lors de l\'ajout du créneau');
      }
    }
  };

  const handleAddMultipleSlots = async (taskId: string, userId: string, date: string, halfDay: 'morning' | 'afternoon', count: number) => {
    try {
      const created = await addMultipleSlots(taskId, userId, date, halfDay, count);
      toast.success(`${created.length} créneau${created.length > 1 ? 'x' : ''} ajouté${created.length > 1 ? 's' : ''}`);
    } catch (error: any) {
      if (error.code === '23505') {
        toast.error('Certains créneaux sont déjà occupés');
      } else {
        toast.error('Erreur lors de l\'ajout des créneaux');
      }
    }
  };

  const handleRemoveSlot = async (slotId: string) => {
    try {
      await removeSlot(slotId);
      toast.success('Créneau supprimé');
    } catch (error) {
      toast.error('Erreur lors de la suppression');
    }
  };

  const handleMoveSlot = async (slotId: string, newDate: string, newHalfDay: 'morning' | 'afternoon') => {
    try {
      await moveSlot(slotId, newDate, newHalfDay);
      toast.success('Créneau déplacé');
    } catch (error: any) {
      if (error.code === '23505') {
        toast.error('Ce créneau est déjà occupé');
      } else {
        toast.error('Erreur lors du déplacement');
      }
    }
  };

  const handleSegmentSlot = async (slot: WorkloadSlot, userId: string, newSegmentCount: number) => {
    try {
      // newSegmentCount is the number of segments, we need to calculate total half-days
      const currentCount = getTaskSlotsCount(slot.task_id, userId);
      // The total half-days stays the same, but we redistribute them
      const created = await segmentTaskSlots(slot.task_id, userId, currentCount);
      toast.success(`Tâche redistribuée en ${created.length} créneau${created.length > 1 ? 'x' : ''}`);
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la segmentation');
    }
  };

  // Get task duration in half-days (from existing slots or default)
  const getTaskDuration = useCallback((taskId: string): number | null => {
    // First check if task already has slots - use that count as duration
    const existingSlotCount = slots.filter(s => s.task_id === taskId).length;
    if (existingSlotCount > 0) {
      return existingSlotCount;
    }
    // Default to 2 half-days (1 day) for new tasks
    return 2;
  }, [slots]);

  // Get task progress from checklists (placeholder - needs checklist data)
  const getTaskProgress = useCallback((taskId: string): { completed: number; total: number } | null => {
    // This would need to be integrated with useChecklists hook
    // For now, return null to indicate no progress data
    return null;
  }, []);

  // Get list of task IDs that already have planning slots
  const plannedTaskIds = useMemo(() => {
    const uniqueTaskIds = new Set(slots.map(s => s.task_id));
    return Array.from(uniqueTaskIds);
  }, [slots]);

  // Export to ICS format
  const handleExportICS = () => {
    try {
      let icsContent = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//KEON//Plan de charge//FR',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
      ];

      slots.forEach(slot => {
        const task = tasks.find(t => t.id === slot.task_id);
        if (!task) return;

        const startHour = slot.half_day === 'morning' ? '08' : '14';
        const endHour = slot.half_day === 'morning' ? '12' : '18';
        const dateStr = slot.date.replace(/-/g, '');

        icsContent.push(
          'BEGIN:VEVENT',
          `UID:${slot.id}@keon.app`,
          `DTSTART:${dateStr}T${startHour}0000`,
          `DTEND:${dateStr}T${endHour}0000`,
          `SUMMARY:${task.title}`,
          `DESCRIPTION:${task.description || ''}`,
          'END:VEVENT'
        );
      });

      icsContent.push('END:VCALENDAR');

      const blob = new Blob([icsContent.join('\r\n')], { type: 'text/calendar' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `plan-charge-${format(new Date(), 'yyyy-MM-dd')}.ics`;
      a.click();
      URL.revokeObjectURL(url);
      
      toast.success('Calendrier exporté au format ICS');
    } catch (error) {
      toast.error('Erreur lors de l\'export');
    }
  };

  // Open Outlook web calendar sync
  const handleOutlookSync = () => {
    // Microsoft Graph would require OAuth, for now show info
    toast.info('Synchronisation Outlook : Importez le fichier ICS exporté dans votre calendrier Outlook');
    handleExportICS();
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar 
        activeView={activeView} 
        onViewChange={setActiveView} 
      />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header 
          title="Plan de charge"
          searchQuery=""
          onSearchChange={() => {}}
        />
        
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
              <TabsList className="grid w-full grid-cols-6 lg:w-auto lg:inline-grid">
                <TabsTrigger value="gantt" className="gap-2">
                  <GanttChart className="h-4 w-4" />
                  <span className="hidden sm:inline">Gantt</span>
                </TabsTrigger>
                <TabsTrigger value="calendar" className="gap-2">
                  <CalendarDays className="h-4 w-4" />
                  <span className="hidden sm:inline">Calendrier</span>
                </TabsTrigger>
                <TabsTrigger value="summary" className="gap-2">
                  <BarChart3 className="h-4 w-4" />
                  <span className="hidden sm:inline">Bilan</span>
                </TabsTrigger>
                <TabsTrigger value="team" className="gap-2">
                  <Users className="h-4 w-4" />
                  <span className="hidden sm:inline">Équipe</span>
                </TabsTrigger>
                <TabsTrigger value="leaves" className="gap-2">
                  <Palmtree className="h-4 w-4" />
                  <span className="hidden sm:inline">Congés</span>
                </TabsTrigger>
                <TabsTrigger value="holidays" className="gap-2">
                  <CalendarCheck className="h-4 w-4" />
                  <span className="hidden sm:inline">Fériés</span>
                </TabsTrigger>
              </TabsList>

              {/* Export / Sync buttons */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Download className="h-4 w-4" />
                    <span className="hidden sm:inline">Exporter</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleExportICS}>
                    <CalendarDays className="h-4 w-4 mr-2" />
                    Exporter en ICS
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleOutlookSync}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Synchroniser Outlook
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Filters for planning views */}
            {(activeTab === 'gantt' || activeTab === 'calendar' || activeTab === 'summary') && (
              <WorkloadFilters
                startDate={startDate}
                endDate={endDate}
                onDateRangeChange={handleDateRangeChange}
                selectedUserIds={selectedUserIds}
                onUserIdsChange={setSelectedUserIds}
                selectedProcessId={selectedProcessId}
                onProcessIdChange={setSelectedProcessId}
                selectedCompanyId={selectedCompanyId}
                onCompanyIdChange={setSelectedCompanyId}
                teamMembers={teamMembers}
              />
            )}

            {isLoading && (activeTab === 'gantt' || activeTab === 'calendar' || activeTab === 'summary') ? (
              <Card>
                <CardContent className="flex items-center justify-center h-64">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </CardContent>
              </Card>
            ) : (
              <>
                <TabsContent value="gantt" className="mt-4">
                  <GanttView
                    workloadData={workloadData}
                    startDate={startDate}
                    endDate={endDate}
                    tasks={tasks}
                    viewMode={viewMode}
                    onSlotAdd={handleAddSlot}
                    onSlotRemove={handleRemoveSlot}
                    onSlotMove={handleMoveSlot}
                    onMultiSlotAdd={handleAddMultipleSlots}
                    onSegmentSlot={handleSegmentSlot}
                    isHalfDayAvailable={isHalfDayAvailable}
                    getTaskSlotsCount={getTaskSlotsCount}
                    getTaskDuration={getTaskDuration}
                    getTaskProgress={getTaskProgress}
                    plannedTaskIds={plannedTaskIds}
                  />
                </TabsContent>

                <TabsContent value="calendar" className="mt-4">
                  <WorkloadCalendarView
                    workloadData={workloadData}
                    holidays={holidays}
                    leaves={leaves}
                    selectedUserId={selectedCalendarUserId}
                    onUserSelect={setSelectedCalendarUserId}
                    viewMode={viewMode}
                    startDate={startDate}
                    endDate={endDate}
                  />
                </TabsContent>

                <TabsContent value="summary" className="mt-4">
                  <WorkloadSummaryView
                    workloadData={workloadData}
                    startDate={startDate}
                    endDate={endDate}
                  />
                </TabsContent>

                <TabsContent value="team" className="mt-4">
                  <TeamWorkloadView />
                </TabsContent>
              </>
            )}

            <TabsContent value="leaves" className="mt-4">
              <LeaveManagement />
            </TabsContent>

            <TabsContent value="holidays" className="mt-4">
              <HolidayManagement />
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  );
}
