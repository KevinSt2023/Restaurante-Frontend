import { cantidadCompraParaObjetivo, trasladoEntranteCubreObjetivo } from './inventario-reposicion';

describe('cantidadCompraParaObjetivo',()=>{
  it('convierte la brecha hasta el objetivo en unidades de compra',()=>expect(cantidadCompraParaObjetivo(500,2500,1000)).toBe(2));
  it('redondea hacia arriba a cuatro decimales para alcanzar el objetivo',()=>expect(cantidadCompraParaObjetivo(0,1,3)).toBe(0.3334));
  it('no sugiere compra si el stock ya alcanza el objetivo',()=>expect(cantidadCompraParaObjetivo(10,10,1)).toBe(0));
  it('descuenta la cantidad entrante al calcular hasta el objetivo',()=>expect(cantidadCompraParaObjetivo(0,350,100,400)).toBe(0));
  it('solo recomienda la brecha que queda después del traslado',()=>expect(cantidadCompraParaObjetivo(0,350,100,300)).toBe(0.5));
  it('repone el objetivo aunque el mínimo de seguridad sea menor',()=>expect(cantidadCompraParaObjetivo(100,350,100,50)).toBe(2));
  it('rechaza factores inválidos y cantidades mayores al máximo admitido por la API',()=>{
    expect(cantidadCompraParaObjetivo(0,1,0)).toBeNull();expect(cantidadCompraParaObjetivo(0,1_000_001,1)).toBeNull();
  });
  it('marca en tránsito solo cuando la llegada cubre un faltante que aún no está en stock físico',()=>{
    expect(trasladoEntranteCubreObjetivo(0,350,400)).toBeTrue();
    expect(trasladoEntranteCubreObjetivo(0,350,300)).toBeFalse();
    expect(trasladoEntranteCubreObjetivo(350,350,400)).toBeFalse();
    expect(trasladoEntranteCubreObjetivo(0,0,4)).toBeFalse();
  });
});
