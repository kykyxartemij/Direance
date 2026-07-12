'use client';

import React, { useId, useRef, useState, type Ref } from 'react';
import ArtLabel from './ArtLabel';
import ArtIcon from './ArtIcon';
import ArtIconButton from './ArtIconButton';
import ArtHelperText from './ArtHelperText';
import { cn } from './art.utils';

interface ArtUploadProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  ref?: Ref<HTMLInputElement>;
  label?: string;
  /** Short hint below the icon, e.g. "MP4, WebM · max 500 MB" */
  hint?: string;
  helperText?: string;
  errorText?: string;
  readOnly?: boolean;
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function ArtUpload({
  label, hint, helperText, errorText, onChange, id: idProp, required, className, disabled, readOnly = false, ref, ...rest
}: ArtUploadProps) {
  const generatedId = useId();
  const id = idProp ?? generatedId;

  const inputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);

  const setRef = (el: HTMLInputElement | null) => {
    inputRef.current = el;
    if (!ref) return;
    if (typeof ref === 'function') ref(el);
    else (ref as React.MutableRefObject<HTMLInputElement | null>).current = el;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFile(e.target.files?.[0] ?? null);
    onChange?.(e);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setFile(null);
    if (inputRef.current) {
      // Reset the file input — only way to clear a file input is value = ''
      inputRef.current.value = '';
      // Notify react-hook-form (or any onChange listener) with an empty FileList
      const event = new Event('change', { bubbles: true });
      inputRef.current.dispatchEvent(event);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (disabled || readOnly) return;
    const dropped = e.dataTransfer.files[0];
    if (!dropped || !inputRef.current) return;
    // Transfer dropped file into the input via DataTransfer
    const dt = new DataTransfer();
    dt.items.add(dropped);
    inputRef.current.files = dt.files;
    inputRef.current.dispatchEvent(new Event('change', { bubbles: true }));
    setFile(dropped);
  };

  return (
    <div className="art-field-wrapper">
      {label && <ArtLabel htmlFor={id} required={required}>{label}</ArtLabel>}

      {/* Drop zone — a <label> so clicking/keyboard-activating the visually-hidden
          file input opens the native picker without a fake role="button". */}
      <label
        htmlFor={id}
        className={cn(
          'art-upload',
          dragging && 'art-upload--dragging',
          file && 'art-upload--selected',
          disabled && 'art-upload--disabled',
          readOnly && 'art-upload--readonly',
          className,
        )}
        onDragOver={(e) => { e.preventDefault(); if (!disabled && !readOnly) setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        {/* Visually-hidden but focusable native input — sr-only keeps it tabbable
            so keyboard users can open the picker with Enter/Space. */}
        <input
          {...rest}
          ref={setRef}
          id={id}
          type="file"
          required={required}
          disabled={disabled || readOnly}
          className="sr-only"
          onChange={handleChange}
        />
        {file ? (
          /* Selected state */
          <>
            <ArtIcon name="Upload" size={22} className="art-upload-icon" />
            <span className="art-upload-filename">{file.name}</span>
            <span className="art-upload-size">{formatSize(file.size)}</span>
            {!readOnly && (
              <ArtIconButton
                icon={{ name: 'Close', size: 12 }}
                size="sm"
                className="art-upload-clear"
                aria-label="Remove file"
                onClick={handleClear}
              />
            )}
          </>
        ) : (
          /* Empty state */
          <>
            <ArtIcon name="Upload" size={24} className="art-upload-icon" />
            <span className="art-upload-label">
              {readOnly ? 'No file' : 'Drop file here or click to browse'}
            </span>
            {!readOnly && hint && <span className="art-upload-hint">{hint}</span>}
          </>
        )}
      </label>

      <ArtHelperText errorText={errorText} helperText={helperText} />
    </div>
  );
}

ArtUpload.displayName = 'ArtUpload';
export default ArtUpload;
export { ArtUpload };
export type { ArtUploadProps };
