/**
 * NativeFieldsBanner — Affiche les champs « natifs » (hardcodés dans le code
 * des pages NewXxxRequest.tsx) d'un process donné, en lecture seule.
 *
 * Objectif : éviter la confusion entre l'onglet « Champs » du configurateur
 * (qui édite des template_custom_fields ADDITIONNELS) et le formulaire réel
 * qui contient déjà des champs codés en dur (Prestation, Description, etc.).
 *
 * Les champs additionnels ajoutés via le configurateur viennent en COMPLEMENT
 * des champs natifs listés ici.
 */
import { Badge } from '@/components/ui/badge';
import { Info, Lock } from 'lucide-react';

interface NativeField {
  label: string;
  required?: boolean;
  conditional?: string; // si conditionnel à une autre valeur
}

/** Map process_template_id → champs natifs hardcodés dans la page de création. */
const NATIVE_FIELDS_BY_PROCESS: Record<string, { page: string; fields: NativeField[] }> = {
  // ─── IT prestations (toutes utilisent NewITRequest.tsx) ──────────────────
  '11111111-1111-4111-8111-111111111301': {
    page: 'src/pages/it/NewITRequest.tsx',
    fields: [
      { label: 'Prestation', required: true },
      { label: 'Description / contexte', required: true },
      { label: 'Priorité', required: true },
      { label: 'Référent métier' },
      { label: 'Échéance souhaitée' },
      { label: 'Nom du dossier SharePoint', required: true, conditional: 'SharePoint' },
      { label: "Emails d'accès", required: true, conditional: 'SharePoint' },
      { label: 'Pièces jointes & liens' },
    ],
  },
  '11111111-1111-4111-8111-111111111302': {
    page: 'src/pages/it/NewITRequest.tsx',
    fields: [
      { label: 'Prestation', required: true },
      { label: 'Description / contexte', required: true },
      { label: 'Priorité', required: true },
      { label: 'Référent métier' },
      { label: 'Échéance souhaitée' },
      { label: 'Numéro de ticket ITP', conditional: 'Divalto' },
      { label: 'Pièces jointes & liens' },
    ],
  },
  '11111111-1111-4111-8111-111111111303': {
    page: 'src/pages/it/NewITRequest.tsx',
    fields: [
      { label: 'Prestation', required: true },
      { label: 'Description / contexte', required: true },
      { label: 'Priorité', required: true },
      { label: 'Référent métier' },
      { label: 'Échéance souhaitée' },
      { label: 'Numéro de ticket BLC', conditional: 'Pipedrive' },
      { label: 'Pièces jointes & liens' },
    ],
  },
  '11111111-1111-4111-8111-111111111304': {
    page: 'src/pages/it/NewITRequest.tsx',
    fields: [
      { label: 'Prestation', required: true },
      { label: 'Description / contexte', required: true },
      { label: 'Priorité', required: true },
      { label: 'Référent métier' },
      { label: 'Échéance souhaitée' },
      { label: 'Pièces jointes & liens' },
    ],
  },
  '11111111-1111-4111-8111-111111111305': {
    page: 'src/pages/it/NewITRequest.tsx',
    fields: [
      { label: 'Prestation', required: true },
      { label: 'Description / contexte', required: true },
      { label: 'Priorité', required: true },
      { label: 'Référent métier' },
      { label: 'Échéance souhaitée' },
      { label: 'Pièces jointes & liens' },
    ],
  },
  '11111111-1111-4111-8111-111111111306': {
    page: 'src/pages/it/NewITRequest.tsx',
    fields: [
      { label: 'Prestation', required: true },
      { label: 'Description / contexte', required: true },
      { label: 'Priorité', required: true },
      { label: 'Référent métier' },
      { label: 'Échéance souhaitée' },
      { label: 'Logiciel / outil concerné', required: true, conditional: 'Intervention IT' },
      { label: 'Sous-catégorie logiciel', conditional: 'selon logiciel' },
      { label: 'Pièces jointes & liens' },
    ],
  },
  '11111111-1111-4111-8111-111111111307': {
    page: 'src/pages/it/NewITRequest.tsx',
    fields: [
      { label: 'Prestation', required: true },
      { label: 'Description / contexte', required: true },
      { label: 'Priorité', required: true },
      { label: 'Référent métier' },
      { label: 'Échéance souhaitée' },
      { label: 'Pièces jointes & liens' },
    ],
  },
  '11111111-1111-4111-8111-111111111308': {
    page: 'src/pages/it/NewITRequest.tsx',
    fields: [
      { label: 'Prestation', required: true },
      { label: 'Description / contexte', required: true },
      { label: 'Priorité', required: true },
      { label: 'Référent métier' },
      { label: 'Pièces jointes & liens' },
    ],
  },
  '11111111-1111-4111-8111-111111111309': {
    page: 'src/pages/it/NewITRequest.tsx',
    fields: [
      { label: 'Prestation', required: true },
      { label: 'Description / contexte', required: true },
      { label: 'Priorité', required: true },
      { label: 'Référent métier' },
      { label: 'Échéance souhaitée' },
      { label: 'Pièces jointes & liens' },
    ],
  },
  '11111111-1111-4111-8111-111111111310': {
    page: 'src/pages/it/NewITRequest.tsx',
    fields: [
      { label: 'Prestation', required: true },
      { label: 'Description / contexte', required: true },
      { label: 'Priorité', required: true },
      { label: 'Référent métier' },
      { label: 'Échéance souhaitée' },
      { label: 'CDC (pièce jointe obligatoire)', required: true, conditional: 'Application dédiée' },
      { label: 'Pièces jointes & liens' },
    ],
  },
  // ─── Maintenance ───────────────────────────────────────────────────────
  '11111111-1111-4111-8111-111111111101': {
    page: 'src/pages/maintenance/NewMaintenanceRequest.tsx',
    fields: [
      { label: 'Justification / contexte', required: true },
      { label: 'Date de besoin' },
      { label: 'Lignes de matériel (articles + quantités)', required: true },
    ],
  },
  // ─── Logistique ─────────────────────────────────────────────────────────
  '11111111-1111-4111-8111-111111111201': {
    page: 'src/pages/logistique/NewLogistiqueRequest.tsx',
    fields: [
      { label: 'Filiale', required: true },
      { label: 'Code projet', required: true },
      { label: 'Urgence' },
      { label: 'Nature marchandise', required: true },
      { label: 'Départ du stock BGN' },
      { label: 'Expéditeur (adresse / nom / tel)', conditional: 'si pas BGN' },
      { label: 'Destinataire (adresse / nom / tel)', required: true },
      { label: 'Nombre de colis', required: true },
      { label: 'Type de colis' },
      { label: 'Date souhaitée enlèvement' },
      { label: 'Commentaire / précisions' },
    ],
  },
  // ─── Innovation ─────────────────────────────────────────────────────────
  'a1b2c3d4-0000-4000-a000-000000000001': {
    page: 'src/pages/InnovationNew.tsx',
    fields: [
      { label: 'Nom du projet', required: true },
      { label: 'Code projet', required: true },
      { label: 'Thème / sous-thème', required: true },
      { label: 'Descriptif', required: true },
      { label: 'Gain attendu', required: true },
      { label: 'Entité concernée', required: true },
      { label: 'Usage', required: true },
      { label: 'EBITDA / Capex / ROI / Commentaires financiers' },
      { label: 'Difficulté / Niveau stratégique (1-10)' },
      { label: 'Étiquettes' },
      { label: 'Sponsor / Commentaire projet' },
    ],
  },
  // ─── SMQ — Déclaration NC ───────────────────────────────────────────────
  '697fdfee-7a64-4193-af2f-bece2da44d8e': {
    page: 'src/pages/smq/SMQNewDeclaration.tsx',
    fields: [
      { label: 'Titre', required: true },
      { label: 'Description du problème' },
      { label: 'Date du constat', required: true },
      { label: 'Date clôture souhaitée' },
      { label: 'Processus / Métier / Société' },
      { label: 'Identification', required: true },
      { label: 'Apparition ailleurs' },
      { label: 'Nom fournisseur (si NC fournisseur)' },
      { label: 'Code projet' },
      { label: 'Causes racines' },
      { label: 'Actions correctives / préventives' },
      { label: 'Pilote (override)' },
      { label: 'Liens / pièces jointes' },
    ],
  },
};

interface Props {
  processId: string;
}

export function NativeFieldsBanner({ processId }: Props) {
  const native = NATIVE_FIELDS_BY_PROCESS[processId];
  if (!native) return null;

  return (
    <div className="rounded-lg border border-amber-300/50 bg-amber-50 dark:bg-amber-900/15 p-4 space-y-3">
      <div className="flex items-start gap-2">
        <Info className="h-4 w-4 text-amber-700 dark:text-amber-300 mt-0.5 shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
            Champs natifs du formulaire (hardcodés)
          </p>
          <p className="text-xs text-amber-800/80 dark:text-amber-200/80 mt-0.5">
            Ces champs sont définis dans le code <code className="font-mono text-[10px]">{native.page}</code>{' '}
            et apparaissent automatiquement dans le formulaire de demande. Les champs ajoutés
            ci-dessous (template_custom_fields) viennent en <strong>complément</strong>.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5 pl-6">
        {native.fields.map((f, i) => (
          <Badge
            key={i}
            variant="outline"
            className="text-[11px] bg-background/60 border-amber-300/50 text-amber-900 dark:text-amber-200 gap-1"
            title={f.conditional ? `Conditionnel : ${f.conditional}` : undefined}
          >
            <Lock className="h-2.5 w-2.5" />
            {f.label}
            {f.required && <span className="text-destructive">*</span>}
            {f.conditional && (
              <span className="text-[9px] text-amber-700/70 italic ml-0.5">({f.conditional})</span>
            )}
          </Badge>
        ))}
      </div>
    </div>
  );
}
