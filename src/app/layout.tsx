import type { Metadata } from 'next';
import './globals.css';
import Navbar from './Navbar';
import ReportSidebar from './ReportSidebar';
import QueryProvider from '@/providers/QueryProvider';
import { ReportProvider } from '@/providers/ReportProvider';
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
          <ReportProvider>
            <ArtSnackbarProvider>
              <ArtDialogProvider>
                <Navbar />
                <div className="flex" style={{ minHeight: 'calc(100vh - 56px)' }}>
                  <ReportSidebar />
                  <main className="flex-1 px-6 py-4">{children}</main>
                </div>
              </ArtDialogProvider>
            </ArtSnackbarProvider>
          </ReportProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
