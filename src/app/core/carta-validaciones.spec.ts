import { validarConfiguracionCombo } from './carta-validaciones';

describe('validación local de combos', () => {
  const valido = [{ nombre: 'Bebida', cantidad: 1, opciones: [{ productoId: 5, precioExtra: 1.25 }] }];

  it('acepta un grupo válido y productos activos disponibles', () => {
    expect(validarConfiguracionCombo(valido, [5])).toBeNull();
  });

  it('rechaza el límite de grupos, grupo sin opciones y cantidad fuera de rango', () => {
    expect(validarConfiguracionCombo([], [5])).toContain('al menos un grupo');
    expect(validarConfiguracionCombo(Array.from({ length: 9 }, (_, i) => ({ ...valido[0], nombre: `Grupo ${i}` })), [5]))
      .toContain('hasta 8');
    expect(validarConfiguracionCombo([{ ...valido[0], opciones: [] }], [5])).toContain('al menos un producto');
    expect(validarConfiguracionCombo([{ ...valido[0], cantidad: 21 }], [5])).toContain('entre 1 y 20');
  });

  it('rechaza opciones repetidas, inactivas y extras con precisión inválida', () => {
    expect(validarConfiguracionCombo([{ ...valido[0], opciones: [valido[0].opciones[0], valido[0].opciones[0]] }], [5]))
      .toContain('repetidos');
    expect(validarConfiguracionCombo(valido, [])).toContain('productos activos');
    expect(validarConfiguracionCombo([{ ...valido[0], opciones: [{ productoId: 5, precioExtra: 1.234 }] }], [5]))
      .toContain('máximo 2 decimales');
  });
});
