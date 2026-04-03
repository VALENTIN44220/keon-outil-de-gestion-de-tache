import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { X, Plus } from 'lucide-react';
import { useAddCustomField, type NewCustomFieldInput } from '@/hooks/useQuestionnaireFieldDefs';
import type { ChampType, PilierCode } from '@/config/questionnaireConfig';

const TYPE_LABELS: Record<ChampType, string> = {
  text:       'Titre / Objet',
  textarea:   'Description / Détails',
  select:     'Liste de choix',
  number:     'Nombre',
  percentage: 'Pourcentage (%)',
  euros:      'Montant (€)',
  spreadsheet: 'Tableau (spreadsheet)',
};

interface AddCustomFieldDialogProps {
  open: boolean;
  onClose: () => void;
  pilierCode: PilierCode;
  section: string;
  sousSection?: string;
}

export function AddCustomFieldDialog({
  open,
  onClose,
  pilierCode,
  section,
  sousSection,
}: AddCustomFieldDialogProps) {
  const { mutateAsync, isPending } = useAddCustomField();

  const [label, setLabel] = useState('');
  const [type, setType] = useState<ChampType>('text');
  const [note, setNote] = useState('');
  const [optionInput, setOptionInput] = useState('');
  const [options, setOptions] = useState<string[]>([]);
  const [sousSection_local, setSousSection] = useState(sousSection ?? '');

  const handleAddOption = () => {
    const trimmed = optionInput.trim();
    if (trimmed && !options.includes(trimmed)) {
      setOptions(prev => [...prev, trimmed]);
    }
    setOptionInput('');
  };

  const handleRemoveOption = (opt: string) => {
    setOptions(prev => prev.filter(o => o !== opt));
  };

  const handleSubmit = async () => {
    if (!label.trim()) return;

    const input: NewCustomFieldInput = {
      pilier_code: pilierCode,
      section,
      sous_section: sousSection_local.trim() || undefined,
      label: label.trim(),
      type,
      options: type === 'select' ? options : undefined,
      note: note.trim() || undefined,
    };

    await mutateAsync(input);
    handleClose();
  };

  const handleClose = () => {
    setLabel('');
    setType('text');
    setNote('');
    setOptionInput('');
    setOptions([]);
    setSousSection(sousSection ?? '');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && handleClose()}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Ajouter un champ personnalisé</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Section <span className="font-medium">{section}</span>
            {sousSection_local && (
              <> · <span className="font-medium">{sousSection_local}</span></>
            )}
          </p>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Label */}
          <div className="space-y-1.5">
            <Label htmlFor="cf-label">
              Intitulé du champ <span className="text-destructive">*</span>
            </Label>
            <Input
              id="cf-label"
              value={label}
              onChange={e => setLabel(e.target.value)}
              placeholder="Ex : Nom du bureau d'études"
              autoFocus
            />
          </div>

          {/* Type */}
          <div className="space-y-1.5">
            <Label>Type de champ</Label>
            <Select value={type} onValueChange={v => setType(v as ChampType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(TYPE_LABELS) as [ChampType, string][]).map(([val, lbl]) => (
                  <SelectItem key={val} value={val}>{lbl}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Sous-section (modifiable si pas de contexte fourni) */}
          {!sousSection && (
            <div className="space-y-1.5">
              <Label htmlFor="cf-sous-section">Sous-section (optionnel)</Label>
              <Input
                id="cf-sous-section"
                value={sousSection_local}
                onChange={e => setSousSection(e.target.value)}
                placeholder="Ex : Données complémentaires"
              />
            </div>
          )}

          {/* Options pour select */}
          {type === 'select' && (
            <div className="space-y-2">
              <Label>Options de la liste</Label>
              <div className="flex gap-2">
                <Input
                  value={optionInput}
                  onChange={e => setOptionInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') { e.preventDefault(); handleAddOption(); }
                  }}
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
                      <button
                        type="button"
                        onClick={() => handleRemoveOption(opt)}
                        className="ml-0.5 rounded-full hover:bg-muted p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
              {type === 'select' && options.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Ajoutez au moins une option pour ce champ.
                </p>
              )}
            </div>
          )}
          {type === 'spreadsheet' && (
            <p className="text-xs text-muted-foreground">
              Le tableau (dimensions + en-têtes + cellules) sera configuré directement dans le questionnaire, une fois le champ créé.
            </p>
          )}

          {/* Note */}
          <div className="space-y-1.5">
            <Label htmlFor="cf-note">Note / aide à la saisie (optionnel)</Label>
            <Textarea
              id="cf-note"
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Ex : Indiquer le nom complet de l'organisme"
              rows={2}
              className="text-sm"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isPending}>
            Annuler
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              isPending ||
              !label.trim() ||
              (type === 'select' && options.length === 0)
            }
          >
            {isPending ? 'Ajout…' : 'Ajouter le champ'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
