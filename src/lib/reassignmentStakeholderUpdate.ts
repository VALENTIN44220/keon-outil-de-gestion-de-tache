/**
 * Lorsqu'un utilisateur affecte ou réaffecte une tâche vers quelqu'un d'autre, enregistrer
 * `reassignment_stakeholder_id` sur son profil pour conserver l'accès (onglet « Tâches de l'équipe »,
 * chat / commentaires une fois la RLS alignée sur `can_access_task`, etc.).
 */
export function reassignmentStakeholderPatchForActingProfile(
  actingProfileId: string | null | undefined,
  prevAssigneeId: string | null | undefined,
  nextAssigneeId: string,
  existingStakeholderId: string | null | undefined
): { reassignment_stakeholder_id?: string } {
  if (!actingProfileId || existingStakeholderId) return {};
  if (!nextAssigneeId || nextAssigneeId === actingProfileId) return {};
  if (prevAssigneeId === nextAssigneeId) return {};

  const firstAssign = !prevAssigneeId;
  const reassign = !!prevAssigneeId && prevAssigneeId !== nextAssigneeId;
  if (reassign || firstAssign) {
    return { reassignment_stakeholder_id: actingProfileId };
  }
  return {};
}
