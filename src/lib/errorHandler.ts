import { NextResponse } from 'next/server';
import axios from 'axios';
import { Prisma } from '../../generated/prisma/client';
import { ApiError } from '@/models/api-error';

export function handleApiError(error: any, context: string) {
  console.error(`${context} error:`, error);

  if (error instanceof ApiError) {
    const payload: any = { error: error.message };
    if (error.code) payload.code = error.code;
    if (error.details) payload.details = error.details;
    return NextResponse.json(payload, { status: error.status });
  }

  if (axios.isAxiosError(error)) {
    const data = error.response?.data as any | undefined;
    const status = error.response?.status ?? 502;
    const message = data?.error ?? error.message ?? 'Bad Gateway';
    const code = data?.code;
    const details = data?.details ?? data;
    const payload: any = { error: message };
    if (code) payload.code = code;
    if (details) payload.details = details;
    return NextResponse.json(payload, { status });
  }

  if (error && typeof error === 'object' && (error as any).name === 'ValidationError') {
    const yupErr = error as any;
    const message = yupErr.message ?? 'Validation failed';
    let details: any = undefined;
    if (Array.isArray(yupErr.inner) && yupErr.inner.length) {
      const fieldErrors: Record<string, string[]> = {};
      yupErr.inner.forEach((e: any) => {
        const path = e.path || '_global';
        fieldErrors[path] = fieldErrors[path] || [];
        if (e.message) fieldErrors[path].push(e.message);
      });
      details = { fieldErrors };
    } else if (Array.isArray(yupErr.errors) && yupErr.errors.length) {
      details = { errors: yupErr.errors };
    }
    const payload: any = { error: message };
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
