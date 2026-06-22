/**
 * @fileoverview Controlador de health check para ms-emergencias.
 * Verifica el estado de la conexión a la base de datos PostgreSQL.
 */

import { Request, Response } from 'express';
import { pool } from '../config/db';
import { successResponse } from '../helpers/handleResponse';
import { asyncHandler } from '../helpers/asyncHandler';

export class HealthController {
    /**
     * Verifica el estado del servicio y la conexión a PostgreSQL.
     *
     * @param _req - Request (no utilizado)
     * @param res - Response con uptime y estado de salud
     */
    static check = asyncHandler(async (_req: Request, res: Response) => {
        await pool.query('SELECT 1'); // Verifica conexión real
        return successResponse(res, { uptime: process.uptime() }, 'ms-emergencias is healthy');
    });
}
