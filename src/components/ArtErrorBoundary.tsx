'use client';

import { Component, type ReactNode } from 'react';

// ==== Types ====

interface ArtErrorBoundaryProps {
  fallback: (error: Error, reset: () => void) => ReactNode;
  children: ReactNode;
}

interface ArtErrorBoundaryState {
  error: Error | null;
}

// ==== Component ====
// React error boundaries require a class component — no hook equivalent exists.

export class ArtErrorBoundary extends Component<ArtErrorBoundaryProps, ArtErrorBoundaryState> {
  state: ArtErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ArtErrorBoundaryState {
    return { error };
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) return this.props.fallback(this.state.error, this.reset);
    return this.props.children;
  }
}

export default ArtErrorBoundary;
