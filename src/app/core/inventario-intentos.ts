interface AlmacenamientoIntentos {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface IntentoInventario<T> {
  claveIdempotencia: string;
  datos: T;
}

/** Keeps inventory writes replayable after a timeout or a page reload. */
export class IntentosInventario {
  private readonly pendientes = new Map<number, IntentoInventario<unknown>>();
  private readonly almacenamiento: AlmacenamientoIntentos | null;

  constructor(private readonly clave: string, almacenamiento?: AlmacenamientoIntentos) {
    try { this.almacenamiento = almacenamiento ?? localStorage; }
    catch { this.almacenamiento = almacenamiento ?? null; }
    this.restaurar();
  }

  leer<T>(id: number): IntentoInventario<T> | undefined {
    return this.pendientes.get(id) as IntentoInventario<T> | undefined;
  }

  idsPendientes(): number[] { return [...this.pendientes.keys()]; }

  iniciar<T>(id: number, datos: T): IntentoInventario<T> {
    if (!this.restaurar()) throw new Error('No se pudo leer el almacenamiento de seguridad. No se envió la operación.');
    const existente = this.leer<T>(id);
    if (existente) {
      if (JSON.stringify(existente.datos) !== JSON.stringify(datos)) {
        throw new Error('Hay una operación de inventario sin confirmar. Reintenta los mismos datos antes de editarla.');
      }
      return existente;
    }
    const intento = { claveIdempotencia: crypto.randomUUID(), datos };
    this.pendientes.set(id, intento);
    if (!this.persistir()) {
      this.pendientes.delete(id);
      throw new Error('No se pudo guardar el intento en este navegador. No se envió la operación de inventario.');
    }
    return intento;
  }

  completar(id: number): void {
    const previo = this.pendientes.get(id);
    if (!previo) return;
    this.pendientes.delete(id);
    if (!this.persistir()) {
      this.pendientes.set(id, previo);
      throw new Error('La API confirmó la operación, pero no se pudo limpiar la clave guardada. Reintenta exactamente los mismos datos para conciliar.');
    }
  }

  private restaurar(): boolean {
    try {
      const raw = this.almacenamiento?.getItem(this.clave);
      if (!raw) return this.almacenamiento !== null;
      const datos = JSON.parse(raw) as Record<string, IntentoInventario<unknown>>;
      for (const [idTexto, intento] of Object.entries(datos)) {
        const id = Number(idTexto);
        if (!Number.isSafeInteger(id) || id <= 0 || !intento || typeof intento.claveIdempotencia !== 'string'
          || !intento.datos || typeof intento.datos !== 'object') continue;
        this.pendientes.set(id, intento);
      }
      return this.almacenamiento !== null;
    } catch { return false; }
  }

  private persistir(): boolean {
    try {
      if (!this.almacenamiento) return false;
      if (this.pendientes.size === 0) {
        this.almacenamiento.removeItem(this.clave);
        return this.almacenamiento.getItem(this.clave) === null;
      }
      const serializado = JSON.stringify(Object.fromEntries(this.pendientes));
      this.almacenamiento.setItem(this.clave, serializado);
      return this.almacenamiento.getItem(this.clave) === serializado;
    } catch { return false; }
  }
}
