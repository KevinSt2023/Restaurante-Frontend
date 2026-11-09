import { IntentosIdempotentes, respuestaOperacionIncierta } from './idempotencia-operaciones';

class AlmacenamientoPrueba {
  private readonly valores = new Map<string, string>();
  getItem(key: string): string | null { return this.valores.get(key) ?? null; }
  setItem(key: string, value: string): void { this.valores.set(key, value); }
  removeItem(key: string): void { this.valores.delete(key); }
}

describe('reintentos idempotentes de operaciones de venta', () => {
  it('conserva payload y clave durante una respuesta incierta y lo libera tras confirmación', () => {
    const intentos = new IntentosIdempotentes<{ claveIdempotencia: string; monto: number }>('pago', new AlmacenamientoPrueba());
    let secuencia = 0;
    const crear = () => ({ claveIdempotencia: `clave-${++secuencia}`, monto: 30 });
    const original = intentos.obtener(41, crear);

    intentos.marcarIncierto(41);
    const reintento = intentos.obtener(41, () => ({ claveIdempotencia: `clave-${++secuencia}`, monto: 5 }));
    expect(intentos.esIncierto(41)).toBeTrue();
    expect(reintento).toBe(original);
    expect(reintento).toEqual({ claveIdempotencia: 'clave-1', monto: 30 });
    expect(secuencia).toBe(1);

    intentos.completar(41);
    expect(intentos.esIncierto(41)).toBeFalse();
    expect(intentos.obtener(41, crear)).toEqual({ claveIdempotencia: 'clave-2', monto: 30 });
  });

  it('mantiene separados los pagos inciertos de pedidos distintos', () => {
    const intentos = new IntentosIdempotentes<{ claveIdempotencia: string }>('pagos', new AlmacenamientoPrueba());
    intentos.obtener(41, () => ({ claveIdempotencia: 'pago-41' }));
    intentos.obtener(42, () => ({ claveIdempotencia: 'pago-42' }));
    intentos.marcarIncierto(41);

    expect(intentos.esIncierto(41)).toBeTrue();
    expect(intentos.esIncierto(42)).toBeFalse();
    expect(intentos.obtener(42, () => ({ claveIdempotencia: 'nuevo' }))).toEqual({ claveIdempotencia: 'pago-42' });
  });

  it('restaura el mismo payload después de recargar y bloquea editarlo hasta conciliarlo', () => {
    const almacenamiento = new AlmacenamientoPrueba();
    const original = new IntentosIdempotentes<{ claveIdempotencia: string; recibido: number }>('sesion', almacenamiento);
    const pago = original.obtener(77, () => ({ claveIdempotencia: 'clave-original', recibido: 50 }));
    const restaurado = new IntentosIdempotentes<{ claveIdempotencia: string; recibido: number }>('sesion', almacenamiento);

    expect(restaurado.esIncierto(77)).toBeTrue();
    expect(restaurado.obtener(77, () => ({ claveIdempotencia: 'clave-nueva', recibido: 1 }))).toEqual(pago);
    restaurado.completar(77);
    expect(almacenamiento.getItem('sesion')).toBeNull();
  });

  it('restaura sin alterar una línea POS con variante, modificadores, combo y nota de cocina', () => {
    const almacenamiento = new AlmacenamientoPrueba();
    const original = new IntentosIdempotentes<{
      claveIdempotencia: string;
      productoId: number;
      varianteId: number;
      modificadores: { grupoId: number; opcionIds: number[] }[];
      combo: { comboGrupoId: number; opciones: { productoId: number; varianteId: number; modificadores: { grupoId: number; opcionIds: number[] }[] }[] }[];
      nota: string;
    }>('lineas', almacenamiento);
    const payload = {
      claveIdempotencia: 'linea-configurada-1', productoId: 80, varianteId: 12,
      modificadores: [{ grupoId: 7, opcionIds: [21, 22] }],
      combo: [{ comboGrupoId: 4, opciones: [{ productoId: 90, varianteId: 13, modificadores: [{ grupoId: 8, opcionIds: [23] }] }] }],
      nota: 'Salsa aparte',
    };
    original.guardar(501, payload);
    original.marcarIncierto(501);

    const restaurado = new IntentosIdempotentes<typeof payload>('lineas', almacenamiento);

    expect(restaurado.esIncierto(501)).toBeTrue();
    expect(restaurado.leer(501)).toEqual(payload);
    expect(restaurado.obtener(501, () => ({ ...payload, claveIdempotencia: 'clave-nueva' }))).toEqual(payload);
  });

  it('conserva el resultado y detalle de impresión con la misma clave después de recargar', () => {
    const almacenamiento = new AlmacenamientoPrueba();
    const original = new IntentosIdempotentes<{ claveIdempotencia: string; impresa: boolean; detalle: string | null }>('impresion', almacenamiento);
    const payload = { claveIdempotencia: 'resultado-impresion-1', impresa: false, detalle: 'Papel atascado' };
    original.guardar(9001, payload);
    original.marcarIncierto(9001);

    const restaurado = new IntentosIdempotentes<typeof payload>('impresion', almacenamiento);

    expect(restaurado.esIncierto(9001)).toBeTrue();
    expect(restaurado.obtener(9001, () => ({ ...payload, claveIdempotencia: 'clave-nueva' }))).toEqual(payload);
  });

  it('conserva tipo, datos del cliente y clave de emisión fiscal al recargar', () => {
    const almacenamiento = new AlmacenamientoPrueba();
    const original = new IntentosIdempotentes<{
      claveIdempotencia: string; tipo: string; clienteTipoDocumento: string;
      clienteNumeroDocumento: string; clienteNombre: string;
    }>('facturacion-tenant-sucursal-usuario', almacenamiento);
    const solicitud = original.obtener(610, () => ({ claveIdempotencia: 'cpe-original', tipo: 'FACTURA',
      clienteTipoDocumento: 'RUC', clienteNumeroDocumento: '20123456789', clienteNombre: 'Restaurante QA SAC' }));
    original.marcarIncierto(610);

    const restaurado = new IntentosIdempotentes<typeof solicitud>('facturacion-tenant-sucursal-usuario', almacenamiento);

    expect(restaurado.esIncierto(610)).toBeTrue();
    expect(restaurado.obtener(610, () => ({ ...solicitud, claveIdempotencia: 'clave-nueva' }))).toEqual(solicitud);
  });

  it('mantiene aislados los payloads fiscales por sucursal y usuario', () => {
    const almacenamiento = new AlmacenamientoPrueba();
    const sucursalNorte = new IntentosIdempotentes<{ claveIdempotencia: string; tipo: string }>('cpe-tenant-1-sucursal-2-usuario-8', almacenamiento);
    sucursalNorte.obtener(610, () => ({ claveIdempotencia: 'norte', tipo: 'BOLETA' }));
    sucursalNorte.marcarIncierto(610);
    const sucursalSur = new IntentosIdempotentes<{ claveIdempotencia: string; tipo: string }>('cpe-tenant-1-sucursal-3-usuario-8', almacenamiento);

    expect(sucursalSur.esIncierto(610)).toBeFalse();
    expect(sucursalSur.leer(610)).toBeUndefined();
  });

  it('distingue rechazos definitivos de respuestas que pueden haber perdido el resultado del cobro', () => {
    for (const status of [0, 408, 425, 429, 500, 502, 550]) expect(respuestaOperacionIncierta(status)).toBeTrue();
    for (const status of [400, 401, 403, 409, 422]) expect(respuestaOperacionIncierta(status)).toBeFalse();
  });
});
