import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { ROLES, Sesion, UsuarioSesion, PlanSesion } from './modelos';

const CLAVE = 'vf_sesion';

@Injectable({ providedIn: 'root' })
export class SesionService {
  private http = inject(HttpClient);
  private router = inject(Router);

  private readonly _sesion = signal<Sesion | null>(this.leer());
  readonly sesion = this._sesion.asReadonly();
  readonly usuario = computed(() => this._sesion()?.usuario ?? null);
  readonly autenticado = computed(() => this._sesion() !== null);
  readonly esSuperAdmin = computed(() => this.usuario()?.rolId === ROLES.SUPERADMIN);
  readonly debeCambiarPassword = computed(() => this.usuario()?.debeCambiarPassword === true);

  // Motivo que se muestra en el login después de un cierre forzado.
  readonly motivoCierre = signal<string | null>(null);

  private refrescando: Promise<string | null> | null = null;

  token(): string | null { return this._sesion()?.token ?? null; }
  tienePermiso(codigo: string): boolean { return this._sesion()?.permisos.includes(codigo) ?? false; }
  tieneAlguno(...codigos: string[]): boolean { return codigos.some(c => this.tienePermiso(c)); }
  tieneFuncion(codigo: string): boolean { return this._sesion()?.funciones.includes(codigo) ?? false; }

  // Permisos y plan frescos desde la API: si el SuperAdmin cambió el plan, el menú
  // se ajusta sin tener que volver a iniciar sesión.
  async refrescarPerfil(): Promise<void> {
    const actual = this._sesion();
    if (!actual) return;
    const p = await firstValueFrom(this.http.get<{ usuario: UsuarioSesion; permisos: string[]; funciones: string[];
      rolesQueOpera: number[]; plan: PlanSesion | null }>(`${environment.api}/auth/perfil`));
    this.guardar({ ...actual, ...p });
  }
  rutaInicio(): string {
    if (this.debeCambiarPassword()) return '/cambiar-password';
    return this.esSuperAdmin() ? '/sa/tablero' : '/inicio';
  }

  async login(email: string, password: string): Promise<Sesion> {
    const s = await firstValueFrom(this.http.post<Sesion>(`${environment.api}/auth/login`, { email, password }));
    this.guardar(s);
    this.motivoCierre.set(null);
    return s;
  }

  async cambiarPassword(actual: string, nueva: string): Promise<void> {
    const s = await firstValueFrom(this.http.post<Sesion>(`${environment.api}/auth/cambiar-password`, { actual, nueva }));
    this.guardar(s);
  }

  // Un solo refresh a la vez: si varias peticiones reciben 401 juntas, todas esperan el mismo.
  refrescar(): Promise<string | null> {
    const refresh = this._sesion()?.refreshToken;
    if (!refresh) return Promise.resolve(null);
    this.refrescando ??= firstValueFrom(this.http.post<Sesion>(`${environment.api}/auth/refresh`, { refreshToken: refresh }))
      .then(s => { this.guardar(s); return s.token; })
      .catch(() => null)
      .finally(() => (this.refrescando = null));
    return this.refrescando;
  }

  async cerrarSesion(motivo: string | null = null): Promise<void> {
    const refresh = this._sesion()?.refreshToken;
    this.limpiar();
    this.motivoCierre.set(motivo);
    if (refresh) this.http.post(`${environment.api}/auth/logout`, { refreshToken: refresh }).subscribe({ error: () => {} });
    await this.router.navigate(['/login']);
  }

  limpiar(): void {
    this._sesion.set(null);
    try { localStorage.removeItem(CLAVE); } catch { /* almacenamiento no disponible */ }
  }

  private guardar(s: Sesion): void {
    this._sesion.set(s);
    try { localStorage.setItem(CLAVE, JSON.stringify(s)); } catch { /* sigue en memoria */ }
  }

  private leer(): Sesion | null {
    try {
      const v = localStorage.getItem(CLAVE);
      return v ? (JSON.parse(v) as Sesion) : null;
    } catch {
      return null;
    }
  }
}
