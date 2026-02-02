import { useMemo } from 'react';
import { format, addMonths, startOfMonth } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { MonthlyCalendarGrid, CalendarEvent } from './MonthlyCalendarGrid';

interface SemesterCalendarGridProps {
  currentDate: Date;
  events: CalendarEvent[];
  onNavigate?: (direction: 'prev' | 'next') => void;
  onToday?: () => void;
  onEventClick?: (event: CalendarEvent) => void;
  onMonthClick?: (month: Date) => void;
  monthCount?: 3 | 6; // 3 for quarter, 6 for semester
}

export function SemesterCalendarGrid({
  currentDate,
  events,
  onNavigate,
  onToday,
  onEventClick,
  onMonthClick,
  monthCount = 6,
}: SemesterCalendarGridProps) {
  // Generate months starting from currentDate
  const months = useMemo(() => {
    const result: Date[] = [];
    const startMonth = startOfMonth(currentDate);
    
    for (let i = 0; i < monthCount; i++) {
      result.push(addMonths(startMonth, i));
    }
    
    return result;
  }, [currentDate, monthCount]);

  // Filter events for each month
  const getEventsForMonth = (month: Date) => {
    const monthStart = startOfMonth(month);
    const nextMonth = addMonths(monthStart, 1);
    
    return events.filter(event => {
      // Event overlaps with this month
      return event.endDate >= monthStart && event.startDate < nextMonth;
    });
  };

  // Get period label
  const getPeriodLabel = () => {
    const firstMonth = months[0];
    const lastMonth = months[months.length - 1];
    const startYear = format(firstMonth, 'yyyy');
    const endYear = format(lastMonth, 'yyyy');
    
    if (startYear === endYear) {
      return `${format(firstMonth, 'MMMM', { locale: fr })} - ${format(lastMonth, 'MMMM yyyy', { locale: fr })}`;
    }
    return `${format(firstMonth, 'MMM yyyy', { locale: fr })} - ${format(lastMonth, 'MMM yyyy', { locale: fr })}`;
  };

  return (
    <div className="space-y-4">
      {/* Header with navigation */}
      <div className="flex items-center justify-between bg-card rounded-xl border p-4 shadow-sm">
        <h2 className="text-lg font-semibold capitalize">
          {getPeriodLabel()}
        </h2>
        
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onNavigate?.('prev')}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onToday}
          >
            Aujourd'hui
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onNavigate?.('next')}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* 6 months grid - 2x3 on desktop, 1 column on mobile */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {months.map((month) => (
          <div 
            key={month.toISOString()}
            className="cursor-pointer hover:ring-2 hover:ring-primary/20 rounded-xl transition-all"
            onClick={() => onMonthClick?.(month)}
          >
            <MonthlyCalendarGrid
              currentDate={month}
              events={getEventsForMonth(month)}
              onEventClick={onEventClick}
              compact
              showHeader
              showNavigation={false}
              maxEventsPerDay={2}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
