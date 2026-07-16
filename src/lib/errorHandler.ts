import { NextResponse } from 'next/server';
import { Prisma } from '../../generated/prisma/client';
import { ApiError } from '@/models/api-error';

// ==== Types ====

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

// ==== Handler ====

/**
 * Centralized error → NextResponse mapper. Always pass the API helper output as `url`
 * (e.g. API.invite.send()) so the logged context updates automatically when the URL definition changes.
 */
export function handleApiError(error: unknown, method: HttpMethod, url: string) {
  console.error(`${method} ${url} error:`, error);

  if (error instanceof ApiError) {
    const payload: Record<string, unknown> = { error: error.message };
    if (error.code) payload.code = error.code;
    if (error.details) payload.details = error.details;
    return NextResponse.json(payload, { status: error.status });
  }

  if (error && typeof error === 'object' && (error as { name?: string }).name === 'ValidationError') {
    const yupErr = error as { message?: string; inner?: { path?: string; message?: string }[]; errors?: string[] };
    const message = yupErr.message ?? 'Validation failed';
    let details: Record<string, unknown> | undefined;
    if (Array.isArray(yupErr.inner) && yupErr.inner.length) {
      const fieldErrors: Record<string, string[]> = {};
      yupErr.inner.forEach((e) => {
        const path = e.path || '_global';
        fieldErrors[path] = fieldErrors[path] || [];
        if (e.message) fieldErrors[path].push(e.message);
      });
      details = { fieldErrors };
    } else if (Array.isArray(yupErr.errors) && yupErr.errors.length) {
      details = { errors: yupErr.errors };
    }
    const payload: Record<string, unknown> = { error: message };
    if (details) payload.details = details;
    return NextResponse.json(payload, { status: 400 });
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    let status = 500;
    let message = 'Database error';
    if (error.code === 'P2025' || error.code === 'P2003') {
      status = 404;
      message = 'Resource not found';
    } else if (error.code === 'P2002') {
      status = 409;
      message = 'This resource already exists';
    } else {
      status = 400;
      message = error.message ?? 'Database error';
    }
    return NextResponse.json({ error: message, code: error.code }, { status });
  }

  const message =
    process.env.NODE_ENV !== 'production' && error instanceof Error
      ? error.message
      : 'Internal server error';
  return NextResponse.json({ error: message }, { status: 500 });
}
