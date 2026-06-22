/**
 * @fileoverview Middleware factory de validación con Zod para ms-emergencias.
 * Valida body, query y params de forma asíncrona contra un esquema AnyZodObject
 * y retorna errores estructurados si la validación falla.
 */

import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, ZodError } from 'zod';

/**
 * Crea un middleware que valida body, query y params contra un esquema Zod.
 * Retorna errores 400 con path y mensaje por cada campo inválido.
 *
 * @param schema - Esquema Zod AnyZodObject para validar la solicitud completa
 * @returns Middleware Express que ejecuta schema.parseAsync
 */
export const validateSchema = (schema: AnyZodObject) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            await schema.parseAsync({
                body: req.body,
                query: req.query,
                params: req.params,
            });
            return next();
        } catch (error) {
            if (error instanceof ZodError) {
                return res.status(400).json({
                    ok: false,
                    errors: error.errors.map((e) => ({
                        path: e.path.join('.'),
                        message: e.message,
                    })),
                });
            }
            return next(error);
        }
    };
};
