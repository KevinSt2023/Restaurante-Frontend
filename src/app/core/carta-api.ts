import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

// ─── Tipos (espejo de CartaService) ───
export type TipoProducto = 'PLATO' | 'BEBIDA' | 'PRODUCTO' | 'COMBO';

export interface CartaQr { activa: boolean; codigo: string | null; url: string | null; svg: string | null; }
export interface Area { areaId: number; nombre: string; color: string; imprimeComanda: boolean; orden: number; activo: boolean; productos: number; }
export interface Categoria { categoriaId: number; nombre: string; descripcion: string | null; color: string; orden: number; activo: boolean; productos: number; }
export interface Opcion { opcionId: number; nombre: string; precioExtra: number; orden: number; activo: boolean; }
export interface Grupo { grupoId: number; nombre: string; minimo: number; maximo: number; orden: number; activo: boolean; opciones: Opcion[]; productos: number; }
export interface GrupoGuardar { nombre: string; minimo: number; maximo: number; opciones: { opcionId: number | null; nombre: string; precioExtra: number; activo: boolean }[]; }

export interface ProductoLista {
  productoId: number; nombre: string; codigo: string | null; tipo: TipoProducto; categoriaId: number; categoria: string;
  categoriaColor: string; areaId: number | null; area: string | null; precio: number; precioDesde: number | null;
  imagen: string | null; activo: boolean; variantes: number; grupos: number; sucursales: number; etiquetas: string[]; orden: number;
}
export interface Variante { varianteId: number | null; nombre: string; precio: number; orden?: number; activo: boolean; }
export interface ComboOpcion { productoId: number; producto?: string; precioExtra: number; activo?: boolean; }
export interface ComboGrupo { comboGrupoId?: number; nombre: string; cantidad: number; opciones: ComboOpcion[]; }
export interface ProductoSucursal { sucursalId: number; sucursal: string; activa: boolean; precio: number | null; agotadoHoy: boolean; }
export interface ProductoDetalle {
  productoId: number; categoriaId: number; areaId: number | null; tipo: TipoProducto; codigo: string | null; nombre: string;
  descripcion: string | null; precio: number; afectacionIgv: string; tiempoPreparacionMin: number | null; etiquetas: string[];
  imagen: string | null; activo: boolean; variantes: Variante[]; grupoIds: number[]; comboGrupos: ComboGrupo[];
  sucursales: ProductoSucursal[]; updatedAt: string;
}
export interface ProductoGuardar {
  categoriaId: number; areaId: number | null; tipo: TipoProducto; codigo: string | null; nombre: string; descripcion: string | null;
  precio: number; afectacionIgv: string; tiempoPreparacionMin: number | null; etiquetas: string[];
  variantes: { varianteId: number | null; nombre: string; precio: number; activo: boolean }[] | null;
  grupoIds: number[] | null;
  comboGrupos: { nombre: string; cantidad: number; opciones: { productoId: number; precioExtra: number }[] }[] | null;
  sucursales: { sucursalId: number; activa: boolean; precio: number | null }[] | null;
}
export interface SucursalSimple { sucursalId: number; nombre: string; esPrincipal: boolean; }
export interface DisponibilidadItem { productoId: number; nombre: string; tipo: TipoProducto; categoriaId: number; categoria: string; categoriaColor: string; imagen: string | null; agotado: boolean; }
export interface Disponibilidad { sucursalId: number; sucursal: string; fecha: string; productos: DisponibilidadItem[]; }

export const TIPOS_PRODUCTO: { valor: TipoProducto; texto: string; icono: string }[] = [
  { valor: 'PLATO', texto: 'Plato', icono: 'chef' },
  { valor: 'BEBIDA', texto: 'Bebida', icono: 'copa' },
  { valor: 'PRODUCTO', texto: 'Reventa', icono: 'caja' },
  { valor: 'COMBO', texto: 'Combo', icono: 'combo' },
];

export const ETIQUETAS_SUGERIDAS = ['picante', 'vegetariano', 'vegano', 'sin gluten', 'del mar', 'para compartir', 'nuevo', 'recomendado'];

// URL pública de una foto guardada (ruta relativa que devuelve la API).
export const urlFoto = (ruta: string | null) => (ruta ? `${environment.archivos}/${ruta}` : null);

@Injectable({ providedIn: 'root' })
export class CartaApi {
  private http = inject(HttpClient);
  private base = `${environment.api}/carta`;

  private get<T>(url: string, params?: Record<string, string | number | boolean | null | undefined>) {
    let p = new HttpParams();
    for (const [k, v] of Object.entries(params ?? {})) if (v !== null && v !== undefined && v !== '') p = p.set(k, String(v));
    return firstValueFrom(this.http.get<T>(`${this.base}${url}`, { params: p }));
  }
  private post<T>(url: string, body: unknown = {}) { return firstValueFrom(this.http.post<T>(`${this.base}${url}`, body)); }
  private put<T>(url: string, body: unknown) { return firstValueFrom(this.http.put<T>(`${this.base}${url}`, body)); }
  private del<T>(url: string) { return firstValueFrom(this.http.delete<T>(`${this.base}${url}`)); }

  // Carta QR: la pagina publica de la sucursal activa.
  qr() { return this.get<CartaQr>('/qr'); }
  guardarQr(activa: boolean, regenerar = false) { return this.put<CartaQr>('/qr', { activa, regenerar }); }

  areas() { return this.get<Area[]>('/areas'); }
  guardarArea(id: number | null, dto: { nombre: string; color: string; imprimeComanda: boolean }) {
    return id ? this.put<Area[]>(`/areas/${id}`, dto) : this.post<Area[]>('/areas', dto);
  }
  estadoArea(id: number, activo: boolean) { return this.post<Area[]>(`/areas/${id}/estado`, { activo }); }
  eliminarArea(id: number) { return this.del<Area[]>(`/areas/${id}`); }
  ordenarAreas(ids: number[]) { return this.put<Area[]>('/areas/orden', { ids }); }

  categorias() { return this.get<Categoria[]>('/categorias'); }
  guardarCategoria(id: number | null, dto: { nombre: string; descripcion: string | null; color: string }) {
    return id ? this.put<Categoria[]>(`/categorias/${id}`, dto) : this.post<Categoria[]>('/categorias', dto);
  }
  estadoCategoria(id: number, activo: boolean) { return this.post<Categoria[]>(`/categorias/${id}/estado`, { activo }); }
  eliminarCategoria(id: number) { return this.del<Categoria[]>(`/categorias/${id}`); }
  ordenarCategorias(ids: number[]) { return this.put<Categoria[]>('/categorias/orden', { ids }); }

  grupos() { return this.get<Grupo[]>('/modificadores'); }
  guardarGrupo(id: number | null, dto: GrupoGuardar) { return id ? this.put<Grupo[]>(`/modificadores/${id}`, dto) : this.post<Grupo[]>('/modificadores', dto); }
  estadoGrupo(id: number, activo: boolean) { return this.post<Grupo[]>(`/modificadores/${id}/estado`, { activo }); }
  eliminarGrupo(id: number) { return this.del<Grupo[]>(`/modificadores/${id}`); }

  productos(f: { categoriaId?: number | null; tipo?: string | null; buscar?: string; incluirInactivos?: boolean } = {}) {
    return this.get<ProductoLista[]>('/productos', f);
  }
  producto(id: number) { return this.get<ProductoDetalle>(`/productos/${id}`); }
  guardarProducto(id: number | null, dto: ProductoGuardar) {
    return id ? this.put<ProductoDetalle>(`/productos/${id}`, dto) : this.post<ProductoDetalle>('/productos', dto);
  }
  estadoProducto(id: number, activo: boolean) { return this.post<ProductoDetalle>(`/productos/${id}/estado`, { activo }); }
  duplicar(id: number) { return this.post<ProductoDetalle>(`/productos/${id}/duplicar`); }
  eliminarProducto(id: number) { return this.del<void>(`/productos/${id}`); }
  ordenarProductos(ids: number[]) { return this.put<ProductoLista[]>('/productos/orden', { ids }); }
  subirFoto(id: number, archivo: File) {
    const fd = new FormData();
    fd.append('archivo', archivo);
    return this.post<ProductoDetalle>(`/productos/${id}/imagen`, fd);
  }
  quitarFoto(id: number) { return this.del<ProductoDetalle>(`/productos/${id}/imagen`); }

  sucursales() { return this.get<SucursalSimple[]>('/sucursales'); }
  disponibilidad(sucursalId: number | null) { return this.get<Disponibilidad>('/disponibilidad', { sucursalId }); }
  marcarAgotado(sucursalId: number, productoId: number, agotado: boolean) {
    return this.post<Disponibilidad>('/disponibilidad', { sucursalId, productoId, agotado });
  }
}
