 import { 
   startOfWeek, endOfWeek, startOfMonth, endOfMonth,
   startOfQuarter, endOfQuarter, startOfYear, endOfYear,
   eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval,
   format, getWeek, isSameMonth
 } from 'date-fns';
 import { fr } from 'date-fns/locale';
 
 export type ViewMode = 'week' | 'month' | 'quarter' | 'year';
 
 export interface PeriodRange {
   start: Date;
   end: Date;
   isValid: boolean;
 }
 
 export interface PeriodUnit {
   key: string;
   date: Date;
   label: string;
   subLabel?: string;
   isToday?: boolean;
   isWeekend?: boolean;
   isFirstOfMonth?: boolean;
   monthLabel?: string;
 }
 
 /**
  * Calculate the date range for a given view mode and anchor date
  * Robust fallbacks ensure we never return invalid ranges
  */
 export function getPeriodRange(viewMode: ViewMode, anchorDate?: Date | null): PeriodRange {
   const safeAnchor = anchorDate instanceof Date && !isNaN(anchorDate.getTime()) 
     ? anchorDate 
     : new Date();
   
   let start: Date;
   let end: Date;
   
   try {
     switch (viewMode) {
       case 'week':
         start = startOfWeek(safeAnchor, { locale: fr });
         end = endOfWeek(safeAnchor, { locale: fr });
         break;
       case 'month':
         start = startOfMonth(safeAnchor);
         end = endOfMonth(safeAnchor);
         break;
       case 'quarter':
         start = startOfQuarter(safeAnchor);
         end = endOfQuarter(safeAnchor);
         break;
       case 'year':
         start = startOfYear(safeAnchor);
         end = endOfYear(safeAnchor);
         break;
       default:
         start = startOfMonth(safeAnchor);
         end = endOfMonth(safeAnchor);
     }
     
     // Validate that end >= start
     if (end < start) {
       console.warn('[getPeriodRange] Invalid range detected, using fallback');
       start = startOfMonth(new Date());
       end = endOfMonth(new Date());
     }
     
     return { start, end, isValid: true };
   } catch (error) {
     console.error('[getPeriodRange] Error calculating period:', error);
     const fallbackStart = startOfMonth(new Date());
     const fallbackEnd = endOfMonth(new Date());
     return { start: fallbackStart, end: fallbackEnd, isValid: false };
   }
 }
 
 /**
  * Get display units for the calendar grid based on view mode
  * Returns an array of units (days, weeks, or months) for rendering
  */
 export function getPeriodUnits(viewMode: ViewMode, start: Date, end: Date): PeriodUnit[] {
   if (!start || !end || !(start instanceof Date) || !(end instanceof Date)) {
     console.warn('[getPeriodUnits] Invalid dates provided');
     return [];
   }
   
   try {
     const today = new Date();
     const todayStr = format(today, 'yyyy-MM-dd');
     
     switch (viewMode) {
       case 'week':
       case 'month': {
         // Day-by-day view
         const days = eachDayOfInterval({ start, end });
         return days.map(day => {
           const dayOfWeek = day.getDay();
           return {
             key: format(day, 'yyyy-MM-dd'),
             date: day,
             label: format(day, 'EEE', { locale: fr }),
             subLabel: format(day, 'd MMM', { locale: fr }),
             isToday: format(day, 'yyyy-MM-dd') === todayStr,
             isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
             isFirstOfMonth: day.getDate() === 1,
             monthLabel: format(day, 'MMMM', { locale: fr }),
           };
         });
       }
       
       case 'quarter': {
         // Week-by-week view for quarter
         const weeks = eachWeekOfInterval({ start, end }, { locale: fr });
         return weeks.map(weekStart => {
           const weekEnd = endOfWeek(weekStart, { locale: fr });
           return {
             key: format(weekStart, 'yyyy-ww'),
             date: weekStart,
             label: `S${getWeek(weekStart, { locale: fr })}`,
             subLabel: format(weekStart, 'd MMM', { locale: fr }),
             isToday: false, // Not applicable for weeks
             isWeekend: false,
             isFirstOfMonth: weekStart.getDate() <= 7,
             monthLabel: format(weekStart, 'MMMM', { locale: fr }),
           };
         });
       }
       
       case 'year': {
         // Month-by-month view for year
         const months = eachMonthOfInterval({ start, end });
         return months.map(monthStart => ({
           key: format(monthStart, 'yyyy-MM'),
           date: monthStart,
           label: format(monthStart, 'MMM', { locale: fr }),
           subLabel: format(monthStart, 'yyyy'),
           isToday: isSameMonth(monthStart, today),
           isWeekend: false,
           isFirstOfMonth: true,
           monthLabel: format(monthStart, 'MMMM yyyy', { locale: fr }),
         }));
       }
       
       default:
         return [];
     }
   } catch (error) {
     console.error('[getPeriodUnits] Error generating units:', error);
     return [];
   }
 }
 
 /**
  * Get the column width for the calendar grid based on view mode
  */
 export function getColumnWidth(viewMode: ViewMode, isCompact: boolean = false): number {
   const compactMultiplier = isCompact ? 0.75 : 1;
   
   switch (viewMode) {
     case 'week':
       return Math.round(140 * compactMultiplier);
     case 'month':
       return Math.round(48 * compactMultiplier);
     case 'quarter':
       return Math.round(56 * compactMultiplier);
     case 'year':
       return Math.round(80 * compactMultiplier);
     default:
       return 48;
   }
 }
 
 /**
  * Get period label for display (e.g., "Janvier 2025", "S4 - Janvier 2025")
  */
 export function getPeriodLabel(viewMode: ViewMode, start: Date | null, end: Date | null): string {
   if (!start || !end) return '';
   
   try {
     switch (viewMode) {
       case 'week':
         return `Semaine ${getWeek(start, { locale: fr })} - ${format(start, 'MMMM yyyy', { locale: fr })}`;
       case 'month':
         return format(start, 'MMMM yyyy', { locale: fr });
       case 'quarter':
         return `${format(start, 'MMM', { locale: fr })} - ${format(end, 'MMM yyyy', { locale: fr })}`;
       case 'year':
         return format(start, 'yyyy');
       default:
         return format(start, 'MMMM yyyy', { locale: fr });
     }
   } catch {
     return '';
   }
 }