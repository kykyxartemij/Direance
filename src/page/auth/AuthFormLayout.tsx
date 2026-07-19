import type { ReactNode } from 'react';
import ArtCard from '@/components/ui/ArtCard';

interface AuthFormLayoutProps {
  children: ReactNode;
}

export function AuthFormLayout({ children }: AuthFormLayoutProps) {
  return <ArtCard>{children}</ArtCard>;
}

AuthFormLayout.displayName = 'AuthFormLayout';
