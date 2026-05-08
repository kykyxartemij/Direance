// 'use client';

// import { Component, Suspense, type ReactNode, type ErrorInfo, use } from 'react';
// import ArtSkeleton from './ArtSkeleton';

// // ==== ErrorBoundary ====

// interface BoundaryProps {
//   children: ReactNode;
//   error?: ReactNode;
// }

// interface BoundaryState {
//   caught: Error | null;
// }

// class ErrorBoundary extends Component<BoundaryProps, BoundaryState> {
//   state: BoundaryState = { caught: null };

//   static getDerivedStateFromError(error: Error): BoundaryState {
//     return { caught: error };
//   }

//   componentDidCatch(error: Error, info: ErrorInfo) {
//     console.error('[ArtAsync]', error, info.componentStack);
//   }

//   render() {
//     if (this.state.caught) {
//       return this.props.error ?? (
//         <p className="text-sm py-4" style={{ color: 'var(--danger)' }}>
//           Something went wrong. Try refreshing.
//         </p>
//       );
//     }
//     return this.props.children;
//   }
// }

// // ==== ArtAsync ====

// interface ArtAsyncProps {
//   children: ReactNode;
//   /** Custom Suspense fallback. Defaults to generic ArtSkeleton bars. Pass null to disable. */
//   fallback?: ReactNode;
//   /** Custom error UI. Defaults to a generic error message. */
//   error?: ReactNode;
// }

// export default function ArtAsync({ children, fallback, error }: ArtAsyncProps) {
//   const skeleton = fallback !== undefined ? fallback : 
//     <ArtSkeleton className='w-2 h-2'/>
//     //   {children} 
//     // </ArtSkeleton>;
//   return (
//     <ErrorBoundary error={error}>
//       <Suspense fallback={skeleton}>
//         {children}
//       </Suspense>
//     </ErrorBoundary>
//   );
// }


// // ==== Helpers ====

// export type Async<T> = Promise<T> | T;

// export function useAsync<T>(value: Async<T> | undefined): T | undefined {
//   if (value === undefined) return undefined;
//   return value instanceof Promise ? use(value) : value;
// }