import { calcularRangoCostoComponente, resumirCostoGruposCombo } from './inventario-costos';

describe('costeo de recetas y componentes de combo', () => {
  it('calcula rango con receta base, variantes y el mínimo/máximo de modificadores', () => {
    const rango = calcularRangoCostoComponente({
      tipo: 'PLATO', variantes: [{ varianteId: 1, activo: true }, { varianteId: 2, activo: true }], grupoIds: [7],
    }, [
      { insumoId: 1, varianteId: null, opcionId: null, cantidadBase: 100 },
      { insumoId: 1, varianteId: 1, opcionId: null, cantidadBase: 50 },
      { insumoId: 1, varianteId: 2, opcionId: null, cantidadBase: 80 },
      { insumoId: 2, varianteId: null, opcionId: 11, cantidadBase: 1 },
      { insumoId: 3, varianteId: null, opcionId: 12, cantidadBase: 1 },
    ], [
      { insumoId: 1, costoConfigurado: true, costoPromedioBase: 0.01 },
      { insumoId: 2, costoConfigurado: true, costoPromedioBase: 0.2 },
      { insumoId: 3, costoConfigurado: true, costoPromedioBase: 0.5 },
    ], [{ grupoId: 7, minimo: 1, maximo: 1, opciones: [
      { opcionId: 11, activo: true }, { opcionId: 12, activo: true },
    ] }]);

    expect(rango).toEqual({ min: 1.7, max: 2.3, incompleto: false });
  });

  it('marca recetas faltantes y costos parciales en vez de tratarlos como costo cero completo', () => {
    const sinReceta = calcularRangoCostoComponente(
      { tipo: 'PLATO', variantes: [], grupoIds: [] }, [], [], []);
    const costoParcial = calcularRangoCostoComponente(
      { tipo: 'PLATO', variantes: [], grupoIds: [] },
      [{ insumoId: 8, varianteId: null, opcionId: null, cantidadBase: 300 }],
      [{ insumoId: 8, costoConfigurado: false, costoPromedioBase: 0 }], []);

    expect(sinReceta.incompleto).toBeTrue();
    expect(costoParcial).toEqual({ min: 0, max: 0, incompleto: true });
  });

  it('marca incompleto un grupo de modificadores referenciado que no está disponible', () => {
    const rango = calcularRangoCostoComponente({
      tipo: 'PLATO', variantes: [], grupoIds: [404],
    }, [{ insumoId: 1, varianteId: null, opcionId: null, cantidadBase: 1 }], [
      { insumoId: 1, costoConfigurado: true, costoPromedioBase: 2 },
    ], []);

    expect(rango).toEqual({ min: 2, max: 2, incompleto: true });
  });

  it('suma alternativas por cantidad del grupo sin sumar entre sí todas las opciones', () => {
    const resumen = resumirCostoGruposCombo([
      { nombre: 'Fondo', cantidad: 2, opciones: [{ productoId: 10 }, { productoId: 11 }] },
    ], new Map([
      [10, { min: 1, max: 2, incompleto: false }],
      [11, { min: 5, max: 7, incompleto: true }],
    ]));

    expect(resumen).toEqual([{
      grupo: 'Fondo', cantidad: 2, costoMinimoConocido: 2, costoMaximoConocido: 14,
      opcionesConCostoIncompleto: 1,
    }]);
  });
});
