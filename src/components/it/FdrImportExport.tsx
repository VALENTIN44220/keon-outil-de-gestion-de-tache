import { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { Download, Upload, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { extractErrorMessage } from '@/lib/extractErrorMessage';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useFdrProfils } from '@/hooks/useFdrSettings';
import type { FdrRoadmapProject } from '@/hooks/useFdrProjects';
import {
  mapImportRow, resolveProfile, buildExportRows, EXPORT_COLUMNS,
  type ExportAppTaskRow,
} from '@/lib/fdr/excelIO';

const SHEET_NAME = 'Export AppTask';

export function FdrImportExport({ projects }: { projects: FdrRoadmapProject[] }) {
  const { data: profils = [] } = useFdrProfils();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  // ---- Export ----
  const handleExport = () => {
    const rows = buildExportRows(projects, profils);
    const ws = XLSX.utils.json_to_sheet(rows, { header: [...EXPORT_COLUMNS] });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, SHEET_NAME);
    const today = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `FDR_Export_AppTask_${today}.xlsx`);
    toast({ title: `Export : ${rows.length} projets` });
  };

  // ---- Import ----
  const handleImportFile = async (file: File) => {
    setImporting(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf);
      const sheetName = wb.SheetNames.find(n => n.trim().toLowerCase() === SHEET_NAME.toLowerCase())
        ?? wb.SheetNames[0];
      const rows = XLSX.utils.sheet_to_json<ExportAppTaskRow>(wb.Sheets[sheetName], { defval: null });

      if (rows.length === 0) {
        toast({ title: 'Fichier vide', description: `Aucune ligne dans l'onglet « ${sheetName} ».`, variant: 'destructive' });
        return;
      }

      // Codes existants pour décider update vs insert
      const { data: existing, error: exErr } = await supabase
        .from('it_projects')
        .select('id, code_projet_digital');
      if (exErr) throw exErr;
      const byCode = new Map((existing ?? []).map(p => [p.code_projet_digital, p.id]));

      let created = 0, updated = 0, skipped = 0;
      const allWarnings: string[] = [];

      for (const raw of rows) {
        const payload = mapImportRow(raw);
        if (!payload) { skipped++; continue; }
        allWarnings.push(...payload.warnings.map(w => `${payload.code} : ${w}`));

        let projectId = byCode.get(payload.code);
        if (projectId) {
          const { error } = await supabase.from('it_projects')
            .update(payload.projectFields).eq('id', projectId);
          if (error) throw new Error(`${payload.code} : ${error.message}`);
          updated++;
        } else {
          const { data, error } = await supabase.from('it_projects')
            .insert({ code_projet_digital: payload.code, ...payload.projectFields })
            .select('id').single();
          if (error) throw new Error(`${payload.code} : ${error.message}`);
          projectId = data.id;
          byCode.set(payload.code, projectId);
          created++;
        }

        // Ventilation build : une ligne sur le profil résolu
        const profil = resolveProfile(payload.profileName, profils);
        if (profil) {
          // profil principal = profil de la ventilation (modèle plat Excel)
          await supabase.from('it_projects')
            .update({ profil_principal: profil.code }).eq('id', projectId);
          await supabase.from('it_project_load').delete().eq('it_project_id', projectId);
          if (payload.buildJMois > 0) {
            const { error } = await supabase.from('it_project_load')
              .insert({ it_project_id: projectId, profil_id: profil.id, j_mois: payload.buildJMois });
            if (error) throw new Error(`${payload.code} (load) : ${error.message}`);
          }
        } else if (payload.profileName) {
          allWarnings.push(`${payload.code} : profil « ${payload.profileName} » introuvable — ventilation ignorée`);
        }
      }

      qc.invalidateQueries({ queryKey: ['fdr-projects'] });
      qc.invalidateQueries({ queryKey: ['fdr-capacity-matrix'] });

      toast({
        title: `Import terminé : ${created} créés, ${updated} mis à jour${skipped ? `, ${skipped} ignorés` : ''}`,
        description: allWarnings.length > 0
          ? `${allWarnings.length} avertissement(s) — voir console`
          : undefined,
      });
      if (allWarnings.length > 0) console.warn('[Import FDR]', allWarnings);
    } catch (e) {
      toast({ title: 'Erreur d\'import', description: extractErrorMessage(e), variant: 'destructive' });
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="flex gap-2">
      <input
        ref={fileRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleImportFile(f); }}
      />
      <Button variant="outline" size="sm" className="gap-2" onClick={() => fileRef.current?.click()} disabled={importing}>
        {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        Importer XLSX
      </Button>
      <Button variant="outline" size="sm" className="gap-2" onClick={handleExport} disabled={projects.length === 0}>
        <Download className="h-4 w-4" />
        Exporter XLSX
      </Button>
    </div>
  );
}
