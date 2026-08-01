import type { Prisma } from '../../generated/prisma/client';

// ==== Constants ====

export const LOGO_ACCEPTED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const;
export type LogoMime = (typeof LOGO_ACCEPTED_MIME_TYPES)[number];

// ==== Select ====

export const LOGO_SELECT_LIGHT = {
  id: true,
  mime: true,
  name: true,
} as const;

export type LogoModel = Prisma.LogoGetPayload<{ select: typeof LOGO_SELECT_LIGHT }>;

// ==== Bytes response models ====
// Assembled client-side from HTTP headers (bytesClient.ts) — mime/name can be null there
// even though the DB column is NOT NULL. Not derived from LogoModel.

export type LogoBytesModel = {
  id: string;
  data: string | null;
  mime: string | null;
  name: string | null;
};

export type LogoMetadataModel = { id: string; name: string };
