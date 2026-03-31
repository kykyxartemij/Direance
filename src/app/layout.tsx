import type { Metadata } from 'next';
import './globals.css';
import Navbar from './Navbar';
import QueryProvider from '@/providers/QueryProvider';
import { ArtSnackbarProvider } from '@/components/ui/ArtSnackbar';
import { ArtDialogProvider } from '@/components/ui/ArtDialog';

export const metadata: Metadata = {
  title: { template: '%s | Direance', default: 'Direance' },
  description: 'Financial reports consolidation dashboard',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <QueryProvider>
          <ArtSnackbarProvider>
            <ArtDialogProvider>
              <Navbar />
              <main className="px-6 py-4">{children}</main>
            </ArtDialogProvider>
          </ArtSnackbarProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
