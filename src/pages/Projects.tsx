/**
 * Projects — Vue d'accueil des projets Bureau d'Études.
 *
 * Affiche :
 *  - Carte de localisation des projets (Leaflet, coordonnées GPS)
 *  - Liste des projets avec statut et affaires associées dépliables
 *
 * (La vue budget est disponible dans /be/budget)
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useQuery } from '@tanstack/react-query';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { useBEProjects } from '@/hooks/useBEProjects';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  ChevronRight,
  ChevronDown,
  MapPin,
  FolderOpen,
  Loader2,
  Search,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BEAffaire } from '@/types/beAffaire';
import { BE_AFFAIRE_STATUS_CONFIG } from '@/types/beAffaire';
import type { BEProject } from '@/types/beProject';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const sb = supabase as any;

const STATUS_COLOR: Record<string, string> = {
  active:  '#10b981',
  on_hold: '#f59e0b',
  closed:  '#6b7280',
};

const STATUS_LABEL: Record<string, string> = {
  active:  'Actif',
  on_hold: 'En attente',
  closed:  'Clôturé',
};

function parseGps(raw: string | null | undefined): [number, number] | null {
  if (!raw) return null;
  const parts = raw.split(',').map((s) => parseFloat(s.trim()));
  if (parts.length !== 2 || isNaN(parts[0]) || isNaN(parts[1])) return null;
  if (Math.abs(parts[0]) < 0.001 && Math.abs(parts[1]) < 0.001) return null;
  return [parts[0], parts[1]];
}

// ─── Map component ────────────────────────────────────────────────────────────

function ProjectsMap({ projects }: { projects: BEProject[] }) {
  const navigate = useNavigate();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  const withCoords = useMemo(
    () => projects.filter((p) => parseGps(p.gps_coordinates) !== null),
    [projects],
  );

  useEffect(() => {
    // Expose navigate for Leaflet popup buttons (Leaflet popups are raw HTML)
    (window as any).__navigateToProject = (code: string) =>
      navigate(`/be/projects/${code}/overview`);

    if (!mapContainerRef.current || withCoords.length === 0) return;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const map = L.map(mapContainerRef.current, {
      zoomControl: true,
      scrollWheelZoom: true,
    });
    mapInstanceRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 18,
    }).addTo(map);

    const bounds: [number, number][] = [];

    withCoords.forEach((p) => {
      const coords = parseGps(p.gps_coordinates)!;
      const color = STATUS_COLOR[p.status] || STATUS_COLOR.active;
      bounds.push(coords);

      const marker = L.circleMarker(coords, {
        radius: 9,
        fillColor: color,
        color: '#fff',
        weight: 2,
        fillOpacity: 0.92,
      });

      marker.bindPopup(
        `<div style="min-width:160px;font-family:system-ui,sans-serif;">
          <div style="font-weight:700;font-size:13px;color:${color};">${p.code_projet}</div>
          <div style="font-size:12px;margin-top:2px;">${p.nom_projet}</div>
          ${p.region ? `<div style="margin-top:4px;font-size:11px;color:#6b7280;">📍 ${p.region}</div>` : ''}
          <div style="margin-top:4px;">
            <span style="display:inline-block;padding:1px 8px;border-radius:9999px;font-size:10px;font-weight:600;background:${color}20;color:${color};">
              ${STATUS_LABEL[p.status] ?? p.status}
            </span>
          </div>
          <button
            onclick="window.__navigateToProject('${p.code_projet}')"
            style="margin-top:8px;font-size:11px;color:#3b82f6;background:none;border:none;padding:0;cursor:pointer;text-decoration:underline;"
          >
            Ouvrir le projet →
          </button>
        </div>`,
        { maxWidth: 240 },
      );

      marker.addTo(map);
    });

    if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: 12 });
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      delete (window as any).__navigateToProject;
    };
  }, [withCoords, navigate]);

  if (withCoords.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
        <div className="text-center">
          <MapPin className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p>Aucune coordonnée GPS disponible</p>
          <p className="text-xs mt-1 text-muted-foreground/60">
            Renseignez les coordonnées dans la fiche projet
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-2">
      <div className="flex items-center gap-2 shrink-0">
        <MapPin className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Carte de localisation</span>
        <Badge variant="secondary">
          {withCoords.length} projet{withCoords.length !== 1 ? 's' : ''} géolocalisé{withCoords.length !== 1 ? 's' : ''}
        </Badge>
      </div>
      <div
        ref={mapContainerRef}
        className="flex-1 min-h-0 rounded-lg overflow-hidden relative z-0"
      />
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Projects() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const { projects, isLoading } = useBEProjects();

  // Fetch all affaires (lightweight — no KPIs)
  const { data: allAffaires = [] } = useQuery<
    Pick<BEAffaire, 'id' | 'be_project_id' | 'code_affaire' | 'libelle' | 'status'>[]
  >({
    queryKey: ['all-be-affaires-projects-page'],
    queryFn: async () => {
      const { data } = await sb
        .from('be_affaires')
        .select('id, be_project_id, code_affaire, libelle, status')
        .order('code_affaire');
      return data ?? [];
    },
  });

  // Group affaires by project id
  const affairesByProject = useMemo(() => {
    const map = new Map<string, typeof allAffaires>();
    for (const a of allAffaires) {
      if (!map.has(a.be_project_id)) map.set(a.be_project_id, []);
      map.get(a.be_project_id)!.push(a);
    }
    return map;
  }, [allAffaires]);

  const filteredProjects = useMemo(() => {
    if (!search.trim()) return projects;
    const q = search.toLowerCase();
    return projects.filter(
      (p) =>
        p.code_projet.toLowerCase().includes(q) ||
        (p.nom_projet ?? '').toLowerCase().includes(q),
    );
  }, [projects, search]);

  const toggleExpand = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="flex h-screen bg-background">
      <Sidebar activeView="projects" onViewChange={() => {}} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Projets" />
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-6">
          <div className="space-y-6">

            {/* ── Carte ─────────────────────────────────────────────────── */}
            <Card className="border-border/50">
              <CardContent className="p-4" style={{ height: 380 }}>
                {isLoading ? (
                  <div className="h-full flex items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : (
                  <ProjectsMap projects={projects} />
                )}
              </CardContent>
            </Card>

            {/* ── Liste des projets ─────────────────────────────────────── */}
            <div className="space-y-3">
              {/* Titre + compteur */}
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-primary/10">
                  <FolderOpen className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-lg font-bold tracking-tight">Projets BE</h3>
                <Badge variant="secondary" className="ml-auto">
                  {projects.length} projet{projects.length !== 1 ? 's' : ''}
                </Badge>
              </div>

              {/* Recherche */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Rechercher par code ou nom..."
                  className="pl-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              {/* Project list */}
              {isLoading ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : filteredProjects.length === 0 ? (
                <div className="py-10 text-center text-muted-foreground text-sm">
                  Aucun projet trouvé
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredProjects.map((project) => {
                    const affaires = affairesByProject.get(project.id) ?? [];
                    const isExpanded = expanded.has(project.id);
                    const color = STATUS_COLOR[project.status] || STATUS_COLOR.active;
                    const coords = parseGps(project.gps_coordinates);

                    return (
                      <div
                        key={project.id}
                        className="border rounded-lg overflow-hidden bg-card"
                      >
                        {/* Project header row */}
                        <div className="flex items-center gap-2 px-3 py-2.5">
                          {/* Expand toggle */}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 shrink-0"
                            onClick={() => toggleExpand(project.id)}
                          >
                            {isExpanded
                              ? <ChevronDown className="h-3.5 w-3.5" />
                              : <ChevronRight className="h-3.5 w-3.5" />}
                          </Button>

                          {/* Project name (navigate to overview) */}
                          <button
                            className="flex-1 text-left flex items-center gap-2 min-w-0"
                            onClick={() =>
                              navigate(`/be/projects/${project.code_projet}/overview`)
                            }
                          >
                            <Badge
                              variant="outline"
                              className="font-mono text-[10px] px-1.5 shrink-0"
                            >
                              {project.code_projet}
                            </Badge>
                            <span className="text-sm font-medium truncate">
                              {project.nom_projet}
                            </span>
                          </button>

                          {/* Meta chips */}
                          <div className="flex items-center gap-2 shrink-0">
                            {coords && (
                              <MapPin
                                className="h-3 w-3 text-muted-foreground/50"
                                title="Géolocalisé"
                              />
                            )}
                            {project.region && (
                              <span className="text-[10px] text-muted-foreground hidden sm:inline truncate max-w-[120px]">
                                {project.region}
                              </span>
                            )}
                            <span
                              className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                              style={{ backgroundColor: color + '20', color }}
                            >
                              {STATUS_LABEL[project.status] ?? project.status}
                            </span>
                            {affaires.length > 0 && (
                              <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                                {affaires.length} affaire{affaires.length !== 1 ? 's' : ''}
                              </Badge>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5"
                              title="Ouvrir le projet"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/be/projects/${project.code_projet}/overview`);
                              }}
                            >
                              <ExternalLink className="h-3 w-3 text-muted-foreground/40" />
                            </Button>
                          </div>
                        </div>

                        {/* Affaires (expanded) */}
                        {isExpanded && (
                          <div className="border-t divide-y bg-muted/10">
                            {affaires.length === 0 ? (
                              <p className="px-6 py-2 text-xs text-muted-foreground italic">
                                Aucune affaire pour ce projet
                              </p>
                            ) : (
                              affaires.map((affaire) => {
                                const sc = BE_AFFAIRE_STATUS_CONFIG[affaire.status];
                                return (
                                  <button
                                    key={affaire.id}
                                    className="w-full text-left flex items-center gap-2 px-6 py-2 hover:bg-muted/20 transition-colors"
                                    onClick={() =>
                                      navigate(
                                        `/be/projects/${project.code_projet}/budget/${affaire.code_affaire}`,
                                      )
                                    }
                                  >
                                    <span className="font-mono text-[11px] text-muted-foreground w-24 shrink-0">
                                      {affaire.code_affaire}
                                    </span>
                                    <span className="text-xs flex-1 truncate">
                                      {affaire.libelle ?? '—'}
                                    </span>
                                    <Badge
                                      variant="outline"
                                      className={cn(
                                        'text-[10px] px-1.5 h-4 shrink-0 border',
                                        sc.className,
                                      )}
                                    >
                                      {sc.label}
                                    </Badge>
                                    <ChevronRight className="h-3 w-3 text-muted-foreground/40 shrink-0" />
                                  </button>
                                );
                              })
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
