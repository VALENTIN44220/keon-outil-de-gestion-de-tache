import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useSimulation } from '@/contexts/SimulationContext';
import { Holiday, UserLeave, WorkloadSlot, WorkloadDay, TeamMemberWorkload } from '@/types/workload';
import { format, addDays, isWeekend, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

interface UseWorkloadPlanningProps {
  startDate: Date;
  endDate: Date;
  userIds?: string[];
  processTemplateId?: string;
  companyId?: string;
}

export function useWorkloadPlanning({
  startDate,
  endDate,
  userIds,
  processTemplateId,
  companyId,
}: UseWorkloadPlanningProps) {
  const { profile: authProfile } = useAuth();
  const { getActiveProfile } = useSimulation();
  const profile = getActiveProfile() || authProfile;
  const [slots, setSlots] = useState<WorkloadSlot[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [leaves, setLeaves] = useState<UserLeave[]>([]);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!profile?.id) return;
    
    setIsLoading(true);
    try {
      const startStr = format(startDate, 'yyyy-MM-dd');
      const endStr = format(endDate, 'yyyy-MM-dd');

      // Fetch team members (self + subordinates)
      const findSubordinates = async (managerId: string): Promise<string[]> => {
        const { data } = await supabase
          .from('profiles')
          .select('id')
          .eq('manager_id', managerId);
        
        if (!data) return [];
        
        const ids = data.map(p => p.id);
        for (const id of data.map(p => p.id)) {
          const subIds = await findSubordinates(id);
          ids.push(...subIds);
        }
        return ids;
      };

      let memberIds: string[];
      if (userIds && userIds.length > 0) {
        memberIds = userIds;
      } else {
        const subordinateIds = await findSubordinates(profile.id);
        memberIds = [profile.id, ...subordinateIds];
      }

      // Apply company filter
      let membersQuery = supabase
        .from('profiles')
        .select('id, display_name, avatar_url, job_title, department, company_id')
        .in('id', memberIds);
      
      if (companyId) {
        membersQuery = membersQuery.eq('company_id', companyId);
      }

      const { data: membersData } = await membersQuery;
      setTeamMembers(membersData || []);

      const filteredMemberIds = (membersData || []).map(m => m.id);

      // Fetch holidays
      const { data: holidaysData } = await supabase
        .from('holidays')
        .select('*')
        .gte('date', startStr)
        .lte('date', endStr);
      
      setHolidays((holidaysData || []) as Holiday[]);

      // Fetch leaves
      const { data: leavesData } = await supabase
        .from('user_leaves')
        .select('*')
        .in('user_id', filteredMemberIds)
        .eq('status', 'declared')
        .or(`start_date.lte.${endStr},end_date.gte.${startStr}`);
      
      setLeaves((leavesData || []) as UserLeave[]);

      // Fetch workload slots with task data
      let slotsQuery = supabase
        .from('workload_slots')
        .select(`
          *,
          task:tasks(id, title, priority, status, due_date, category_id, source_process_template_id)
        `)
        .in('user_id', filteredMemberIds)
        .gte('date', startStr)
        .lte('date', endStr);

      if (processTemplateId) {
        slotsQuery = slotsQuery.eq('task.source_process_template_id', processTemplateId);
      }

      const { data: slotsData } = await slotsQuery;
      setSlots((slotsData || []) as WorkloadSlot[]);

    } catch (error) {
      console.error('Error fetching workload data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [profile?.id, startDate, endDate, userIds, processTemplateId, companyId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Build workload data for each team member
  const workloadData = useMemo((): TeamMemberWorkload[] => {
    const days = eachDayOfInterval({ start: startDate, end: endDate });

    return teamMembers.map(member => {
      const memberSlots = slots.filter(s => s.user_id === member.id);
      const memberLeaves = leaves.filter(l => l.user_id === member.id);

      const workloadDays: WorkloadDay[] = days.map(day => {
        const dateStr = format(day, 'yyyy-MM-dd');
        const isWeekendDay = isWeekend(day);
        const holiday = holidays.find(h => h.date === dateStr);
        
        // Check if this day is a leave day
        const leaveForDay = memberLeaves.find(l => {
          const start = parseISO(l.start_date);
          const end = parseISO(l.end_date);
          return day >= start && day <= end;
        });

        const morningSlot = memberSlots.find(s => s.date === dateStr && s.half_day === 'morning');
        const afternoonSlot = memberSlots.find(s => s.date === dateStr && s.half_day === 'afternoon');

        // Check morning leave
        let isMorningLeave = false;
        let morningLeaveType: string | undefined;
        if (leaveForDay) {
          const start = parseISO(leaveForDay.start_date);
          const end = parseISO(leaveForDay.end_date);
          if (format(day, 'yyyy-MM-dd') === leaveForDay.start_date) {
            isMorningLeave = leaveForDay.start_half_day === 'morning';
          } else if (format(day, 'yyyy-MM-dd') === leaveForDay.end_date) {
            isMorningLeave = true;
          } else if (day > start && day < end) {
            isMorningLeave = true;
          }
          if (isMorningLeave) morningLeaveType = leaveForDay.leave_type;
        }

        // Check afternoon leave
        let isAfternoonLeave = false;
        let afternoonLeaveType: string | undefined;
        if (leaveForDay) {
          const start = parseISO(leaveForDay.start_date);
          const end = parseISO(leaveForDay.end_date);
          if (format(day, 'yyyy-MM-dd') === leaveForDay.end_date) {
            isAfternoonLeave = leaveForDay.end_half_day === 'afternoon';
          } else if (format(day, 'yyyy-MM-dd') === leaveForDay.start_date) {
            isAfternoonLeave = leaveForDay.start_half_day === 'morning';
          } else if (day > start && day < end) {
            isAfternoonLeave = true;
          }
          if (isAfternoonLeave) afternoonLeaveType = leaveForDay.leave_type;
        }

        return {
          date: dateStr,
          morning: {
            slot: morningSlot || null,
            isHoliday: !!holiday,
            isWeekend: isWeekendDay,
            isLeave: isMorningLeave,
            leaveType: morningLeaveType,
          },
          afternoon: {
            slot: afternoonSlot || null,
            isHoliday: !!holiday,
            isWeekend: isWeekendDay,
            isLeave: isAfternoonLeave,
            leaveType: afternoonLeaveType,
          },
        };
      });

      // Calculate stats
      const totalSlots = days.length * 2; // 2 half-days per day
      const usedSlots = memberSlots.length;
      const leaveSlots = workloadDays.reduce((count, day) => {
        return count + (day.morning.isLeave ? 1 : 0) + (day.afternoon.isLeave ? 1 : 0);
      }, 0);
      const holidaySlots = workloadDays.reduce((count, day) => {
        return count + (day.morning.isHoliday || day.morning.isWeekend ? 1 : 0) + (day.afternoon.isHoliday || day.afternoon.isWeekend ? 1 : 0);
      }, 0);

      return {
        memberId: member.id,
        memberName: member.display_name || 'Sans nom',
        avatarUrl: member.avatar_url,
        jobTitle: member.job_title,
        department: member.department,
        companyId: member.company_id,
        days: workloadDays,
        totalSlots,
        usedSlots,
        leaveSlots,
        holidaySlots,
      };
    });
  }, [teamMembers, slots, holidays, leaves, startDate, endDate]);

  // Helper to check if a half-day is available
  const isHalfDayAvailable = useCallback((userId: string, date: string, halfDay: 'morning' | 'afternoon'): boolean => {
    const dayDate = parseISO(date);
    
    // Check weekend
    if (isWeekend(dayDate)) return false;
    
    // Check holiday
    if (holidays.some(h => h.date === date)) return false;
    
    // Check leave
    const userLeaves = leaves.filter(l => l.user_id === userId);
    for (const leave of userLeaves) {
      const start = parseISO(leave.start_date);
      const end = parseISO(leave.end_date);
      
      if (dayDate >= start && dayDate <= end) {
        // Check specific half-day for start/end dates
        if (date === leave.start_date && leave.start_half_day === 'afternoon' && halfDay === 'morning') continue;
        if (date === leave.end_date && leave.end_half_day === 'morning' && halfDay === 'afternoon') continue;
        return false;
      }
    }
    
    // Check if slot already exists
    if (slots.some(s => s.user_id === userId && s.date === date && s.half_day === halfDay)) return false;
    
    return true;
  }, [holidays, leaves, slots]);

  // Find next available half-days starting from a given date
  const findNextAvailableSlots = useCallback((
    userId: string, 
    startFromDate: Date, 
    startFromHalfDay: 'morning' | 'afternoon',
    count: number
  ): Array<{ date: string; halfDay: 'morning' | 'afternoon' }> => {
    const result: Array<{ date: string; halfDay: 'morning' | 'afternoon' }> = [];
    let currentDate = new Date(startFromDate);
    let currentHalfDay: 'morning' | 'afternoon' = startFromHalfDay;
    let maxIterations = 365; // Safety limit
    
    while (result.length < count && maxIterations > 0) {
      const dateStr = format(currentDate, 'yyyy-MM-dd');
      
      if (isHalfDayAvailable(userId, dateStr, currentHalfDay)) {
        result.push({ date: dateStr, halfDay: currentHalfDay });
      }
      
      // Move to next half-day
      if (currentHalfDay === 'morning') {
        currentHalfDay = 'afternoon';
      } else {
        currentHalfDay = 'morning';
        currentDate = addDays(currentDate, 1);
      }
      
      maxIterations--;
    }
    
    return result;
  }, [isHalfDayAvailable]);

  // CRUD operations
  const addSlot = async (taskId: string, userId: string, date: string, halfDay: 'morning' | 'afternoon') => {
    const { data, error } = await supabase
      .from('workload_slots')
      .insert({ task_id: taskId, user_id: userId, date, half_day: halfDay })
      .select()
      .single();
    
    if (error) throw error;
    
    // Also assign the task to the user if not already assigned
    const { error: taskError } = await supabase
      .from('tasks')
      .update({ assignee_id: userId })
      .eq('id', taskId);
    
    if (taskError) {
      console.error('Error assigning task:', taskError);
    }
    
    await fetchData();
    return data;
  };

  // Add multiple slots with automatic segmentation around weekends/holidays/leaves
  const addMultipleSlots = async (
    taskId: string, 
    userId: string, 
    startDate: string, 
    startHalfDay: 'morning' | 'afternoon',
    halfDayCount: number
  ) => {
    const startDateObj = parseISO(startDate);
    const slotsToCreate = findNextAvailableSlots(userId, startDateObj, startHalfDay, halfDayCount);
    
    if (slotsToCreate.length === 0) {
      throw new Error('Aucun créneau disponible trouvé');
    }
    
    const inserts = slotsToCreate.map(slot => ({
      task_id: taskId,
      user_id: userId,
      date: slot.date,
      half_day: slot.halfDay,
    }));
    
    const { error } = await supabase
      .from('workload_slots')
      .insert(inserts);
    
    if (error) throw error;
    
    // Also assign the task to the user if not already assigned
    const { error: taskError } = await supabase
      .from('tasks')
      .update({ assignee_id: userId })
      .eq('id', taskId);
    
    if (taskError) {
      console.error('Error assigning task:', taskError);
    }
    
    await fetchData();
    return slotsToCreate;
  };

  const removeSlot = async (slotId: string) => {
    const { error } = await supabase
      .from('workload_slots')
      .delete()
      .eq('id', slotId);
    
    if (error) throw error;
    await fetchData();
  };

  // Remove all slots for a task/user combination
  const removeTaskSlots = async (taskId: string, userId: string) => {
    const { error } = await supabase
      .from('workload_slots')
      .delete()
      .eq('task_id', taskId)
      .eq('user_id', userId);
    
    if (error) throw error;
    await fetchData();
  };

  // Segment: remove existing slots and recreate with new count
  const segmentTaskSlots = async (
    taskId: string, 
    userId: string, 
    newCount: number
  ) => {
    // Find existing slots for this task/user
    const existingSlots = slots.filter(s => s.task_id === taskId && s.user_id === userId);
    
    if (existingSlots.length === 0) {
      throw new Error('Aucun créneau existant trouvé');
    }
    
    // Find the earliest slot to start from
    const sortedSlots = [...existingSlots].sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date);
      if (dateCompare !== 0) return dateCompare;
      return a.half_day === 'morning' ? -1 : 1;
    });
    
    const firstSlot = sortedSlots[0];
    const startDate = firstSlot.date;
    const startHalfDay = firstSlot.half_day as 'morning' | 'afternoon';
    
    // Delete all existing slots for this task/user
    const { error: deleteError } = await supabase
      .from('workload_slots')
      .delete()
      .eq('task_id', taskId)
      .eq('user_id', userId);
    
    if (deleteError) throw deleteError;
    
    // Create new slots with the new count
    const startDateObj = parseISO(startDate);
    const slotsToCreate = findNextAvailableSlots(userId, startDateObj, startHalfDay, newCount);
    
    if (slotsToCreate.length === 0) {
      throw new Error('Aucun créneau disponible trouvé');
    }
    
    const inserts = slotsToCreate.map(slot => ({
      task_id: taskId,
      user_id: userId,
      date: slot.date,
      half_day: slot.halfDay,
    }));
    
    const { error: insertError } = await supabase
      .from('workload_slots')
      .insert(inserts);
    
    if (insertError) throw insertError;
    await fetchData();
    return slotsToCreate;
  };

  // Get count of slots for a task/user
  const getTaskSlotsCount = useCallback((taskId: string, userId: string): number => {
    return slots.filter(s => s.task_id === taskId && s.user_id === userId).length;
  }, [slots]);

  const moveSlot = async (slotId: string, newDate: string, newHalfDay: 'morning' | 'afternoon') => {
    const { error } = await supabase
      .from('workload_slots')
      .update({ date: newDate, half_day: newHalfDay })
      .eq('id', slotId);
    
    if (error) throw error;
    await fetchData();
  };

  return {
    workloadData,
    slots,
    holidays,
    leaves,
    teamMembers,
    isLoading,
    addSlot,
    addMultipleSlots,
    removeSlot,
    removeTaskSlots,
    segmentTaskSlots,
    moveSlot,
    isHalfDayAvailable,
    findNextAvailableSlots,
    getTaskSlotsCount,
    refetch: fetchData,
  };
}
