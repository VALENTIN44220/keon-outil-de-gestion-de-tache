import { useMemo, useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  ChevronUp, ChevronDown, Pencil, Trash2, Plus, EyeOff, Eye, FolderPlus, Layers,
} from 'lucide-react';
import { PILIERS, type PilierCode, type ChampType } from '@/config/questionnaireConfig';
import {
  useAdminQuestionnaireFieldDefs,
  useReorderFields,
  useSetFieldActive,
  useDeleteFieldDef,
  type FieldDefinition,
} from '@/hooks/useQuestionnaireFieldDefs';
import {
  useQuestionnaireSections,
  useQuestionnaireSousSections,
  useCreateSection,
  useRenameSection,
  useReorderSections,
  useDeleteSection,
  useCreateSousSection,
  useRenameSousSection,
  useReorderSousSections,
  useDeleteSousSection,
} from '@/hooks/useQuestionnaireSections';
import { buildOrderedSectionGroups } from '@/hooks/useQuestionnaireSectionOrder';
import { FieldEditorDialog } from './FieldEditorDialog';

const TYPE_SHORT: Record<ChampType, string> = {
  text: 'Texte', textarea: 'Texte long', select: 'Liste',
  number: 'Nombre', percentage: '%', euros: '€', spreadsheet: 'Tableau',
};

interface Row { id: string; order_index: number }
function swapOrder(mutate: (items: Row[]) => void, list: Row[], i: number, j: number) {
  if (i < 0 || j < 0 || i >= list.length || j >= list.length) return;
  const a = list[i], b = list[j];
  mutate([{ id: a.id, order_index: b.order_index }, { id: b.id, order_index: a.order_index }]);
}

interface TextPrompt {
  title: string;
  label: string;
  initial: string;
  confirmLabel: string;
  onSubmit: (value: string) => void;
}

export function QuestionnaireAdminTab() {
  const [pilier, setPilier] = useState<PilierCode>('02');

  const { data: fieldDefs = [], isLoading: loadingFields } = useAdminQuestionnaireFieldDefs(pilier);
  const { data: sectionRows = [], isLoading: loadingSections } = useQuestionnaireSections(pilier);
  const { data: sousSectionRows = [] } = useQuestionnaireSousSections(pilier);

  const createSection = useCreateSection();
  const renameSection = useRenameSection();
  const reorderSections = useReorderSections();
  const deleteSection = useDeleteSection();
  const createSousSection = useCreateSousSection();
  const renameSousSection = useRenameSousSection();
  const reorderSousSections = useReorderSousSections();
  const deleteSousSection = useDeleteSousSection();
  const reorderFields = useReorderFields();
  const setFieldActive = useSetFieldActive();
  const deleteField = useDeleteFieldDef();

  const [prompt, setPrompt] = useState<TextPrompt | null>(null);
  const [promptValue, setPromptValue] = useState('');
  const [editor, setEditor] = useState<
    { mode: 'create' | 'edit'; section: string; sousSection?: string; field?: FieldDefinition } | null
  >(null);

  const groups = useMemo(
    () => buildOrderedSectionGroups(fieldDefs, sectionRows, sousSectionRows, pilier),
    [fieldDefs, sectionRows, sousSectionRows, pilier],
  );

  const sectionsOrdered = useMemo(
    () => sectionRows.filter(r => r.pilier_code === pilier).sort((a, b) => a.order_index - b.order_index),
    [sectionRows, pilier],
  );
  const sectionIndexByName = useMemo(
    () => new Map(sectionsOrdered.map((r, i) => [r.section, i])), [sectionsOrdered],
  );

  const openPrompt = (p: TextPrompt) => { setPromptValue(p.initial); setPrompt(p); };
  const submitPrompt = () => {
    if (!prompt) return;
    const v = promptValue.trim();
    if (v) prompt.onSubmit(v);
    setPrompt(null);
  };

  const isLoading = loadingFields || loadingSections;

  return (
    <div className="space-y-4">
      {/* En-tête */}
      <div className="flex items-center justify-between bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Layers className="h-5 w-5 text-indigo-500" /> Questionnaires
          </h2>
          <p className="text-sm text-slate-500">
            Sections, sous-sections et champs — déployés sur <strong>toutes</strong> les SPV du pilier.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={pilier} onValueChange={v => setPilier(v as PilierCode)}>
            <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PILIERS.map(p => (<SelectItem key={p.code} value={p.code}>{p.label}</SelectItem>))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            onClick={() => openPrompt({
              title: 'Nouvelle section', label: 'Nom de la section', initial: '', confirmLabel: 'Créer',
              onSubmit: section => createSection.mutate({ pilier_code: pilier, section }),
            })}
            className="gap-1.5"
          >
            <FolderPlus className="h-4 w-4" /> Nouvelle section
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}</div>
      ) : groups.length === 0 ? (
        <div className="text-center text-sm text-muted-foreground py-12">
          Aucune section. Créez-en une pour commencer.
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map(group => {
            const sIdx = sectionIndexByName.get(group.section) ?? -1;
            const activeCount = group.fields.filter(f => f.is_active).length;
            const ssRows = sousSectionRows
              .filter(r => r.pilier_code === pilier && r.section === group.section)
              .sort((a, b) => a.order_index - b.order_index);

            return (
              <div key={group.section} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                {/* En-tête de section */}
                <div className="flex items-center gap-2 px-4 py-3 bg-slate-50 border-b">
                  <div className="flex flex-col">
                    <button type="button" className="text-slate-400 hover:text-slate-700 disabled:opacity-30"
                      disabled={sIdx <= 0}
                      onClick={() => swapOrder(reorderSections.mutate, sectionsOrdered, sIdx, sIdx - 1)}>
                      <ChevronUp className="h-4 w-4" />
                    </button>
                    <button type="button" className="text-slate-400 hover:text-slate-700 disabled:opacity-30"
                      disabled={sIdx < 0 || sIdx >= sectionsOrdered.length - 1}
                      onClick={() => swapOrder(reorderSections.mutate, sectionsOrdered, sIdx, sIdx + 1)}>
                      <ChevronDown className="h-4 w-4" />
                    </button>
                  </div>
                  <span className="font-semibold text-sm text-slate-800 flex-1">{group.section}</span>
                  <Badge variant="outline" className="text-xs">{activeCount} champ{activeCount > 1 ? 's' : ''}</Badge>
                  <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs"
                    onClick={() => setEditor({ mode: 'create', section: group.section })}>
                    <Plus className="h-3.5 w-3.5" /> Champ
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs"
                    onClick={() => openPrompt({
                      title: 'Nouvelle sous-section', label: 'Nom de la sous-section', initial: '', confirmLabel: 'Créer',
                      onSubmit: ss => createSousSection.mutate({ pilier_code: pilier, section: group.section, sous_section: ss }),
                    })}>
                    <Layers className="h-3.5 w-3.5" /> Sous-section
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0"
                    onClick={() => openPrompt({
                      title: 'Renommer la section', label: 'Nouveau nom', initial: group.section, confirmLabel: 'Renommer',
                      onSubmit: newName => { if (newName !== group.section) renameSection.mutate({ pilier_code: pilier, oldName: group.section, newName }); },
                    })}>
                    <Pencil className="h-3.5 w-3.5 text-slate-500" />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0"
                    onClick={() => {
                      if (activeCount > 0) {
                        window.alert('Cette section contient encore des champs actifs. Déplacez ou désactivez-les avant de la supprimer.');
                        return;
                      }
                      if (window.confirm(`Supprimer la section « ${group.section} » ?`)) {
                        deleteSection.mutate({ pilier_code: pilier, section: group.section });
                      }
                    }}>
                    <Trash2 className="h-3.5 w-3.5 text-red-500" />
                  </Button>
                </div>

                {/* Contenu : par sous-section */}
                <div className="p-3 space-y-3">
                  {group.orderedSousSections.length === 0 && group.fields.length === 0 && (
                    <p className="text-xs text-muted-foreground italic px-1">Section vide — ajoutez un champ.</p>
                  )}
                  {group.orderedSousSections.map(ss => {
                    const bucket = group.fields
                      .filter(f => (f.sous_section || '') === ss)
                      .sort((a, b) => a.order_index - b.order_index);
                    const ssIdx = ss ? ssRows.findIndex(r => r.sous_section === ss) : -1;

                    return (
                      <div key={ss || '__default__'} className="rounded-lg border border-slate-100">
                        {ss && (
                          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50/60 border-b">
                            <div className="flex flex-col">
                              <button type="button" className="text-slate-300 hover:text-slate-600 disabled:opacity-20"
                                disabled={ssIdx <= 0}
                                onClick={() => swapOrder(reorderSousSections.mutate, ssRows, ssIdx, ssIdx - 1)}>
                                <ChevronUp className="h-3 w-3" />
                              </button>
                              <button type="button" className="text-slate-300 hover:text-slate-600 disabled:opacity-20"
                                disabled={ssIdx < 0 || ssIdx >= ssRows.length - 1}
                                onClick={() => swapOrder(reorderSousSections.mutate, ssRows, ssIdx, ssIdx + 1)}>
                                <ChevronDown className="h-3 w-3" />
                              </button>
                            </div>
                            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 flex-1">{ss}</span>
                            <Button size="sm" variant="ghost" className="h-6 gap-1 text-[11px]"
                              onClick={() => setEditor({ mode: 'create', section: group.section, sousSection: ss })}>
                              <Plus className="h-3 w-3" /> Champ
                            </Button>
                            <Button size="sm" variant="ghost" className="h-6 w-6 p-0"
                              onClick={() => openPrompt({
                                title: 'Renommer la sous-section', label: 'Nouveau nom', initial: ss, confirmLabel: 'Renommer',
                                onSubmit: newName => { if (newName !== ss) renameSousSection.mutate({ pilier_code: pilier, section: group.section, oldName: ss, newName }); },
                              })}>
                              <Pencil className="h-3 w-3 text-slate-400" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-6 w-6 p-0"
                              onClick={() => {
                                if (bucket.some(f => f.is_active)) {
                                  window.alert('Cette sous-section contient des champs actifs.');
                                  return;
                                }
                                if (window.confirm(`Supprimer la sous-section « ${ss} » ?`)) {
                                  deleteSousSection.mutate({ pilier_code: pilier, section: group.section, sous_section: ss });
                                }
                              }}>
                              <Trash2 className="h-3 w-3 text-red-400" />
                            </Button>
                          </div>
                        )}

                        <div className="divide-y">
                          {bucket.length === 0 && (
                            <p className="text-[11px] text-muted-foreground italic px-3 py-2">Aucun champ.</p>
                          )}
                          {bucket.map((f, i) => (
                            <div key={f.id} className={`flex items-center gap-2 px-2.5 py-1.5 ${!f.is_active ? 'opacity-50' : ''}`}>
                              <div className="flex flex-col">
                                <button type="button" className="text-slate-300 hover:text-slate-600 disabled:opacity-20"
                                  disabled={i <= 0}
                                  onClick={() => swapOrder(reorderFields.mutate, bucket, i, i - 1)}>
                                  <ChevronUp className="h-3 w-3" />
                                </button>
                                <button type="button" className="text-slate-300 hover:text-slate-600 disabled:opacity-20"
                                  disabled={i >= bucket.length - 1}
                                  onClick={() => swapOrder(reorderFields.mutate, bucket, i, i + 1)}>
                                  <ChevronDown className="h-3 w-3" />
                                </button>
                              </div>
                              <span className="text-sm text-slate-700 flex-1 truncate">{f.label}</span>
                              <Badge variant="secondary" className="text-[10px] py-0">{TYPE_SHORT[f.type]}</Badge>
                              {!f.is_builtin && <Badge variant="outline" className="text-[10px] py-0">custom</Badge>}
                              {!f.is_active && <Badge variant="outline" className="text-[10px] py-0 text-red-500 border-red-200">inactif</Badge>}
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0"
                                onClick={() => setEditor({ mode: 'edit', section: group.section, field: f })}>
                                <Pencil className="h-3.5 w-3.5 text-slate-500" />
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0"
                                title={f.is_active ? 'Désactiver' : 'Réactiver'}
                                onClick={() => setFieldActive.mutate({ id: f.id, is_active: !f.is_active })}>
                                {f.is_active
                                  ? <EyeOff className="h-3.5 w-3.5 text-slate-500" />
                                  : <Eye className="h-3.5 w-3.5 text-emerald-600" />}
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0"
                                onClick={() => {
                                  if (window.confirm(`Supprimer définitivement « ${f.label} » ? Les valeurs saisies sur les SPV seront perdues.`)) {
                                    deleteField.mutate(f.id);
                                  }
                                }}>
                                <Trash2 className="h-3.5 w-3.5 text-red-500" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Dialog texte (créer / renommer section & sous-section) */}
      <Dialog open={!!prompt} onOpenChange={v => !v && setPrompt(null)}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader><DialogTitle>{prompt?.title}</DialogTitle></DialogHeader>
          <div className="space-y-1.5 py-2">
            <Label htmlFor="prompt-input">{prompt?.label}</Label>
            <Input id="prompt-input" value={promptValue} autoFocus
              onChange={e => setPromptValue(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submitPrompt(); } }} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPrompt(null)}>Annuler</Button>
            <Button onClick={submitPrompt} disabled={!promptValue.trim()}>{prompt?.confirmLabel}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Éditeur de champ */}
      {editor && (
        <FieldEditorDialog
          open
          onClose={() => setEditor(null)}
          pilierCode={pilier}
          mode={editor.mode}
          section={editor.section}
          sousSection={editor.sousSection}
          field={editor.field}
        />
      )}
    </div>
  );
}
