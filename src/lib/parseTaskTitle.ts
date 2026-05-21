/**
 * parseTaskTitle — décompose un titre de tâche concaténé en segments
 * exploitables individuellement pour l'affichage.
 *
 * Convention historique observée dans les titres :
 *   "T-VINZ-0005 — BE — VINZ — AVINZETD — RACCORDEMENT — Étude raccordement"
 *    └────┬────┘   └────────┬────────┘   └────┬─────┘   └──────┬────────┘
 *       REF (code)      Contexte projet     PRESTATION         NOM réel
 *
 * Heuristique :
 *   1. Les codes en tête (T-XXX-NNNN, D-XXX-NNNN, etc.) → REF
 *   2. Le dernier segment → NOM
 *   3. Un segment ALL_CAPS placé avant le NOM → PRESTATION
 *   4. Tout ce qui reste entre REF et NOM (hors prestation) → CONTEXT (projet)
 *
 * Cette fonction est volontairement tolérante : si le titre ne suit pas la
 * convention, on renvoie au minimum un `name` non vide (le titre original).
 */

export interface ParsedTaskTitle {
  /** Code(s) de tâche extraits du début (ex: "T-VINZ-0005") */
  ref: string | null;
  /** Segments de contexte projet entre la ref et la prestation (ex: ["BE", "VINZ", "AVINZETD"]) */
  context: string[];
  /** Nom de la prestation/sous-processus en majuscules (ex: "RACCORDEMENT") */
  prestation: string | null;
  /** Nom court réel de la tâche (ex: "Étude raccordement") */
  name: string;
  /** Titre original non parsé, en fallback */
  raw: string;
}

const CODE_PREFIX_RE = /^((?:[TD]-[A-Z][A-Z0-9-]*\d+\s*—\s*)+)/;
const SEPARATOR_RE = /\s*[—\-]\s*/;

export function parseTaskTitle(
  title: string | null | undefined,
  fallbackCode?: string | null,
): ParsedTaskTitle {
  const raw = String(title ?? '').trim();
  if (!raw) {
    return { ref: fallbackCode ?? null, context: [], prestation: null, name: '', raw };
  }

  // 1. Extrait le(s) code(s) en tête
  const codeMatch = raw.match(CODE_PREFIX_RE);
  let ref: string | null = fallbackCode ?? null;
  let rest = raw;
  if (codeMatch && codeMatch[0]) {
    ref = codeMatch[0].replace(/\s*—\s*$/, '').trim();
    rest = raw.slice(codeMatch[0].length).trim();
  }

  // 2. Découpe par séparateur (— ou -)
  const parts = rest
    .split(SEPARATOR_RE)
    .map((s) => s.trim())
    .filter(Boolean);

  if (parts.length === 0) {
    return { ref, context: [], prestation: null, name: raw, raw };
  }

  if (parts.length === 1) {
    return { ref, context: [], prestation: null, name: parts[0], raw };
  }

  // 3. Dernier segment = NOM
  const name = parts[parts.length - 1];

  // 4. Cherche un segment ALL_CAPS qui pourrait être une PRESTATION
  let prestation: string | null = null;
  let prestationIdx = -1;
  for (let i = parts.length - 2; i >= 0; i--) {
    const p = parts[i];
    // Critères : >= 4 caractères, tout en majuscules (ou chiffres/espaces/tirets),
    // pas un code de projet court type "BE" / "IT" (<4 char)
    if (p.length >= 4 && p === p.toUpperCase() && /[A-ZÀ-Ý]/.test(p) && !/^[A-Z]+\d/.test(p)) {
      prestation = p;
      prestationIdx = i;
      break;
    }
  }

  // 5. CONTEXT = tout ce qui est entre la ref et la prestation (ou le nom)
  const contextEnd = prestationIdx >= 0 ? prestationIdx : parts.length - 1;
  const context = parts.slice(0, contextEnd);

  return { ref, context, prestation, name, raw };
}

/**
 * Helper d'affichage : renvoie le nom court (sans préfixes), ou le titre
 * complet en fallback si rien n'a pu être extrait.
 */
export function getTaskShortName(title: string | null | undefined): string {
  return parseTaskTitle(title).name || String(title ?? '');
}
