/* eslint-disable local/require-art-page */
// NOTE: parallel-routes shell (@stats/@users slots compose in admin/layout.tsx) — no content
// of its own, so no <ArtPage> here. See @stats/page.tsx and @users/page.tsx.
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Admin' };

export default function Page() {
  return null;
}
