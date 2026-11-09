import { calcularPrecioConfiguradoPos, comboSeleccionValida, precioDesdeConfiguracionPos, precioDesdeProducto } from './pos-precios';

const seleccionVacia = {
  varianteId: null,
  modificadores: {},
  combos: {},
  variantesCombo: {},
  modificadoresCombo: {},
};

describe('precios del POS', () => {
  it('muestra desde la variante activa más económica y usa el precio de sucursal sin variantes', () => {
    expect(precioDesdeProducto(12, [{ varianteId: 1, precio: 18 }, { varianteId: 2, precio: 15 }])).toBe(15);
    expect(precioDesdeProducto(12, [])).toBe(12);
  });

  it('exige espacios completos y productos distintos en cada grupo de combo', () => {
    expect(comboSeleccionValida(2, [30, 31])).toBeTrue();
    expect(comboSeleccionValida(2, [30, 30])).toBeFalse();
    expect(comboSeleccionValida(2, [30])).toBeFalse();
    expect(comboSeleccionValida(1, [null])).toBeFalse();
  });

  it('suma variante y modificadores seleccionados, redondeando a dos decimales', () => {
    const precio = calcularPrecioConfiguradoPos({ precio: 10, variantes: [
      { varianteId: 1, precio: 14.5 }, { varianteId: 2, precio: 18 },
    ], grupos: [{ grupoId: 3, minimo: 0, opciones: [
      { opcionId: 7, precioExtra: 1.125 }, { opcionId: 8, precioExtra: 2 },
    ] }], combo: [] }, {
      ...seleccionVacia, varianteId: 2, modificadores: { 3: [7] },
    });

    expect(precio).toBe(19.13);
  });

  it('aplica en combos el extra fijo, diferencia de variante frente a la más barata y modificadores del componente', () => {
    const precio = calcularPrecioConfiguradoPos({ precio: 20, variantes: [], grupos: [], combo: [{
      comboGrupoId: 9, cantidad: 1, opciones: [{ productoId: 30, precioExtra: 3, agotado: false, variantes: [
        { varianteId: 4, precio: 8 }, { varianteId: 5, precio: 11 },
      ], grupos: [{ grupoId: 6, minimo: 1, opciones: [{ opcionId: 2, precioExtra: 1.5 }] }] }],
    }] }, {
      ...seleccionVacia,
      combos: { 9: [30] },
      variantesCombo: { '9:0': 5 },
      modificadoresCombo: { '9:0': { 6: [2] } },
    });

    expect(precio).toBe(27.5);
  });

  it('muestra el precio mínimo válido del combo con adicionales obligatorios y opciones distintas', () => {
    const precio = precioDesdeConfiguracionPos({ precio: 20, variantes: [], grupos: [{ grupoId: 1, minimo: 1,
      opciones: [{ opcionId: 1, precioExtra: 4 }, { opcionId: 2, precioExtra: 2 }] }], combo: [{
      comboGrupoId: 9, cantidad: 2, opciones: [
        { productoId: 30, precioExtra: 0, agotado: false, variantes: [{ varianteId: 1, precio: 8 }, { varianteId: 2, precio: 12 }],
          grupos: [{ grupoId: 2, minimo: 1, opciones: [{ opcionId: 3, precioExtra: 1.5 }] }] },
        { productoId: 31, precioExtra: 3, agotado: false, variantes: [], grupos: [] },
        { productoId: 32, precioExtra: 0, agotado: true, variantes: [], grupos: [] },
      ],
    }] });

    expect(precio).toBe(26.5);
  });
});
