export interface VariantePrecioPos {
  varianteId: number;
  precio: number;
}

export interface OpcionPrecioPos {
  opcionId: number;
  precioExtra: number;
}

export interface GrupoModificadorPrecioPos {
  grupoId: number;
  minimo: number;
  opciones: OpcionPrecioPos[];
}

export interface OpcionComboPrecioPos {
  productoId: number;
  precioExtra: number;
  agotado: boolean;
  variantes: VariantePrecioPos[];
  grupos: GrupoModificadorPrecioPos[];
}

export interface GrupoComboPrecioPos {
  comboGrupoId: number;
  cantidad: number;
  opciones: OpcionComboPrecioPos[];
}

export interface ProductoPrecioPos {
  precio: number;
  variantes: VariantePrecioPos[];
  grupos: GrupoModificadorPrecioPos[];
  combo: GrupoComboPrecioPos[];
}

export interface SeleccionesPrecioPos {
  varianteId: number | null;
  modificadores: Record<number, number[]>;
  combos: Record<number, (number | null)[]>;
  variantesCombo: Record<string, number | null>;
  modificadoresCombo: Record<string, Record<number, number[]>>;
}

/** A combo slot must be complete and cannot reuse a product within its group. */
export function comboSeleccionValida(cantidad: number, productoIds: (number | null)[]): boolean {
  return productoIds.length === cantidad
    && productoIds.every(id => id !== null && Number.isSafeInteger(id) && id > 0)
    && new Set(productoIds).size === productoIds.length;
}

/** Keeps the product card price aligned with the cheapest sellable variant. */
export function precioDesdeProducto(precioBase: number, variantes: VariantePrecioPos[]): number {
  return variantes.length ? Math.min(...variantes.map(v => v.precio)) : precioBase;
}

/** Cheapest valid price shown on a product card, including mandatory modifiers and combo choices. */
export function precioDesdeConfiguracionPos(producto: ProductoPrecioPos): number {
  let total = precioDesdeProducto(producto.precio, producto.variantes);
  const extraMinimo = (grupos: GrupoModificadorPrecioPos[]): number => {
    let extra = 0;
    for (const grupo of grupos) {
      const minimo = grupo.opciones.map(o => o.precioExtra).sort((a, b) => a - b).slice(0, grupo.minimo);
      if (minimo.length < grupo.minimo) return Number.POSITIVE_INFINITY;
      extra += minimo.reduce((suma, valor) => suma + valor, 0);
    }
    return extra;
  };

  total += extraMinimo(producto.grupos);
  for (const grupo of producto.combo) {
    const opciones = grupo.opciones.filter(o => !o.agotado).map(o => ({
      productoId: o.productoId,
      extra: o.precioExtra + extraMinimo(o.grupos),
    })).sort((a, b) => a.extra - b.extra || a.productoId - b.productoId).slice(0, grupo.cantidad);
    if (opciones.length < grupo.cantidad) return Number.POSITIVE_INFINITY;
    total += opciones.reduce((suma, opcion) => suma + opcion.extra, 0);
  }
  return Math.round((total + Number.EPSILON) * 100) / 100;
}

/** Mirrors the server's POS price resolution for a configured menu item. */
export function calcularPrecioConfiguradoPos(producto: ProductoPrecioPos, seleccion: SeleccionesPrecioPos): number {
  const variante = producto.variantes.find(v => v.varianteId === seleccion.varianteId);
  let total = variante?.precio ?? producto.precio;

  for (const grupo of producto.grupos) {
    const elegidas = seleccion.modificadores[grupo.grupoId] ?? [];
    for (const opcion of grupo.opciones) if (elegidas.includes(opcion.opcionId)) total += opcion.precioExtra;
  }

  for (const grupo of producto.combo) {
    const slots = seleccion.combos[grupo.comboGrupoId] ?? [];
    for (let slot = 0; slot < grupo.cantidad; slot++) {
      const productoId = slots[slot];
      const opcion = grupo.opciones.find(o => o.productoId === productoId);
      if (!opcion) continue;

      total += opcion.precioExtra;
      const varianteId = seleccion.variantesCombo[`${grupo.comboGrupoId}:${slot}`];
      const varianteComponente = opcion.variantes.find(v => v.varianteId === varianteId);
      if (varianteComponente && opcion.variantes.length) {
        total += varianteComponente.precio - Math.min(...opcion.variantes.map(v => v.precio));
      }

      const gruposElegidos = seleccion.modificadoresCombo[`${grupo.comboGrupoId}:${slot}`] ?? {};
      for (const grupoComponente of opcion.grupos) {
        const opcionesElegidas = gruposElegidos[grupoComponente.grupoId] ?? [];
        for (const modificador of grupoComponente.opciones) {
          if (opcionesElegidas.includes(modificador.opcionId)) total += modificador.precioExtra;
        }
      }
    }
  }

  return Math.round((total + Number.EPSILON) * 100) / 100;
}
