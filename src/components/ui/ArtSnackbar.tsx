'use client';

import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { type ApiError } from '@/models/api-error';
import { type ArtIconName } from './ArtIcon';
import ArtTitle from './ArtTitle';
import ArtIconButton from './ArtIconButton';
import { type ArtColor, ART_COLOR_CLASS } from './art.types';
import { cn } from './art.utils';

export interface SnackOptions {
  color?: ArtColor;
  /** ms before auto-hide. 0 = no auto-hide. Default: 4000 */
  duration?: number;
  description?: string;
  icon?: ArtIconName;
}

interface SnackItem {
  id: string;
  groupKey: string;
  title: string;
  description?: string;
  icon?: ArtIconName;
  color?: ArtColor;
  duration: number;
  removing: boolean;
  count: number;
  /** Incremented on duplicate — triggers CSS progress bar restart via key= */
  version: number;
}

interface TimerEntry {
  remaining: number;
  startedAt: number;
  handle: ReturnType<typeof setTimeout> | undefined;
}

export interface AnchorOrigin {
  vertical: 'top' | 'bottom';
  horizontal: 'left' | 'center' | 'right';
}

interface ArtSnackbarContextValue {
  enqueue: (title: string, options?: SnackOptions) => string;
  enqueueError: (err: ApiError | Error | string, title?: string, opts?: Omit<SnackOptions, 'color' | 'description' | 'icon'>) => string;
  enqueueSuccess: (title: string, opts?: Omit<SnackOptions, 'color' | 'icon'>) => string;
  close: (id?: string) => void;
}

function makeGroupKey(title: string, color?: ArtColor, description?: string): string {
  return `${color ?? ''}|${title}|${description ?? ''}`;
}

const EXIT_MS = 260;

const ArtSnackbarContext = createContext<ArtSnackbarContextValue | null>(null);

function SnackItemUI({
  item,
  anchorOrigin,
  onClose,
  onPause,
  onResume,
  zIndex,
}: {
  item: SnackItem;
  anchorOrigin: AnchorOrigin;
  onClose: (id: string) => void;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  zIndex: number;
}) {
  const outClass = anchorOrigin.horizontal === 'left' ? 'art-snackbar--out-left' : 'art-snackbar--out';
  const fromLeftClass = anchorOrigin.horizontal === 'left' ? 'art-snackbar--from-left' : undefined;

  return (
    <div
      className={cn(
        'art-snackbar',
        item.color && ART_COLOR_CLASS[item.color],
        item.count >= 2 && 'art-snackbar--stacked',
        item.count >= 3 && 'art-snackbar--stacked-deep',
        !item.description && 'art-snackbar--centered',
        fromLeftClass,
        item.removing && outClass,
      )}
      style={{
        zIndex,
        '--snack-duration': `${item.duration}ms`,
        // Without a color, --art-accent inherits --primary (purple). Use muted gray for neutral snacks.
        ...(!item.color && { '--art-accent': 'var(--text-muted)' }),
      } as React.CSSProperties}
      onMouseEnter={() => onPause(item.id)}
      onMouseLeave={() => onResume(item.id)}
    >
      <ArtTitle title={item.title} description={item.description} icon={item.icon} size="sm" />
      {item.count > 1 && (
        <span className="art-snackbar-count">×{item.count}</span>
      )}
      <ArtIconButton
        icon={{ name: 'Close', size: 13 }}
        tooltip="Dismiss"
        onClick={() => onClose(item.id)}
      />
      {item.duration > 0 && (
        <div key={item.version} className="art-progress art-snackbar-progress">
          <div className="art-progress-fill" />
        </div>
      )}
    </div>
  );
}

function SnackStack({
  items,
  anchorOrigin,
  onClose,
  onPause,
  onResume,
}: {
  items: SnackItem[];
  anchorOrigin: AnchorOrigin;
  onClose: (id: string) => void;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
}) {
  const { vertical, horizontal } = anchorOrigin;

  const style: React.CSSProperties = {
    [vertical]: vertical === 'top' ? '5rem' : '1.25rem',
    ...(horizontal === 'left'   && { left: '1.25rem' }),
    ...(horizontal === 'center' && { left: '50%', transform: 'translateX(-50%)' }),
    ...(horizontal === 'right'  && { right: '1.25rem' }),
    flexDirection: vertical === 'bottom' ? 'column' : 'column-reverse',
  };

  return createPortal(
    <div className="art-snackbar-stack" style={style}>
      {items.map((item, index) => (
        <SnackItemUI
          key={item.id}
          item={item}
          anchorOrigin={anchorOrigin}
          onClose={onClose}
          onPause={onPause}
          onResume={onResume}
          zIndex={items.length - index}
        />
      ))}
    </div>,
    document.body,
  );
}

interface ArtSnackbarProviderProps {
  children: ReactNode;
  /** Max unique snacks visible at once. Oldest is evicted when exceeded. Default: 4 */
  maxSnack?: number;
  anchorOrigin?: AnchorOrigin;
  /** Default auto-hide duration in ms. Default: 4000 */
  defaultDuration?: number;
}

export function ArtSnackbarProvider({
  children,
  maxSnack = 4,
  anchorOrigin = { vertical: 'top', horizontal: 'right' },
  defaultDuration = 4000,
}: ArtSnackbarProviderProps) {
  const [items, setItems] = useState<SnackItem[]>([]);

  const itemsRef = useRef(items);
  useLayoutEffect(() => { itemsRef.current = items; });

  const timersRef = useRef(new Map<string, TimerEntry>());

  const closeSnack = useCallback((id: string) => {
    const t = timersRef.current.get(id);
    if (t) { clearTimeout(t.handle); timersRef.current.delete(id); }
    setItems((prev) => prev.map((s) => s.id === id ? { ...s, removing: true } : s));
    setTimeout(() => setItems((prev) => prev.filter((s) => s.id !== id)), EXIT_MS);
  }, []);

  // useCallback memoizes the function reference so dependent useCallbacks don't recreate
  // on every render, which would cascade re-renders through all consumers.
  const startEntry = useCallback((id: string, entry: TimerEntry) => {
    if (entry.remaining <= 0) return;
    clearTimeout(entry.handle);
    entry.startedAt = Date.now();
    entry.handle = setTimeout(() => closeSnack(id), entry.remaining);
  }, [closeSnack]);

  const pauseTimer = useCallback((id: string) => {
    const t = timersRef.current.get(id);
    if (!t) return;
    clearTimeout(t.handle);
    t.remaining = Math.max(0, t.remaining - (Date.now() - t.startedAt));
  }, []);

  const resumeTimer = useCallback((id: string) => {
    const t = timersRef.current.get(id);
    if (t) startEntry(id, t);
  }, [startEntry]);

  const initTimer = useCallback((id: string, duration: number) => {
    if (duration === 0) return;
    const entry: TimerEntry = { remaining: duration, startedAt: 0, handle: undefined };
    timersRef.current.set(id, entry);
    startEntry(id, entry);
  }, [startEntry]);

  const resetTimer = useCallback((id: string, duration: number) => {
    const t = timersRef.current.get(id);
    if (t) { t.remaining = duration; startEntry(id, t); }
    else initTimer(id, duration);
  }, [startEntry, initTimer]);

  const enqueue = useCallback((title: string, opts: SnackOptions = {}): string => {
    const { color, duration = defaultDuration, description, icon } = opts;
    const key = makeGroupKey(title, color, description);

    const existing = itemsRef.current.find((s) => !s.removing && s.groupKey === key);
    if (existing) {
      resetTimer(existing.id, existing.duration);
      setItems((prev) => {
        const rest = prev.filter((s) => s.id !== existing.id);
        return [...rest, { ...existing, count: existing.count + 1, version: existing.version + 1 }];
      });
      return existing.id;
    }

    const active = itemsRef.current.filter((s) => !s.removing);
    if (active.length >= maxSnack) closeSnack(active[0].id);

    const id = `snack-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setItems((prev) => [...prev, {
      id, groupKey: key, title, description, icon, color,
      duration, removing: false, count: 1, version: 0,
    }]);
    initTimer(id, duration);
    return id;
  }, [defaultDuration, maxSnack, closeSnack, resetTimer, initTimer]);

  const enqueueError = useCallback((
    err: ApiError | Error | string,
    title = 'Error',
    opts: Omit<SnackOptions, 'color' | 'description' | 'icon'> = {},
  ): string => {
    const description = typeof err === 'string' ? err : err.message;
    return enqueue(title, { ...opts, color: 'danger', icon: 'Close', description });
  }, [enqueue]);

  const enqueueSuccess = useCallback((
    title: string,
    opts: Omit<SnackOptions, 'color' | 'icon'> = {},
  ): string => {
    return enqueue(title, { ...opts, color: 'success', icon: 'Check' });
  }, [enqueue]);

  const close = useCallback((id?: string) => {
    if (id) closeSnack(id);
    else itemsRef.current.forEach((s) => closeSnack(s.id));
  }, [closeSnack]);

  return (
    <ArtSnackbarContext.Provider value={{ enqueue, enqueueError, enqueueSuccess, close }}>
      {children}
      {items.length > 0 && (
        <SnackStack
          items={items}
          anchorOrigin={anchorOrigin}
          onClose={closeSnack}
          onPause={pauseTimer}
          onResume={resumeTimer}
        />
      )}
    </ArtSnackbarContext.Provider>
  );
}

export function useArtSnackbar(): ArtSnackbarContextValue {
  const ctx = useContext(ArtSnackbarContext);
  if (!ctx) throw new Error('useArtSnackbar must be used inside <ArtSnackbarProvider>');
  return ctx;
}
