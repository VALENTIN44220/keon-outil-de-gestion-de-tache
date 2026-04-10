/**
 * Options pour les champs `table_lookup`.
 *
 * On regroupe par **libellé affiché** (colonne « affichage »), pas par ligne SQL.
 * Exemple : 3 lignes avec famille « Blue » et 2 « Orange » → 2 options dans le select,
 * pas 5. Même si la « colonne valeur » est un id différent par ligne.
 *
 * La valeur enregistrée pour une ligne du formulaire est celle de la **première**
 * ligne source qui porte ce libellé (colonne « valeur » telle que configurée sur le champ).
 */
export interface TableLookupOptionRow {
  id: string;
  label: string;
}

export function dedupeTableLookupOptions(
  options: TableLookupOptionRow[]
): TableLookupOptionRow[] {
  /** Clé = texte affiché ; valeur = id à stocker (première ligne pour ce libellé). */
  const firstIdByLabel = new Map<string, string>();

  for (const opt of options) {
    const id = String(opt.id ?? '').trim();
    if (!id) continue;

    let label = String(opt.label ?? '').trim();
    if (!label) label = id;

    if (!firstIdByLabel.has(label)) {
      firstIdByLabel.set(label, id);
    }
  }

  return Array.from(firstIdByLabel.entries())
    .map(([label, id]) => ({ id, label }))
    .sort((a, b) =>
      a.label.localeCompare(b.label, 'fr', { sensitivity: 'base' })
    );
}
