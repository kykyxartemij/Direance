import type { Metadata } from 'next';
import './globals.css';
import '@/components/ui/art.style.css';
import Navbar from './Navbar';
import ReportSidebar from './ReportSidebar';
import QueryProvider from '@/providers/QueryProvider';
import { AuthProvider } from '@/providers/AuthProvider';
import AuthGate from '@/providers/AuthGate';
import { ReportProvider } from '@/providers/ReportProvider';
import { ArtSnackbarProvider } from '@/components/ui/ArtSnackbar';
import { ArtDialogProvider } from '@/components/ui/ArtDialog';
import GlobalLoaderBlur from '@/components/GlobalLoaderBlur';
import GlobalMutationSnackbar from '@/components/GlobalMutationSnackbar';

export const metadata: Metadata = {
  title: { template: '%s | Direance', default: 'Direance' },
  description: 'Financial reports consolidation dashboard',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <QueryProvider>
          <AuthProvider>
            <AuthGate>
              <ReportProvider>
                <ArtSnackbarProvider>
                  <ArtDialogProvider>
                    <div className="flex flex-col" style={{ height: '100vh' }}>
                      <Navbar />
                      <div className="flex flex-1 overflow-hidden">
                        <main className="flex-1 overflow-y-auto px-6 py-4">{children}</main>
                        <ReportSidebar />
                      </div>
                    </div>
                    <GlobalLoaderBlur />
                    <GlobalMutationSnackbar />
                  </ArtDialogProvider>
                </ArtSnackbarProvider>
              </ReportProvider>
            </AuthGate>
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
