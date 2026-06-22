/**
 * @fileoverview Repositorio de despachos a organismos externos.
 * Gestiona logs de despachos con soporte para reintentos, ON CONFLICT upsert
 * y control de estados de envío (PENDIENTE → PROCESANDO → EXITOSO/FALLIDO).
 */

import { QueryConfig } from 'pg';
import { pool } from '../config/db';
import {
    IDespacho,
    DespachoStatus,
    ICreateDespachoDTO,
    IFinishDespachoDTO,
} from '../models/despacho.model';

export class DespachoRepository {
    /**
     * Crea un registro de despacho o incrementa intentos si ya existe (mismo correlation_id y organismo).
     *
     * @param data - DTO con datos del despacho (alerta_id, organismo, endpoint_url, request_payload)
     * @returns El despacho creado o actualizado
     */
    static async create(data: ICreateDespachoDTO): Promise<IDespacho> {
        const query: QueryConfig = {
            name: 'create-despacho-log',
            text: `
                INSERT INTO logs_despacho (
                    alerta_id, correlation_id, organismo, prioridad, 
                    request_payload, endpoint_url, estado
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                ON CONFLICT (correlation_id, organismo) DO UPDATE 
                    SET intentos_actuales = logs_despacho.intentos_actuales + 1,
                        updated_at = CURRENT_TIMESTAMP
                RETURNING *;
            `,
            values: [
                data.alerta_id,
                data.correlation_id,
                data.organismo,
                data.prioridad,
                data.request_payload,
                data.endpoint_url,
                DespachoStatus.PENDIENTE,
            ],
        };

        const result = await pool.query<IDespacho>(query);
        return result.rows[0];
    }

    /**
     * Actualiza el estado de un despacho y su timestamp.
     *
     * @param id - UUID del despacho
     * @param estado - Nuevo estado del enum DespachoStatus
     */
    static async updateStatus(id: string, estado: DespachoStatus): Promise<void> {
        const query: QueryConfig = {
            text: 'UPDATE logs_despacho SET estado = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2;',
            values: [estado, id],
        };
        await pool.query(query);
    }

    /**
     * Finaliza un despacho registrando resultado, duración, payload de respuesta y errores.
     *
     * @param id - UUID del despacho
     * @param result - DTO con estado final, response_payload, duracion_ms, código de error HTTP
     */
    static async finish(id: string, result: IFinishDespachoDTO): Promise<void> {
        const query: QueryConfig = {
            text: `
                UPDATE logs_despacho 
                SET estado = $1,
                    response_payload = $2,
                    duracion_ms = $3,
                    codigo_error_http = $4,
                    error_detalle = $5,
                    finalizado_at = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $6;
            `,
            values: [
                result.estado,
                result.response_payload || null,
                result.duracion_ms,
                result.codigo_error_http || null,
                result.error_detalle || null,
                id,
            ],
        };
        await pool.query(query);
    }

    /**
     * Busca un despacho por su ID.
     *
     * @param id - UUID del despacho
     * @returns El despacho encontrado o null
     */
    static async findById(id: string): Promise<IDespacho | null> {
        const query: QueryConfig = {
            text: 'SELECT * FROM logs_despacho WHERE id = $1;',
            values: [id],
        };
        const result = await pool.query<IDespacho>(query);
        return result.rows[0] || null;
    }

    /**
     * Busca todos los despachos asociados a un correlation_id.
     *
     * @param correlation_id - ID de correlación compartido
     * @returns Array de despachos ordenados por creación ascendente
     */
    static async findByCorrelationId(correlation_id: string): Promise<IDespacho[]> {
        const query: QueryConfig = {
            text: 'SELECT * FROM logs_despacho WHERE correlation_id = $1 ORDER BY created_at ASC;',
            values: [correlation_id],
        };
        const result = await pool.query<IDespacho>(query);
        return result.rows;
    }

    /**
     * Obtiene despachos fallidos o en reintento que aún no superan el máximo de intentos.
     *
     * @returns Array de despachos pendientes de reintento ordenados por fecha de actualización
     */
    static async getPendingRetries(): Promise<IDespacho[]> {
        const query: QueryConfig = {
            text: `
                SELECT * FROM logs_despacho 
                WHERE estado IN ('FALLIDO', 'REINTENTANDO') 
                  AND intentos_actuales <= max_reintentos_permitidos
                ORDER BY updated_at ASC;
            `,
        };
        const result = await pool.query<IDespacho>(query);
        return result.rows;
    }
}
