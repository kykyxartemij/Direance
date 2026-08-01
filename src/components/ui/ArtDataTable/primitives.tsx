'use client';

import React from 'react';
import { cn } from '../art.utils';

// ==== Row primitives ====
// Use these inside renderRow so callers never depend on internal CSS class names.

export function ArtDataTr({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn('art-data-tr', className)} {...props}>{children}</tr>;
}

export function ArtDataTd({
  children,
  className,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn('art-data-td', className)} {...props}>{children}</td>;
}
