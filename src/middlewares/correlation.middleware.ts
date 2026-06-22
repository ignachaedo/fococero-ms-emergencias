/**
 * @fileoverview Middleware de correlación para trazabilidad distribuida.
 * Asigna o propaga un correlation ID único por petición para rastrear
 * el flujo completo a través de los microservicios.
 */

import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

/**
 * Middleware que asegura que cada petición tenga un correlation ID.
 * Reusa el header x-correlation-id si existe, o genera uno nuevo UUID v4.
 *
 * @param req - Objeto Request de Express
 * @param res - Objeto Response de Express
 * @param next - Función NextFunction de Express
 */
export const correlationMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const header = req.headers['x-correlation-id'];
    const correlationId = Array.isArray(header) ? header[0] : header || uuidv4();

    req.correlationId = correlationId;

    res.setHeader('X-Correlation-ID', correlationId);

    next();
};
