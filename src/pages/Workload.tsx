 import { useState, useEffect, useCallback, useMemo } from 'react';
 import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, format, addWeeks, addMonths, startOfYear, endOfYear, addYears, startOfQuarter, endOfQuarter } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useWorkloadPlanning } from '@/hooks/useWorkloadPlanning';
import { useWorkloadPreferences } from '@/hooks/useWorkloadPreferences';
import { useWorkloadFilters } from '@/hooks/useWorkloadFilters';
import { WorkloadFilters } from '@/components/workload/WorkloadFilters';
import { PlanningKPIs } from '@/components/workload/calendar/PlanningKPIs';
 import { PlanningCalendarView } from '@/components/workload/calendar';
 import { useOutlookCalendar } from '@/hooks/useOutlookCalendar';
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
 import { Loader2, CalendarDays, BarChart3, Palmtree, CalendarCheck, Download, RefreshCw, Users, FileSpreadsheet, FileJson, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useSimulation } from '@/contexts/SimulationContext';
import { Task } from '@/types/task';
import { WorkloadSlot, TeamMemberWorkload } from '@/types/workload';
import { toast } from 'sonner';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
export default function Workload() {
  const { profile: authProfile } = useAuth();
  const { getActiveProfile } = useSimulation();
  const profile = getActiveProfile() || authProfile;
  const [activeView, setActiveView] = useState('workload');
   const [activeTab, setActiveTab] = useState('calendar');
  const [viewMode, setViewMode] = useState<'week' | 'month' | 'quarter' | 'year'>('month');
  const [startDate, setStartDate] = useState(() => startOfMonth(new Date()));
  const [endDate, setEndDate] = useState(() => endOfMonth(new Date()));
  const [selectedCalendarUserId, setSelectedCalendarUserId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [useAdvancedFilters, setUseAdvancedFilters] = useState(false);
 
   // Fetch Outlook calendar events for team members
   const { events: outlookEvents, isLoading: isLoadingOutlook } = useOutlookCalendar(
     startDate,
     endDate,
     true // include subordinates
   );

  // Workload filters (persisted in localStorage)
  const {
    filters,
    setSearchQuery,
    setSelectedUserIds,
    setSelectedProcessId,
    setSelectedCompanyId,
    setSelectedDepartmentId,
    setSelectedStatuses,
    setSelectedPriorities,
    setItemType,
    setShowOnlyOverloaded,
    setShowOnlyWithConflicts,
    clearFilters,
    hasActiveFilters,
    activeFiltersCount,
  } = useWorkloadFilters();

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
    moveSlotsWithOffset,
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
    userIds: filters.selectedUserIds.length > 0 ? filters.selectedUserIds : undefined,
    processTemplateId: filters.selectedProcessId || undefined,
    companyId: filters.selectedCompanyId || undefined,
  });

  // Fetch tasks for planning grid - include ALL tasks (even done/validated) 
  // so they remain visible in the calendar. Only the backlog sidebar filters them.
  useEffect(() => {
    const fetchTasks = async () => {
      if (!profile?.id) return;

      // 1. Tâches déjà affectées à des membres de l'équipe
      const teamIds = teamMembers.map(m => m.id);
      const { data: assignedData } = await supabase
        .from('tasks')
        .select('*')
        .in('assignee_id', teamIds);

      // 2. Tâches NON affectées qui ciblent le département du manager connecté
      //    → permet au manager (ex : Florence pour le BE) de les voir dans le
      //    backlog et de les planifier en les déposant sur une date.
      //    Le drop sur un collaborateur déclenchera l'auto-affectation.
      let unassignedData: any[] = [];
      const deptId = (profile as any)?.department_id;
      if (deptId) {
        const { data } = await supabase
          .from('tasks')
          .select('*')
          .is('assignee_id', null)
          .eq('target_department_id', deptId);
        unassignedData = data ?? [];
      }

      // Merge + déduplication par id (au cas où une tâche serait dans les 2)
      const seen = new Set<string>();
      const merged = [...(assignedData ?? []), ...unassignedData].filter((t: any) => {
        if (seen.has(t.id)) return false;
        seen.add(t.id);
        return true;
      });

      setTasks(merged as Task[]);
    };

    if (teamMembers.length > 0) {
      fetchTasks();
    }
  }, [profile?.id, (profile as any)?.department_id, teamMembers]);

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

  // Get task duration in half-days (slots existants > duration_hours > défaut 2)
  // Pour les tâches BE, `duration_hours` est saisi par le manager dans le dispatch
  // → on l'utilise comme taille de drag par défaut (1 demi-journée = 4h).
  const getTaskDuration = useCallback((taskId: string): number | null => {
    // 1. Slots déjà posés → on conserve cette taille pour la cohérence
    const existingSlotCount = slots.filter(s => s.task_id === taskId).length;
    if (existingSlotCount > 0) {
      return existingSlotCount;
    }
    // 2. Estimation `duration_hours` portée par la tâche (typiquement BE)
    const t = tasks.find(t => t.id === taskId) as any;
    const durationHours = t?.duration_hours;
    if (typeof durationHours === 'number' && durationHours > 0) {
      return Math.max(1, Math.ceil(durationHours / 4));
    }
    // 3. Défaut : 2 demi-journées (= 1 jour)
    return 2;
  }, [slots, tasks]);

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
        
        <main className="flex-1 flex flex-col overflow-hidden bg-keon-50">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 overflow-hidden">

            {/* ── Tab bar ── */}
            <div className="flex items-center justify-between px-4 h-12 bg-white border-b shrink-0">
              <TabsList className="h-8 p-0.5 bg-muted rounded-lg gap-0">
                <TabsTrigger value="calendar"
                  className="gap-1.5 px-3 h-7 text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md font-medium">
                  <CalendarDays className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Planning</span>
                </TabsTrigger>
                <TabsTrigger value="summary"
                  className="gap-1.5 px-3 h-7 text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md font-medium">
                  <BarChart3 className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Bilan</span>
                </TabsTrigger>
                <TabsTrigger value="team"
                  className="gap-1.5 px-3 h-7 text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md font-medium">
                  <Users className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Équipe</span>
                </TabsTrigger>
                <TabsTrigger value="leaves"
                  className="gap-1.5 px-3 h-7 text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md font-medium">
                  <Palmtree className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Congés</span>
                </TabsTrigger>
                <TabsTrigger value="holidays"
                  className="gap-1.5 px-3 h-7 text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md font-medium">
                  <CalendarCheck className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Fériés</span>
                </TabsTrigger>
              </TabsList>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground">
                    <Download className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Exporter</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={handleExportCSV}>
                    <FileSpreadsheet className="h-4 w-4 mr-2" /> Export CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExportJSON}>
                    <FileJson className="h-4 w-4 mr-2" /> Export JSON
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExportReport}>
                    <FileText className="h-4 w-4 mr-2" /> Rapport de synthèse
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleExportICS}>
                    <CalendarDays className="h-4 w-4 mr-2" /> Export ICS
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleOutlookSync}>
                    <RefreshCw className="h-4 w-4 mr-2" /> Synchroniser Outlook
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* ── Control bar (Planning & Bilan only) ── */}
            {(activeTab === 'calendar' || activeTab === 'summary') && (
              <WorkloadFilters
                startDate={startDate}
                endDate={endDate}
                onDateRangeChange={handleDateRangeChange}
                selectedUserIds={filters.selectedUserIds}
                onUserIdsChange={setSelectedUserIds}
                selectedProcessId={filters.selectedProcessId}
                onProcessIdChange={setSelectedProcessId}
                selectedCompanyId={filters.selectedCompanyId}
                onCompanyIdChange={setSelectedCompanyId}
                teamMembers={teamMembers}
                viewMode={viewMode}
                searchQuery={filters.searchQuery}
                onSearchChange={setSearchQuery}
                selectedStatuses={filters.selectedStatuses}
                onStatusesChange={setSelectedStatuses}
                itemTypeFilter={filters.itemType}
                onItemTypeChange={setItemType}
                extras={activeTab === 'calendar' ? (
                  <PlanningKPIs
                    workloadData={workloadData}
                    tasks={tasks}
                    plannedTaskIds={plannedTaskIds}
                  />
                ) : undefined}
              />
            )}

            {/* ── Content ── */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6">
              {isLoading && (activeTab === 'calendar' || activeTab === 'summary') ? (
                <Card>
                  <CardContent className="flex items-center justify-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </CardContent>
                </Card>
              ) : (
                <>
                  <TabsContent value="calendar" className="mt-0 flex-1 min-h-0">
                    <PlanningCalendarView
                      workloadData={workloadData}
                      startDate={startDate}
                      endDate={endDate}
                      tasks={tasks}
                      holidays={holidays}
                      leaves={leaves}
                      outlookEvents={outlookEvents}
                      viewMode={viewMode}
                      onNavigate={(direction: 'prev' | 'next') => {
                        const offset = direction === 'prev' ? -1 : 1;
                        let newStart: Date, newEnd: Date;
                        if (viewMode === 'week') {
                          newStart = addWeeks(startDate, offset);
                          newEnd = endOfWeek(newStart, { locale: fr });
                        } else if (viewMode === 'quarter') {
                          newStart = offset === 1 ? startOfQuarter(addMonths(startDate, 3)) : startOfQuarter(addMonths(startDate, -3));
                          newEnd = endOfQuarter(newStart);
                        } else if (viewMode === 'year') {
                          newStart = addYears(startDate, offset);
                          newEnd = endOfYear(newStart);
                        } else {
                          newStart = addMonths(startDate, offset);
                          newEnd = endOfMonth(newStart);
                        }
                        setStartDate(newStart);
                        setEndDate(newEnd);
                      }}
                      onToday={() => {
                        if (viewMode === 'week') {
                          setStartDate(startOfWeek(new Date(), { locale: fr }));
                          setEndDate(endOfWeek(new Date(), { locale: fr }));
                        } else if (viewMode === 'quarter') {
                          setStartDate(startOfQuarter(new Date()));
                          setEndDate(endOfQuarter(new Date()));
                        } else if (viewMode === 'year') {
                          setStartDate(startOfYear(new Date()));
                          setEndDate(endOfYear(new Date()));
                        } else {
                          setStartDate(startOfMonth(new Date()));
                          setEndDate(endOfMonth(new Date()));
                        }
                      }}
                      onSlotAdd={handleAddSlot}
                      onMultiSlotAdd={handleAddMultipleSlots}
                      onSlotMove={moveSlotsWithOffset}
                      onReassignTask={reassignTaskSlots}
                      isHalfDayAvailable={isHalfDayAvailable}
                      checkSlotLeaveConflict={checkSlotLeaveConflict}
                      getTaskDuration={getTaskDuration}
                      getTaskProgress={getTaskProgress}
                      plannedTaskIds={plannedTaskIds}
                      onTaskUpdated={refetch}
                      searchQuery={filters.searchQuery}
                      onSearchChange={setSearchQuery}
                      onViewModeChange={(mode, anchorDate) => {
                        setViewMode(mode);
                        if (anchorDate) {
                          if (mode === 'week') {
                            setStartDate(startOfWeek(anchorDate, { locale: fr }));
                            setEndDate(endOfWeek(anchorDate, { locale: fr }));
                          } else if (mode === 'month') {
                            setStartDate(startOfMonth(anchorDate));
                            setEndDate(endOfMonth(anchorDate));
                          } else if (mode === 'quarter') {
                            setStartDate(startOfQuarter(anchorDate));
                            setEndDate(endOfQuarter(anchorDate));
                          } else if (mode === 'year') {
                            setStartDate(startOfYear(anchorDate));
                            setEndDate(endOfYear(anchorDate));
                          }
                        }
                      }}
                    />
                  </TabsContent>

                  <TabsContent value="summary" className="mt-0">
                    <WorkloadSummaryView
                      workloadData={workloadData}
                      startDate={startDate}
                      endDate={endDate}
                    />
                  </TabsContent>

                  <TabsContent value="team" className="mt-0">
                    <TeamWorkloadView />
                  </TabsContent>
                </>
              )}

              <TabsContent value="leaves" className="mt-0">
                <LeaveManagement />
              </TabsContent>

              <TabsContent value="holidays" className="mt-0">
                <HolidayManagement />
              </TabsContent>
            </div>
          </Tabs>
        </main>
      </div>
    </div>
  );
}
