import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useUserLeaves } from '@/hooks/useUserLeaves';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Calendar, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const LEAVE_TYPES = [
  { value: 'paid', label: 'Congés payés', color: 'bg-green-100 text-green-800' },
  { value: 'rtt', label: 'RTT', color: 'bg-blue-100 text-blue-800' },
  { value: 'sick', label: 'Maladie', color: 'bg-red-100 text-red-800' },
  { value: 'unpaid', label: 'Sans solde', color: 'bg-gray-100 text-gray-800' },
  { value: 'other', label: 'Autre', color: 'bg-purple-100 text-purple-800' },
];

const HALF_DAYS = [
  { value: 'morning', label: 'Matin' },
  { value: 'afternoon', label: 'Après-midi' },
];

export function LeaveManagement() {
  const { profile } = useAuth();
  const { leaves, isLoading, addLeave, cancelLeave, deleteLeave } = useUserLeaves();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    start_date: '',
    end_date: '',
    start_half_day: 'morning' as 'morning' | 'afternoon',
    end_half_day: 'afternoon' as 'morning' | 'afternoon',
    leave_type: 'paid' as 'paid' | 'unpaid' | 'sick' | 'rtt' | 'other',
    description: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.id || !formData.start_date || !formData.end_date) return;

    setIsSubmitting(true);
    try {
      await addLeave({
        user_id: profile.id,
        start_date: formData.start_date,
        end_date: formData.end_date,
        start_half_day: formData.start_half_day,
        end_half_day: formData.end_half_day,
        leave_type: formData.leave_type,
        description: formData.description || null,
      });
      setIsDialogOpen(false);
      setFormData({
        start_date: '',
        end_date: '',
        start_half_day: 'morning',
        end_half_day: 'afternoon',
        leave_type: 'paid',
        description: '',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getLeaveTypeInfo = (type: string) => {
    return LEAVE_TYPES.find(t => t.value === type) || LEAVE_TYPES[4];
  };

  const activeLeaves = leaves.filter(l => l.status === 'declared');
  const cancelledLeaves = leaves.filter(l => l.status === 'cancelled');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Mes congés</h2>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Déclarer un congé
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Déclarer un congé</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Date de début</Label>
                  <Input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Demi-journée début</Label>
                  <Select
                    value={formData.start_half_day}
                    onValueChange={(v) => setFormData({ ...formData, start_half_day: v as 'morning' | 'afternoon' })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {HALF_DAYS.map(h => (
                        <SelectItem key={h.value} value={h.value}>{h.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Date de fin</Label>
                  <Input
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    min={formData.start_date}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Demi-journée fin</Label>
                  <Select
                    value={formData.end_half_day}
                    onValueChange={(v) => setFormData({ ...formData, end_half_day: v as 'morning' | 'afternoon' })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {HALF_DAYS.map(h => (
                        <SelectItem key={h.value} value={h.value}>{h.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Type de congé</Label>
                <Select
                  value={formData.leave_type}
                  onValueChange={(v) => setFormData({ ...formData, leave_type: v as any })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LEAVE_TYPES.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Commentaire (optionnel)</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Raison ou détails..."
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Annuler
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Déclarer
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Active leaves */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Congés déclarés
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activeLeaves.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Aucun congé déclaré
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Période</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Commentaire</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeLeaves.map(leave => {
                  const typeInfo = getLeaveTypeInfo(leave.leave_type);
                  const startHalf = leave.start_half_day === 'morning' ? 'matin' : 'après-midi';
                  const endHalf = leave.end_half_day === 'morning' ? 'matin' : 'après-midi';
                  
                  return (
                    <TableRow key={leave.id}>
                      <TableCell>
                        <div>
                          <span className="font-medium">
                            {format(parseISO(leave.start_date), 'dd MMM yyyy', { locale: fr })}
                          </span>
                          <span className="text-muted-foreground text-sm"> ({startHalf})</span>
                        </div>
                        <div className="text-muted-foreground">
                          au {format(parseISO(leave.end_date), 'dd MMM yyyy', { locale: fr })}
                          <span className="text-sm"> ({endHalf})</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={cn("font-normal", typeInfo.color)}>
                          {typeInfo.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {leave.description || '-'}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (window.confirm('Supprimer ce congé ?')) {
                              deleteLeave(leave.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Cancelled leaves */}
      {cancelledLeaves.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-muted-foreground">Congés annulés</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Période</TableHead>
                  <TableHead>Type</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cancelledLeaves.map(leave => {
                  const typeInfo = getLeaveTypeInfo(leave.leave_type);
                  return (
                    <TableRow key={leave.id} className="opacity-50">
                      <TableCell>
                        {format(parseISO(leave.start_date), 'dd MMM', { locale: fr })} -{' '}
                        {format(parseISO(leave.end_date), 'dd MMM yyyy', { locale: fr })}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{typeInfo.label}</Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
