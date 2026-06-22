/**
 * @fileoverview Middleware de timeout para peticiones lentas.
 * Aborta peticiones que exceden el tiempo máximo de ejecución (15 segundos)
 * para prevenir acumulación de procesos colgados.
 */

import { Request, Response, NextFunction } from 'express';
import { AppError } from '../helpers/AppError';

/** Tiempo máximo de ejecución en milisegundos (15 segundos) */
const MAX_EXECUTION_TIME_MS = 15000;

/**
 * Middleware que establece un timeout de 15 segundos por petición.
 * Si se excede, aborta la operación y responde con error 408.
 *
 * @param req - Objeto Request de Express (recibe signal para AbortController)
 * @param res - Objeto Response de Express
 * @param next - Función NextFunction de Express
 */
export const timeoutMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const controller = new AbortController();
    req.signal = controller.signal;

    const timeoutId = setTimeout(() => {
        controller.abort();
        const error = new AppError(
            'Timeout: El proceso tomó demasiado tiempo y fue abortado por seguridad',
            408,
        );
        next(error);
    }, MAX_EXECUTION_TIME_MS);

    res.on('finish', () => {
        clearTimeout(timeoutId);
    });

    res.setTimeout(MAX_EXECUTION_TIME_MS, () => {
        if (!res.headersSent) {
            res.status(408).json({ ok: false, message: 'Request Timeout' });
        }
    });

    next();
};
