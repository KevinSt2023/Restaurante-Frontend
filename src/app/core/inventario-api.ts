import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export interface UnidadMedida { codigo:string; nombre:string; plural:string; abreviatura:string; dimension:string; unidadBase:string; factorABase:number; }
export interface Insumo { insumoId:number; codigo:string|null; nombre:string; unidadBase:string; unidadCompra:string; unidadCompraCodigo:string; empaqueNombre:string|null; empaqueContenido:number|null; factorCompraABase:number; costoPromedioBase:number; costoConfigurado:boolean; stockActualBase:number; stockMinimoBase:number; stockObjetivoBase:number; cantidadEntranteBase:number; activo:boolean; bajoMinimo:boolean; reposicionRequerida:boolean; }
export interface InsumoGuardar { codigo:string|null; nombre:string; unidadBase:string; unidadCompraCodigo:string; empaqueNombre:string|null; empaqueContenido:number|null; stockMinimoBase:number; stockObjetivoBase?:number; }
export interface RecetaFila { recetaInsumoId:number; productoId:number; varianteId:number|null; opcionId:number|null; insumoId:number; nombreInsumo:string; unidadBase:string; cantidadBase:number; }
export interface RecetaGuardar { insumoId:number; cantidadBase:number; varianteId:number|null; opcionId:number|null; }
export interface Almacen { almacenId:number; sucursalId:number; nombre:string; tipo:string; esPrincipal:boolean; activo:boolean; }
export interface AlmacenGuardar { nombre:string; tipo:string; activo:boolean; }
export interface StockAlmacenFila { almacenId:number; almacen:string; tipo:string; esPrincipal:boolean; stockActualBase:number; }
export interface StockPorAlmacen { insumoId:number; nombre:string; unidadBase:string; stockSucursalBase:number; almacenes:StockAlmacenFila[]; }
export interface ReubicacionFila { insumoId:number; nombreInsumo:string; unidadBase:string; cantidadBase:number; movimientoSalidaId:number; movimientoEntradaId:number; }
export interface Reubicacion { referencia:string; almacenOrigenId:number; almacenOrigen:string; almacenDestinoId:number; almacenDestino:string; motivo:string|null; registradoEn:string; insumos:ReubicacionFila[]; }
export interface Movimiento { movimientoInsumoId:number; insumoId:number; nombreInsumo:string; unidadBase:string; tipo:string; cantidadDeltaBase:number; cantidadRegistrada:number; unidadRegistrada:string; costoConfigurado:boolean; costoUnitarioBase:number|null; costoTotal:number|null; motivo:string|null; referencia:string|null; pedidoId:number|null; registradoEn:string; almacenId:number; almacen:string; }
export interface ProveedorInsumo { proveedorInsumoId:number; ruc:string|null; nombre:string; contacto:string|null; telefono:string|null; activo:boolean; }
export interface CompraLinea { itemId:number; insumoId:number; nombreInsumo:string; cantidadCompra:number; unidadCompra:string; factorCompraABase:number; cantidadBase:number; costoUnitarioBase:number; costoTotal:number; unidadBase:string; movimientoId:number|null; }
export interface RecepcionCompra { recepcionId:number; sucursalId:number; proveedorId:number; proveedorNombre:string; proveedorRuc:string; tipoDocumento:string; serieDocumento:string|null; numeroDocumento:string|null; fechaDocumento:string; estado:string; totalInsumos:number; motivo:string|null; registradoPor:number; registradoEn:string; insumos:CompraLinea[]; almacenId:number; almacen:string; }
export interface ConteoLinea { conteoInventarioItemId:number; insumoId:number; nombreInsumo:string; stockSistemaBase:number; cantidadContadaBase:number; diferenciaBase:number; unidadBase:string; costoConfigurado:boolean; costoUnitarioBase:number|null; costoTotalDiferencia:number|null; movimientoInsumoId:number|null; }
export interface ConteoInventario { conteoInventarioId:number; sucursalId:number; sucursal:string; estado:string; motivo:string; registradoPor:number; registradoEn:string; aplicadoPor:number|null; aplicadoEn:string|null; insumos:ConteoLinea[]; almacenId:number; almacen:string; }
export interface ConteoGuardar { insumos:{insumoId:number;stockSistemaBase:number;cantidadContadaBase:number}[]; motivo:string; claveIdempotencia:string; }
export interface TrasladoLinea { trasladoItemId:number; insumoId:number; nombreInsumo:string; cantidadBase:number; cantidadRecibidaBase:number|null; cantidadFaltanteBase:number; motivoDiferencia:string|null; unidadBase:string; costoUnitarioBase:number; costoTotal:number; }
export interface Traslado { trasladoId:number; sucursalOrigenId:number; sucursalOrigen:string; sucursalDestinoId:number; sucursalDestino:string; estado:string; motivo:string|null; registradoPor:number; registradoEn:string; recibidoPor:number|null; recibidoEn:string|null; insumos:TrasladoLinea[]; almacenOrigenId:number; almacenOrigen:string; almacenDestinoId:number; almacenDestino:string; }
export interface TrasladoRecepcionLinea { trasladoItemId:number; cantidadRecibidaBase:number; motivoDiferencia:string|null; }
export interface ProductoCostoInsumo { insumoId:number; nombreInsumo:string; unidadBase:string; cantidadBaseConsumida:number; costoConocido:number; lineasSinCosto:number; }
export interface ProductoCostoReceta { productoId:number; producto:string; unidades:number; ventaNetaAsignada:number; costoRecetaConocido:number; contribucionEstimada:number; lineasSinConsumo:number; lineasSinCosto:number; insumos:ProductoCostoInsumo[]; }
export interface SucursalCostoReceta { sucursalId:number; sucursal:string; ventasNetas:number; costoRecetaConocido:number; contribucionEstimada:number; lineasConConsumo:number; lineasConCostoCompleto:number; lineasTotales:number; lineasSinConsumo:number; lineasSinCosto:number; }
export interface AnaliticaCostoReceta { desde:string; hasta:string; consolidado:boolean; ventasNetas:number; costoRecetaConocido:number; contribucionEstimada:number; lineasConConsumo:number; lineasConCostoCompleto:number; lineasTotales:number; lineasSinConsumo:number; lineasSinCosto:number; coberturaCostosPct:number; productosTotal:number; productosMostrados:number; paginaProductos:number; paginasProductos:number; sucursales:SucursalCostoReceta[]; productos:ProductoCostoReceta[]; }

export interface CuadreInsumo { insumoId:number; nombre:string; unidadBase:string;
  existenciaRegistrada:number; sumaDelKardex:number; diferencia:number; movimientos:number; motivo:string; }
export interface CuadreInventario { insumos:number; movimientos:number; observados:number; detalle:CuadreInsumo[]; }

@Injectable({providedIn:'root'})
export class InventarioApi {
  private http=inject(HttpClient); private base=`${environment.api}/inventario`;
  private get<T>(url:string, query:Record<string,string|number|boolean|undefined>={}){let params=new HttpParams();for(const [k,v] of Object.entries(query))if(v!==undefined&&v!=='')params=params.set(k,String(v));return firstValueFrom(this.http.get<T>(`${this.base}${url}`,{params}));}
  private post<T>(url:string, body:unknown){return firstValueFrom(this.http.post<T>(`${this.base}${url}`,body));}
  private put<T>(url:string, body:unknown){return firstValueFrom(this.http.put<T>(`${this.base}${url}`,body));}
  unidades(){return this.get<UnidadMedida[]>('/unidades');}
  almacenes(incluirInactivos=false){return this.get<Almacen[]>('/almacenes',{incluirInactivos});}
  crearAlmacen(dto:AlmacenGuardar){return this.post<Almacen[]>('/almacenes',dto);}
  editarAlmacen(id:number,dto:AlmacenGuardar){return this.put<Almacen[]>(`/almacenes/${id}`,dto);}
  stockPorAlmacen(insumoId?:number,soloConStock=false){return this.get<StockPorAlmacen[]>('/stock-almacenes',{insumoId,soloConStock});}
  reubicar(dto:{almacenOrigenId:number;almacenDestinoId:number;insumos:{insumoId:number;cantidadBase:number}[];motivo:string|null;claveIdempotencia:string}){return this.post<Reubicacion>('/reubicaciones',dto);}
  insumos(buscar?:string){return this.get<Insumo[]>('/insumos',{buscar});}
  cuadre(){return this.get<CuadreInventario>('/cuadre');}
  crearInsumo(dto:InsumoGuardar){return this.post<Insumo>('/insumos',dto);}
  editarInsumo(id:number,dto:InsumoGuardar){return this.put<Insumo>(`/insumos/${id}`,dto);}
  configurarReposicion(id:number,dto:{stockMinimoBase:number;stockObjetivoBase:number}){return this.put<Insumo>(`/insumos/${id}/reposicion`,dto);}
  receta(productoId:number){return this.get<RecetaFila[]>(`/productos/${productoId}/receta`);}
  guardarReceta(productoId:number,insumos:RecetaGuardar[]){return this.put<RecetaFila[]>(`/productos/${productoId}/receta`,{insumos});}
  movimiento(insumoId:number,dto:{tipo:string;cantidadCompra:number;costoTotal:number|null;motivo:string|null;referencia:string|null;claveIdempotencia:string}){return this.post<Movimiento>(`/insumos/${insumoId}/movimientos`,dto);}
  proveedores(buscar?:string){return this.get<ProveedorInsumo[]>('/proveedores',{buscar});}
  crearProveedor(dto:{ruc:string|null;nombre:string;contacto:string|null;telefono:string|null}){return this.post<ProveedorInsumo>('/proveedores',dto);}
  compras(antesDe?:number,limite=100){return this.get<RecepcionCompra[]>('/compras',{antesDe,limite});}
  registrarCompra(dto:{proveedorInsumoId:number;tipoDocumento:string;serieDocumento:string|null;numeroDocumento:string|null;fechaDocumento:string;insumos:{insumoId:number;cantidadCompra:number;costoTotal:number}[];motivo:string|null;claveIdempotencia:string}){return this.post<RecepcionCompra>('/compras',dto);}
  movimientos(insumoId?:number,antesDe?:number,limite=80){return this.get<Movimiento[]>('/movimientos',{insumoId,antesDe,limite});}
  conteos(antesDe?:number,limite=50){return this.get<ConteoInventario[]>('/conteos',{antesDe,limite});}
  registrarConteo(dto:ConteoGuardar){return this.post<ConteoInventario>('/conteos',dto);}
  traslados(antesDe?:number,limite=100){return this.get<Traslado[]>('/traslados',{antesDe,limite});}
  crearTraslado(dto:{sucursalDestinoId:number;insumos:{insumoId:number;cantidadBase:number}[];motivo:string|null;claveIdempotencia:string}){return this.post<Traslado>('/traslados',dto);}
  recibirTraslado(id:number,claveIdempotencia:string,insumos:TrasladoRecepcionLinea[]){return this.post<Traslado>(`/traslados/${id}/recibir`,{claveIdempotencia,insumos});}
  analiticaCostos(desde:string,hasta:string,consolidado:boolean,paginaProductos=1,priorizarPendientes=false){return this.get<AnaliticaCostoReceta>('/analitica-costos',{desde,hasta,consolidado,paginaProductos,priorizarPendientes});}
}
