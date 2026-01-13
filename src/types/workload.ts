export interface Holiday {
  id: string;
  date: string;
  name: string;
  company_id: string | null;
  is_national: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserLeave {
  id: string;
  user_id: string;
  start_date: string;
  end_date: string;
  start_half_day: 'morning' | 'afternoon';
  end_half_day: 'morning' | 'afternoon';
  leave_type: 'paid' | 'unpaid' | 'sick' | 'rtt' | 'other';
  description: string | null;
  status: 'declared' | 'cancelled';
  id_lucca: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkloadSlot {
  id: string;
  task_id: string;
  user_id: string;
  date: string;
  half_day: 'morning' | 'afternoon';
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  task?: {
    id: string;
    title: string;
    priority: string;
    status: string;
    due_date: string | null;
    category_id: string | null;
    source_process_template_id: string | null;
  };
}

export interface WorkloadDay {
  date: string;
  morning: {
    slot: WorkloadSlot | null;
    isHoliday: boolean;
    isWeekend: boolean;
    isLeave: boolean;
    leaveType?: string;
  };
  afternoon: {
    slot: WorkloadSlot | null;
    isHoliday: boolean;
    isWeekend: boolean;
    isLeave: boolean;
    leaveType?: string;
  };
}

export interface TeamMemberWorkload {
  memberId: string;
  memberName: string;
  avatarUrl: string | null;
  jobTitle: string | null;
  department: string | null;
  companyId: string | null;
  days: WorkloadDay[];
  totalSlots: number;
  usedSlots: number;
  leaveSlots: number;
  holidaySlots: number;
}
