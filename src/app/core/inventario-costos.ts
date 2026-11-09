export interface RecetaCostoFila {
  insumoId: number;
  varianteId: number | null;
  opcionId: number | null;
  cantidadBase: number;
}

export interface InsumoCostoActual {
  insumoId: number;
  costoConfigurado: boolean;
  costoPromedioBase: number;
}

export interface ProductoRecetaCosto {
  tipo: string;
  variantes: { varianteId: number | null; activo: boolean }[];
  grupoIds: number[];
}

export interface GrupoModificadorCosto {
  grupoId: number;
  minimo: number;
  maximo: number;
  opciones: { opcionId: number; activo: boolean }[];
}

export interface RangoCostoConocido {
  min: number;
  max: number;
  incompleto: boolean;
}

export interface GrupoComboCostoInput {
  nombre: string;
  cantidad: number;
  opciones: { productoId: number }[];
}

export interface GrupoComboCostoResultado {
  grupo: string;
  cantidad: number;
  costoMinimoConocido: number;
  costoMaximoConocido: number;
  opcionesConCostoIncompleto: number;
}

/** Calculates ingredient cost for a component across its sellable variants and modifier combinations. */
export function calcularRangoCostoComponente(
  producto: ProductoRecetaCosto,
  receta: RecetaCostoFila[],
  costos: InsumoCostoActual[],
  grupos: GrupoModificadorCosto[],
): RangoCostoConocido {
  if (producto.tipo === 'COMBO') return { min: 0, max: 0, incompleto: true };

  const costoPorInsumo = new Map(costos.map(x => [x.insumoId, x]));
  const costoLineas = (filas: RecetaCostoFila[]) => filas.reduce((acc, fila) => {
    const insumo = costoPorInsumo.get(fila.insumoId);
    if (!insumo?.costoConfigurado) return { total: acc.total, sinCosto: acc.sinCosto + 1 };
    return { total: acc.total + fila.cantidadBase * insumo.costoPromedioBase, sinCosto: acc.sinCosto };
  }, { total: 0, sinCosto: 0 });

  const base = receta.filter(x => x.varianteId === null && x.opcionId === null);
  const costoBase = costoLineas(base);
  const variantes = producto.variantes.filter(x => x.activo && x.varianteId !== null);
  const escenarios = variantes.length
    ? variantes.map(x => receta.filter(r => r.varianteId === x.varianteId))
    : [[]];

  const rangos = escenarios.map(variantesFilas => {
    const costoVariante = costoLineas(variantesFilas);
    let minimo = costoBase.total + costoVariante.total;
    let maximo = minimo;
    let incompleto = costoBase.sinCosto + costoVariante.sinCosto > 0 || base.length + variantesFilas.length === 0;

    for (const grupoId of producto.grupoIds) {
      const grupo = grupos.find(x => x.grupoId === grupoId);
      if (!grupo) {
        incompleto = true;
        continue;
      }

      const opciones = grupo.opciones.filter(x => x.activo).map(opcion => ({
        costo: costoLineas(receta.filter(r => r.opcionId === opcion.opcionId)),
      }));
      const masBaratas = [...opciones].sort((a, b) => a.costo.total - b.costo.total);
      const masCostosas = [...opciones].sort((a, b) => b.costo.total - a.costo.total);
      const minSeleccionables = Math.min(opciones.length, grupo.minimo);
      const maxSeleccionables = Math.min(opciones.length, grupo.maximo);
      minimo += masBaratas.slice(0, minSeleccionables).reduce((s, x) => s + x.costo.total, 0);
      maximo += masCostosas.slice(0, maxSeleccionables).reduce((s, x) => s + x.costo.total, 0);
      incompleto ||= grupo.maximo < grupo.minimo
        || opciones.length < grupo.minimo
        || opciones.some(x => x.costo.sinCosto > 0);
    }
    return { min: minimo, max: maximo, incompleto };
  });

  return {
    min: Math.min(...rangos.map(x => x.min)),
    max: Math.max(...rangos.map(x => x.max)),
    incompleto: rangos.some(x => x.incompleto),
  };
}

/** Summarizes each combo group as a known-cost interval; alternatives are not added together. */
export function resumirCostoGruposCombo(
  grupos: GrupoComboCostoInput[],
  rangosPorProducto: Map<number, RangoCostoConocido | null>,
): GrupoComboCostoResultado[] {
  return grupos.map(grupo => {
    const rangos = grupo.opciones.map(x => rangosPorProducto.get(x.productoId) ?? null)
      .filter((x): x is RangoCostoConocido => x !== null);
    const incompletas = grupo.opciones.filter(x => {
      const rango = rangosPorProducto.get(x.productoId);
      return !rango || rango.incompleto;
    }).length;
    return {
      grupo: grupo.nombre,
      cantidad: grupo.cantidad,
      costoMinimoConocido: (rangos.length ? Math.min(...rangos.map(x => x.min)) : 0) * grupo.cantidad,
      costoMaximoConocido: (rangos.length ? Math.max(...rangos.map(x => x.max)) : 0) * grupo.cantidad,
      opcionesConCostoIncompleto: incompletas,
    };
  });
}
