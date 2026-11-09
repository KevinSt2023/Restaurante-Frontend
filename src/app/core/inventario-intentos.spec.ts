import { IntentosInventario } from './inventario-intentos';

class AlmacenamientoMemoria {
  private readonly valores = new Map<string, string>();
  getItem(key: string): string | null { return this.valores.get(key) ?? null; }
  setItem(key: string, value: string): void { this.valores.set(key, value); }
  removeItem(key: string): void { this.valores.delete(key); }
}

class AlmacenamientoSinEscritura extends AlmacenamientoMemoria {
  override setItem(_key: string, _value: string): void { throw new Error('quota exceeded'); }
}

describe('reintentos idempotentes de inventario', () => {
  it('reutiliza la misma clave y payload para reintentar una compra', () => {
    const storage = new AlmacenamientoMemoria();
    const first = new IntentosInventario('compras', storage);
    const data = { proveedorInsumoId: 4, total: 30, lineas: [{ insumoId: 2, cantidad: 3 }] };
    const saved = first.iniciar(1, data);
    expect(first.iniciar(1, data)).toEqual(saved);
  });

  it('bloquea cambiar datos mientras el resultado anterior es incierto', () => {
    const attempts = new IntentosInventario('traslados', new AlmacenamientoMemoria());
    attempts.iniciar(1, { destino: 3, cantidad: 10 });
    expect(() => attempts.iniciar(1, { destino: 3, cantidad: 5 })).toThrowError(/sin confirmar/);
  });

  it('restaura la operación pendiente tras recargar la vista', () => {
    const storage = new AlmacenamientoMemoria();
    const original = new IntentosInventario('conteos', storage);
    const saved = original.iniciar(1, { cantidadContada: 8, stockSistema: 9 });
    const restored = new IntentosInventario('conteos', storage);
    expect(restored.leer(1)).toEqual(saved);
    expect(restored.iniciar(1, saved.datos)).toEqual(saved);
  });

  it('separa las recepciones pendientes por traslado y libera solo al confirmar', () => {
    const storage = new AlmacenamientoMemoria();
    const attempts = new IntentosInventario('recepciones', storage);
    const first = attempts.iniciar(21, { recibido: 9 });
    attempts.iniciar(22, { recibido: 4 });
    attempts.completar(21);
    expect(attempts.leer(21)).toBeUndefined();
    expect(attempts.leer(22)).toBeDefined();
    expect(new IntentosInventario('recepciones', storage).leer(22)?.claveIdempotencia).toBeDefined();
    expect(first.claveIdempotencia).toBeDefined();
  });

  it('falla cerrado si el navegador no puede persistir el intento antes del POST', () => {
    const attempts = new IntentosInventario('compras', new AlmacenamientoSinEscritura());
    expect(() => attempts.iniciar(1, { total: 50 })).toThrowError(/No se envió/);
    expect(attempts.leer(1)).toBeUndefined();
  });

  it('sincroniza una clave creada por otra pestaña antes de permitir un nuevo intento', () => {
    const storage = new AlmacenamientoMemoria();
    const tabA = new IntentosInventario('traslados', storage);
    const tabB = new IntentosInventario('traslados', storage);
    const original = tabA.iniciar(1, { destino: 2, cantidad: 7 });
    expect(tabB.iniciar(1, { destino: 2, cantidad: 7 })).toEqual(original);
    expect(() => tabB.iniciar(1, { destino: 2, cantidad: 8 })).toThrowError(/sin confirmar/);
  });

  it('mantiene la clave local si otra pestaña ya limpió el storage al confirmar', () => {
    const storage = new AlmacenamientoMemoria();
    const tabA = new IntentosInventario('movimientos', storage);
    const tabB = new IntentosInventario('movimientos', storage);
    const original = tabA.iniciar(1, { insumoId: 3, cantidad: 2 });
    tabB.iniciar(1, original.datos);
    tabB.completar(1);
    // An old tab must replay the original key; it must not manufacture a second stock movement.
    expect(tabA.iniciar(1, original.datos)).toEqual(original);
  });

  it('conserva la clave si no puede borrar la persistencia después de la confirmación', () => {
    const storage = new class extends AlmacenamientoMemoria {
      override removeItem(_key: string): void { throw new Error('storage locked'); }
    }();
    const attempts = new IntentosInventario('conteos', storage);
    const original = attempts.iniciar(1, { total: 3 });
    expect(() => attempts.completar(1)).toThrowError(/API confirmó/);
    expect(attempts.iniciar(1, original.datos)).toEqual(original);
  });
});
