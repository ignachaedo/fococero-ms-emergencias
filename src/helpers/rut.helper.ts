/**
 * @fileoverview Helper de validación y formateo de RUT chileno.
 * Implementa validación de dígito verificador (módulo 11) y formateo
 * básico para normalización de RUTs.
 */
export class RutHelper {
    /**
     * Valida un RUT chileno completo (con dígito verificador) usando módulo 11.
     *
     * @param rut - RUT en formato xx.xxx.xxx-x o xxxxxxxx-x
     * @returns true si el dígito verificador es correcto, false en caso contrario
     */
    static validate(rut: string): boolean {
        if (!/^[0-9]+[-|‐][0-9kK]{1}$/.test(rut)) return false;
        const [num, dv] = rut.replace(/\./g, '').split('-');
        let T = parseInt(num);
        let M = 0,
            S = 1;
        for (; T; T = Math.floor(T / 10)) {
            S = (S + (T % 10) * (9 - (M++ % 6))) % 11;
        }
        const expectedDv = S ? (S - 1).toString() : 'k';
        return expectedDv === dv.toLowerCase();
    }

    /**
     * Normaliza un RUT eliminando puntos, guiones y convirtiendo a minúsculas.
     *
     * @param rut - RUT en cualquier formato
     * @returns RUT formateado como string sin separadores
     */
    static format(rut: string): string {
        return rut.replace(/\./g, '').replace(/-/g, '').toLowerCase();
    }
}
