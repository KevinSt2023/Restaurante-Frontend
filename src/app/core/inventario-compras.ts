export interface LineaCompraInventario {
  insumoId: number | null;
  cantidadCompra: number | null;
  costoTotal: number | null;
}

const MAX_CANTIDAD_COMPRA = 1_000_000;
const MAX_TOTAL_COMPRA = 9_999_999_999.9999;
const tieneDecimalesPermitidos = (valor: number, decimales: number) =>
  Number.isFinite(valor) && Math.abs(valor - Number(valor.toFixed(decimales))) < 1e-8;

export function validarLineasCompraInventario(lineas: LineaCompraInventario[]): string | null {
  if (lineas.length < 1 || lineas.length > 100) return 'La compra debe tener entre 1 y 100 insumos.';
  if (lineas.some(x => !Number.isSafeInteger(x.insumoId) || (x.insumoId ?? 0) <= 0))
    return 'Selecciona un insumo válido en cada línea.';
  if (new Set(lineas.map(x => x.insumoId)).size !== lineas.length)
    return 'Cada insumo debe aparecer una sola vez. Consolida sus cantidades en la misma línea.';
  if (lineas.some(x => !Number.isFinite(x.cantidadCompra) || (x.cantidadCompra ?? 0) <= 0
    || (x.cantidadCompra ?? 0) > MAX_CANTIDAD_COMPRA || !tieneDecimalesPermitidos(x.cantidadCompra ?? 0, 4)))
    return 'Las cantidades deben ser positivas, no superar 1,000,000 y tener hasta cuatro decimales.';
  if (lineas.some(x => !Number.isFinite(x.costoTotal) || (x.costoTotal ?? -1) < 0
    || (x.costoTotal ?? 0) > MAX_TOTAL_COMPRA || !tieneDecimalesPermitidos(x.costoTotal ?? 0, 2)))
    return 'Los costos deben ser positivos o cero, tener hasta dos decimales y estar dentro del rango permitido.';
  if (lineas.reduce((sum, x) => sum + (x.costoTotal ?? 0), 0) > MAX_TOTAL_COMPRA)
    return 'El total de la compra supera el rango permitido.';
  return null;
}
