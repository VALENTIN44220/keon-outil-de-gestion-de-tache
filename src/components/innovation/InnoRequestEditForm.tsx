import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useInnoRole } from '@/hooks/useInnoRole';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Separator } from '@/components/ui/separator';
import { Check, ChevronsUpDown, Loader2, Save } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { ENTITES, THEMES, SOUS_THEMES, STATUS_CONFIG, type InnoRequest } from './constants';

interface Props {
  request: InnoRequest;
  onSaved: () => void;
  onCancel: () => void;
}

export function InnoRequestEditForm({ request, onSaved, onCancel }: Props) {
  const { isInnoAdmin } = useInnoRole();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [profiles, setProfiles] = useState<{ id: string; display_name: string }[]>([]);
  const [codeProjetOptions, setCodeProjetOptions] = useState<{ code: string; label: string }[]>([]);
  const [usageOptions, setUsageOptions] = useState<{ code: string; label: string }[]>([]);
  const [demandeurOpen, setDemandeurOpen] = useState(false);

  const [form, setForm] = useState({
    nom_projet: request.nom_projet,
    code_projet: request.code_projet,
    theme: request.theme,
    sous_theme: request.sous_theme,
    entite_concernee: request.entite_concernee,
    usage: request.usage_inno,
    descriptif: request.descriptif,
    commentaire_demande: request.commentaire_demande,
    gain_attendu: request.gain_attendu,
    partenaires_identifies: request.partenaires_identifies,
    sponsor: request.sponsor,
    ebitda_retour_financier: request.ebitda_retour_financier,
    capex_investissement: request.capex_investissement,
    roi: request.roi,
    commentaires_financiers: request.commentaires_financiers,
    temps_caracteristique: request.temps_caracteristique,
    difficulte_complexite: request.difficulte_complexite,
    niveau_strategique: request.niveau_strategique,
    commentaire_projet: request.commentaire_projet,
    statut_demande: request.status,
    demandeur_id: request.demandeur_id,
  });

  useEffect(() => {
    Promise.all([
      supabase.from('profiles').select('id, display_name').eq('status', 'active').order('display_name'),
      supabase.from('inno_code_projet_options').select('code, label').eq('is_active', true).order('code'),
      supabase.from('inno_usage_options').select('code, label').eq('is_active', true).order('label'),
    ]).then(([pRes, cRes, uRes]) => {
      setProfiles(pRes.data || []);
      setCodeProjetOptions(cRes.data || []);
      setUsageOptions(uRes.data || []);
    });
  }, []);

  const set = (key: string, value: any) => setForm(f => ({ ...f, [key]: value }));

  const selectedDemandeur = profiles.find(p => p.id === form.demandeur_id);
  const sousThemes = form.theme ? (SOUS_THEMES[form.theme] || []) : [];

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('inno_demandes')
        .update({
          nom_projet: form.nom_projet,
          code_projet: form.code_projet,
          theme: form.theme || null,
          sous_theme: form.sous_theme || null,
          entite_concernee: form.entite_concernee,
          usage: form.usage,
          descriptif: form.descriptif,
          commentaire_demande: form.commentaire_demande || null,
          gain_attendu: form.gain_attendu || null,
          partenaires_identifies: form.partenaires_identifies || null,
          sponsor: form.sponsor || null,
          ebitda_retour_financier: form.ebitda_retour_financier,
          capex_investissement: form.capex_investissement,
          roi: form.roi,
          commentaires_financiers: form.commentaires_financiers || null,
          temps_caracteristique: form.temps_caracteristique || null,
          difficulte_complexite: form.difficulte_complexite,
          niveau_strategique: form.niveau_strategique,
          commentaire_projet: form.commentaire_projet || null,
          statut_demande: form.statut_demande,
          demandeur_id: form.demandeur_id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', request.id);

      if (error) throw error;
      toast.success('Demande mise à jour');
      queryClient.invalidateQueries({ queryKey: ['inno-demandes'] });
      onSaved();
    } catch (e: any) {
      toast.error('Erreur : ' + (e.message || 'Échec de la sauvegarde'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 mt-4">
      {/* Nom projet */}
      <div>
        <Label className="text-xs">Nom du projet</Label>
        <Input value={form.nom_projet} onChange={e => set('nom_projet', e.target.value)} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Code projet */}
        <div>
          <Label className="text-xs">Code projet</Label>
          <Select value={form.code_projet} onValueChange={v => set('code_projet', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {codeProjetOptions.map(o => (
                <SelectItem key={o.code} value={o.code}>{o.code} — {o.label}</SelectItem>
              ))}
              {!codeProjetOptions.find(o => o.code === form.code_projet) && form.code_projet && (
                <SelectItem value={form.code_projet}>{form.code_projet}</SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>

        {/* Entité */}
        <div>
          <Label className="text-xs">Entité</Label>
          <Select value={form.entite_concernee} onValueChange={v => set('entite_concernee', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {ENTITES.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Thème */}
        <div>
          <Label className="text-xs">Thème</Label>
          <Select value={form.theme} onValueChange={v => { set('theme', v); set('sous_theme', ''); }}>
            <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>
              {THEMES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Sous-thème */}
        <div>
          <Label className="text-xs">Sous-thème</Label>
          <Select value={form.sous_theme} onValueChange={v => set('sous_theme', v)} disabled={!sousThemes.length}>
            <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>
              {sousThemes.map(st => <SelectItem key={st} value={st}>{st}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Usage */}
        <div>
          <Label className="text-xs">Usage</Label>
          <Select value={form.usage} onValueChange={v => set('usage', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {usageOptions.map(o => <SelectItem key={o.code} value={o.code}>{o.label}</SelectItem>)}
              {!usageOptions.find(o => o.code === form.usage) && form.usage && (
                <SelectItem value={form.usage}>{form.usage}</SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>

        {/* Statut */}
        {isInnoAdmin && (
          <div>
            <Label className="text-xs">Statut</Label>
            <Select value={form.statut_demande} onValueChange={v => set('statut_demande', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                  <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Demandeur - User picker */}
      <div>
        <Label className="text-xs">Demandeur</Label>
        <Popover open={demandeurOpen} onOpenChange={setDemandeurOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
              {selectedDemandeur?.display_name || 'Sélectionner un utilisateur'}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[300px] p-0" align="start">
            <Command>
              <CommandInput placeholder="Rechercher..." />
              <CommandList>
                <CommandEmpty>Aucun utilisateur trouvé</CommandEmpty>
                <CommandGroup>
                  {profiles.map(p => (
                    <CommandItem
                      key={p.id}
                      value={p.display_name}
                      onSelect={() => { set('demandeur_id', p.id); setDemandeurOpen(false); }}
                    >
                      <Check className={cn('mr-2 h-4 w-4', form.demandeur_id === p.id ? 'opacity-100' : 'opacity-0')} />
                      {p.display_name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      <div>
        <Label className="text-xs">Sponsor</Label>
        <Input value={form.sponsor} onChange={e => set('sponsor', e.target.value)} />
      </div>

      <Separator />

      {/* Descriptif */}
      <div>
        <Label className="text-xs">Descriptif</Label>
        <Textarea value={form.descriptif} onChange={e => set('descriptif', e.target.value)} rows={3} />
      </div>

      <div>
        <Label className="text-xs">Gain attendu</Label>
        <Textarea value={form.gain_attendu} onChange={e => set('gain_attendu', e.target.value)} rows={2} />
      </div>

      <div>
        <Label className="text-xs">Partenaires identifiés</Label>
        <Input value={form.partenaires_identifies} onChange={e => set('partenaires_identifies', e.target.value)} />
      </div>

      <Separator />

      {/* Financier */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label className="text-xs">EBITDA (€/an)</Label>
          <Input type="number" value={form.ebitda_retour_financier ?? ''} onChange={e => set('ebitda_retour_financier', e.target.value ? Number(e.target.value) : null)} />
        </div>
        <div>
          <Label className="text-xs">CAPEX (€)</Label>
          <Input type="number" value={form.capex_investissement ?? ''} onChange={e => set('capex_investissement', e.target.value ? Number(e.target.value) : null)} />
        </div>
        <div>
          <Label className="text-xs">ROI</Label>
          <Input type="number" step="0.1" value={form.roi ?? ''} onChange={e => set('roi', e.target.value ? Number(e.target.value) : null)} />
        </div>
      </div>

      <div>
        <Label className="text-xs">Commentaires financiers</Label>
        <Textarea value={form.commentaires_financiers} onChange={e => set('commentaires_financiers', e.target.value)} rows={2} />
      </div>

      <Separator />

      {/* Scoring */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label className="text-xs">Temps caractéristique</Label>
          <Input value={form.temps_caracteristique} onChange={e => set('temps_caracteristique', e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Difficulté (1-10)</Label>
          <Input type="number" min={1} max={10} value={form.difficulte_complexite ?? ''} onChange={e => set('difficulte_complexite', e.target.value ? Number(e.target.value) : null)} />
        </div>
        <div>
          <Label className="text-xs">Niveau stratégique (1-10)</Label>
          <Input type="number" min={1} max={10} value={form.niveau_strategique ?? ''} onChange={e => set('niveau_strategique', e.target.value ? Number(e.target.value) : null)} />
        </div>
      </div>

      <div>
        <Label className="text-xs">Commentaire demande</Label>
        <Textarea value={form.commentaire_demande} onChange={e => set('commentaire_demande', e.target.value)} rows={2} />
      </div>

      <div>
        <Label className="text-xs">Commentaire projet</Label>
        <Textarea value={form.commentaire_projet} onChange={e => set('commentaire_projet', e.target.value)} rows={2} />
      </div>

      <Separator />

      <div className="flex gap-2">
        <Button onClick={handleSave} disabled={saving} className="flex-1">
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Enregistrer
        </Button>
        <Button variant="outline" onClick={onCancel} disabled={saving}>Annuler</Button>
      </div>
    </div>
  );
}
