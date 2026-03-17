import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import * as d3 from 'd3';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { ZoomIn, ZoomOut, Minimize2 } from 'lucide-react';
import { STATUS_CONFIG, GROUPING_FIELDS, type InnoRequest, type GroupingField } from './constants';

interface Props {
  requests: InnoRequest[];
  onOpenDetail: (id: string) => void;
}

const BRANCH_COLORS = [
  '#6366f1', '#f59e0b', '#10b981', '#ef4444',
  '#8b5cf6', '#06b6d4', '#f97316', '#ec4899',
  '#84cc16', '#14b8a6',
];

const PASTEL = [
  '#e0e7ff', '#fef3c7', '#d1fae5', '#fee2e2',
  '#ede9fe', '#cffafe', '#ffedd5', '#fce7f3',
  '#ecfccb', '#ccfbf1',
];

// ── Data types ──

interface MindNode {
  id: string;
  label: string;
  count?: number;
  level: number;
  colorIdx: number;
  requestId?: string;
  status?: string;
  children?: MindNode[];
  expanded?: boolean;
}

// ── Tree builder ──

function getVal(r: InnoRequest, field: GroupingField): string {
  if (field === 'status') return STATUS_CONFIG[r.status]?.label || r.status;
  return (r[field] as string) || '(vide)';
}

function buildTree(
  requests: InnoRequest[],
  groupBy: GroupingField,
  subGroupBy: GroupingField | null,
  expanded: Set<string>,
  expandedSub: Set<string>,
): MindNode {
  const groups = new Map<string, InnoRequest[]>();
  requests.forEach(r => {
    const k = getVal(r, groupBy);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(r);
  });

  const groupEntries = [...groups.entries()].sort((a, b) => b[1].length - a[1].length);

  const children: MindNode[] = groupEntries.map(([groupKey, groupReqs], gi) => {
    const gId = `g-${groupKey}`;
    const isExpanded = expanded.has(gId);
    let subChildren: MindNode[] = [];

    if (isExpanded) {
      if (subGroupBy) {
        const subGroups = new Map<string, InnoRequest[]>();
        groupReqs.forEach(r => {
          const sk = getVal(r, subGroupBy);
          if (!subGroups.has(sk)) subGroups.set(sk, []);
          subGroups.get(sk)!.push(r);
        });
        subChildren = [...subGroups.entries()].sort((a, b) => b[1].length - a[1].length).map(([subKey, subReqs], si) => {
          const subId = `sg-${groupKey}-${subKey}`;
          const isSubExpanded = expandedSub.has(subId);
          const leafChildren: MindNode[] = isSubExpanded
            ? subReqs.slice(0, 12).map(r => ({
                id: `leaf-${r.id}`,
                label: r.nom_projet || r.title,
                level: 3,
                colorIdx: gi,
                requestId: r.id,
                status: r.status,
              }))
            : [];
          return {
            id: subId,
            label: subKey,
            count: subReqs.length,
            level: 2,
            colorIdx: gi,
            children: leafChildren.length > 0 ? leafChildren : undefined,
          };
        });
      } else {
        subChildren = groupReqs.slice(0, 15).map(r => ({
          id: `leaf-${r.id}`,
          label: r.nom_projet || r.title,
          level: 3,
          colorIdx: gi,
          requestId: r.id,
          status: r.status,
        }));
      }
    }

    return {
      id: gId,
      label: groupKey,
      count: groupReqs.length,
      level: 1,
      colorIdx: gi,
      children: subChildren.length > 0 ? subChildren : undefined,
      expanded: isExpanded,
    };
  });

  return {
    id: 'root',
    label: 'Innovation',
    count: requests.length,
    level: 0,
    colorIdx: 0,
    children,
  };
}

// ── D3 Rendering ──

function renderMindMap(
  svgEl: SVGSVGElement,
  tree: MindNode,
  onNodeClick: (node: MindNode) => void,
  width: number,
  height: number,
) {
  const svg = d3.select(svgEl);
  svg.selectAll('*').remove();

  svg.attr('width', width).attr('height', height);

  const g = svg.append('g').attr('class', 'mindmap-root');

  // Zoom & pan
  const zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
    .scaleExtent([0.2, 4])
    .on('zoom', e => g.attr('transform', e.transform.toString()));
  svg.call(zoomBehavior);

  // Build D3 hierarchy
  const root = d3.hierarchy(tree, d => d.children?.length ? d.children : null);

  // Radial tree layout
  const maxDepth = root.height;
  const radius = Math.min(width, height) / 2 * 0.75;
  const depthRadius = radius / Math.max(maxDepth, 1);

  const treeLayout = d3.tree<MindNode>()
    .size([2 * Math.PI, radius])
    .separation((a, b) => {
      if (a.depth === 0) return 1;
      const baseSep = (a.parent === b.parent ? 1 : 1.8);
      // More separation at deeper levels with many siblings
      const siblingCount = a.parent?.children?.length || 1;
      return baseSep / Math.max(a.depth * 0.7, 0.5) * Math.max(1, 8 / siblingCount);
    });

  const layoutRoot = treeLayout(root);

  // Project radial coords
  function project(d: d3.HierarchyPointNode<MindNode>): [number, number] {
    const angle = d.x - Math.PI / 2;
    return [d.y * Math.cos(angle), d.y * Math.sin(angle)];
  }

  // ── Draw links ──
  const linkGen = d3.linkRadial<d3.HierarchyPointLink<MindNode>, d3.HierarchyPointNode<MindNode>>()
    .angle(d => d.x)
    .radius(d => d.y);

  g.selectAll('.link')
    .data(layoutRoot.links())
    .enter()
    .append('path')
    .attr('class', 'link')
    .attr('d', linkGen as any)
    .attr('fill', 'none')
    .attr('stroke', d => {
      const colorIdx = d.target.data.colorIdx;
      return BRANCH_COLORS[colorIdx % BRANCH_COLORS.length];
    })
    .attr('stroke-width', d => {
      const level = d.target.data.level;
      return level === 1 ? 3.5 : level === 2 ? 2.5 : 1.5;
    })
    .attr('stroke-opacity', d => {
      const level = d.target.data.level;
      return level === 1 ? 0.7 : level === 2 ? 0.55 : 0.4;
    })
    .attr('stroke-linecap', 'round');

  // ── Draw nodes ──
  const nodeGroups = g.selectAll('.node')
    .data(layoutRoot.descendants())
    .enter()
    .append('g')
    .attr('class', 'node')
    .attr('transform', d => {
      if (d.depth === 0) return 'translate(0,0)';
      const [x, y] = project(d);
      return `translate(${x},${y})`;
    })
    .style('cursor', d => d.data.level < 3 ? 'pointer' : 'pointer')
    .on('click', (event, d) => {
      event.stopPropagation();
      onNodeClick(d.data);
    });

  // Draw shapes per level
  nodeGroups.each(function(d) {
    const node = d3.select(this);
    const data = d.data;
    const colorIdx = data.colorIdx;
    const color = BRANCH_COLORS[colorIdx % BRANCH_COLORS.length];
    const pastel = PASTEL[colorIdx % PASTEL.length];

    if (data.level === 0) {
      // ROOT — large gradient circle
      const defs = svg.select('defs').empty() ? svg.append('defs') : svg.select('defs');
      const gradId = 'root-grad';
      if (defs.select(`#${gradId}`).empty()) {
        const grad = defs.append('radialGradient').attr('id', gradId);
        grad.append('stop').attr('offset', '0%').attr('stop-color', '#818cf8');
        grad.append('stop').attr('offset', '100%').attr('stop-color', '#6366f1');
      }
      node.append('circle')
        .attr('r', 56)
        .attr('fill', `url(#${gradId})`)
        .attr('filter', 'drop-shadow(0 6px 20px rgba(99,102,241,0.45))');
      node.append('circle')
        .attr('r', 50)
        .attr('fill', 'none')
        .attr('stroke', 'rgba(255,255,255,0.25)')
        .attr('stroke-width', 2);

      node.append('text')
        .attr('text-anchor', 'middle').attr('dy', '-0.3em')
        .attr('fill', '#fff').attr('font-size', 14).attr('font-weight', 700)
        .attr('pointer-events', 'none')
        .text('Innovation');
      node.append('text')
        .attr('text-anchor', 'middle').attr('dy', '1.2em')
        .attr('fill', 'rgba(255,255,255,0.8)').attr('font-size', 11)
        .attr('pointer-events', 'none')
        .text(`${data.count} demandes`);

    } else if (data.level === 1) {
      // GROUP — rounded pill
      const truncLabel = data.label.length > 20 ? data.label.slice(0, 20) + '…' : data.label;
      const textW = Math.max(truncLabel.length * 7.5, 70);
      const w = textW + 40;
      const h = 34;
      const isExp = data.expanded;

      node.append('rect')
        .attr('x', -w / 2).attr('y', -h / 2)
        .attr('width', w).attr('height', h)
        .attr('rx', h / 2).attr('ry', h / 2)
        .attr('fill', isExp ? color : pastel)
        .attr('stroke', color)
        .attr('stroke-width', 2)
        .attr('filter', 'drop-shadow(0 2px 8px rgba(0,0,0,0.12))');

      node.append('text')
        .attr('text-anchor', 'middle')
        .attr('dy', '0.35em')
        .attr('x', -10)
        .attr('fill', isExp ? '#fff' : color)
        .attr('font-size', 11).attr('font-weight', 600)
        .attr('pointer-events', 'none')
        .text(truncLabel);

      // Count badge
      const badgeX = w / 2 - 16;
      node.append('circle')
        .attr('cx', badgeX).attr('cy', 0)
        .attr('r', 11)
        .attr('fill', isExp ? 'rgba(255,255,255,0.25)' : color);
      node.append('text')
        .attr('text-anchor', 'middle')
        .attr('x', badgeX).attr('dy', '0.38em')
        .attr('fill', '#fff').attr('font-size', 9).attr('font-weight', 700)
        .attr('pointer-events', 'none')
        .text(data.count ?? '');

    } else if (data.level === 2) {
      // SUB-GROUP — smaller pill
      const truncLabel = data.label.length > 18 ? data.label.slice(0, 18) + '…' : data.label;
      const textW = Math.max(truncLabel.length * 6.5, 55);
      const w = textW + 32;
      const h = 26;

      node.append('rect')
        .attr('x', -w / 2).attr('y', -h / 2)
        .attr('width', w).attr('height', h)
        .attr('rx', h / 2).attr('ry', h / 2)
        .attr('fill', pastel)
        .attr('stroke', color)
        .attr('stroke-width', 1.5)
        .attr('opacity', 0.92);

      node.append('text')
        .attr('text-anchor', 'middle')
        .attr('dy', '0.35em')
        .attr('x', -8)
        .attr('fill', color)
        .attr('font-size', 10).attr('font-weight', 500)
        .attr('pointer-events', 'none')
        .text(truncLabel);

      if (data.count != null) {
        const badgeX = w / 2 - 13;
        node.append('circle')
          .attr('cx', badgeX).attr('cy', 0)
          .attr('r', 9)
          .attr('fill', `${color}cc`);
        node.append('text')
          .attr('text-anchor', 'middle')
          .attr('x', badgeX).attr('dy', '0.38em')
          .attr('fill', '#fff').attr('font-size', 8).attr('font-weight', 700)
          .attr('pointer-events', 'none')
          .text(data.count);
      }

    } else {
      // LEAF — small status-colored pill
      const statusColor = STATUS_CONFIG[data.status || '']?.color || '#888';
      const truncLabel = data.label.length > 20 ? data.label.slice(0, 20) + '…' : data.label;
      const w = Math.max(truncLabel.length * 6, 60);
      const h = 22;

      node.append('rect')
        .attr('x', -w / 2).attr('y', -h / 2)
        .attr('width', w).attr('height', h)
        .attr('rx', h / 2).attr('ry', h / 2)
        .attr('fill', statusColor)
        .attr('fill-opacity', 0.15)
        .attr('stroke', statusColor)
        .attr('stroke-width', 1);

      node.append('text')
        .attr('text-anchor', 'middle')
        .attr('dy', '0.35em')
        .attr('fill', statusColor)
        .attr('font-size', 9).attr('font-weight', 500)
        .attr('pointer-events', 'none')
        .text(truncLabel);
    }
  });

  // Hover effects
  nodeGroups
    .on('mouseenter', function(_, d) {
      if (d.data.level === 0) return;
      d3.select(this).transition().duration(120)
        .attr('transform', function() {
          if (d.depth === 0) return 'translate(0,0) scale(1.08)';
          const [x, y] = project(d);
          return `translate(${x},${y}) scale(1.08)`;
        });
    })
    .on('mouseleave', function(_, d) {
      d3.select(this).transition().duration(120)
        .attr('transform', function() {
          if (d.depth === 0) return 'translate(0,0)';
          const [x, y] = project(d);
          return `translate(${x},${y})`;
        });
    });

  // Auto-fit
  requestAnimationFrame(() => {
    const bbox = (g.node() as SVGGElement)?.getBBox();
    if (!bbox) return;
    const pad = 60;
    const scale = Math.min(
      (width - pad * 2) / (bbox.width || 1),
      (height - pad * 2) / (bbox.height || 1),
      1.2,
    );
    const tx = width / 2 - (bbox.x + bbox.width / 2) * scale;
    const ty = height / 2 - (bbox.y + bbox.height / 2) * scale;

    svg.transition().duration(500).call(
      zoomBehavior.transform,
      d3.zoomIdentity.translate(tx, ty).scale(scale),
    );
  });

  // Return zoom behavior for external controls
  return zoomBehavior;
}

// ── Main component ──

export function InnovationRequestsMindMap({ requests, onOpenDetail }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  const [groupBy, setGroupBy] = useState<GroupingField>('status');
  const [subGroupBy, setSubGroupBy] = useState<GroupingField | null>('entite_concernee');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [expandedSub, setExpandedSub] = useState<Set<string>>(new Set());
  const [dims, setDims] = useState({ w: 900, h: 600 });

  // Responsive sizing
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) setDims({ w: width, h: height });
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const tree = useMemo(
    () => buildTree(requests, groupBy, subGroupBy, expanded, expandedSub),
    [requests, groupBy, subGroupBy, expanded, expandedSub],
  );

  const handleNodeClick = useCallback((node: MindNode) => {
    if (node.requestId) { onOpenDetail(node.requestId); return; }
    if (node.level === 0) return;
    if (node.level === 1) {
      setExpanded(prev => {
        const next = new Set(prev);
        next.has(node.id) ? next.delete(node.id) : next.add(node.id);
        return next;
      });
    }
    if (node.level === 2) {
      setExpandedSub(prev => {
        const next = new Set(prev);
        next.has(node.id) ? next.delete(node.id) : next.add(node.id);
        return next;
      });
    }
  }, [onOpenDetail]);

  // Render D3
  useEffect(() => {
    if (!svgRef.current || dims.w === 0) return;
    const z = renderMindMap(svgRef.current, tree, handleNodeClick, dims.w, dims.h);
    zoomRef.current = z;
  }, [tree, dims.w, dims.h, handleNodeClick]);

  // Zoom controls
  const zoomBy = (factor: number) => {
    if (!svgRef.current || !zoomRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.transition().duration(250).call(zoomRef.current.scaleBy, factor);
  };

  const resetView = () => {
    if (!svgRef.current || !zoomRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.transition().duration(400).call(
      zoomRef.current.transform,
      d3.zoomIdentity.translate(dims.w / 2, dims.h / 2).scale(0.8),
    );
  };

  return (
    <div className="relative w-full">
      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-medium">Grouper par</span>
          <Select value={groupBy} onValueChange={v => { setGroupBy(v as GroupingField); setExpanded(new Set()); setExpandedSub(new Set()); }}>
            <SelectTrigger className="h-7 w-36 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {GROUPING_FIELDS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-medium">Sous-groupe</span>
          <Select value={subGroupBy || 'none'} onValueChange={v => { setSubGroupBy(v === 'none' ? null : v as GroupingField); setExpandedSub(new Set()); }}>
            <SelectTrigger className="h-7 w-36 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Aucun</SelectItem>
              {GROUPING_FIELDS.filter(f => f.value !== groupBy).map(f =>
                <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-1 ml-auto">
          {expanded.size > 0 && (
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => { setExpanded(new Set()); setExpandedSub(new Set()); }}>
              Tout réduire
            </Button>
          )}
          <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => zoomBy(1.3)}>
            <ZoomIn className="w-3.5 h-3.5" />
          </Button>
          <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => zoomBy(0.75)}>
            <ZoomOut className="w-3.5 h-3.5" />
          </Button>
          <Button variant="outline" size="icon" className="h-7 w-7" onClick={resetView}>
            <Minimize2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        className="h-[75vh] w-full rounded-xl border border-border overflow-hidden bg-background relative"
      >
        <svg
          ref={svgRef}
          className="w-full h-full"
          style={{ display: 'block' }}
        />

        {/* Status legend overlay */}
        <div className="absolute bottom-3 right-3 flex flex-wrap gap-2 bg-background/80 backdrop-blur-sm rounded-lg p-2 border border-border shadow-sm">
          {Object.entries(STATUS_CONFIG).map(([k, v]) => (
            <div key={k} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: v.color }} />
              <span className="text-[10px] text-muted-foreground">{v.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
