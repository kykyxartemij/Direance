// ==== Constants ====

export const LOGO_ACCEPTED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const;
export type LogoMime = (typeof LOGO_ACCEPTED_MIME_TYPES)[number];

// ==== Models ====

export type LogoModel = {
  id: string;
  mime: string | null;
  name: string | null;
};

export type LogoBytesModel = LogoModel & {
  data: string | null;
};

export type LogoMetadataModel = { id: string; name: string };
