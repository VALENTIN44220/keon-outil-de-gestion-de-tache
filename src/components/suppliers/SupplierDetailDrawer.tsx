import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSupplierCategories, useSupplierFamillesByCategorie } from "@/hooks/useSupplierCategorisation";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  MessageSquare,
  Lock,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface SupplierDetailDrawerProps {
  supplierId: string | null;
  open: boolean;
  onClose: () => void;
  canEdit?: boolean;
}

// Types alignés sur la table Supabase (supplier_purchase_enrichment)
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

  commentaires: string | null;

  completeness_score: number | null;
  status: "a_completer" | "en_cours" | "complet" | null;

  updated_at: string | null;
};

const SEGMENTS = ["Production", "Services", "IT", "Maintenance", "Transport", "Énergie", "Autre"];
const ENTITES = ["NASKEO", "PRODEVAL", "KEON", "Autre"];
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

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    segmentation: true,
    contrat: true,
    paiement: true,
    logistique: true,
    contact: true,
    commentaires: true,
  });

  const statusConfig: Record<"a_completer" | "en_cours" | "complet", { label: string; color: string }> = {
    a_completer: { label: "À compléter", color: "bg-destructive/10 text-destructive" },
    en_cours: { label: "En cours", color: "bg-warning/10 text-warning" },
    complet: { label: "Complet", color: "bg-success/10 text-success" },
  };

  // Load supplier by id
  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!open || !supplierId) {
        setSupplier(null);
        setFormData({});
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
          toast({
            title: "Erreur",
            description: "Impossible de charger le fournisseur.",
            variant: "destructive",
          });
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, supplierId]);

  // Debounced save
  useEffect(() => {
    if (!pendingSave || !supplierId) return;

    const timeout = setTimeout(async () => {
      setSaveStatus("saving");
      try {
        // Ne pas envoyer l'id dans l'update payload
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
      "categorie",
      "famille",
      "segment",
      "entite",
      "delai_de_paiement",
      "incoterm",
      "adresse_mail",
      "telephone",
      "type_de_contrat",
      "nom_contact",
    ];

    const missing = requiredFields.filter((f) => {
      const v = (formData as any)[f];
      return v === null || v === undefined || String(v).trim() === "";
    });

    if (missing.length > 0) {
      toast({
        title: "Champs obligatoires manquants",
        description: `Veuillez remplir: ${missing.join(", ")}`,
        variant: "destructive",
      });
      return;
    }

    if (!supplierId) return;

    try {
      const { error } = await supabase
        .from("supplier_purchase_enrichment")
        .update({ status: "complet" })
        .eq("id", supplierId);

      if (error) throw error;

      setFormData((p) => ({ ...p, status: "complet" }));
      toast({ title: "Fournisseur marqué comme complet", description: "La fiche a été validée." });
    } catch (e) {
      toast({ title: "Erreur", description: "Impossible de valider la fiche.", variant: "destructive" });
    }
  };

  const toggleSection = (section: string) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  if (!open) return null;

  const currentStatus = (formData.status ?? "a_completer") as "a_completer" | "en_cours" | "complet";

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : supplier ? (
          <div className="space-y-6">
            {/* Header */}
            <SheetHeader className="sticky top-0 bg-background z-10 pb-4 border-b">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <SheetTitle className="text-xl flex items-center gap-2">
                    <span className="font-mono bg-muted px-2 py-1 rounded">{supplier.tiers}</span>
                    <span>{supplier.nomfournisseur || "Sans nom"}</span>
                  </SheetTitle>

                  <div className="flex items-center gap-2 mt-2">
                    <Badge className={statusConfig[currentStatus].color}>
                      {statusConfig[currentStatus].label}
                    </Badge>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Progress value={formData.completeness_score || 0} className="h-2 w-20" />
                      <span>{formData.completeness_score || 0}%</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2">
                  <div className="flex items-center gap-2">
                    {saveStatus === "saving" && (
                      <span className="text-sm text-muted-foreground flex items-center gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Sauvegarde...
                      </span>
                    )}
                    {saveStatus === "saved" && (
                      <span className="text-sm text-success flex items-center gap-1">
                        <Check className="h-3 w-3" />
                        Sauvegardé
                      </span>
                    )}
                    {saveStatus === "error" && (
                      <span className="text-sm text-destructive flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        Erreur
                      </span>
                    )}
                  </div>

                   <Button onClick={handleMarkComplete} disabled={!canEdit || formData.status === "complet"}>
                     <Check className="h-4 w-4 mr-2" />
                     Marquer complet
                   </Button>
                </div>
              </div>
            </SheetHeader>

            {/* Source Data (Read-only) */}
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Lock className="h-4 w-4" />
                Données source (lecture seule)
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
                {supplier.famille_source_initiale ? (
                  <div className="col-span-2">
                    <Label className="text-xs text-muted-foreground">FAMILLE SOURCE</Label>
                    <div>{supplier.famille_source_initiale}</div>
                  </div>
                ) : null}
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
                  <Select
                    value={formData.categorie || ""}
                    onValueChange={(v) => {
                      // si la catégorie change : reset famille (sinon incohérence)
                      handleFieldChange("categorie", v);
                      handleFieldChange("famille", null);
                    }}
                    disabled={catLoading || !canEdit}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={catLoading ? "Chargement..." : "Sélectionner..."} />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>


               <FormField label="Famille *">
                <Select
                  value={formData.famille || ""}
                  onValueChange={(v) => handleFieldChange("famille", v)}
                  disabled={!canEdit || !formData.categorie || famLoading}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        !formData.categorie
                          ? "Choisir une catégorie d’abord"
                          : famLoading
                            ? "Chargement..."
                            : "Sélectionner..."
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {familles.map((f) => (
                      <SelectItem key={f} value={f}>
                        {f}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                  <Select value={formData.entite || ""} onValueChange={(v) => handleFieldChange("entite", v)} disabled={!canEdit}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner..." />
                    </SelectTrigger>
                    <SelectContent>
                      {ENTITES.map((e) => (
                        <SelectItem key={e} value={e}>
                          {e}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                  <Select
                    value={formData.type_de_contrat || ""}
                    onValueChange={(v) => handleFieldChange("type_de_contrat", v)}
                    disabled={!canEdit}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner..." />
                    </SelectTrigger>
                    <SelectContent>
                      {TYPES_CONTRAT.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                  <Input
                    type="date"
                    value={formData.validite_prix || ""}
                    onChange={(e) => handleFieldChange("validite_prix", e.target.value)}
                    disabled={!canEdit}
                  />
                </FormField>

                <FormField label="Validité contrat">
                  <Input
                    type="date"
                    value={formData.validite_du_contrat || ""}
                    onChange={(e) => handleFieldChange("validite_du_contrat", e.target.value)}
                    disabled={!canEdit}
                  />
                </FormField>

                <FormField label="Date 1ère signature">
                  <Input
                    type="date"
                    value={formData.date_premiere_signature || ""}
                    onChange={(e) => handleFieldChange("date_premiere_signature", e.target.value)}
                    disabled={!canEdit}
                  />
                </FormField>

                <FormField label="Avenants" className="col-span-2">
                  <Textarea
                    value={formData.avenants || ""}
                    onChange={(e) => handleFieldChange("avenants", e.target.value)}
                    placeholder="Détail des avenants..."
                    rows={2}
                    disabled={!canEdit}
                  />
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
                  <Select
                    value={formData.delai_de_paiement || ""}
                    onValueChange={(v) => handleFieldChange("delai_de_paiement", v)}
                    disabled={!canEdit}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner..." />
                    </SelectTrigger>
                    <SelectContent>
                      {DELAIS_PAIEMENT.map((d) => (
                        <SelectItem key={d} value={d}>
                          {d}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>

                <FormField label="Échéances de paiement">
                  <Input
                    value={formData.echeances_de_paiement || ""}
                    onChange={(e) => handleFieldChange("echeances_de_paiement", e.target.value)}
                    placeholder="Ex: fin de mois"
                    disabled={!canEdit}
                  />
                </FormField>

                <FormField label="Pénalités">
                  <Textarea
                    value={formData.penalites || ""}
                    onChange={(e) => handleFieldChange("penalites", e.target.value)}
                    placeholder="Conditions de pénalités..."
                    rows={2}
                    disabled={!canEdit}
                  />
                </FormField>

                <FormField label="Exclusivité / Non-sollicitation">
                  <Input
                    value={formData.exclusivite_non_sollicitation || ""}
                    onChange={(e) => handleFieldChange("exclusivite_non_sollicitation", e.target.value)}
                    placeholder="Oui / Non / Détails..."
                    disabled={!canEdit}
                  />
                </FormField>

                <FormField label="Remise">
                  <Input
                    value={formData.remise || ""}
                    onChange={(e) => handleFieldChange("remise", e.target.value)}
                    placeholder="% ou montant"
                    disabled={!canEdit}
                  />
                </FormField>

                <FormField label="RFA">
                  <Input
                    value={formData.rfa || ""}
                    onChange={(e) => handleFieldChange("rfa", e.target.value)}
                    placeholder="Ristourne fin d'année"
                    disabled={!canEdit}
                  />
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
                  <Select value={formData.incoterm || ""} onValueChange={(v) => handleFieldChange("incoterm", v)} disabled={!canEdit}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner..." />
                    </SelectTrigger>
                    <SelectContent>
                      {INCOTERMS.map((i) => (
                        <SelectItem key={i} value={i}>
                          {i}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>

                <FormField label="Transport">
                  <Input
                    value={formData.transport || ""}
                    onChange={(e) => handleFieldChange("transport", e.target.value)}
                    placeholder="Conditions de transport"
                    disabled={!canEdit}
                  />
                </FormField>

                <FormField label="Garanties bancaires & équipement" className="col-span-2">
                  <Textarea
                    value={String(formData.garanties_bancaire_et_equipement ?? "")}
                    onChange={(e) => handleFieldChange("garanties_bancaire_et_equipement", e.target.value)}
                    placeholder="Détails des garanties..."
                    rows={2}
                    disabled={!canEdit}
                  />
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
                  <Input
                    value={formData.nom_contact || ""}
                    onChange={(e) => handleFieldChange("nom_contact", e.target.value)}
                    placeholder="Prénom NOM"
                    disabled={!canEdit}
                  />
                </FormField>

                <FormField label="Poste">
                  <Input
                    value={formData.poste || ""}
                    onChange={(e) => handleFieldChange("poste", e.target.value)}
                    placeholder="Fonction"
                    disabled={!canEdit}
                  />
                </FormField>

                <FormField label="Email *">
                  <Input
                    type="email"
                    value={formData.adresse_mail || ""}
                    onChange={(e) => handleFieldChange("adresse_mail", e.target.value)}
                    placeholder="email@example.com"
                    disabled={!canEdit}
                  />
                </FormField>

                <FormField label="Téléphone *">
                  <Input
                    type="tel"
                    value={formData.telephone || ""}
                    onChange={(e) => handleFieldChange("telephone", e.target.value)}
                    placeholder="+33 1 23 45 67 89"
                    disabled={!canEdit}
                  />
                </FormField>
              </div>
            </CollapsibleSection>

            {/* Commentaires */}
            <CollapsibleSection
              title="Commentaires"
              icon={<MessageSquare className="h-4 w-4" />}
              open={openSections.commentaires}
              onToggle={() => toggleSection("commentaires")}
            >
              <FormField label="Commentaires généraux">
                <Textarea
                  value={formData.commentaires || ""}
                  onChange={(e) => handleFieldChange("commentaires", e.target.value)}
                  placeholder="Notes, remarques, historique..."
                  rows={4}
                  disabled={!canEdit}
                />
              </FormField>
            </CollapsibleSection>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            Fournisseur non trouvé
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

// Helper components
function CollapsibleSection({
  title,
  icon,
  open,
  onToggle,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
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

function FormField({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <Label className="text-sm">{label}</Label>
      {children}
    </div>
  );
}
