interface AlmacenamientoSesion {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function respuestaOperacionIncierta(status: number): boolean {
  return status === 0 || status === 408 || status === 425 || status === 429 || status >= 500;
}

export class IntentosIdempotentes<T> {
  private readonly payloads = new Map<number, T>();
  private readonly inciertos = new Set<number>();
  private readonly almacenamiento: AlmacenamientoSesion | null;

  constructor(private readonly claveAlmacenamiento: string, almacenamiento?: AlmacenamientoSesion) {
    try { this.almacenamiento = almacenamiento ?? sessionStorage; }
    catch { this.almacenamiento = almacenamiento ?? null; }
    this.restaurar();
  }

  obtener(pedidoId: number, crear: () => T): T {
    return this.leer(pedidoId) ?? this.guardar(pedidoId, crear());
  }

  leer(pedidoId: number): T | undefined { return this.payloads.get(pedidoId); }

  guardar(pedidoId: number, payload: T): T {
    const existente = this.leer(pedidoId);
    if (existente !== undefined) return existente;
    this.payloads.set(pedidoId, payload);
    this.persistir();
    return payload;
  }

  marcarIncierto(pedidoId: number): void { this.inciertos.add(pedidoId); this.persistir(); }
  esIncierto(pedidoId: number): boolean { return this.inciertos.has(pedidoId); }

  completar(pedidoId: number): void {
    this.payloads.delete(pedidoId);
    this.inciertos.delete(pedidoId);
    this.persistir();
  }

  private restaurar(): void {
    try {
      const raw = this.almacenamiento?.getItem(this.claveAlmacenamiento);
      if (!raw) return;
      const datos = JSON.parse(raw) as { pagos?: Record<string, T> };
      for (const [idTexto, payload] of Object.entries(datos.pagos ?? {})) {
        const id = Number(idTexto);
        if (!Number.isSafeInteger(id) || id <= 0 || !payload || typeof payload !== 'object'
          || typeof (payload as Record<string, unknown>)['claveIdempotencia'] !== 'string') continue;
        this.payloads.set(id, payload);
        // La página pudo cerrarse mientras el POST estaba en curso.
        this.inciertos.add(id);
      }
      this.persistir();
    } catch { /* Si el almacenamiento está corrupto o bloqueado, el POS sigue en memoria. */ }
  }

  private persistir(): void {
    try {
      if (!this.almacenamiento) return;
      if (this.payloads.size === 0) {
        this.almacenamiento.removeItem(this.claveAlmacenamiento);
        return;
      }
      this.almacenamiento.setItem(this.claveAlmacenamiento, JSON.stringify({ pagos: Object.fromEntries(this.payloads) }));
    } catch { /* La clave del intento sigue protegida en memoria mientras la vista siga abierta. */ }
  }
}
