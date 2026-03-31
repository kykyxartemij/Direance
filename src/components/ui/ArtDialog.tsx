'use client';

import React, {
  createContext, useCallback, useContext, useMemo, useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import ArtButton, { type ArtButtonProps } from './ArtButton';
import { type ArtIconName } from './ArtIcon';
import ArtIconButton from './ArtIconButton';
import ArtTitle from './ArtTitle';
import { type ArtColor, ART_COLOR_CLASS } from './art.types';
import { cn } from './art.utils';

// ---- Types ----

export type ArtDialogButtonProps = Omit<ArtButtonProps, 'children' | 'onClick'> & {
  label: string;
  onClick?: () => void;
  /** Auto-close the dialog after onClick (default: true) */
  closesDialog?: boolean;
};

/**
 * `true`            → default ghost "Cancel" button
 * `false|undefined` → no cancel button
 * object            → overrides for the cancel button; onClick always closes the dialog
 */
export type ArtDialogCancelButton =
  | boolean
  | (Omit<ArtDialogButtonProps, 'onClick' | 'closesDialog' | 'label'> & { label?: string });

export interface ArtDialogConfig {
  title: string;
  description?: string;
  icon?: ArtIconName;
  color?: ArtColor;
  /** default = surface background, outlined = accent-tinted border + background */
  variant?: 'default' | 'outlined';
  content?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  buttons?: ArtDialogButtonProps[];
  /** Cancel button: true = default ghost, false/omit = hidden, object = custom overrides */
  cancelButton?: ArtDialogCancelButton;
  onClose?: () => void;
}

interface ArtDialogContextValue {
  show: (config: ArtDialogConfig) => void;
  close: () => void;
}

// ---- Context ----

const ArtDialogContext = createContext<ArtDialogContextValue | null>(null);

// ---- Provider ─────────────────────────────────────────────────────────────
// Mounts DialogUI once at the root — no remount flicker on open/close.
// ───────────────────────────────────────────────────────────────────────────

export function ArtDialogProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<ArtDialogConfig | null>(null);

  const show  = useCallback((cfg: ArtDialogConfig) => setConfig(cfg), []);
  const close = useCallback(() => setConfig((prev) => { prev?.onClose?.(); return null; }), []);

  // Stable object — prevents all useContext(ArtDialogContext) consumers from
  // re-rendering when config state changes (show/close are already stable callbacks).
  const value = useMemo(() => ({ show, close }), [show, close]);

  return (
    <ArtDialogContext.Provider value={value}>
      {children}
      {config !== null && createPortal(<DialogUI config={config} onClose={close} />, document.body)}
    </ArtDialogContext.Provider>
  );
}

// ---- Hook ----

export function useArtDialog(): ArtDialogContextValue {
  const ctx = useContext(ArtDialogContext);
  if (!ctx) throw new Error('useArtDialog must be used inside <ArtDialogProvider>');
  return ctx;
}

// ---- ArtDialog ─────────────────────────────────────────────────────────────
// Wraps a trigger child. Supports:
//   • Provider mode (recommended) — provider manages state, no remount
//   • Controlled mode — caller manages open/onOpenChange
//   • Fallback mode — local useState when no provider and no controlled state
export interface ArtDialogProps extends ArtDialogConfig {
  /** Element that opens the dialog on click */
  children: ReactNode;
  /** Controlled open state */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function ArtDialog({
  children,
  open: openProp,
  onOpenChange,
  onClose: onCloseProp,
  ...config
}: ArtDialogProps) {
  const ctx = useContext(ArtDialogContext);

  // Always declared — only used in fallback mode (no provider, not controlled)
  const [localOpen, setLocalOpen] = useState(false);

  const isControlled = openProp !== undefined;
  // Provider is only used when the caller does not supply their own open state.
  // Supplying `open` (controlled mode) bypasses the provider entirely so the
  // caller's state machine owns open/close.
  const useProvider = !!ctx && !isControlled;
  const isOpen      = isControlled ? openProp : localOpen;

  const handleClose = useCallback(() => {
    if (!isControlled) setLocalOpen(false);
    onOpenChange?.(false);
    onCloseProp?.();
    if (useProvider) ctx!.close();
  }, [isControlled, useProvider, ctx, onOpenChange, onCloseProp]);

  const handleOpen = () => {
    if (useProvider) {
      ctx!.show({ ...config, onClose: handleClose });
      return;
    }
    if (!isControlled) setLocalOpen(true);
    onOpenChange?.(true);
  };

  const trigger = React.isValidElement(children)
    ? <div onClick={handleOpen} style={{ display: 'contents' }}>{children}</div>
    : <button type="button" onClick={handleOpen}>{children}</button>;

  return (
    <>
      {trigger}

      {/* Local portal — rendered when not delegating to the provider */}
      {!useProvider && createPortal(
        <DialogUI
          config={isOpen ? { ...config, onClose: handleClose } : null}
          onClose={handleClose}
        />,
        document.body,
      )}
    </>
  );
}

// ---- ArtConfirmDialog ──────────────────────────────────────────────────────
// Thin wrapper for yes/no confirmation flows — reuses ArtDialog.
// ───────────────────────────────────────────────────────────────────────────

export interface ArtConfirmDialogProps {
  children: ReactNode;
  title: string;
  description?: string;
  icon?: ArtIconName;
  color?: ArtColor;
  content?: ReactNode;
  onConfirm: () => void;
  confirmLabel?: string;
}

export function ArtConfirmDialog({
  children,
  onConfirm,
  confirmLabel = 'Confirm',
  color = 'danger',
  ...rest
}: ArtConfirmDialogProps) {
  return (
    <ArtDialog
      color={color}
      cancelButton
      buttons={[{ label: confirmLabel, variant: 'default', color, onClick: onConfirm }]}
      {...rest}
    >
      {children}
    </ArtDialog>
  );
}

// ---- DialogUI (internal) ----

const SIZE_MAX: Record<NonNullable<ArtDialogConfig['size']>, string> = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
};

function DialogUI({
  config,
  onClose,
}: {
  config: ArtDialogConfig | null;
  onClose: () => void;
}) {
  if (!config) return null;

  const {
    title, description, icon, color, variant = 'default', content,
    buttons, cancelButton, size = 'md',
  } = config;

  type CancelCfg = Exclude<ArtDialogCancelButton, boolean>;
  const cancelCfg: CancelCfg | null = cancelButton === true ? {} : (cancelButton || null);
  const hasFooter = cancelCfg !== null || (buttons && buttons.length > 0);

  return (
    <div
      className="art-dialog-backdrop"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className={cn('art-dialog', SIZE_MAX[size], color && ART_COLOR_CLASS[color], variant === 'outlined' && 'art-dialog--outlined')}
        role="dialog"
        aria-modal
        aria-labelledby="art-dialog-title"
      >
        {/* Header */}
        <div className="art-dialog-header">
          <ArtTitle title={title} description={description} icon={icon} size="md" id="art-dialog-title" />
          <ArtIconButton icon={{ name: 'Close', size: 16 }} tooltip="Close" onClick={onClose} />
        </div>

        {/* Content */}
        {content && <div className="art-dialog-content">{content}</div>}

        {/* Footer */}
        {hasFooter && (
          <div className="art-dialog-footer">
            {cancelCfg !== null && (
              <ArtButton
                variant={cancelCfg.variant ?? 'ghost'}
                color={cancelCfg.color}
                size={cancelCfg.size}
                onClick={onClose}
              >
                {cancelCfg.label ?? 'Cancel'}
              </ArtButton>
            )}
            {buttons?.map(({ label, onClick, closesDialog = true, ...btnProps }, i) => (
              <ArtButton
                key={i}
                onClick={() => { onClick?.(); if (closesDialog) onClose(); }}
                {...btnProps}
              >
                {label}
              </ArtButton>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
