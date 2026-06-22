/**
 * @fileoverview Middleware de logging de peticiones HTTP para ms-emergencias.
 * Registra método, URL, código de estado, duración y correlation ID
 * de cada petición con niveles según el código de estado.
 */

import { Request, Response, NextFunction } from 'express';
import { Logger } from '../helpers/logger';

/**
 * Middleware que logea cada petición HTTP con su duración y correlation ID.
 * Usa Logger.error para status >= 500, Logger.warn para status >= 400,
 * y Logger.info para el resto.
 *
 * @param req - Objeto Request de Express
 * @param res - Objeto Response de Express
 * @param next - Función NextFunction de Express
 */
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
    if (req.path === '/health') return next();

    const start = Date.now();

    res.on('finish', () => {
        const duration = Date.now() - start;
        const status = res.statusCode;
        const correlationId = req.correlationId || 'NO-ID';

        const message = `${req.method} ${req.originalUrl} - Status: ${status} - [${duration}ms] - ID: ${correlationId}`;

        if (status >= 500) {
            Logger.error(message, null, 'HTTP');
        } else if (status >= 400) {
            Logger.warn(message, 'HTTP');
        } else {
            Logger.info(message, 'HTTP');
        }
    });

    next();
};
