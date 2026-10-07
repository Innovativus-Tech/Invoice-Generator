import type { Response } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';

export class AppError extends Error {
  constructor(message: string, public status = 400, public code = 'BAD_REQUEST') {
    super(message);
  }
}

export const notFound = (what: string) => new AppError(`${what} not found`, 404, 'NOT_FOUND');

/** Sends the standard `{ data, error, meta }` error envelope. */
export function sendError(res: Response, err: unknown, fallbackCode = 'SERVER_ERROR') {
  if (err instanceof AppError) {
    res.status(err.status).json({ data: null, error: { message: err.message, code: err.code }, meta: null });
    return;
  }
  if (err instanceof ZodError) {
    res.status(400).json({
      data: null,
      error: {
        message: err.errors[0]?.message ?? 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: err.errors.map((e) => ({ field: e.path.join('.'), message: e.message })),
      },
      meta: null,
    });
    return;
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
    res.status(409).json({ data: null, error: { message: 'A record with this number already exists', code: 'CONFLICT' }, meta: null });
    return;
  }
  const status = (err as { status?: number })?.status;
  const message = err instanceof Error ? err.message : 'Internal server error';
  if (!status || status >= 500) console.error(err);
  res.status(status && status < 600 ? status : 500).json({
    data: null,
    error: { message: status && status < 500 ? message : 'Something went wrong. Please try again.', code: fallbackCode },
    meta: null,
  });
}
