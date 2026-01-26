import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { FieldScope, CustomFieldType, FIELD_TYPE_LABELS } from '@/types/customField';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Info, Upload } from 'lucide-react';

interface BulkCustomFieldImportDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface ParsedField {
  name: string;
  label: string;
  field_type: CustomFieldType;
  is_required: boolean;
}

export function BulkCustomFieldImportDialog({
  open,
  onClose,
  onSuccess,
}: BulkCustomFieldImportDialogProps) {
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rawData, setRawData] = useState('');
  const [parsedFields, setParsedFields] = useState<ParsedField[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);

  // Scope
  const [scope, setScope] = useState<FieldScope>('common');
  const [processId, setProcessId] = useState<string | null>(null);
  const [subProcessId, setSubProcessId] = useState<string | null>(null);

  // Lists
  const [processes, setProcesses] = useState<{ id: string; name: string }[]>([]);
  const [subProcesses, setSubProcesses] = useState<{ id: string; name: string; process_template_id: string }[]>([]);

  useEffect(() => {
    if (open) {
      fetchProcesses();
      fetchSubProcesses();
    }
  }, [open]);

  const fetchProcesses = async () => {
    const { data } = await supabase.from('process_templates').select('id, name').order('name');
    setProcesses(data || []);
  };

  const fetchSubProcesses = async () => {
    const { data } = await supabase
      .from('sub_process_templates')
      .select('id, name, process_template_id')
      .order('name');
    setSubProcesses(data || []);
  };

  const parseData = (data: string) => {
    setParseError(null);
    const lines = data.trim().split('\n').filter((l) => l.trim());
    
    if (lines.length === 0) {
      setParsedFields([]);
      return;
    }

    try {
      const parsed: ParsedField[] = [];
      
      for (const line of lines) {
        // Expected format: name, label, type, required (yes/no)
        // Or simple: name, label
        // Support comma, semicolon, pipe, or tab as separators
        const parts = line.split(/[,;|\t]/).map((p) => p.trim());
        
        if (parts.length < 2) {
          throw new Error(`Format invalide : "${line}". Attendu : nom, libellé [, type, requis]`);
        }

        const name = parts[0].replace(/\s+/g, '_').toLowerCase();
        const label = parts[1];
        let fieldType: CustomFieldType = 'text';
        let isRequired = false;

        if (parts.length >= 3) {
          const typeInput = parts[2].toLowerCase();
          const validTypes = Object.keys(FIELD_TYPE_LABELS);
          if (validTypes.includes(typeInput)) {
            fieldType = typeInput as CustomFieldType;
          } else {
            // Try to match by label
            const matchedType = Object.entries(FIELD_TYPE_LABELS).find(
              ([, lbl]) => lbl.toLowerCase() === typeInput
            );
            if (matchedType) {
              fieldType = matchedType[0] as CustomFieldType;
            }
          }
        }

        if (parts.length >= 4) {
          const reqInput = parts[3].toLowerCase();
          isRequired = ['oui', 'yes', 'true', '1', 'o', 'y'].includes(reqInput);
        }

        parsed.push({ name, label, field_type: fieldType, is_required: isRequired });
      }

      setParsedFields(parsed);
    } catch (error: any) {
      setParseError(error.message);
      setParsedFields([]);
    }
  };

  const handleDataChange = (value: string) => {
    setRawData(value);
    parseData(value);
  };

  const handleClose = () => {
    setRawData('');
    setParsedFields([]);
    setParseError(null);
    setScope('common');
    setProcessId(null);
    setSubProcessId(null);
    onClose();
  };

  const handleImport = async () => {
    if (parsedFields.length === 0) {
      toast.error('Aucun champ à importer');
      return;
    }

    if (scope === 'process' && !processId) {
      toast.error('Veuillez sélectionner un processus');
      return;
    }

    if (scope === 'sub_process' && !subProcessId) {
      toast.error('Veuillez sélectionner un sous-processus');
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user?.id)
        .single();

      const fieldsToInsert = parsedFields.map((field, index) => ({
        name: field.name,
        label: field.label,
        field_type: field.field_type,
        is_required: field.is_required,
        is_common: scope === 'common',
        process_template_id: scope === 'process' ? processId : null,
        sub_process_template_id: scope === 'sub_process' ? subProcessId : null,
        created_by: profile?.id || null,
        order_index: index,
      }));

      const { error } = await supabase.from('template_custom_fields').insert(fieldsToInsert);

      if (error) throw error;

      toast.success(`${parsedFields.length} champ(s) importé(s) avec succès`);
      handleClose();
      onSuccess();
    } catch (error: any) {
      console.error('Error importing fields:', error);
      toast.error(error.message || "Erreur lors de l'import");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredSubProcesses = processId
    ? subProcesses.filter((sp) => sp.process_template_id === processId)
    : subProcesses;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import en masse de champs personnalisés</DialogTitle>
          <DialogDescription>
            Collez vos données pour créer plusieurs champs en une fois.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Format info */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <strong>Format attendu :</strong> nom, libellé, type, requis (un champ par ligne)
              <br />
              <span className="text-muted-foreground">
                Exemple : code_projet, Code projet, text, oui
              </span>
              <br />
              <span className="text-muted-foreground">
                Types disponibles : {Object.values(FIELD_TYPE_LABELS).join(', ')}
              </span>
              <br />
              <span className="text-muted-foreground text-xs">
                Séparateurs acceptés : virgule, point-virgule, pipe (|), tabulation
              </span>
            </AlertDescription>
          </Alert>

          {/* Scope Selection */}
          <div className="space-y-4">
            <Label>Portée des champs importés</Label>
            <Tabs value={scope} onValueChange={(v) => setScope(v as FieldScope)}>
              <TabsList className="grid grid-cols-3">
                <TabsTrigger value="common">Commun à tous</TabsTrigger>
                <TabsTrigger value="process">Processus</TabsTrigger>
                <TabsTrigger value="sub_process">Sous-processus</TabsTrigger>
              </TabsList>

              <TabsContent value="common" className="mt-4">
                <p className="text-sm text-muted-foreground">
                  Les champs seront disponibles dans toutes les demandes.
                </p>
              </TabsContent>

              <TabsContent value="process" className="mt-4">
                <Select value={processId || ''} onValueChange={setProcessId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un processus" />
                  </SelectTrigger>
                  <SelectContent>
                    {processes.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TabsContent>

              <TabsContent value="sub_process" className="mt-4 space-y-4">
                <div className="space-y-2">
                  <Label>Filtrer par processus (optionnel)</Label>
                  <Select value={processId || '__all__'} onValueChange={(v) => setProcessId(v === '__all__' ? '' : v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Tous les processus" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">Tous</SelectItem>
                      {processes.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Sous-processus *</Label>
                  <Select value={subProcessId || ''} onValueChange={setSubProcessId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un sous-processus" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredSubProcesses.map((sp) => (
                        <SelectItem key={sp.id} value={sp.id}>
                          {sp.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Data Input */}
          <div className="space-y-2">
            <Label>Données à importer</Label>
            <Textarea
              value={rawData}
              onChange={(e) => handleDataChange(e.target.value)}
              placeholder={`code_projet, Code projet, text, oui\ndate_debut, Date de début, date, non\ntype_demande, Type de demande, select, oui`}
              rows={8}
              className="font-mono text-sm"
            />
          </div>

          {/* Parse errors */}
          {parseError && (
            <Alert variant="destructive">
              <AlertDescription>{parseError}</AlertDescription>
            </Alert>
          )}

          {/* Preview */}
          {parsedFields.length > 0 && (
            <div className="space-y-2">
              <Label>Aperçu ({parsedFields.length} champ(s))</Label>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-3 py-2 text-left">Nom</th>
                      <th className="px-3 py-2 text-left">Libellé</th>
                      <th className="px-3 py-2 text-left">Type</th>
                      <th className="px-3 py-2 text-left">Requis</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedFields.map((field, idx) => (
                      <tr key={idx} className="border-t">
                        <td className="px-3 py-2 font-mono">{field.name}</td>
                        <td className="px-3 py-2">{field.label}</td>
                        <td className="px-3 py-2">{FIELD_TYPE_LABELS[field.field_type]}</td>
                        <td className="px-3 py-2">{field.is_required ? 'Oui' : 'Non'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleClose}>
            Annuler
          </Button>
          <Button onClick={handleImport} disabled={isSubmitting || parsedFields.length === 0}>
            <Upload className="h-4 w-4 mr-2" />
            {isSubmitting ? 'Import...' : `Importer ${parsedFields.length} champ(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
