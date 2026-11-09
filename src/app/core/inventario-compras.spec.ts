import { validarLineasCompraInventario } from './inventario-compras';

describe('validación de líneas de compra de inventario', () => {
  it('acepta insumos únicos dentro de cantidad, costo y decimales permitidos', () => {
    expect(validarLineasCompraInventario([
      { insumoId: 2, cantidadCompra: 1.2346, costoTotal: 12.34 },
      { insumoId: 3, cantidadCompra: 0.25, costoTotal: 0 },
    ])).toBeNull();
  });

  it('rechaza insumos duplicados y dirige a consolidar la cantidad', () => {
    expect(validarLineasCompraInventario([
      { insumoId: 2, cantidadCompra: 1, costoTotal: 5 },
      { insumoId: 2, cantidadCompra: 2, costoTotal: 10 },
    ])).toContain('una sola vez');
  });

  it('rechaza más de cien líneas y cantidades fuera del contrato de API', () => {
    const many = Array.from({ length: 101 }, (_, i) => ({ insumoId: i + 1, cantidadCompra: 1, costoTotal: 1 }));
    expect(validarLineasCompraInventario(many)).toContain('100');
    expect(validarLineasCompraInventario([{ insumoId: 1, cantidadCompra: 1_000_001, costoTotal: 1 }])).toContain('1,000,000');
  });

  it('rechaza cantidades o costos con más decimales de los aceptados por la API', () => {
    expect(validarLineasCompraInventario([{ insumoId: 1, cantidadCompra: 0.00001, costoTotal: 1 }])).toContain('cuatro decimales');
    expect(validarLineasCompraInventario([{ insumoId: 1, cantidadCompra: 1, costoTotal: 1.001 }])).toContain('dos decimales');
  });

  it('rechaza un total agregado que exceda el límite del backend', () => {
    expect(validarLineasCompraInventario([
      { insumoId: 1, cantidadCompra: 1, costoTotal: 6_000_000_000 },
      { insumoId: 2, cantidadCompra: 1, costoTotal: 5_000_000_000 },
    ])).toContain('total de la compra');
  });
});
