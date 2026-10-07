import type { Request, Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { PERMISSIONS } from '../middleware/rbac.middleware.js';
import { AppError, sendError } from './errors.js';

/**
 * Wraps an async handler: the resolved value is sent as `{ data, error: null, meta }`,
 * thrown errors go through `sendError`. Handlers that stream (PDFs) write to `res`
 * themselves and resolve to undefined.
 */
export function route<T>(
  fn: (req: AuthenticatedRequest, res: Response) => Promise<T>,
  options: { status?: number; errorCode?: string } = {}
) {
  return (req: Request, res: Response) => {
    fn(req as AuthenticatedRequest, res)
      .then((data) => {
        if (res.headersSent) return;
        const meta =
          data && typeof data === 'object' && 'totalPages' in data
            ? {
                page: (data as any).page,
                limit: (data as any).limit,
                total: (data as any).total,
                totalPages: (data as any).totalPages,
              }
            : null;
        res.status(options.status ?? 200).json({ data, error: null, meta });
      })
      .catch((err) => sendError(res, err, options.errorCode));
  };
}

export function can(req: AuthenticatedRequest, resource: string, action: string): boolean {
  const role = req.org?.role;
  return !!role && (PERMISSIONS[role]?.[resource] ?? []).includes(action);
}

export function assertCan(req: AuthenticatedRequest, resource: string, action: string, what = resource) {
  if (!can(req, resource, action)) {
    throw new AppError(`Your role (${req.org?.role ?? 'unknown'}) cannot ${action.replace('_', ' ')} ${what}`, 403, 'PERMISSION_DENIED');
  }
}

/** Safe file name for Content-Disposition (document numbers may contain slashes). */
export function pdfFileName(label: string, number: string) {
  return `${label}-${number}`.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/-+/g, '-') + '.pdf';
}
