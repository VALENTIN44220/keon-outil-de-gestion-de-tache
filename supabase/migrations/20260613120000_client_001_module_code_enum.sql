-- CLIENT 001 — Ajoute la valeur 'client' à l'enum module_code (migration isolée :
-- une valeur d'enum ne peut être ajoutée et utilisée dans la même transaction).
ALTER TYPE module_code ADD VALUE IF NOT EXISTS 'client';
