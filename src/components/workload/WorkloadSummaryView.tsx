import { TeamMemberWorkload } from '@/types/workload';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface WorkloadSummaryViewProps {
  workloadData: TeamMemberWorkload[];
  startDate: Date;
  endDate: Date;
}

export function WorkloadSummaryView({
  workloadData,
  startDate,
  endDate,
}: WorkloadSummaryViewProps) {
  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getOccupancyColor = (percent: number) => {
    if (percent >= 90) return 'text-red-600';
    if (percent >= 70) return 'text-orange-600';
    if (percent >= 50) return 'text-yellow-600';
    return 'text-green-600';
  };

  const getOccupancyBadge = (percent: number) => {
    if (percent >= 90) return { label: 'Surchargé', variant: 'destructive' as const };
    if (percent >= 70) return { label: 'Chargé', variant: 'default' as const };
    if (percent >= 50) return { label: 'Modéré', variant: 'secondary' as const };
    return { label: 'Disponible', variant: 'outline' as const };
  };

  // Calculate stats for each member
  const memberStats = workloadData.map(member => {
    const availableSlots = member.totalSlots - member.holidaySlots - member.leaveSlots;
    const occupancyPercent = availableSlots > 0 ? Math.round((member.usedSlots / availableSlots) * 100) : 0;
    const freeSlots = availableSlots - member.usedSlots;

    return {
      ...member,
      availableSlots,
      occupancyPercent,
      freeSlots,
    };
  });

  // Chart data
  const chartData = memberStats.map(m => ({
    name: m.memberName.split(' ')[0],
    Planifié: m.usedSlots,
    Congés: m.leaveSlots,
    Libre: m.freeSlots > 0 ? m.freeSlots : 0,
  }));

  // Global stats
  const totalSlots = memberStats.reduce((sum, m) => sum + m.availableSlots, 0);
  const totalUsed = memberStats.reduce((sum, m) => sum + m.usedSlots, 0);
  const totalLeave = memberStats.reduce((sum, m) => sum + m.leaveSlots, 0);
  const globalOccupancy = totalSlots > 0 ? Math.round((totalUsed / totalSlots) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Global stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Taux d'occupation global</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={cn("text-3xl font-bold", getOccupancyColor(globalOccupancy))}>
              {globalOccupancy}%
            </div>
            <Progress value={globalOccupancy} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Créneaux planifiés</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalUsed}</div>
            <p className="text-xs text-muted-foreground">sur {totalSlots} disponibles</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Jours de congés</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{Math.round(totalLeave / 2)}</div>
            <p className="text-xs text-muted-foreground">{totalLeave} demi-journées</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Membres de l'équipe</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{workloadData.length}</div>
            <p className="text-xs text-muted-foreground">
              {memberStats.filter(m => m.occupancyPercent >= 90).length} surchargés
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Répartition par collaborateur</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={80} />
                <Tooltip />
                <Legend />
                <Bar dataKey="Planifié" stackId="a" fill="hsl(var(--primary))" />
                <Bar dataKey="Congés" stackId="a" fill="hsl(210, 80%, 60%)" />
                <Bar dataKey="Libre" stackId="a" fill="hsl(var(--muted))" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Detailed table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Détail par collaborateur</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Collaborateur</TableHead>
                <TableHead>Service</TableHead>
                <TableHead className="text-center">Créneaux dispo.</TableHead>
                <TableHead className="text-center">Planifiés</TableHead>
                <TableHead className="text-center">Congés</TableHead>
                <TableHead className="text-center">Libres</TableHead>
                <TableHead className="text-center">Occupation</TableHead>
                <TableHead>Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {memberStats.map(member => {
                const badge = getOccupancyBadge(member.occupancyPercent);
                return (
                  <TableRow key={member.memberId}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={member.avatarUrl || undefined} />
                          <AvatarFallback className="text-xs">
                            {getInitials(member.memberName)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">{member.memberName}</div>
                          <div className="text-xs text-muted-foreground">{member.jobTitle}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{member.department || '-'}</TableCell>
                    <TableCell className="text-center">{member.availableSlots}</TableCell>
                    <TableCell className="text-center font-medium">{member.usedSlots}</TableCell>
                    <TableCell className="text-center text-blue-600">{member.leaveSlots}</TableCell>
                    <TableCell className="text-center text-green-600">
                      {member.freeSlots > 0 ? member.freeSlots : 0}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={cn("font-bold", getOccupancyColor(member.occupancyPercent))}>
                        {member.occupancyPercent}%
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
