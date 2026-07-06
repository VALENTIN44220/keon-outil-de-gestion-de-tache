export interface CGIParticipant {
  fonction: string;
  profile_id?: string | null;
}

export interface CGISession {
  id: string;
  trimestre: string;
  date_seance: string;
  ordre_du_jour: string | null;
  compte_rendu: string | null;
  participants: CGIParticipant[];
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export const CGI_FONCTIONS = [
  'DG',
  'Dir Réalisation',
  'Resp Infra/Automatismes',
  'RRH',
  'Dir Com',
  'RQHSE',
  'Dir Dev',
  'DAF',
  'RSI',
] as const;

export type CGIFonction = (typeof CGI_FONCTIONS)[number];
