/**
 * @fileoverview Controlador de despacho de emergencias.
 * Gestiona el envío de alertas a organismos externos, reintentos de despachos
 * fallidos, consulta de estado y actualización asíncrona mediante webhooks.
 */

import { Request, Response } from 'express';
import { DespachoService } from '../services/despacho.service';
import { DespachoRepository } from '../repositories/despacho.repository';
import { successResponse } from '../helpers/handleResponse';
import { asyncHandler } from '../helpers/asyncHandler';
import { AppError } from '../helpers/AppError';
import { isValidTransition } from '../validators/despacho.validator';
import { DespachoStatus } from '../models/despacho.model';
import { Logger } from '../helpers/logger';

export class DespachoController {
    /**
     * Inicia un nuevo proceso de despacho hacia un organismo externo.
     *
     * @param req - Request con body con datos del despacho
     * @param res - Response 201 con resultado del despacho
     */
    static create = asyncHandler(async (req: Request, res: Response) => {
        const result = await DespachoService.procesarDespacho(req.body);
        return successResponse(res, result, 'Despacho procesado e iniciado correctamente', 201);
    });

    /**
     * Dispara manualmente el reintento de todos los despachos fallidos en segundo plano.
     *
     * @param _req - Request (no utilizado)
     * @param res - Response 202 indicando que el proceso se inició
     */
    static retry = asyncHandler(async (_req: Request, res: Response) => {
        // En producción, esto no se espera, se lanza en background
        DespachoService.reintentarDespachosFallidos().catch((err) =>
            Logger.error('Error en proceso de reintento en background:', err),
        );
        return successResponse(res, null, 'Proceso de reintento iniciado en segundo plano', 202);
    });

    /**
     * Consulta los despachos asociados a un correlation_id.
     *
     * @param req - Request con params.correlation_id
     * @param res - Response con lista de despachos encontrados
     * @throws AppError(404) - Si no hay registros para ese ID
     */
    static getStatus = asyncHandler(async (req: Request, res: Response) => {
        const correlation_id = req.params.correlation_id as string;

        const logs = await DespachoRepository.findByCorrelationId(correlation_id);

        if (logs.length === 0) {
            throw new AppError('No se encontraron registros de despacho para este ID', 404);
        }

        return successResponse(res, logs, 'Estado(s) de despacho recuperado(s)');
    });

    /**
     * Recibe actualizaciones de estado asíncronas vía webhook desde organismos externos.
     *
     * @param req - Request con params.id y body.estado
     * @param res - Response 200 confirmando la actualización
     * @throws AppError(404) - Si el despacho no existe
     * @throws AppError(400) - Si la transición de estado no es válida
     */
    static updateStatus = asyncHandler(async (req: Request, res: Response) => {
        const id = req.params.id as string;
        const { estado } = req.body as { estado: DespachoStatus };

        const despacho = await DespachoRepository.findById(id);
        if (!despacho) {
            throw new AppError('Despacho no encontrado', 404);
        }

        if (!isValidTransition(despacho.estado, estado)) {
            throw new AppError(
                `Transición inválida: ${despacho.estado} -> ${estado}`,
                400,
            );
        }

        await DespachoRepository.updateStatus(id, estado);

        return successResponse(res, null, 'Estado actualizado correctamente');
    });
}