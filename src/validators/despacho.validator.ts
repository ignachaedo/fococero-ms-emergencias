/**
 * @fileoverview Esquemas Zod y utilidades de validación para despachos a organismos externos.
 * Define reglas de transición de estados, validación de URLs permitidas y schemas
 * para creación y actualización de despachos.
 */

import { z } from 'zod';
import { OrganismoType, PrioridadType, DespachoStatus } from '../models/despacho.model';

/** Mapa de transiciones válidas entre estados de despacho */
const VALID_TRANSITIONS: Record<DespachoStatus, DespachoStatus[]> = {
    [DespachoStatus.PENDIENTE]: [DespachoStatus.PROCESANDO, DespachoStatus.CANCELADO],
    [DespachoStatus.PROCESANDO]: [DespachoStatus.EXITOSO, DespachoStatus.FALLIDO, DespachoStatus.CANCELADO],
    [DespachoStatus.EXITOSO]: [],
    [DespachoStatus.FALLIDO]: [DespachoStatus.REINTENTANDO, DespachoStatus.CANCELADO],
    [DespachoStatus.REINTENTANDO]: [DespachoStatus.PROCESANDO, DespachoStatus.CANCELADO],
    [DespachoStatus.CANCELADO]: [],
};

/** Patrón de URLs permitidas para endpoints de organismos */
const urlAllowlistPattern = /^https:\/\/(api\.)?(bomberos|conaf|carabineros|senapred)\.cl\//;

/**
 * Esquema para validar la creación de un despacho.
 * Requiere alerta_id, correlation_id, organismo, prioridad, endpoint_url y request_payload.
 * Valida que la URL del endpoint esté en la lista de dominios permitidos.
 */
export const createDespachoSchema = z.object({
    body: z.object({
        alerta_id: z.string().uuid('alerta_id inválido'),
        correlation_id: z.string().uuid('correlation_id inválido'),
        organismo: z.nativeEnum(OrganismoType, {
            errorMap: () => ({ message: 'Organismo no soportado' }),
        }),
        prioridad: z.nativeEnum(PrioridadType).default(PrioridadType.MEDIA),
        endpoint_url: z
            .string()
            .url('URL de endpoint inválida')
            .refine((url) => urlAllowlistPattern.test(url), {
                message: 'URL de endpoint no está en la lista de dominios permitidos',
            }),
        request_payload: z.record(z.unknown()).refine((obj) => Object.keys(obj).length > 0, {
            message: 'El payload no puede estar vacío',
        }),
    }),
});

/**
 * Esquema para validar la actualización de estado de un despacho.
 * Recibe un UUID por parámetro y un estado válido del enum DespachoStatus.
 */
export const updateStatusSchema = z.object({
    params: z.object({
        id: z.string().uuid('ID de despacho inválido'),
    }),
    body: z.object({
        estado: z.nativeEnum(DespachoStatus, {
            errorMap: () => ({ message: 'Estado de despacho no válido' }),
        }),
    }),
});

/**
 * Verifica si una transición de estado es válida según las reglas de máquina de estados.
 *
 * @param currentStatus - Estado actual del despacho
 * @param nextStatus - Estado al que se desea transitar
 * @returns true si la transición está permitida, false en caso contrario
 */
export function isValidTransition(
    currentStatus: DespachoStatus,
    nextStatus: DespachoStatus,
): boolean {
    const allowed = VALID_TRANSITIONS[currentStatus];
    return allowed ? allowed.includes(nextStatus) : false;
}

export type CreateDespachoInput = z.infer<typeof createDespachoSchema>['body'];
