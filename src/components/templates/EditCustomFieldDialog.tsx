import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  TemplateCustomField,
  CustomFieldType,
  FIELD_TYPE_LABELS,
  FieldOption,
} from '@/types/customField';
import { Plus, Trash2 } from 'lucide-react';

interface EditCustomFieldDialogProps {
  field: TemplateCustomField | null;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function EditCustomFieldDialog({
  field,
  open,
  onClose,
  onSuccess,
}: EditCustomFieldDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [label, setLabel] = useState('');
  const [fieldType, setFieldType] = useState<CustomFieldType>('text');
  const [description, setDescription] = useState('');
  const [isRequired, setIsRequired] = useState(false);
  const [placeholder, setPlaceholder] = useState('');
  const [defaultValue, setDefaultValue] = useState('');
  const [options, setOptions] = useState<FieldOption[]>([]);

  useEffect(() => {
    if (field) {
      setName(field.name);
      setLabel(field.label);
      setFieldType(field.field_type);
      setDescription(field.description || '');
      setIsRequired(field.is_required);
      setPlaceholder(field.placeholder || '');
      setDefaultValue(field.default_value || '');
      setOptions(field.options || []);
    }
  }, [field]);

  const handleClose = () => {
    onClose();
  };

  const addOption = () => {
    setOptions([...options, { value: '', label: '' }]);
  };

  const updateOption = (index: number, optField: 'value' | 'label', val: string) => {
    const updated = [...options];
    updated[index][optField] = val;
    setOptions(updated);
  };

  const removeOption = (index: number) => {
    setOptions(options.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!field || !name.trim() || !label.trim()) {
      toast.error('Le nom et le libellé sont requis');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('template_custom_fields')
        .update({
          name: name.trim(),
          label: label.trim(),
          field_type: fieldType,
          description: description.trim() || null,
          is_required: isRequired,
          placeholder: placeholder.trim() || null,
          default_value: defaultValue.trim() || null,
          options: ['select', 'multiselect'].includes(fieldType)
            ? (options.filter((o) => o.value && o.label) as any)
            : null,
        })
        .eq('id', field.id);

      if (error) throw error;

      toast.success('Champ mis à jour');
      onSuccess();
    } catch (error: any) {
      console.error('Error updating field:', error);
      toast.error(error.message || 'Erreur lors de la mise à jour');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!field) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Modifier le champ personnalisé</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Nom technique *</Label>
              <Input
                id="edit-name"
                value={name}
                onChange={(e) => setName(e.target.value.replace(/\s+/g, '_').toLowerCase())}
                placeholder="code_projet"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-label">Libellé affiché *</Label>
              <Input
                id="edit-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Code projet"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-description">Description</Label>
            <Textarea
              id="edit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description du champ..."
              rows={2}
            />
          </div>

          {/* Type & Validation */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Type de champ *</Label>
              <Select value={fieldType} onValueChange={(v) => setFieldType(v as CustomFieldType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(FIELD_TYPE_LABELS).map(([value, labelText]) => (
                    <SelectItem key={value} value={value}>
                      {labelText}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 flex items-end">
              <div className="flex items-center gap-2">
                <Switch id="edit-required" checked={isRequired} onCheckedChange={setIsRequired} />
                <Label htmlFor="edit-required">Champ obligatoire</Label>
              </div>
            </div>
          </div>

          {/* Options for select/multiselect */}
          {['select', 'multiselect'].includes(fieldType) && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Options</Label>
                <Button type="button" variant="outline" size="sm" onClick={addOption}>
                  <Plus className="h-4 w-4 mr-1" />
                  Ajouter
                </Button>
              </div>
              <div className="space-y-2">
                {options.map((opt, idx) => (
                  <div key={idx} className="flex gap-2">
                    <Input
                      placeholder="Valeur"
                      value={opt.value}
                      onChange={(e) => updateOption(idx, 'value', e.target.value)}
                    />
                    <Input
                      placeholder="Libellé"
                      value={opt.label}
                      onChange={(e) => updateOption(idx, 'label', e.target.value)}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeOption(idx)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
                {options.length === 0 && (
                  <p className="text-sm text-muted-foreground">Aucune option définie</p>
                )}
              </div>
            </div>
          )}

          {/* Placeholder & Default */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-placeholder">Placeholder</Label>
              <Input
                id="edit-placeholder"
                value={placeholder}
                onChange={(e) => setPlaceholder(e.target.value)}
                placeholder="Entrez..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-default">Valeur par défaut</Label>
              <Input
                id="edit-default"
                value={defaultValue}
                onChange={(e) => setDefaultValue(e.target.value)}
              />
            </div>
          </div>

          {/* Scope info (read-only) */}
          <div className="p-3 bg-muted rounded-lg text-sm">
            <span className="font-medium">Portée : </span>
            {field.is_common
              ? 'Commun à tous les processus'
              : field.sub_process_template_id
              ? 'Lié à un sous-processus'
              : field.process_template_id
              ? 'Lié à un processus'
              : 'Non défini'}
            <p className="text-muted-foreground mt-1">
              La portée ne peut pas être modifiée. Supprimez et recréez le champ si nécessaire.
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Annuler
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
      if (error) throw error;

      toast.success('Champ mis à jour');
      onSuccess();
    } catch (error: any) {
      console.error('Error updating field:', error);
      toast.error(error.message || 'Erreur lors de la mise à jour');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!field) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Modifier le champ personnalisé</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Nom technique *</Label>
              <Input
                id="edit-name"
                value={name}
                onChange={(e) => setName(e.target.value.replace(/\s+/g, '_').toLowerCase())}
                placeholder="code_projet"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-label">Libellé affiché *</Label>
              <Input
                id="edit-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Code projet"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-description">Description</Label>
            <Textarea
              id="edit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description du champ..."
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Type de champ *</Label>
              <Select value={fieldType} onValueChange={(v) => setFieldType(v as CustomFieldType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(FIELD_TYPE_LABELS).map(([value, labelText]) => (
                    <SelectItem key={value} value={value}>
                      {labelText}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 flex items-end">
              <div className="flex items-center gap-2">
                <Switch id="edit-required" checked={isRequired} onCheckedChange={setIsRequired} />
                <Label htmlFor="edit-required">Champ obligatoire</Label>
              </div>
            </div>
          </div>

          {['select', 'multiselect'].includes(fieldType) && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Options</Label>
                <Button type="button" variant="outline" size="sm" onClick={addOption}>
                  <Plus className="h-4 w-4 mr-1" />
                  Ajouter
                </Button>
              </div>
              <div className="space-y-2">
                {options.map((opt, idx) => (
                  <div key={idx} className="flex gap-2">
                    <Input
                      placeholder="Valeur"
                      value={opt.value}
                      onChange={(e) => updateOption(idx, 'value', e.target.value)}
                    />
                    <Input
                      placeholder="Libellé"
                      value={opt.label}
                      onChange={(e) => updateOption(idx, 'label', e.target.value)}
                    />
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeOption(idx)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-placeholder">Placeholder</Label>
              <Input id="edit-placeholder" value={placeholder} onChange={(e) => setPlaceholder(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-default">Valeur par défaut</Label>
              <Input id="edit-default" value={defaultValue} onChange={(e) => setDefaultValue(e.target.value)} />
            </div>
          </div>

          <div className="p-3 bg-muted rounded-lg text-sm">
            <span className="font-medium">Portée : </span>
            {field.is_common ? 'Commun' : field.sub_process_template_id ? 'Sous-processus' : 'Processus'}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>Annuler</Button>
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Enregistrement...' : 'Enregistrer'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
