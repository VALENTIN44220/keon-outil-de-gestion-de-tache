/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AZURE_REDIRECT_URI: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
