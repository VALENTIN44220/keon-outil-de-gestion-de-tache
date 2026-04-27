import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  MarkerType,
  NodeResizer,
  Position,
  Handle,
  EdgeLabelRenderer,
  getSmoothStepPath,
  useNodesState,
  useEdgesState,
  type Node,
  type NodeProps,
  type Edge,
  type EdgeProps,
  type NodeChange,
  type Connection,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from '@dagrejs/dagre';
import { Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { ITSolutionLinkFormDialog } from '@/components/it/ITSolutionLinkFormDialog';
import { useITSolutions } from '@/hooks/useITSolutions';
import { extractErrorMessage } from '@/lib/extractErrorMessage';
import {
  CRITICITE_CONFIG,
  DATALAKE_CONFIG,
  DIRECTION_LABEL,
  FLUX_TYPE_CONFIG,
  resolveFluxType,
  type ITSolution,
  type ITSolutionCriticite,
  type ITSolutionDatalakeStatus,
  type ITSolutionLink,
} from '@/types/itSolution';

interface Props {
  solutions: ITSolution[];
  links: ITSolutionLink[];
  onSelectSolution?: (s: ITSolution) => void;
}

// ─── Color-by mechanism ───────────────────────────────────────────────────

type ColorBy = 'criticite' | 'perimetre' | 'categorie' | 'type' | 'domaine_metier' | 'usage_principal' | 'connecte_datalake';

const COLOR_BY_LABEL: Record<ColorBy, string> = {
  criticite:          'Criticité',
  perimetre:          'Périmètre / entité',
  categorie:          'Catégorie',
  type:               'Type',
  domaine_metier:     'Domaine métier',
  usage_principal:    'Usage principal',
  connecte_datalake:  'Connexion Datalake',
};

const PALETTE = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#84cc16',
  '#a855f7', '#0ea5e9', '#22c55e', '#eab308',
];

/** Hash deterministe d'une chaîne vers une couleur de la palette. */
function colorFromString(s: string): string {
  let hash = 0;
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

const CRITICITE_COLOR: Record<ITSolutionCriticite, string> = {
  faible:      '#94a3b8',
  moyenne:     '#3b82f6',
  forte:       '#f97316',
  tres_forte:  '#ef4444',
};

const DATALAKE_COLOR: Record<ITSolutionDatalakeStatus, string> = {
  oui:       '#10b981',
  non:       '#94a3b8',
  indirect:  '#f59e0b',
  na:        '#cbd5e1',
};

/** Couleur de bordure d'un nœud selon le critère choisi. */
function colorForSolution(s: ITSolution, by: ColorBy): { color: string; label: string } {
  if (by === 'criticite') {
    if (!s.criticite) return { color: '#cbd5e1', label: 'Non définie' };
    return { color: CRITICITE_COLOR[s.criticite], label: CRITICITE_CONFIG[s.criticite].label };
  }
  if (by === 'connecte_datalake') {
    if (!s.connecte_datalake) return { color: '#cbd5e1', label: 'Non défini' };
    return { color: DATALAKE_COLOR[s.connecte_datalake], label: DATALAKE_CONFIG[s.connecte_datalake].label };
  }
  // Champs texte libre : hash → couleur stable
  const v = (s[by] as string | null | undefined)?.trim() ?? '';
  if (!v) return { color: '#cbd5e1', label: 'Non défini' };
  return { color: colorFromString(v), label: v };
}

/** Légende dynamique : valeurs distinctes du critère + leur couleur. */
function buildLegend(solutions: ITSolution[], by: ColorBy): { color: string; label: string; count: number }[] {
  const map = new Map<string, { color: string; label: string; count: number }>();
  for (const s of solutions) {
    const { color, label } = colorForSolution(s, by);
    const key = label;
    const cur = map.get(key);
    if (cur) cur.count += 1;
    else map.set(key, { color, label, count: 1 });
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}

const DEFAULT_NODE_W = 220;
const DEFAULT_NODE_H = 90;

type SolutionNodeData = Record<string, unknown> & {
  solution: ITSolution;
  borderColor: string;
  onSelect?: (s: ITSolution) => void;
};

type SolutionLinkData = Record<string, unknown> & {
  link: ITSolutionLink;
  onEdit: (link: ITSolutionLink) => void;
};

// ─── Layout dagre (sans croisement) ───────────────────────────────────────

function dagreLayout(
  solutions: ITSolution[],
  links: ITSolutionLink[]
): Record<string, { x: number; y: number }> {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: 'LR', nodesep: 60, ranksep: 120, marginx: 20, marginy: 20 });
  g.setDefaultEdgeLabel(() => ({}));

  for (const s of solutions) {
    g.setNode(s.id, { width: s.width ?? DEFAULT_NODE_W, height: s.height ?? DEFAULT_NODE_H });
  }
  for (const l of links) {
    if (g.hasNode(l.source_solution_id) && g.hasNode(l.target_solution_id)) {
      g.setEdge(l.source_solution_id, l.target_solution_id);
    }
  }

  dagre.layout(g);

  const out: Record<string, { x: number; y: number }> = {};
  for (const s of solutions) {
    const n = g.node(s.id);
    if (n) {
      const w = s.width ?? DEFAULT_NODE_W;
      const h = s.height ?? DEFAULT_NODE_H;
      out[s.id] = { x: n.x - w / 2, y: n.y - h / 2 };
    }
  }
  return out;
}

// ─── Custom node ──────────────────────────────────────────────────────────

function SolutionNode({ data, selected }: NodeProps<Node<SolutionNodeData>>) {
  const { solution: s, onSelect, borderColor } = data;
  return (
    <div
      onClick={() => onSelect?.(s)}
      className={cn(
        'group relative h-full w-full rounded-lg border-2 bg-background shadow-sm hover:shadow-md transition-shadow px-3 py-2 cursor-pointer overflow-hidden',
        selected && 'ring-2 ring-primary'
      )}
      style={{ borderColor }}
    >
      <NodeResizer
        color="#6366f1"
        isVisible={selected}
        minWidth={140}
        minHeight={64}
        handleClassName="!w-2 !h-2 !rounded-sm"
        lineClassName="!border-primary"
      />

      {/*
        Chaque cote a une paire source/target — l'utilisateur peut tirer un
        lien dans les deux sens sans avoir a viser le bon point. Visibles au
        hover grace au styling group/node.
      */}
      {(['top', 'right', 'bottom', 'left'] as const).map((side) => {
        const positionMap: Record<typeof side, Position> = {
          top: Position.Top, right: Position.Right, bottom: Position.Bottom, left: Position.Left,
        };
        const pos = positionMap[side];
        return (
          <span key={side}>
            <Handle
              type="source"
              position={pos}
              id={`s-${side}`}
              className="!w-3 !h-3 !rounded-full !bg-primary !border-2 !border-background opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ zIndex: 2 }}
            />
            <Handle
              type="target"
              position={pos}
              id={`t-${side}`}
              className="!w-3 !h-3 !rounded-full !bg-emerald-500 !border-2 !border-background opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ zIndex: 1 }}
            />
          </span>
        );
      })}

      <div className="flex items-start gap-2 h-full">
        {s.logo_url && (
          <img
            src={s.logo_url}
            alt=""
            className="h-8 w-8 shrink-0 rounded border bg-white object-contain p-0.5"
            draggable={false}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold leading-tight break-words">{s.nom}</p>
          {s.categorie && (
            <p className="text-[10px] text-muted-foreground leading-tight break-words mt-0.5">{s.categorie}</p>
          )}
        </div>
        {s.criticite && (
          <Badge
            variant="outline"
            className={cn('shrink-0 text-[9px] h-4 px-1', CRITICITE_CONFIG[s.criticite].className)}
          >
            {CRITICITE_CONFIG[s.criticite].label}
          </Badge>
        )}
      </div>
    </div>
  );
}

// ─── Custom edge ──────────────────────────────────────────────────────────

function CharacterizedEdge(props: EdgeProps<Edge<SolutionLinkData>>) {
  const { sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, markerEnd, data, id, style, markerStart } = props;
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, borderRadius: 12,
  });

  const link = data?.link;
  const flux = link?.type_flux ? resolveFluxType(link.type_flux) : null;
  const direction = link?.direction ? DIRECTION_LABEL[link.direction] : null;

  return (
    <>
      <path
        id={id}
        d={edgePath}
        fill="none"
        stroke={flux?.color ?? '#6b7280'}
        strokeWidth={2}
        markerEnd={markerEnd}
        markerStart={markerStart}
        style={style}
      />
      {link && (
        <EdgeLabelRenderer>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); data?.onEdit(link); }}
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            }}
            className="absolute pointer-events-auto rounded-full border bg-background px-2 py-0.5 text-[10px] shadow-sm hover:bg-accent transition-colors"
          >
            <span className="font-medium" style={{ color: flux?.color }}>
              {flux?.label ?? '·'}
            </span>
            {direction && <span className="ml-1 text-muted-foreground">{direction.symbol}</span>}
          </button>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

const nodeTypes = { solution: SolutionNode };
const edgeTypes = { characterized: CharacterizedEdge };

// ─── Main component ───────────────────────────────────────────────────────

export function ITCartographieGraph({ solutions, links, onSelectSolution }: Props) {
  const { updateSolutionLayout, createSolutionLink } = useITSolutions();
  const [editingLink, setEditingLink] = useState<ITSolutionLink | null>(null);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [colorBy, setColorBy] = useState<ColorBy>('criticite');
  const [defaultLink, setDefaultLink] = useState<{ source: string; target: string } | null>(null);

  const initialPositions = useMemo(() => {
    const fallback = dagreLayout(solutions, links);
    const positions: Record<string, { x: number; y: number }> = {};
    for (const s of solutions) {
      if (typeof s.position_x === 'number' && typeof s.position_y === 'number') {
        positions[s.id] = { x: Number(s.position_x), y: Number(s.position_y) };
      } else {
        positions[s.id] = fallback[s.id] ?? { x: 0, y: 0 };
      }
    }
    return positions;
  }, [solutions, links]);

  const buildNodes = useCallback((): Node<SolutionNodeData>[] =>
    solutions.map((s) => {
      const { color } = colorForSolution(s, colorBy);
      return {
        id: s.id,
        type: 'solution',
        position: initialPositions[s.id] ?? { x: 0, y: 0 },
        width: s.width ?? DEFAULT_NODE_W,
        height: s.height ?? DEFAULT_NODE_H,
        style: { width: s.width ?? DEFAULT_NODE_W, height: s.height ?? DEFAULT_NODE_H },
        data: { solution: s, onSelect: onSelectSolution, borderColor: color },
      };
    }),
    [solutions, initialPositions, onSelectSolution, colorBy]
  );

  const buildEdges = useCallback((): Edge<SolutionLinkData>[] =>
    links.map((l) => {
      const flux = l.type_flux ? resolveFluxType(l.type_flux) : null;
      return {
        id: l.id,
        source: l.source_solution_id,
        target: l.target_solution_id,
        type: 'characterized',
        animated: l.criticite === 'tres_forte' || l.criticite === 'forte',
        markerEnd: { type: MarkerType.ArrowClosed, color: flux?.color ?? '#6b7280' },
        markerStart: l.direction === 'bidirectionnel'
          ? { type: MarkerType.ArrowClosed, color: flux?.color ?? '#6b7280' }
          : undefined,
        style: { stroke: flux?.color ?? '#6b7280', strokeWidth: 2 },
        data: {
          link: l,
          onEdit: (link) => { setEditingLink(link); setLinkDialogOpen(true); },
        },
      };
    }),
    [links]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState<Node<SolutionNodeData>>(buildNodes());
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge<SolutionLinkData>>(buildEdges());

  useEffect(() => { setNodes(buildNodes()); }, [buildNodes, setNodes]);
  useEffect(() => { setEdges(buildEdges()); }, [buildEdges, setEdges]);

  // Debounce de persistance pour drag/resize
  const pendingTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const schedulePersist = useCallback((id: string, payload: { x?: number; y?: number; w?: number; h?: number }) => {
    const existing = pendingTimers.current.get(id);
    if (existing) clearTimeout(existing);
    const t = setTimeout(() => {
      pendingTimers.current.delete(id);
      updateSolutionLayout.mutate({
        id,
        position_x: payload.x,
        position_y: payload.y,
        width: payload.w,
        height: payload.h,
      });
    }, 600);
    pendingTimers.current.set(id, t);
  }, [updateSolutionLayout]);

  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    onNodesChange(changes);
    for (const c of changes) {
      if (c.type === 'position' && c.position && !c.dragging) {
        schedulePersist(c.id, { x: c.position.x, y: c.position.y });
      } else if (c.type === 'dimensions' && c.dimensions && c.resizing === false) {
        schedulePersist(c.id, { w: c.dimensions.width, h: c.dimensions.height });
      }
    }
  }, [onNodesChange, schedulePersist]);

  /**
   * onConnect : declenche apres qu'on a tire un lien entre 2 handles. On
   * cree un lien minimal en DB (direction source->target par defaut) puis
   * on ouvre directement le dialogue d'edition pour caracteriser le flux.
   */
  const handleConnect = useCallback(async (conn: Connection) => {
    if (!conn.source || !conn.target || conn.source === conn.target) return;
    try {
      const created = await createSolutionLink.mutateAsync({
        source_solution_id: conn.source,
        target_solution_id: conn.target,
        type_flux: null,
        direction: 'source_to_target',
        protocole: null,
        frequence: null,
        criticite: null,
        description: null,
      });
      setEditingLink(created);
      setDefaultLink(null);
      setLinkDialogOpen(true);
    } catch (e) {
      toast({ title: 'Erreur de creation du lien', description: extractErrorMessage(e), variant: 'destructive' });
    }
  }, [createSolutionLink]);

  const openCreateLink = useCallback(() => {
    setEditingLink(null);
    setDefaultLink(null);
    setLinkDialogOpen(true);
  }, []);

  const legend = useMemo(() => buildLegend(solutions, colorBy), [solutions, colorBy]);

  return (
    <div className="relative h-full w-full">
      {/* Toolbar : color-by + nouveau lien */}
      <div className="absolute top-2 right-2 z-10 flex items-center gap-2">
        <div className="flex items-center gap-2 rounded-md border bg-background/90 backdrop-blur px-2 py-1 shadow-sm">
          <Label className="text-xs text-muted-foreground whitespace-nowrap">Couleur par</Label>
          <Select value={colorBy} onValueChange={(v) => setColorBy(v as ColorBy)}>
            <SelectTrigger className="h-7 text-xs min-w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.entries(COLOR_BY_LABEL) as [ColorBy, string][]).map(([k, label]) => (
                <SelectItem key={k} value={k}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button type="button" size="sm" onClick={openCreateLink} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          Nouveau lien
        </Button>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={handleConnect}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        minZoom={0.15}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        connectionRadius={30}
      >
        <Background gap={24} />
        <Controls showInteractive={false} />
        <MiniMap nodeStrokeWidth={3} pannable zoomable />
      </ReactFlow>

      {/* Légende dynamique : couleurs des cards selon le critère choisi */}
      <div className="absolute bottom-2 left-2 z-10 rounded-md border bg-background/90 backdrop-blur p-2 text-[11px] shadow-sm max-w-[260px]">
        <p className="font-semibold mb-1">Couleurs des cartes — {COLOR_BY_LABEL[colorBy]}</p>
        <div className="flex flex-col gap-0.5 max-h-[160px] overflow-y-auto pr-1">
          {legend.map((entry) => (
            <div key={entry.label} className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded shrink-0 border border-border/50" style={{ backgroundColor: entry.color }} />
              <span className="truncate">{entry.label}</span>
              <span className="ml-auto text-muted-foreground">{entry.count}</span>
            </div>
          ))}
        </div>

        <div className="border-t mt-2 pt-2 space-y-1">
          <p className="font-semibold">Types de flux (arêtes)</p>
          {(Object.entries(FLUX_TYPE_CONFIG) as [keyof typeof FLUX_TYPE_CONFIG, typeof FLUX_TYPE_CONFIG.data][]).map(([k, v]) => (
            <div key={k} className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-0.5 rounded shrink-0" style={{ backgroundColor: v.color }} />
              <span>{v.label}</span>
            </div>
          ))}
        </div>

        <p className="text-[10px] text-muted-foreground italic mt-2">
          Survolez une carte pour voir les points de connexion. Tirez d'un point bleu pour créer un lien.
        </p>
      </div>

      <ITSolutionLinkFormDialog
        open={linkDialogOpen}
        onOpenChange={setLinkDialogOpen}
        link={editingLink}
        defaultSourceId={defaultLink?.source}
        defaultTargetId={defaultLink?.target}
      />
    </div>
  );
}
