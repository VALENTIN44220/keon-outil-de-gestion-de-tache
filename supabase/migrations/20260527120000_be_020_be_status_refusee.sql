-- Migration : ajout de l'état terminal be_status 'refusee'
--
-- Contexte : la chaîne de validation BE (N1 → N2) introduit un bouton « Refuser »
-- à chaque niveau. Une tâche refusée passe dans un état terminal négatif distinct
-- de la clôture positive ('cloturee').
--
-- Élargit la contrainte CHECK be_status pour accepter 'refusee'.
-- Additif : aucune donnée existante n'est modifiée.

BEGIN;

-- Supprimer l'ancienne contrainte CHECK
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_be_status_check;

-- Recréer avec la nouvelle valeur 'refusee'
ALTER TABLE tasks ADD CONSTRAINT tasks_be_status_check CHECK (
  be_status IN (
    'soumise',
    'affectee',
    'en_cours',
    'a_relire',
    'a_valider',
    'a_deposer',
    'en_instruction',
    'complement_demande',
    'cloturee',
    'refusee'
  )
);

COMMIT;
