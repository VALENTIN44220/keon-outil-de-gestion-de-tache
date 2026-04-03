/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AZURE_REDIRECT_URI: string;
  /** Si `true`, affiche les logs `[auth/gate]` en production (sinon uniquement en dev). */
  readonly VITE_AUTH_GATE_DEBUG?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
