import { useState, useEffect, useRef, useMemo, ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  User, Users, FileText, Zap, ChevronRight, GripVertical, Settings2, Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

// Must match ServiceProcessCard color order
const PROCESS_DOT_COLORS = [
  'bg-blue-500', 'bg-violet-500', 'bg-emerald-500', 'bg-orange-500',
  'bg-pink-500', 'bg-cyan-500', 'bg-amber-500', 'bg-teal-500',
];

const PROCESS_BORDER_COLORS = [
  'border-blue-500/40', 'border-violet-500/40', 'border-emerald-500/40', 'border-orange-500/40',
  'border-pink-500/40', 'border-cyan-500/40', 'border-amber-500/40', 'border-teal-500/40',
];

export interface QuickLaunchItem {
  subProcess: { id: string; name: string };
  processId: string;
  processName: string;
  colorIndex: number;
}

interface DraggableActionCardsProps {
  isManager: boolean;
  quickLaunchItems: QuickLaunchItem[];
  onPersonalTask: () => void;
  onTeamTask: () => void;
  onCustomRequest: () => void;
  onQuickLaunch: (subProcessId: string, processId: string) => void;
}

type CardId = 'personal' | 'team' | 'custom' | 'express';

const STORAGE_KEY = 'requests-card-order';

function getStoredOrder(userId: string): CardId[] | null {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}-${userId}`);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return null;
}

function storeOrder(userId: string, order: CardId[]) {
  localStorage.setItem(`${STORAGE_KEY}-${userId}`, JSON.stringify(order));
}

export function DraggableActionCards({
  isManager,
  quickLaunchItems,
  onPersonalTask,
  onTeamTask,
  onCustomRequest,
  onQuickLaunch,
}: DraggableActionCardsProps) {
  const { user } = useAuth();
  const hasExpress = quickLaunchItems.length > 0;

  const defaultOrder = useMemo<CardId[]>(() => {
    const base: CardId[] = ['personal', 'team', 'custom'];
    if (hasExpress) base.push('express');
    return base;
  }, [hasExpress]);

  const [cardOrder, setCardOrder] = useState<CardId[]>(defaultOrder);
  const [isEditing, setIsEditing] = useState(false);
  const [draggedId, setDraggedId] = useState<CardId | null>(null);
  const [dragOverId, setDragOverId] = useState<CardId | null>(null);
  const dragNode = useRef<HTMLDivElement | null>(null);

  // Load saved order
  useEffect(() => {
    if (!user?.id) return;
    const saved = getStoredOrder(user.id);
    if (saved) {
      // Reconcile: keep only visible cards, add new ones at end
      const visible = new Set(defaultOrder);
      const reconciled = saved.filter(id => visible.has(id));
      for (const id of defaultOrder) {
        if (!reconciled.includes(id)) reconciled.push(id);
      }
      setCardOrder(reconciled);
    } else {
      setCardOrder(defaultOrder);
    }
  }, [user?.id, defaultOrder]);

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, id: CardId) => {
    if (!isEditing) return;
    setDraggedId(id);
    dragNode.current = e.currentTarget as HTMLDivElement;
    e.dataTransfer.effectAllowed = 'move';
    // Make transparent after a tick
    setTimeout(() => {
      if (dragNode.current) dragNode.current.style.opacity = '0.4';
    }, 0);
  };

  const handleDragEnd = () => {
    if (dragNode.current) dragNode.current.style.opacity = '1';
    setDraggedId(null);
    setDragOverId(null);
    dragNode.current = null;
  };

  const handleDragOver = (e: React.DragEvent, id: CardId) => {
    e.preventDefault();
    if (!draggedId || draggedId === id) return;
    setDragOverId(id);

    setCardOrder(prev => {
      const fromIdx = prev.indexOf(draggedId);
      const toIdx = prev.indexOf(id);
      if (fromIdx === -1 || toIdx === -1) return prev;
      const next = [...prev];
      next.splice(fromIdx, 1);
      next.splice(toIdx, 0, draggedId);
      return next;
    });
  };

  const handleSave = () => {
    if (user?.id) storeOrder(user.id, cardOrder);
    setIsEditing(false);
  };

  const renderCard = (id: CardId) => {
    const draggable = isEditing;
    const wrapperProps = {
      draggable,
      onDragStart: (e: React.DragEvent<HTMLDivElement>) => handleDragStart(e, id),
      onDragEnd: handleDragEnd,
      onDragOver: (e: React.DragEvent<HTMLDivElement>) => handleDragOver(e, id),
    };

    const editOverlay = isEditing && (
      <div className="absolute top-2 left-2 z-10 cursor-grab active:cursor-grabbing">
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>
    );

    switch (id) {
      case 'personal':
        return (
          <div key={id} {...wrapperProps} className="relative">
            {editOverlay}
            <Card
              className={cn(
                'cursor-pointer hover:shadow-md transition-shadow border-2 hover:border-primary/50 flex flex-col h-full',
                isEditing && 'pointer-events-none ring-2 ring-primary/20',
                dragOverId === id && 'ring-2 ring-primary',
              )}
              onClick={() => !isEditing && onPersonalTask()}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <CardTitle className="text-base">Tâche personnelle</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="flex-1">
                <CardDescription>Créer une tâche pour moi-même</CardDescription>
              </CardContent>
            </Card>
          </div>
        );

      case 'team':
        return (
          <div key={id} {...wrapperProps} className="relative">
            {editOverlay}
            <Card
              className={cn(
                'cursor-pointer hover:shadow-md transition-shadow border-2 hover:border-primary/50 flex flex-col h-full',
                !isManager && 'opacity-50',
                isEditing && 'pointer-events-none ring-2 ring-primary/20',
                dragOverId === id && 'ring-2 ring-primary',
              )}
              onClick={() => !isEditing && isManager && onTeamTask()}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/10">
                    <Users className="h-5 w-5 text-blue-500" />
                  </div>
                  <CardTitle className="text-base">Affecter à mon équipe</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="flex-1">
                <CardDescription>
                  {isManager ? "Affecter une tâche à un membre de votre équipe" : "Réservé aux managers"}
                </CardDescription>
              </CardContent>
            </Card>
          </div>
        );

      case 'custom':
        return (
          <div key={id} {...wrapperProps} className="relative">
            {editOverlay}
            <Card
              className={cn(
                'cursor-pointer hover:shadow-md transition-shadow border-2 hover:border-accent/50 flex flex-col h-full',
                isEditing && 'pointer-events-none ring-2 ring-primary/20',
                dragOverId === id && 'ring-2 ring-primary',
              )}
              onClick={() => !isEditing && onCustomRequest()}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-accent/10">
                    <FileText className="h-5 w-5 text-accent-foreground" />
                  </div>
                  <CardTitle className="text-base">Demande personnalisée</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="flex-1">
                <CardDescription>Créer une demande libre à un service</CardDescription>
              </CardContent>
            </Card>
          </div>
        );

      case 'express':
        if (!hasExpress) return null;
        return (
          <div key={id} {...wrapperProps} className="relative">
            {editOverlay}
            <Card
              className={cn(
                'border-2 border-dashed border-primary/30 bg-primary/5 flex flex-col h-full',
                isEditing && 'pointer-events-none ring-2 ring-primary/20',
                dragOverId === id && 'ring-2 ring-primary',
              )}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/15">
                    <Zap className="h-5 w-5 text-primary" />
                  </div>
                  <CardTitle className="text-base">Demande express</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col gap-1.5 pt-0">
                {quickLaunchItems.map(({ subProcess, processId, colorIndex }) => {
                  const borderColor = PROCESS_BORDER_COLORS[colorIndex % PROCESS_BORDER_COLORS.length];
                  return (
                    <Button
                      key={subProcess.id}
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "w-full justify-start text-xs h-8 gap-2 hover:bg-primary/10 hover:text-primary px-2 rounded-lg border",
                        borderColor,
                      )}
                      onClick={() => !isEditing && onQuickLaunch(subProcess.id, processId)}
                      disabled={isEditing}
                    >
                      <span className={cn("h-2.5 w-2.5 rounded-full shrink-0", PROCESS_DOT_COLORS[colorIndex % PROCESS_DOT_COLORS.length])} />
                      <span className="truncate">{subProcess.name}</span>
                    </Button>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        );

      default:
        return null;
    }
  };

  const colCount = cardOrder.filter(id => id !== 'express' || hasExpress).length;

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        {isEditing ? (
          <Button size="sm" variant="default" className="gap-1.5 text-xs" onClick={handleSave}>
            <Check className="h-3.5 w-3.5" />
            Enregistrer la disposition
          </Button>
        ) : (
          <Button size="sm" variant="ghost" className="gap-1.5 text-xs text-muted-foreground" onClick={() => setIsEditing(true)}>
            <Settings2 className="h-3.5 w-3.5" />
            Personnaliser
          </Button>
        )}
      </div>
      <div className={cn(
        'grid grid-cols-1 md:grid-cols-2 gap-4',
        colCount >= 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3',
      )}>
        {cardOrder.map(id => renderCard(id))}
      </div>
    </div>
  );
}
