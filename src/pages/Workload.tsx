import { useState, useEffect, useCallback, useMemo } from 'react';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useWorkloadPlanning } from '@/hooks/useWorkloadPlanning';
import { useWorkloadPreferences } from '@/hooks/useWorkloadPreferences';
import { WorkloadFilters } from '@/components/workload/WorkloadFilters';
import { GanttViewInteractive } from '@/components/workload/GanttViewInteractive';
import { WorkloadCalendarView } from '@/components/workload/WorkloadCalendarView';
import { WorkloadSummaryView } from '@/components/workload/WorkloadSummaryView';
import { LeaveManagement } from '@/components/workload/LeaveManagement';
import { HolidayManagement } from '@/components/workload/HolidayManagement';
import { TeamWorkloadView } from '@/components/team/TeamWorkloadView';
import { GanttConfigPanel } from '@/components/workload/GanttConfigPanel';
import { exportToCSV, exportToJSON, exportSummaryReport, ExportData } from '@/components/workload/WorkloadExport';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Loader2, GanttChart, CalendarDays, BarChart3, Palmtree, CalendarCheck, Download, RefreshCw, Users, FileSpreadsheet, FileJson, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useSimulation } from '@/contexts/SimulationContext';
import { Task } from '@/types/task';
import { WorkloadSlot } from '@/types/workload';
import { toast } from 'sonner';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
export default function Workload() {
  const { profile: authProfile } = useAuth();
  const { getActiveProfile } = useSimulation();
  const profile = getActiveProfile() || authProfile;
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

  // Workload preferences (persisted in localStorage)
  const {
    preferences,
    updatePreference,
    updateColumn,
    resetToDefaults,
    toggleHeatmap,
    setGroupBy,
    setZoomLevel,
    toggleCompactMode,
  } = useWorkloadPreferences();
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
    checkSlotLeaveConflict,
    reassignTaskSlots,
    resizeTaskSlots,
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

  // Export data for all export functions
  const exportData: ExportData = useMemo(() => ({
    workloadData,
    tasks,
    slots,
    startDate,
    endDate,
  }), [workloadData, tasks, slots, startDate, endDate]);

  // Export handlers
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

  const handleExportCSV = () => exportToCSV(exportData);
  const handleExportJSON = () => exportToJSON(exportData);
  const handleExportReport = () => exportSummaryReport(exportData);

  // Open Outlook web calendar sync
  const handleOutlookSync = () => {
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
        
        <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-keon-50">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            {/* Premium header row */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
              {/* Tabs with premium underline style */}
              <TabsList className="h-auto p-1 bg-card border border-keon-200 rounded-xl shadow-premium">
                <TabsTrigger 
                  value="gantt" 
                  className="gap-2 px-4 py-2.5 data-[state=active]:bg-primary data-[state=active]:text-white rounded-lg transition-all"
                >
                  <GanttChart className="h-4 w-4" />
                  <span className="hidden sm:inline font-medium">Gantt</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="calendar" 
                  className="gap-2 px-4 py-2.5 data-[state=active]:bg-primary data-[state=active]:text-white rounded-lg transition-all"
                >
                  <CalendarDays className="h-4 w-4" />
                  <span className="hidden sm:inline font-medium">Calendrier</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="summary" 
                  className="gap-2 px-4 py-2.5 data-[state=active]:bg-primary data-[state=active]:text-white rounded-lg transition-all"
                >
                  <BarChart3 className="h-4 w-4" />
                  <span className="hidden sm:inline font-medium">Bilan</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="team" 
                  className="gap-2 px-4 py-2.5 data-[state=active]:bg-primary data-[state=active]:text-white rounded-lg transition-all"
                >
                  <Users className="h-4 w-4" />
                  <span className="hidden sm:inline font-medium">Équipe</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="leaves" 
                  className="gap-2 px-4 py-2.5 data-[state=active]:bg-primary data-[state=active]:text-white rounded-lg transition-all"
                >
                  <Palmtree className="h-4 w-4" />
                  <span className="hidden sm:inline font-medium">Congés</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="holidays" 
                  className="gap-2 px-4 py-2.5 data-[state=active]:bg-primary data-[state=active]:text-white rounded-lg transition-all"
                >
                  <CalendarCheck className="h-4 w-4" />
                  <span className="hidden sm:inline font-medium">Fériés</span>
                </TabsTrigger>
              </TabsList>

              {/* Action buttons row */}
              <div className="flex items-center gap-2">
                {/* Config Panel for Gantt */}
                {activeTab === 'gantt' && (
                  <GanttConfigPanel
                    preferences={preferences}
                    onGroupByChange={setGroupBy}
                    onZoomChange={setZoomLevel}
                    onToggleHeatmap={toggleHeatmap}
                    onToggleCompact={toggleCompactMode}
                    onColumnChange={updateColumn}
                    onWidthChange={(width) => updatePreference('memberColumnWidth', width)}
                    onReset={resetToDefaults}
                  />
                )}

                {/* Export / Sync buttons */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2 h-9 border-keon-200 hover:bg-keon-50">
                      <Download className="h-4 w-4" />
                      <span className="hidden sm:inline font-medium">Exporter</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onClick={handleExportCSV}>
                      <FileSpreadsheet className="h-4 w-4 mr-2" />
                      Export CSV
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleExportJSON}>
                      <FileJson className="h-4 w-4 mr-2" />
                      Export JSON
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleExportReport}>
                      <FileText className="h-4 w-4 mr-2" />
                      Rapport de synthèse
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleExportICS}>
                      <CalendarDays className="h-4 w-4 mr-2" />
                      Export ICS (Calendrier)
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleOutlookSync}>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Synchroniser Outlook
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
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
                viewMode={viewMode}
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
                  <GanttViewInteractive
                    workloadData={workloadData}
                    startDate={startDate}
                    endDate={endDate}
                    tasks={tasks}
                    leaves={leaves}
                    viewMode={viewMode}
                    onSlotAdd={handleAddSlot}
                    onSlotRemove={handleRemoveSlot}
                    onSlotMove={handleMoveSlot}
                    onMultiSlotAdd={handleAddMultipleSlots}
                    onReassignTask={reassignTaskSlots}
                    onResizeTask={resizeTaskSlots}
                    isHalfDayAvailable={isHalfDayAvailable}
                    checkSlotLeaveConflict={checkSlotLeaveConflict}
                    getTaskSlotsCount={getTaskSlotsCount}
                    getTaskDuration={getTaskDuration}
                    getTaskProgress={getTaskProgress}
                    plannedTaskIds={plannedTaskIds}
                    preferences={preferences}
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
                    tasks={tasks}
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
