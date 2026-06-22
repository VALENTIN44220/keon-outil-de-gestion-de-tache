import { useEffect, useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { X, Plus, AlertTriangle } from 'lucide-react';
import {
  useAdminCreateField,
  useUpdateFieldDef,
  type FieldDefinition,
} from '@/hooks/useQuestionnaireFieldDefs';
import type { ChampType, PilierCode } from '@/config/questionnaireConfig';

const TYPE_LABELS: Record<ChampType, string> = {
  text: 'Titre / Objet',
  textarea: 'Description / Détails',
  select: 'Liste de choix',
  number: 'Nombre',
  percentage: 'Pourcentage (%)',
  euros: 'Montant (€)',
  spreadsheet: 'Tableau (spreadsheet)',
};

interface FieldEditorDialogProps {
  open: boolean;
  onClose: () => void;
  pilierCode: PilierCode | string;
  mode: 'create' | 'edit';
  section: string;
  sousSection?: string;
  field?: FieldDefinition;
}

export function FieldEditorDialog({
  open, onClose, pilierCode, mode, section, sousSection, field,
}: FieldEditorDialogProps) {
  const createMut = useAdminCreateField();
  const updateMut = useUpdateFieldDef();
  const isPending = createMut.isPending || updateMut.isPending;

  const [label, setLabel] = useState('');
  const [type, setType] = useState<ChampType>('text');
  const [note, setNote] = useState('');
  const [optionInput, setOptionInput] = useState('');
  const [options, setOptions] = useState<string[]>([]);
  const [sousSectionLocal, setSousSectionLocal] = useState('');
  const [required, setRequired] = useState(false);
  const [hasEval, setHasEval] = useState(false);

  // (Ré)initialise le formulaire à chaque ouverture / changement de champ.
  useEffect(() => {
    if (!open) return;
    if (mode === 'edit' && field) {
      setLabel(field.label ?? '');
      setType(field.type);
      setNote(field.note ?? '');
      setOptions(field.options ?? []);
      setSousSectionLocal(field.sous_section ?? '');
      setRequired(!!field.required);
      setHasEval(!!field.has_evaluation_risque);
    } else {
      setLabel('');
      setType('text');
      setNote('');
      setOptions([]);
      setSousSectionLocal(sousSection ?? '');
      setRequired(false);
      setHasEval(false);
    }
    setOptionInput('');
  }, [open, mode, field, sousSection]);

  const typeChanged = mode === 'edit' && field ? type !== field.type : false;

  const handleAddOption = () => {
    const t = optionInput.trim();
    if (t && !options.includes(t)) setOptions(prev => [...prev, t]);
    setOptionInput('');
  };

  const handleSubmit = async () => {
    if (!label.trim()) return;
    if (mode === 'create') {
      await createMut.mutateAsync({
        pilier_code: pilierCode as PilierCode,
        section,
        sous_section: sousSectionLocal.trim() || undefined,
        label: label.trim(),
        type,
        options: type === 'select' ? options : undefined,
        note: note.trim() || undefined,
      });
    } else if (field) {
      await updateMut.mutateAsync({
        id: field.id,
        label: label.trim(),
        type,
        options: type === 'select' ? options : null,
        note: note.trim() || null,
        required,
        has_evaluation_risque: hasEval,
        sous_section: sousSectionLocal.trim() || null,
      });
    }
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-[520px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Ajouter un champ' : 'Modifier le champ'}</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Section <span className="font-medium">{section}</span>
            {sousSectionLocal && (<> · <span className="font-medium">{sousSectionLocal}</span></>)}
          </p>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="fe-label">
              Intitulé du champ <span className="text-destructive">*</span>
            </Label>
            <Input id="fe-label" value={label} onChange={e => setLabel(e.target.value)} autoFocus />
          </div>

          <div className="space-y-1.5">
            <Label>Type de donnée</Label>
            <Select value={type} onValueChange={v => setType(v as ChampType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.entries(TYPE_LABELS) as [ChampType, string][]).map(([val, lbl]) => (
                  <SelectItem key={val} value={val}>{lbl}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {typeChanged && (
              <div className="flex items-start gap-2 p-2.5 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>
                  Changer le type d'un champ déjà renseigné peut rendre les valeurs
                  existantes incohérentes (les données ne sont pas converties).
                </span>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="fe-ss">Sous-section (optionnel)</Label>
            <Input
              id="fe-ss"
              value={sousSectionLocal}
              onChange={e => setSousSectionLocal(e.target.value)}
              placeholder="Ex : CODIR"
            />
          </div>

          {type === 'select' && (
            <div className="space-y-2">
              <Label>Options de la liste</Label>
              <div className="flex gap-2">
                <Input
                  value={optionInput}
                  onChange={e => setOptionInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddOption(); } }}
                  placeholder="Ajouter une option…"
                  className="flex-1"
                />
                <Button type="button" size="sm" variant="outline" onClick={handleAddOption}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {options.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {options.map(opt => (
                    <Badge key={opt} variant="secondary" className="gap-1 pr-1">
                      {opt}
                      <button type="button" onClick={() => setOptions(prev => prev.filter(o => o !== opt))}
                        className="ml-0.5 rounded-full hover:bg-muted p-0.5">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
              {options.length === 0 && (
                <p className="text-xs text-muted-foreground">Ajoutez au moins une option.</p>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="fe-note">Note / aide à la saisie (optionnel)</Label>
            <Textarea id="fe-note" value={note} onChange={e => setNote(e.target.value)} rows={2} className="text-sm" />
          </div>

          <div className="flex flex-col gap-2 pt-1">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox checked={required} onCheckedChange={v => setRequired(!!v)} />
              Champ obligatoire
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox checked={hasEval} onCheckedChange={v => setHasEval(!!v)} />
              Ajouter une évaluation des risques
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>Annuler</Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending || !label.trim() || (type === 'select' && options.length === 0)}
          >
            {isPending ? 'Enregistrement…' : mode === 'create' ? 'Ajouter' : 'Enregistrer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
