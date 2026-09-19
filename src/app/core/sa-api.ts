import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  Acceso, Bitacora, Cobranza, ConfiguracionSaas, EmpresaCrear, EmpresaDatos, EmpresaDetalle, EmpresaLista, Funcion,
  MatrizPermisos, Movimiento, Pagina, PasswordTemporal, Plan, PlanGuardar, RegistrarMovimiento, Rol, SaludEmpresa,
  SugerenciaCobro, Tablero, UsuarioGuardar,
} from './modelos';

// Todas las llamadas del panel SuperAdmin. Devuelven promesas: las pantallas
// hacen await y muestran el error con Ui.error().
@Injectable({ providedIn: 'root' })
export class SaApi {
  private http = inject(HttpClient);
  private base = `${environment.api}/sa`;

  private get<T>(url: string, params?: Record<string, string | number | boolean | null | undefined>) {
    let p = new HttpParams();
    for (const [k, v] of Object.entries(params ?? {})) if (v !== null && v !== undefined && v !== '') p = p.set(k, String(v));
    return firstValueFrom(this.http.get<T>(`${this.base}${url}`, { params: p }));
  }
  private post<T>(url: string, body: unknown = {}) { return firstValueFrom(this.http.post<T>(`${this.base}${url}`, body)); }
  private put<T>(url: string, body: unknown) { return firstValueFrom(this.http.put<T>(`${this.base}${url}`, body)); }
  private del<T>(url: string) { return firstValueFrom(this.http.delete<T>(`${this.base}${url}`)); }

  // ─── Tablero y cobros ───
  tablero() { return this.get<Tablero>('/suscripciones/tablero'); }
  cobranza() { return this.get<Cobranza[]>('/suscripciones/cobranza'); }
  ultimosMovimientos(limite = 30) { return this.get<Movimiento[]>('/suscripciones/movimientos', { limite }); }
  sugerencia(tenantId: number, meses: number) { return this.get<SugerenciaCobro>(`/suscripciones/sugerencia/${tenantId}`, { meses }); }
  registrarMovimiento(tenantId: number, dto: RegistrarMovimiento) {
    return this.post<{ movimiento: Movimiento; advertencia: string | null }>(`/suscripciones/${tenantId}`, dto);
  }
  anularMovimiento(id: number, motivo: string) { return this.post<Movimiento>(`/suscripciones/movimientos/${id}/anular`, { motivo }); }

  // ─── Empresas ───
  empresas() { return this.get<EmpresaLista[]>('/empresas'); }
  empresa(id: number) { return this.get<EmpresaDetalle>(`/empresas/${id}`); }
  crearEmpresa(dto: EmpresaCrear) {
    return this.post<{ empresa: EmpresaDetalle; passwordTemporal: string | null; advertencia: string | null }>('/empresas', dto);
  }
  actualizarEmpresa(id: number, dto: EmpresaDatos) { return this.put<EmpresaDetalle>(`/empresas/${id}`, dto); }
  guardarNotas(id: number, notas: string) { return this.put<void>(`/empresas/${id}/notas`, { notas }); }
  cambiarPlan(id: number, planId: number) { return this.post<EmpresaDetalle>(`/empresas/${id}/plan`, { planId }); }
  suspender(id: number, motivo: string) { return this.post<EmpresaDetalle>(`/empresas/${id}/suspender`, { motivo }); }
  reactivar(id: number) { return this.post<EmpresaDetalle>(`/empresas/${id}/reactivar`); }
  cerrarSesionesEmpresa(id: number) { return this.post<{ usuarios: number }>(`/empresas/${id}/cerrar-sesiones`); }
  accesos(id: number, limite = 100) { return this.get<Acceso[]>(`/empresas/${id}/accesos`, { limite }); }
  movimientos(id: number) { return this.get<Movimiento[]>(`/empresas/${id}/movimientos`); }
  saludEmpresa(id: number) { return this.get<SaludEmpresa | null>(`/empresas/${id}/salud`); }
  bitacoraEmpresa(id: number, pagina = 1) { return this.get<Pagina<Bitacora>>(`/empresas/${id}/bitacora`, { pagina, tamano: 30 }); }

  crearSucursal(id: number, dto: { nombre: string; direccion: string | null; telefono: string | null }) {
    return this.post<EmpresaDetalle>(`/empresas/${id}/sucursales`, dto);
  }
  editarSucursal(id: number, sid: number, dto: { nombre: string; direccion: string | null; telefono: string | null }) {
    return this.put<EmpresaDetalle>(`/empresas/${id}/sucursales/${sid}`, dto);
  }
  estadoSucursal(id: number, sid: number, activo: boolean) { return this.post<EmpresaDetalle>(`/empresas/${id}/sucursales/${sid}/estado`, { activo }); }
  sucursalPrincipal(id: number, sid: number) { return this.post<EmpresaDetalle>(`/empresas/${id}/sucursales/${sid}/principal`); }

  crearUsuario(id: number, dto: UsuarioGuardar) {
    return this.post<{ temporal: PasswordTemporal | null; empresa: EmpresaDetalle }>(`/empresas/${id}/usuarios`, dto);
  }
  editarUsuario(id: number, uid: number, dto: UsuarioGuardar) { return this.put<EmpresaDetalle>(`/empresas/${id}/usuarios/${uid}`, dto); }
  estadoUsuario(id: number, uid: number, activo: boolean) { return this.post<EmpresaDetalle>(`/empresas/${id}/usuarios/${uid}/estado`, { activo }); }
  resetPassword(id: number, uid: number) { return this.post<PasswordTemporal>(`/empresas/${id}/usuarios/${uid}/reset-password`); }
  desbloquear(id: number, uid: number) { return this.post<EmpresaDetalle>(`/empresas/${id}/usuarios/${uid}/desbloquear`); }
  cerrarSesionesUsuario(id: number, uid: number) { return this.post<void>(`/empresas/${id}/usuarios/${uid}/cerrar-sesiones`); }

  // ─── Planes ───
  planes() { return this.get<Plan[]>('/planes'); }
  crearPlan(dto: PlanGuardar) { return this.post<Plan>('/planes', dto); }
  actualizarPlan(id: number, dto: PlanGuardar) { return this.put<Plan>(`/planes/${id}`, dto); }
  eliminarPlan(id: number) { return this.del<void>(`/planes/${id}`); }

  // ─── Salud, bitácora, catálogos ───
  salud() { return this.get<SaludEmpresa[]>('/salud'); }
  bitacora(f: { tenantId?: number | null; accion?: string; buscar?: string; desde?: string; hasta?: string; soloSaas?: boolean; pagina: number }) {
    return this.get<Pagina<Bitacora>>('/bitacora', { ...f, tamano: 50 });
  }
  accionesBitacora() { return this.get<string[]>('/bitacora/acciones'); }
  roles() { return this.get<Rol[]>('/catalogos/roles'); }
  funciones() { return this.get<Funcion[]>('/catalogos/funciones'); }
  permisos() { return this.get<MatrizPermisos>('/catalogos/permisos'); }
  guardarPermisos(rolId: number, permisoIds: number[]) { return this.put<MatrizPermisos>(`/catalogos/permisos/${rolId}`, { permisoIds }); }
  configuracion() { return this.get<ConfiguracionSaas>('/catalogos/configuracion'); }
  guardarConfiguracion(dto: ConfiguracionSaas) { return this.put<ConfiguracionSaas>('/catalogos/configuracion', dto); }
}
