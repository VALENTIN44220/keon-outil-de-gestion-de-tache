import { TeamMemberWorkload } from '@/types/workload';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
import { TrendingUp, Users, Calendar, Clock, CheckCircle2 } from 'lucide-react';

interface WorkloadSummaryViewProps {
  workloadData: TeamMemberWorkload[];
  startDate: Date;
  endDate: Date;
}

// Member color palette (same as calendar)
const MEMBER_COLORS = [
  'hsl(210, 80%, 55%)',   // Blue
  'hsl(280, 70%, 60%)',   // Purple
  'hsl(340, 75%, 55%)',   // Pink
  'hsl(160, 60%, 45%)',   // Teal
  'hsl(30, 85%, 55%)',    // Orange
  'hsl(200, 75%, 50%)',   // Cyan
  'hsl(260, 65%, 55%)',   // Violet
  'hsl(10, 80%, 55%)',    // Red
];

const getMemberColor = (index: number) => MEMBER_COLORS[index % MEMBER_COLORS.length];

export function WorkloadSummaryView({
  workloadData,
  startDate,
  endDate,
}: WorkloadSummaryViewProps) {
  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getOccupancyColor = (percent: number) => {
    if (percent >= 90) return 'text-red-500';
    if (percent >= 70) return 'text-orange-500';
    if (percent >= 50) return 'text-yellow-500';
    return 'text-emerald-500';
  };

  const getOccupancyBgColor = (percent: number) => {
    if (percent >= 90) return 'bg-red-500';
    if (percent >= 70) return 'bg-orange-500';
    if (percent >= 50) return 'bg-yellow-500';
    return 'bg-emerald-500';
  };

  const getOccupancyBadge = (percent: number) => {
    if (percent >= 90) return { label: 'Surchargé', variant: 'destructive' as const, bg: 'bg-red-100 text-red-700 border-red-200' };
    if (percent >= 70) return { label: 'Chargé', variant: 'default' as const, bg: 'bg-orange-100 text-orange-700 border-orange-200' };
    if (percent >= 50) return { label: 'Modéré', variant: 'secondary' as const, bg: 'bg-yellow-100 text-yellow-700 border-yellow-200' };
    return { label: 'Disponible', variant: 'outline' as const, bg: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
  };

  // Calculate stats for each member
  const memberStats = workloadData.map((member, index) => {
    const availableSlots = member.totalSlots - member.holidaySlots - member.leaveSlots;
    const occupancyPercent = availableSlots > 0 ? Math.round((member.usedSlots / availableSlots) * 100) : 0;
    const freeSlots = availableSlots - member.usedSlots;

    return {
      ...member,
      availableSlots,
      occupancyPercent,
      freeSlots,
      color: getMemberColor(index),
    };
  });

  // Chart data for horizontal bar chart
  const chartData = memberStats.map((m, index) => ({
    name: m.memberName,
    shortName: m.memberName.split(' ')[0],
    occupancy: m.occupancyPercent,
    color: getMemberColor(index),
    initials: getInitials(m.memberName),
  }));

  // Global stats
  const totalSlots = memberStats.reduce((sum, m) => sum + m.availableSlots, 0);
  const totalUsed = memberStats.reduce((sum, m) => sum + m.usedSlots, 0);
  const totalLeave = memberStats.reduce((sum, m) => sum + m.leaveSlots, 0);
  const globalOccupancy = totalSlots > 0 ? Math.round((totalUsed / totalSlots) * 100) : 0;
  const overloadedCount = memberStats.filter(m => m.occupancyPercent >= 90).length;
  const completedTasks = memberStats.reduce((sum, m) => sum + m.usedSlots, 0);

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white/95 backdrop-blur-sm border border-border/50 rounded-xl px-4 py-3 shadow-xl">
          <p className="font-semibold text-foreground">{data.name}</p>
          <p className="text-sm text-muted-foreground">
            Occupation: <span className="font-bold" style={{ color: data.color }}>{data.occupancy}%</span>
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6 p-2">
      {/* Global KPI Cards - 2 colonnes uniformes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Occupation globale */}
        <Card className="relative overflow-hidden border-0 shadow-lg bg-gradient-to-br from-blue-500 to-blue-600">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-blue-100 text-sm font-medium uppercase tracking-wide">Occupation globale</p>
                <p className="text-5xl font-bold text-white mt-2">{globalOccupancy}%</p>
                <p className="text-blue-200 text-xs mt-2">{totalUsed} créneaux utilisés sur {totalSlots}</p>
              </div>
              <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center">
                <TrendingUp className="w-8 h-8 text-white" />
              </div>
            </div>
            <div className="mt-4 h-3 bg-white/30 rounded-full overflow-hidden">
              <div 
                className="h-full bg-white rounded-full transition-all duration-500"
                style={{ width: `${Math.min(globalOccupancy, 100)}%` }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Créneaux planifiés */}
        <Card className="relative overflow-hidden border-0 shadow-lg bg-gradient-to-br from-purple-500 to-purple-600">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-purple-100 text-sm font-medium uppercase tracking-wide">Créneaux planifiés</p>
                <p className="text-5xl font-bold text-white mt-2">{totalUsed}</p>
                <p className="text-purple-200 text-xs mt-2">sur {totalSlots} disponibles</p>
              </div>
              <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center">
                <Clock className="w-8 h-8 text-white" />
              </div>
            </div>
            <div className="mt-4 h-3 bg-white/30 rounded-full overflow-hidden">
              <div 
                className="h-full bg-white rounded-full transition-all duration-500"
                style={{ width: `${totalSlots > 0 ? Math.min((totalUsed / totalSlots) * 100, 100) : 0}%` }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Jours de congés */}
        <Card className="relative overflow-hidden border-0 shadow-lg bg-gradient-to-br from-pink-500 to-pink-600">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-pink-100 text-sm font-medium uppercase tracking-wide">Jours de congés</p>
                <p className="text-5xl font-bold text-white mt-2">{Math.round(totalLeave / 2)}</p>
                <p className="text-pink-200 text-xs mt-2">{totalLeave} demi-journées sur la période</p>
              </div>
              <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center">
                <Calendar className="w-8 h-8 text-white" />
              </div>
            </div>
            <div className="mt-4 h-3 bg-white/30 rounded-full overflow-hidden">
              <div 
                className="h-full bg-white rounded-full transition-all duration-500"
                style={{ width: `${totalSlots > 0 ? Math.min((totalLeave / totalSlots) * 100, 100) : 0}%` }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Membres de l'équipe */}
        <Card className="relative overflow-hidden border-0 shadow-lg bg-gradient-to-br from-teal-500 to-teal-600">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-teal-100 text-sm font-medium uppercase tracking-wide">Membres de l'équipe</p>
                <p className="text-5xl font-bold text-white mt-2">{workloadData.length}</p>
                <p className="text-teal-200 text-xs mt-2">{overloadedCount} surchargé{overloadedCount > 1 ? 's' : ''} sur la période</p>
              </div>
              <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center">
                <Users className="w-8 h-8 text-white" />
              </div>
            </div>
            <div className="mt-4 h-3 bg-white/30 rounded-full overflow-hidden">
              <div 
                className="h-full bg-white rounded-full transition-all duration-500"
                style={{ width: `${workloadData.length > 0 ? Math.min((overloadedCount / workloadData.length) * 100, 100) : 0}%` }}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Members with progress bars */}
        <div className="lg:col-span-2">
          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Users className="w-4 h-4 text-primary" />
                </div>
                Charge par collaborateur
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {memberStats.map((member, index) => {
                const badge = getOccupancyBadge(member.occupancyPercent);
                return (
                  <div 
                    key={member.memberId}
                    className="flex items-center gap-4 p-4 rounded-2xl bg-muted/30 hover:bg-muted/50 transition-colors"
                  >
                    {/* Avatar with letter badge */}
                    <div className="relative">
                      <div 
                        className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-md"
                        style={{ backgroundColor: member.color }}
                      >
                        {getInitials(member.memberName)}
                      </div>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <h4 className="font-semibold text-foreground truncate">{member.memberName}</h4>
                          <p className="text-xs text-muted-foreground">{member.jobTitle || member.department || 'Collaborateur'}</p>
                        </div>
                        <Badge className={cn("border font-medium", badge.bg)}>
                          {badge.label}
                        </Badge>
                      </div>

                      {/* Progress bar - Modern rounded design */}
                      <div className="relative h-8 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="absolute inset-y-0 left-0 rounded-full transition-all duration-500 flex items-center justify-end pr-3"
                          style={{ 
                            width: `${Math.max(member.occupancyPercent, 15)}%`,
                            background: `linear-gradient(90deg, ${member.color}, ${member.color}dd)`
                          }}
                        >
                          <span className="text-white text-sm font-bold drop-shadow-sm">
                            {member.occupancyPercent}%
                          </span>
                        </div>
                      </div>

                      {/* Stats row */}
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span>{member.usedSlots} planifiés</span>
                        <span>•</span>
                        <span>{member.freeSlots > 0 ? member.freeSlots : 0} libres</span>
                        <span>•</span>
                        <span>{member.leaveSlots} congés</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>

        {/* Right: Chart and Stats */}
        <div className="space-y-6">
          {/* Horizontal Bar Chart */}
          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-primary" />
                </div>
                Efficience
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart 
                    data={chartData} 
                    layout="vertical"
                    margin={{ top: 10, right: 40, left: 10, bottom: 10 }}
                  >
                    <XAxis type="number" domain={[0, 100]} hide />
                    <YAxis 
                      dataKey="initials" 
                      type="category" 
                      width={40}
                      tick={{ fontSize: 12, fontWeight: 600 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={false} />
                    <Bar 
                      dataKey="occupancy" 
                      radius={[0, 12, 12, 0]}
                      barSize={24}
                    >
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                      <LabelList 
                        dataKey="occupancy" 
                        position="right" 
                        formatter={(value: number) => `${value}%`}
                        style={{ fontSize: 12, fontWeight: 600, fill: 'hsl(var(--foreground))' }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Completed Tasks */}
          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                </div>
                Répartition créneaux
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                {memberStats.slice(0, 6).map((member, index) => (
                  <div 
                    key={member.memberId}
                    className="flex flex-col items-center p-3 rounded-xl bg-muted/30"
                  >
                    <div 
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm mb-2"
                      style={{ backgroundColor: member.color }}
                    >
                      {getInitials(member.memberName)}
                    </div>
                    <span className="text-xl font-bold text-foreground">{member.usedSlots}</span>
                    <span className="text-xs text-muted-foreground text-center truncate w-full">
                      {member.memberName.split(' ')[0]}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
