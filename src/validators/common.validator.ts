/**
 * @fileoverview Esquemas Zod reutilizables para validaciones comunes.
 * Incluye validación de RUT chileno, paginación y rangos de fechas.
 */

import { z } from 'zod';
import { RutHelper } from '../helpers/rut.helper';

/**
 * Esquema para validar un RUT chileno con dígito verificador.
 * Usa RutHelper.validate para comprobar el DV.
 */
export const rutSchema = z
    .string()
    .min(8, 'RUT demasiado corto')
    .max(12, 'RUT demasiado largo')
    .refine(RutHelper.validate, { message: 'RUT inválido (Dígito verificador incorrecto)' });

/**
 * Esquema para validar y transformar parámetros de paginación.
 * page por defecto es 1, limit por defecto es 10 (máximo 100).
 */
export const paginationSchema = z.object({
    page: z
        .string()
        .optional()
        .transform((val) => Math.max(1, Number(val) || 1)),
    limit: z
        .string()
        .optional()
        .transform((val) => Math.min(100, Number(val) || 10)),
});
