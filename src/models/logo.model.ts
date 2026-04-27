import * as yup from 'yup';

// ==== Constants ====

export const LOGO_ACCEPTED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const;
export type LogoMime = (typeof LOGO_ACCEPTED_MIME_TYPES)[number];

// ==== Types ====

export type LogoLight = {
  id: string;
  mime: string;
  name: string;
  createdAt: string;
};

export type LogoBytes = {
  logoData: string | null;
  logoMime: string | null;
  logoName: string | null;
};

// Full logo — metadata + decoded bytes merged for runtime use
export type Logo = LogoLight & LogoBytes;

// ==== Validators ====

export const LogoIdValidator = yup.string().uuid('Invalid logo ID');
