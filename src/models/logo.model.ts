import * as yup from 'yup';

// ==== Constants ====

export const LOGO_ACCEPTED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const;
export type LogoMime = (typeof LOGO_ACCEPTED_MIME_TYPES)[number];

// ==== Models ====

export type LogoModel = {
  id: string;
  name: string;
  mime: string;
};

/** Full logo — metadata + decoded bytes merged for runtime use (export dialog, preview) */
export type LogoBytesModel = {
  logoData: string | null;
  logoMime: string | null;
  logoName: string | null;
};

// ==== Validators ====

export const LogoIdValidator = yup.string().uuid('Invalid logo ID');
