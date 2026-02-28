import React, { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSupplierCategories, useSupplierFamillesByCategorie } from "@/hooks/useSupplierCategorisation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { MultiSearchableSelect } from "@/components/ui/multi-searchable-select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ChevronDown,
  Check,
  AlertCircle,
  Loader2,
  Building2,
  FileText,
  CreditCard,
  Truck,
  User,
  Lock,
  Plus,
  Globe,
  Paperclip,
  Upload,
  Trash2,
  ExternalLink,
  Clock,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface SupplierDetailDrawerProps {
  supplierId: string | null;
  open: boolean;
  onClose: () => void;
  canEdit?: boolean;
}

type SupplierRow = {
  id: string;
  tiers: string | null;
  nomfournisseur: string | null;
  famille_source_initiale?: string | null;
  categorie: string | null;
  famille: string | null;
  segment: string | null;
  sous_segment: string | null;
  entite: string | null;
  type_de_contrat: string | null;
  evolution_tarif_2026: string | null;
  validite_prix: string | null;
  validite_du_contrat: string | null;
  date_premiere_signature: string | null;
  avenants: string | null;
  delai_de_paiement: string | null;
  delais_de_paiement_commentaires: string | null;
  echeances_de_paiement: string | null;
  penalites: string | null;
  exclusivite_non_sollicitation: string | null;
  remise: string | null;
  rfa: string | null;
  incoterm: string | null;
  transport: string | null;
  garanties_bancaire_et_equipement: string | number | null;
  nom_contact: string | null;
  poste: string | null;
  adresse_mail: string | null;
  telephone: string | null;
  site_web: string | null;
  commentaires: string | null;
  completeness_score: number | null;
  status: "a_completer" | "en_cours" | "complet" | null;
  updated_at: string | null;
};

interface SupplierAttachment {
  id: string;
  supplier_id: string;
  file_name: string;
  file_url: string;
  storage_path: string;
  created_at: string;
}

const SEGMENTS = ["Production", "Services", "IT", "Maintenance", "Transport", "Énergie", "Autre"];
const TYPES_CONTRAT = ["Contrat cadre", "Commande ponctuelle", "Appel d'offres", "Marché", "Convention"];
const DELAIS_PAIEMENT = ["Comptant", "30 jours", "45 jours", "60 jours", "90 jours"];
const INCOTERMS = ["EXW", "FCA", "CPT", "CIP", "DAP", "DPU", "DDP", "FAS", "FOB", "CFR", "CIF"];

export function SupplierDetailDrawer({ supplierId, open, onClose, canEdit = true }: SupplierDetailDrawerProps) {
  const [supplier, setSupplier] = useState<SupplierRow | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState<Partial<SupplierRow>>({});

  const { data: categories = [], isLoading: catLoading } = useSupplierCategories();
  const { data: familles = [], isLoading: famLoading } = useSupplierFamillesByCategorie(formData.categorie as string | null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [pendingSave, setPendingSave] = useState<Partial<SupplierRow> | null>(null);

  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [showAddCompany, setShowAddCompany] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState("");
  const [addingCompany, setAddingCompany] = useState(false);

  // Attachments
  const [attachments, setAttachments] = useState<SupplierAttachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    segmentation: true,
    contrat: true,
    paiement: true,
    logistique: true,
    contact: true,
    piecesjointes: true,
    commentaires: true,
  });

  const statusConfig: Record<"a_completer" | "en_cours" | "complet", { label: string; color: string }> = {
    a_completer: { label: "À compléter", color: "bg-destructive/10 text-destructive" },
    en_cours: { label: "En cours", color: "bg-warning/10 text-warning" },
    complet: { label: "Complet", color: "bg-success/10 text-success" },
  };

  const fetchCompanies = useCallback(async () => {
    const { data } = await supabase.from("companies").select("id, name").order("name");
    if (data) setCompanies(data);
  }, []);

  const fetchAttachments = useCallback(async () => {
    if (!supplierId) return;
    const { data } = await supabase
      .from("supplier_attachments")
      .select("*")
      .eq("supplier_id", supplierId)
      .order("created_at", { ascending: false });
    if (data) setAttachments(data as SupplierAttachment[]);
  }, [supplierId]);

  useEffect(() => {
    if (open) {
      fetchCompanies();
      fetchAttachments();
    }
  }, [open, fetchCompanies, fetchAttachments]);

  const handleAddCompany = async () => {
    const trimmed = newCompanyName.trim();
    if (!trimmed) return;
    setAddingCompany(true);
    try {
      const { data, error } = await supabase.from("companies").insert({ name: trimmed }).select("id, name").single();
      if (error) throw error;
      setCompanies((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      // Add the new company to the current entite list
      const currentEntites = (formData.entite || "").split(",").map(s => s.trim()).filter(Boolean);
      if (!currentEntites.includes(data.name)) {
        handleFieldChange("entite", [...currentEntites, data.name].join(", "));
      }
      setShowAddCompany(false);
      setNewCompanyName("");
      toast({ title: "Société ajoutée", description: `"${data.name}" a été créée.` });
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message || "Impossible de créer la société.", variant: "destructive" });
    } finally {
      setAddingCompany(false);
    }
  };

  // Load supplier by id
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!open || !supplierId) {
        setSupplier(null);
        setFormData({});
        setAttachments([]);
        return;
      }
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from("supplier_purchase_enrichment")
          .select("*")
          .eq("id", supplierId)
          .maybeSingle();
        if (error) throw error;
        if (cancelled) return;
        setSupplier((data as SupplierRow) ?? null);
        setFormData(((data as SupplierRow) ?? {}) as Partial<SupplierRow>);
      } catch (e) {
        if (!cancelled) {
          setSupplier(null);
          setFormData({});
          toast({ title: "Erreur", description: "Impossible de charger le fournisseur.", variant: "destructive" });
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, supplierId]);

  // Debounced save
  useEffect(() => {
    if (!pendingSave || !supplierId) return;
    const timeout = setTimeout(async () => {
      setSaveStatus("saving");
      try {
        const { id, ...payload } = pendingSave as any;
        const { error } = await supabase
          .from("supplier_purchase_enrichment")
          .update(payload)
          .eq("id", supplierId);
        if (error) throw error;
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 1500);
      } catch (e) {
        setSaveStatus("error");
      } finally {
        setPendingSave(null);
      }
    }, 1000);
    return () => clearTimeout(timeout);
  }, [pendingSave, supplierId]);

  const handleFieldChange = (field: keyof SupplierRow, value: any) => {
    if (!canEdit) return;
    const newData = { ...formData, [field]: value };
    setFormData(newData);
    setPendingSave(newData);
  };

  const handleMarkComplete = async () => {
    const requiredFields: (keyof SupplierRow)[] = [
      "categorie", "famille", "segment", "entite",
      "delai_de_paiement", "incoterm", "adresse_mail",
      "telephone", "type_de_contrat", "nom_contact",
    ];
    const missing = requiredFields.filter((f) => {
      const v = (formData as any)[f];
      return v === null || v === undefined || String(v).trim() === "";
    });
    if (missing.length > 0) {
      toast({ title: "Champs obligatoires manquants", description: `Veuillez remplir: ${missing.join(", ")}`, variant: "destructive" });
      return;
    }
    if (!supplierId) return;
    try {
      const { error } = await supabase.from("supplier_purchase_enrichment").update({ status: "complet" }).eq("id", supplierId);
      if (error) throw error;
      setFormData((p) => ({ ...p, status: "complet" }));
      toast({ title: "Fournisseur marqué comme complet" });
    } catch (e) {
      toast({ title: "Erreur", description: "Impossible de valider la fiche.", variant: "destructive" });
    }
  };

  const toggleSection = (section: string) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  // File upload handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !supplierId) return;
    setIsUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non connecté");

      const fileExt = file.name.split('.').pop();
      const storagePath = `${supplierId}/${crypto.randomUUID()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('supplier-attachments')
        .upload(storagePath, file);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('supplier-attachments')
        .getPublicUrl(storagePath);

      // Use signed URL since bucket is private
      const { data: signedData } = await supabase.storage
        .from('supplier-attachments')
        .createSignedUrl(storagePath, 60 * 60 * 24 * 365); // 1 year

      const fileUrl = signedData?.signedUrl || publicUrl;

      const { error: insertError } = await supabase
        .from('supplier_attachments')
        .insert({
          supplier_id: supplierId,
          file_name: file.name,
          file_url: fileUrl,
          storage_path: storagePath,
          uploaded_by: user.id,
        });
      if (insertError) throw insertError;

      await fetchAttachments();
      toast({ title: "Fichier ajouté", description: file.name });
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message || "Échec du téléchargement", variant: "destructive" });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteAttachment = async (att: SupplierAttachment) => {
    try {
      await supabase.storage.from('supplier-attachments').remove([att.storage_path]);
      await supabase.from('supplier_attachments').delete().eq('id', att.id);
      setAttachments((prev) => prev.filter((a) => a.id !== att.id));
      toast({ title: "Fichier supprimé" });
    } catch {
      toast({ title: "Erreur", description: "Impossible de supprimer", variant: "destructive" });
    }
  };

  const handleViewAttachment = async (att: SupplierAttachment) => {
    try {
      const { data } = await supabase.storage
        .from('supplier-attachments')
        .createSignedUrl(att.storage_path, 60 * 60);
      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      }
    } catch {
      toast({ title: "Erreur", description: "Impossible d'ouvrir le fichier", variant: "destructive" });
    }
  };

  if (!open) return null;
  const currentStatus = (formData.status ?? "a_completer") as "a_completer" | "en_cours" | "complet";

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-[95vw] w-full h-[95vh] flex flex-col p-0 overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : supplier ? (
            <div className="flex flex-col h-full overflow-hidden">
              {/* Header */}
              <DialogHeader className="p-6 border-b shrink-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <DialogTitle className="text-2xl flex items-center gap-2">
                      <span className="font-mono bg-muted px-2 py-1 rounded">{supplier.tiers}</span>
                      <span>{supplier.nomfournisseur || "Sans nom"}</span>
                    </DialogTitle>
                    <div className="flex items-center gap-2 mt-3">
                      <Badge className={statusConfig[currentStatus].color}>
                        {statusConfig[currentStatus].label}
                      </Badge>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Progress value={formData.completeness_score || 0} className="h-2 w-32" />
                        <span>{formData.completeness_score || 0}%</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <div className="flex items-center gap-2">
                      {saveStatus === "saving" && (
                        <span className="text-sm text-muted-foreground flex items-center gap-1">
                          <Loader2 className="h-3 w-3 animate-spin" /> Sauvegarde...
                        </span>
                      )}
                      {saveStatus === "saved" && (
                        <span className="text-sm text-success flex items-center gap-1">
                          <Check className="h-3 w-3" /> Sauvegardé
                        </span>
                      )}
                      {saveStatus === "error" && (
                        <span className="text-sm text-destructive flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" /> Erreur
                        </span>
                      )}
                    </div>
                    <Button onClick={handleMarkComplete} disabled={!canEdit || formData.status === "complet"}>
                      <Check className="h-4 w-4 mr-2" /> Marquer complet
                    </Button>
                  </div>
                </div>
              </DialogHeader>

              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto p-6">
                <div className="max-w-4xl mx-auto space-y-6">

                  {/* Last Modified Date Card */}
                  {formData.updated_at && (
                    <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border">
                      <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="text-sm">
                        <span className="text-muted-foreground">Dernière modification : </span>
                        <span className="font-medium">
                          {format(new Date(formData.updated_at), "dd MMMM yyyy 'à' HH:mm", { locale: fr })}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Source Data (Read-only) */}
                  <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <Lock className="h-4 w-4" /> Données source (lecture seule)
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-xs text-muted-foreground">TIERS</Label>
                        <div className="font-mono font-medium">{supplier.tiers}</div>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">NOM FOURNISSEUR</Label>
                        <div className="font-medium">{supplier.nomfournisseur || "—"}</div>
                      </div>
                      {supplier.famille_source_initiale && (
                        <div className="col-span-2">
                          <Label className="text-xs text-muted-foreground">FAMILLE SOURCE</Label>
                          <div>{supplier.famille_source_initiale}</div>
                        </div>
                      )}
                    </div>
                  </div>

                  <Separator />

                  {/* Segmentation */}
                  <CollapsibleSection
                    title="Segmentation"
                    icon={<Building2 className="h-4 w-4" />}
                    open={openSections.segmentation}
                    onToggle={() => toggleSection("segmentation")}
                  >
                    <div className="grid grid-cols-2 gap-4">
                      <FormField label="Catégorie *">
                        <SearchableSelect
                          value={formData.categorie || ""}
                          onValueChange={(v) => {
                            const newData = { ...formData, categorie: v, famille: null };
                            setFormData(newData);
                            setPendingSave(newData);
                          }}
                          disabled={catLoading || !canEdit}
                          placeholder={catLoading ? "Chargement..." : "Sélectionner..."}
                          searchPlaceholder="Rechercher une catégorie..."
                          options={categories.map((c) => ({ value: c, label: c }))}
                        />
                      </FormField>

                      <FormField label="Famille *">
                        <SearchableSelect
                          value={formData.famille || ""}
                          onValueChange={(v) => handleFieldChange("famille", v)}
                          disabled={!canEdit || !formData.categorie || famLoading}
                          placeholder={!formData.categorie ? "Choisir une catégorie d'abord" : famLoading ? "Chargement..." : "Sélectionner..."}
                          searchPlaceholder="Rechercher une famille..."
                          options={familles.map((f) => ({ value: f, label: f }))}
                        />
                      </FormField>

                      <FormField label="Segment">
                        <SearchableSelect
                          value={formData.segment || ""}
                          onValueChange={(v) => handleFieldChange("segment", v)}
                          disabled={!canEdit}
                          placeholder="Sélectionner..."
                          searchPlaceholder="Rechercher..."
                          options={SEGMENTS.map((s) => ({ value: s, label: s }))}
                        />
                      </FormField>

                      <FormField label="Sous-segment">
                        <Input
                          value={formData.sous_segment || ""}
                          onChange={(e) => handleFieldChange("sous_segment", e.target.value)}
                          placeholder="Précision..."
                          disabled={!canEdit}
                        />
                      </FormField>

                      <FormField label="Entité *" className="col-span-2">
                        <div className="flex gap-2">
                          <MultiSearchableSelect
                            values={(formData.entite || "").split(",").map(s => s.trim()).filter(Boolean)}
                            onValuesChange={(vals) => handleFieldChange("entite", vals.join(", "))}
                            disabled={!canEdit}
                            placeholder="Sélectionner..."
                            searchPlaceholder="Rechercher une société..."
                            triggerClassName="flex-1"
                            options={companies.map((c) => ({ value: c.name, label: c.name }))}
                          />
                          {canEdit && (
                            <Button type="button" variant="outline" size="icon" onClick={() => setShowAddCompany(true)} title="Ajouter une société">
                              <Plus className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </FormField>
                    </div>
                  </CollapsibleSection>

                  {/* Contrat & Prix */}
                  <CollapsibleSection
                    title="Contrat & Prix"
                    icon={<FileText className="h-4 w-4" />}
                    open={openSections.contrat}
                    onToggle={() => toggleSection("contrat")}
                  >
                    <div className="grid grid-cols-2 gap-4">
                      <FormField label="Type de contrat *">
                        <SearchableSelect
                          value={formData.type_de_contrat || ""}
                          onValueChange={(v) => handleFieldChange("type_de_contrat", v)}
                          disabled={!canEdit}
                          placeholder="Sélectionner..."
                          searchPlaceholder="Rechercher..."
                          options={TYPES_CONTRAT.map((t) => ({ value: t, label: t }))}
                        />
                      </FormField>

                      <FormField label="Évolution tarif 2026">
                        <Input
                          value={formData.evolution_tarif_2026 || ""}
                          onChange={(e) => handleFieldChange("evolution_tarif_2026", e.target.value)}
                          placeholder="+3%, stable, etc."
                          disabled={!canEdit}
                        />
                      </FormField>

                      <FormField label="Validité prix">
                        <Input type="date" value={formData.validite_prix || ""} onChange={(e) => handleFieldChange("validite_prix", e.target.value)} disabled={!canEdit} />
                      </FormField>

                      <FormField label="Validité contrat">
                        <Input type="date" value={formData.validite_du_contrat || ""} onChange={(e) => handleFieldChange("validite_du_contrat", e.target.value)} disabled={!canEdit} />
                      </FormField>

                      <FormField label="Date 1ère signature">
                        <Input type="date" value={formData.date_premiere_signature || ""} onChange={(e) => handleFieldChange("date_premiere_signature", e.target.value)} disabled={!canEdit} />
                      </FormField>

                      <FormField label="Avenants" className="col-span-2">
                        <Textarea value={formData.avenants || ""} onChange={(e) => handleFieldChange("avenants", e.target.value)} placeholder="Détail des avenants..." rows={2} disabled={!canEdit} />
                      </FormField>
                    </div>
                  </CollapsibleSection>

                  {/* Paiement */}
                  <CollapsibleSection
                    title="Paiement"
                    icon={<CreditCard className="h-4 w-4" />}
                    open={openSections.paiement}
                    onToggle={() => toggleSection("paiement")}
                  >
                    <div className="grid grid-cols-2 gap-4">
                      <FormField label="Délai de paiement *">
                        <SearchableSelect
                          value={formData.delai_de_paiement || ""}
                          onValueChange={(v) => handleFieldChange("delai_de_paiement", v)}
                          disabled={!canEdit}
                          placeholder="Sélectionner..."
                          searchPlaceholder="Rechercher..."
                          options={DELAIS_PAIEMENT.map((d) => ({ value: d, label: d }))}
                          allowCustom
                          customPlaceholder="Ajouter une valeur..."
                        />
                      </FormField>

                      <FormField label="Échéances de paiement">
                        <Input value={formData.echeances_de_paiement || ""} onChange={(e) => handleFieldChange("echeances_de_paiement", e.target.value)} placeholder="Ex: fin de mois" disabled={!canEdit} />
                      </FormField>

                      <FormField label="Commentaires délai de paiement" className="col-span-2">
                        <Textarea value={formData.delais_de_paiement_commentaires || ""} onChange={(e) => handleFieldChange("delais_de_paiement_commentaires", e.target.value)} placeholder="Commentaires sur le délai de paiement..." rows={2} disabled={!canEdit} />
                      </FormField>

                      <FormField label="Pénalités" className="col-span-2">
                        <Textarea value={formData.penalites || ""} onChange={(e) => handleFieldChange("penalites", e.target.value)} placeholder="Conditions de pénalités..." rows={2} disabled={!canEdit} />
                      </FormField>

                      <FormField label="Exclusivité / Non-sollicitation">
                        <Input value={formData.exclusivite_non_sollicitation || ""} onChange={(e) => handleFieldChange("exclusivite_non_sollicitation", e.target.value)} placeholder="Oui / Non / Détails..." disabled={!canEdit} />
                      </FormField>

                      <FormField label="Remise">
                        <Input value={formData.remise || ""} onChange={(e) => handleFieldChange("remise", e.target.value)} placeholder="% ou montant" disabled={!canEdit} />
                      </FormField>

                      <FormField label="RFA">
                        <Input value={formData.rfa || ""} onChange={(e) => handleFieldChange("rfa", e.target.value)} placeholder="Ristourne fin d'année" disabled={!canEdit} />
                      </FormField>
                    </div>
                  </CollapsibleSection>

                  {/* Logistique */}
                  <CollapsibleSection
                    title="Logistique"
                    icon={<Truck className="h-4 w-4" />}
                    open={openSections.logistique}
                    onToggle={() => toggleSection("logistique")}
                  >
                    <div className="grid grid-cols-2 gap-4">
                      <FormField label="Incoterm *">
                        <SearchableSelect
                          value={formData.incoterm || ""}
                          onValueChange={(v) => handleFieldChange("incoterm", v)}
                          disabled={!canEdit}
                          placeholder="Sélectionner..."
                          searchPlaceholder="Rechercher..."
                          options={INCOTERMS.map((i) => ({ value: i, label: i }))}
                        />
                      </FormField>

                      <FormField label="Transport">
                        <Input value={formData.transport || ""} onChange={(e) => handleFieldChange("transport", e.target.value)} placeholder="Conditions de transport" disabled={!canEdit} />
                      </FormField>

                      <FormField label="Garanties bancaires & équipement" className="col-span-2">
                        <Textarea value={String(formData.garanties_bancaire_et_equipement ?? "")} onChange={(e) => handleFieldChange("garanties_bancaire_et_equipement", e.target.value)} placeholder="Détails des garanties..." rows={2} disabled={!canEdit} />
                      </FormField>
                    </div>
                  </CollapsibleSection>

                  {/* Contact */}
                  <CollapsibleSection
                    title="Contact"
                    icon={<User className="h-4 w-4" />}
                    open={openSections.contact}
                    onToggle={() => toggleSection("contact")}
                  >
                    <div className="grid grid-cols-2 gap-4">
                      <FormField label="Nom du contact *">
                        <Input value={formData.nom_contact || ""} onChange={(e) => handleFieldChange("nom_contact", e.target.value)} placeholder="Prénom NOM" disabled={!canEdit} />
                      </FormField>

                      <FormField label="Poste">
                        <Input value={formData.poste || ""} onChange={(e) => handleFieldChange("poste", e.target.value)} placeholder="Fonction" disabled={!canEdit} />
                      </FormField>

                      <FormField label="Email *">
                        <Input type="email" value={formData.adresse_mail || ""} onChange={(e) => handleFieldChange("adresse_mail", e.target.value)} placeholder="email@example.com" disabled={!canEdit} />
                      </FormField>

                      <FormField label="Téléphone *">
                        <Input type="tel" value={formData.telephone || ""} onChange={(e) => handleFieldChange("telephone", e.target.value)} placeholder="+33 1 23 45 67 89" disabled={!canEdit} />
                      </FormField>

                      <FormField label="Site web" className="col-span-2">
                        <div className="flex gap-2">
                          <Input
                            type="url"
                            value={formData.site_web || ""}
                            onChange={(e) => handleFieldChange("site_web", e.target.value)}
                            placeholder="https://www.example.com"
                            disabled={!canEdit}
                            className="flex-1"
                          />
                          {formData.site_web && (
                            <Button type="button" variant="outline" size="icon" asChild>
                              <a href={formData.site_web.startsWith('http') ? formData.site_web : `https://${formData.site_web}`} target="_blank" rel="noopener noreferrer">
                                <Globe className="h-4 w-4" />
                              </a>
                            </Button>
                          )}
                        </div>
                      </FormField>
                    </div>
                  </CollapsibleSection>

                  {/* Pièces jointes */}
                  <CollapsibleSection
                    title="Pièces jointes"
                    icon={<Paperclip className="h-4 w-4" />}
                    open={openSections.piecesjointes}
                    onToggle={() => toggleSection("piecesjointes")}
                  >
                    <div className="space-y-3">
                      {attachments.length > 0 && (
                        <div className="space-y-2">
                          {attachments.map((att) => (
                            <div key={att.id} className="flex items-center gap-2 p-2 rounded-lg border bg-muted/30">
                              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                              <div className="flex-1 min-w-0">
                                <button
                                  onClick={() => handleViewAttachment(att)}
                                  className="text-sm font-medium hover:underline flex items-center gap-1 text-left"
                                >
                                  {att.file_name}
                                  <ExternalLink className="h-3 w-3 shrink-0" />
                                </button>
                                <p className="text-xs text-muted-foreground">
                                  {format(new Date(att.created_at), "dd/MM/yyyy HH:mm", { locale: fr })}
                                </p>
                              </div>
                              {canEdit && (
                                <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => handleDeleteAttachment(att)}>
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {canEdit && (
                        <div>
                          <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileUpload} disabled={isUploading} />
                          <Button type="button" variant="outline" className="w-full" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                            {isUploading ? (
                              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Téléchargement...</>
                            ) : (
                              <><Upload className="h-4 w-4 mr-2" /> Ajouter un fichier</>
                            )}
                          </Button>
                        </div>
                      )}

                      {attachments.length === 0 && !canEdit && (
                        <p className="text-sm text-muted-foreground">Aucune pièce jointe</p>
                      )}
                    </div>
                  </CollapsibleSection>

                  {/* Commentaires */}
                  <CollapsibleSection
                    title="Commentaires"
                    icon={<Lock className="h-4 w-4" />}
                    open={openSections.commentaires}
                    onToggle={() => toggleSection("commentaires")}
                  >
                    <FormField label="Notes">
                      <Textarea value={formData.commentaires || ""} onChange={(e) => handleFieldChange("commentaires", e.target.value)} placeholder="Notes, remarques, historique..." rows={4} disabled={!canEdit} />
                    </FormField>
                  </CollapsibleSection>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">Fournisseur non trouvé</div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Company Dialog */}
      <Dialog open={showAddCompany} onOpenChange={setShowAddCompany}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Ajouter une société</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label>Nom de la société</Label>
            <Input
              value={newCompanyName}
              onChange={(e) => setNewCompanyName(e.target.value)}
              placeholder="Ex: NASKEO, PRODEVAL..."
              onKeyDown={(e) => e.key === "Enter" && handleAddCompany()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddCompany(false)}>Annuler</Button>
            <Button onClick={handleAddCompany} disabled={!newCompanyName.trim() || addingCompany}>
              {addingCompany && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Helper components
function CollapsibleSection({
  title, icon, open, onToggle, children,
}: {
  title: string; icon: React.ReactNode; open: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <Collapsible open={open} onOpenChange={onToggle}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" className="w-full justify-between p-0 h-auto">
          <div className="flex items-center gap-2 py-2">
            {icon}
            <span className="font-semibold">{title}</span>
          </div>
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-4">{children}</CollapsibleContent>
    </Collapsible>
  );
}

function FormField({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string; }) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <Label className="text-sm">{label}</Label>
      {children}
    </div>
  );
}
