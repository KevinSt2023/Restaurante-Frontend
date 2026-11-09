export interface GrupoComboValidacion {
  nombre: string;
  cantidad: number;
  opciones: { productoId: number; precioExtra: number }[];
}

/** Mirrors CartaService combo constraints so predictable business errors are caught before the API call. */
export function validarConfiguracionCombo(
  grupos: GrupoComboValidacion[],
  productosDisponibles: number[],
): string | null {
  if (grupos.length === 0) return 'Agrega al menos un grupo al combo.';
  if (grupos.length > 8) return 'Un combo admite hasta 8 grupos.';
  const disponibles = new Set(productosDisponibles);

  for (const [indice, grupo] of grupos.entries()) {
    const nombre = grupo.nombre.trim();
    if (!nombre) return `Escribe el nombre del grupo ${indice + 1}.`;
    if (nombre.length > 80) return `El nombre del grupo ${indice + 1} admite hasta 80 caracteres.`;
    if (!Number.isInteger(grupo.cantidad) || grupo.cantidad < 1 || grupo.cantidad > 20) {
      return `La cantidad de selecciones de ${nombre} debe estar entre 1 y 20.`;
    }
    if (!grupo.opciones.length) return `Agrega al menos un producto a ${nombre}.`;

    const ids = grupo.opciones.map(opcion => opcion.productoId);
    if (ids.some(id => !disponibles.has(id))) return `Todas las opciones de ${nombre} deben ser productos activos disponibles.`;
    if (new Set(ids).size !== ids.length) return `Quita los productos repetidos de ${nombre}.`;
    if (grupo.opciones.some(({ precioExtra }) => !Number.isFinite(precioExtra)
      || precioExtra < 0 || precioExtra > 9999
      || Math.abs(precioExtra * 100 - Math.round(precioExtra * 100)) > 1e-8)) {
      return `El precio extra de ${nombre} debe estar entre S/ 0 y S/ 9 999, con máximo 2 decimales.`;
    }
  }
  return null;
}
