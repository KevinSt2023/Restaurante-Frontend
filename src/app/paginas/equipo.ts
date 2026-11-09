import { CommonModule, DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { SesionService } from '../core/sesion';
import { Icono } from '../shared/icono';
import { Ui, esc, mensajeError } from '../core/ui';

interface Miembro {
  usuarioId: number; nombre: string; email: string; dni: string | null; telefono: string | null;
  rolId: number; rol: string; sucursalId: number | null; sucursal: string | null;
  activo: boolean; bloqueado: boolean; bloqueadoHasta: string | null;
  debeCambiarPassword: boolean; ultimoLogin: string | null; createdAt: string;
}
interface Temporal { passwordTemporal: string; mensaje: string; }

/** El cupo del plan por rol, tal como lo devuelve GET /equipo/roles. */
interface CupoRol { rolId: number; rol: string; usados: number; maximo: number | null; permitido: boolean; porSucursal: boolean; }

/** Cómo se ve y qué hace cada puesto. Su disponibilidad la manda el plan. */
const ROLES = [
  { rolId: 6, icono: 'tienda', hace: 'Manda en este local: cobra, abre y cierra caja y corrige pedidos. No toca usuarios, sedes ni precios.' },
  { rolId: 2, icono: 'billete', hace: 'Cobra, abre y cierra la caja, emite comprobantes.' },
  { rolId: 4, icono: 'cubiertos', hace: 'Atiende mesas y toma los pedidos.' },
  { rolId: 3, icono: 'chef', hace: 'Ve la pantalla de cocina y marca los platos listos.' },
  { rolId: 5, icono: 'moto', hace: 'Reparte los pedidos y rinde lo cobrado.' },
] as const;

@Component({
  selector: 'vf-equipo-pagina',
  imports: [CommonModule, FormsModule, DatePipe, Icono],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-5xl space-y-5">
      <header class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p class="text-xs font-bold uppercase tracking-[0.16em] text-naranja">{{ s.usuario()?.empresa }}</p>
          <h1 class="titulo-pagina mt-0.5">Tu equipo</h1>
          <p class="subtitulo mt-1.5">Crea las cuentas de tu personal. Cada quien ve solo lo que le toca.</p>
        </div>
        <button class="btn btn-secundario" [disabled]="ocupada()" (click)="cargar()">
          <vf-icono nombre="refrescar" [tam]="18" /> Actualizar
        </button>
      </header>

      @if (error()) { <div role="alert" class="flex items-start gap-3 rounded-2xl border border-peligro/40 bg-peligro/10 px-4 py-3 text-sm font-medium text-peligro"><vf-icono nombre="alerta" class="mt-0.5 shrink-0" />{{ error() }}</div> }
      @if (mensaje()) { <div role="status" class="flex items-start gap-3 rounded-2xl border border-exito/40 bg-exito/10 px-4 py-3 text-sm font-medium text-exito"><vf-icono nombre="check" class="mt-0.5 shrink-0" />{{ mensaje() }}</div> }

      <!-- Cuántas cuentas permite el plan -->
      <div class="tarjeta flex flex-wrap items-center justify-between gap-4 p-4">
        <div class="flex items-center gap-3">
          <span class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-marino">
            <vf-icono nombre="usuarios" [tam]="24" class="text-white" />
          </span>
          <div>
            <p class="font-bold">{{ operativos().length }} cuenta(s) de personal</p>
            <p class="text-sm text-suave">Además de la tuya, que no cuenta para el plan.</p>
          </div>
        </div>
        <button class="btn-grande-naranja" [disabled]="ocupada()" (click)="abrirAlta()">
          <vf-icono nombre="mas" [tam]="22" /> Nueva cuenta
        </button>
      </div>

      <!-- Listado -->
      <div class="grid gap-3">
        @for (m of equipo(); track m.usuarioId) {
          <article class="tarjeta p-4" [class.opacity-60]="!m.activo">
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div class="flex min-w-0 items-center gap-3">
                <span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                      [class.bg-naranja]="m.rolId === 1" [class.bg-marino]="m.rolId !== 1">{{ iniciales(m.nombre) }}</span>
                <div class="min-w-0">
                  <p class="truncate text-[15px] font-bold">{{ m.nombre }}</p>
                  <p class="truncate text-sm text-suave">{{ m.email }}</p>
                  <p class="mt-0.5 flex flex-wrap items-center gap-1.5">
                    <span class="chip" [class.chip-naranja]="m.rolId === 1" [class.chip-neutro]="m.rolId !== 1">{{ m.rol }}</span>
                    @if (m.sucursal) { <span class="chip-neutro">{{ m.sucursal }}</span> }
                    @if (!m.activo) { <span class="chip-peligro">Desactivado</span> }
                    @if (m.bloqueado) { <span class="chip-alerta">Bloqueado</span> }
                    @if (m.debeCambiarPassword) { <span class="chip-info">Clave temporal</span> }
                  </p>
                </div>
              </div>
              <div class="text-right text-xs text-tenue">
                @if (m.ultimoLogin) { Último ingreso {{ m.ultimoLogin | date:'dd/MM HH:mm' }} }
                @else { Todavía no ha entrado }
              </div>
            </div>

            @if (m.rolId === 1) {
              <p class="mt-3 rounded-xl bg-elevada px-3 py-2 text-xs text-suave">
                Esta es la cuenta del Administrador. Para cambiarla, escríbele a VK Software Solutions.
              </p>
            } @else {
              <div class="mt-3 flex flex-wrap gap-2">
                <button class="btn btn-sm btn-secundario" [disabled]="ocupada()" (click)="abrirEdicion(m)">
                  <vf-icono nombre="editar" [tam]="17" /> Editar
                </button>
                <button class="btn btn-sm btn-secundario" [disabled]="ocupada()" (click)="resetear(m)">
                  <vf-icono nombre="llave" [tam]="17" /> Nueva clave
                </button>
                @if (m.bloqueado) {
                  <button class="btn btn-sm btn-secundario border-alerta/50 text-alerta" [disabled]="ocupada()" (click)="desbloquear(m)">
                    <vf-icono nombre="desbloquear" [tam]="17" /> Desbloquear
                  </button>
                }
                <button class="btn btn-sm btn-secundario" [disabled]="ocupada()" (click)="cerrarSesiones(m)">
                  <vf-icono nombre="power" [tam]="17" /> Cerrar sus sesiones
                </button>
                <button class="btn btn-sm btn-secundario" [class.border-peligro]="m.activo" [class.text-peligro]="m.activo"
                        [disabled]="ocupada()" (click)="alternarEstado(m)">
                  <vf-icono [nombre]="m.activo ? 'prohibido' : 'check'" [tam]="17" />
                  {{ m.activo ? 'Desactivar' : 'Reactivar' }}
                </button>
              </div>
            }
          </article>
        }
        @if (!equipo().length && !cargando()) {
          <div class="rounded-2xl border border-dashed border-borde p-10 text-center text-sm text-tenue">
            Todavía no has creado cuentas para tu personal.
          </div>
        }
      </div>

      <!-- Alta y edición -->
      @if (editando(); as m) {
        <div class="fixed inset-0 z-50 flex items-end justify-center bg-tinta/70 backdrop-blur-sm sm:items-center sm:p-4" role="presentation">
          <section class="panel-desplazable w-full max-w-xl rounded-t-3xl bg-superficie p-5 shadow-flotante sm:rounded-3xl"
                   role="dialog" aria-modal="true" aria-labelledby="titulo-equipo">
            <div class="flex items-start justify-between gap-4">
              <div>
                <p class="text-xs font-bold uppercase tracking-wider text-naranja">{{ m.usuarioId ? 'Editar cuenta' : 'Nueva cuenta' }}</p>
                <h2 id="titulo-equipo" class="mt-0.5 text-2xl font-extrabold">{{ m.usuarioId ? m.nombre : 'Alguien de tu equipo' }}</h2>
              </div>
              <button class="btn-icono" (click)="editando.set(null)" aria-label="Cerrar"><vf-icono nombre="x" /></button>
            </div>

            <div class="mt-4">
              <p class="etiqueta">¿Qué hace en el restaurante?</p>
              <div class="grid grid-cols-2 gap-2">
                @for (r of puestos(); track r.rolId) {
                  <button type="button" class="medio-pago" [class.medio-pago-activo]="m.rolId === r.rolId"
                          [disabled]="!!m.usuarioId || (!r.libre && m.rolId !== r.rolId)" (click)="elegirRol(r.rolId)">
                    <vf-icono [nombre]="r.icono" [tam]="26" />
                    <span class="leading-none">{{ r.nombre }}</span>
                    <span class="text-[11px] font-normal text-tenue">{{ r.cupo }}</span>
                  </button>
                }
              </div>
              @if (!puestos().length) {
                <p class="mt-2 text-sm text-suave">Tu plan no incluye personal adicional. Escríbenos para ampliarlo.</p>
              }
              @if (descripcionRol(); as texto) { <p class="mt-2 text-sm text-suave">{{ texto }}</p> }
              @if (m.usuarioId) { <p class="mt-2 text-xs text-tenue">El rol no se cambia: crea otra cuenta si cambió de puesto.</p> }
            </div>

            <label class="mt-4 block"><span class="etiqueta">Nombre completo</span>
              <input class="campo" name="nombre" maxlength="120" [(ngModel)]="m.nombre" placeholder="Ej. Ana Torres" />
            </label>
            <label class="mt-3 block"><span class="etiqueta">Correo con el que entrará</span>
              <input class="campo" name="email" type="email" inputmode="email" maxlength="120" [(ngModel)]="m.email" placeholder="ana@turestaurante.pe" />
            </label>
            <div class="mt-3 grid gap-3 sm:grid-cols-2">
              <label class="block"><span class="etiqueta">DNI <span class="font-medium text-tenue">(opcional)</span></span>
                <input class="campo" name="dni" inputmode="numeric" maxlength="8" [(ngModel)]="m.dni" placeholder="12345678" />
              </label>
              <label class="block"><span class="etiqueta">Celular <span class="font-medium text-tenue">(opcional)</span></span>
                <input class="campo" name="telefono" inputmode="tel" maxlength="20" [(ngModel)]="m.telefono" placeholder="987654321" />
              </label>
            </div>

            @if (s.sucursales().length > 1) {
              <div class="mt-3">
                <p class="etiqueta">¿En qué local trabaja?</p>
                <div class="grid gap-2 sm:grid-cols-2">
                  @for (suc of s.sucursales(); track suc.sucursalId) {
                    <button type="button" class="opcion" [class.opcion-activa]="m.sucursalId === suc.sucursalId"
                            (click)="m.sucursalId = suc.sucursalId">{{ suc.nombre }}</button>
                  }
                </div>
              </div>
            }

            <p class="mt-4 rounded-xl bg-elevada p-3 text-xs text-suave">
              Se crea con una contraseña temporal que te mostraremos. La persona la cambia en su primer ingreso.
            </p>

            <div class="sticky bottom-0 -mx-5 mt-5 flex justify-end gap-2 border-t border-borde bg-superficie px-5 pb-1 pt-4">
              <button type="button" class="btn-grande-borde" (click)="editando.set(null)">Cancelar</button>
              <button type="button" class="btn-grande-naranja" [disabled]="ocupada() || !completo()" (click)="guardar()">
                {{ m.usuarioId ? 'Guardar cambios' : 'Crear cuenta' }}
              </button>
            </div>
          </section>
        </div>
      }
    </section>
  `,
})
export class EquipoPagina {
  readonly s = inject(SesionService);
  private readonly http = inject(HttpClient);
  private readonly ui = inject(Ui);

  readonly ROLES = ROLES;
  readonly equipo = signal<Miembro[]>([]);
  readonly cupos = signal<CupoRol[]>([]);
  readonly cargando = signal(false);
  readonly ocupada = signal(false);
  readonly error = signal<string | null>(null);
  readonly mensaje = signal<string | null>(null);
  readonly editando = signal<Partial<Miembro> | null>(null);

  readonly operativos = computed(() => this.equipo().filter(m => m.rolId !== 1));

  /**
   * Los puestos que el plan permite contratar, en el orden en que se muestran.
   * El cupo sale de la API (una sola cuenta con la ficha del SuperAdmin) y lo
   * que esté lleno se ve deshabilitado antes de intentarlo.
   */
  readonly puestos = computed(() => this.cupos()
    .filter(c => c.permitido)
    .map(c => {
      const def = ROLES.find(r => r.rolId === c.rolId);
      const tope = c.maximo ?? 0;
      return {
        rolId: c.rolId, nombre: c.rol, icono: def?.icono ?? 'usuario',
        libre: !tope || c.usados < tope,
        cupo: !tope ? 'sin tope' : `${c.usados}/${tope}${c.porSucursal ? ' por local' : ''}`,
      };
    })
    .sort((a, b) => ROLES.findIndex(r => r.rolId === a.rolId) - ROLES.findIndex(r => r.rolId === b.rolId)));

  constructor() {
    effect(() => {
      if (this.s.sucursalActivaId() != null) void this.cargar();
    });
  }

  iniciales(nombre: string): string {
    return nombre.split(' ').filter(Boolean).slice(0, 2).map(p => p[0].toUpperCase()).join('');
  }

  descripcionRol(): string | null {
    return ROLES.find(r => r.rolId === this.editando()?.rolId)?.hace ?? null;
  }

  elegirRol(rolId: number): void {
    const m = this.editando();
    if (!m || m.usuarioId) return;
    this.editando.set({ ...m, rolId });
  }

  completo(): boolean {
    const m = this.editando();
    return !!m?.rolId && (m.nombre ?? '').trim().length >= 3 && (m.email ?? '').trim().includes('@');
  }

  abrirAlta(): void {
    this.error.set(null); this.mensaje.set(null);
    this.editando.set({
      nombre: '', email: '', dni: null, telefono: null,
      rolId: this.puestos().find(p => p.libre)?.rolId ?? this.puestos()[0]?.rolId,
      sucursalId: this.s.sucursalActivaId() ?? null,
    });
  }

  abrirEdicion(m: Miembro): void {
    this.error.set(null); this.mensaje.set(null);
    this.editando.set({ ...m });
  }

  async cargar(): Promise<void> {
    this.cargando.set(true);
    this.error.set(null);
    try {
      const [equipo, cupos] = await Promise.all([
        firstValueFrom(this.http.get<Miembro[]>(`${environment.api}/equipo`)),
        firstValueFrom(this.http.get<CupoRol[]>(`${environment.api}/equipo/roles`)),
      ]);
      this.equipo.set(equipo);
      this.cupos.set(cupos);
    } catch (e) {
      this.error.set(mensajeError(e));
    } finally {
      this.cargando.set(false);
    }
  }

  async guardar(): Promise<void> {
    const m = this.editando();
    if (!m || !this.completo()) return;
    const cuerpo = {
      nombre: (m.nombre ?? '').trim(), email: (m.email ?? '').trim(),
      dni: m.dni || null, telefono: m.telefono || null,
      rolId: m.rolId, sucursalId: m.sucursalId ?? null, password: null,
    };
    await this.ejecutar(async () => {
      if (m.usuarioId) {
        this.equipo.set(await firstValueFrom(this.http.put<Miembro[]>(`${environment.api}/equipo/${m.usuarioId}`, cuerpo)));
        this.mensaje.set('Datos actualizados.');
      } else {
        const r = await firstValueFrom(this.http.post<{ temporal: Temporal | null; usuarios: Miembro[] }>(
          `${environment.api}/equipo`, cuerpo));
        this.equipo.set(r.usuarios);
        this.mensaje.set(`Cuenta creada para ${cuerpo.nombre}.`);
        if (r.temporal) await this.mostrarClave(cuerpo.nombre, r.temporal.passwordTemporal);
      }
      this.editando.set(null);
    });
  }

  async resetear(m: Miembro): Promise<void> {
    if (!await this.ui.confirmar('Generar nueva contraseña',
      `Se reemplazará la clave de <b>${esc(m.nombre)}</b> y tendrá que cambiarla al entrar.`, 'Generar')) return;
    await this.ejecutar(async () => {
      const t = await firstValueFrom(this.http.post<Temporal>(`${environment.api}/equipo/${m.usuarioId}/reset-password`, {}));
      await this.mostrarClave(m.nombre, t.passwordTemporal);
      await this.cargar();
    });
  }

  async alternarEstado(m: Miembro): Promise<void> {
    const texto = m.activo
      ? `<b>${esc(m.nombre)}</b> no podrá entrar hasta que lo reactives, y libera su cupo del plan.`
      : `<b>${esc(m.nombre)}</b> podrá entrar de nuevo con su cuenta.`;
    if (!await this.ui.confirmar(m.activo ? 'Desactivar cuenta' : 'Reactivar cuenta', texto, 'Confirmar', m.activo)) return;
    await this.ejecutar(async () => {
      this.equipo.set(await firstValueFrom(
        this.http.post<Miembro[]>(`${environment.api}/equipo/${m.usuarioId}/estado`, { activo: !m.activo })));
      this.mensaje.set(m.activo ? `${m.nombre} quedó desactivado.` : `${m.nombre} está activo otra vez.`);
    });
  }

  async desbloquear(m: Miembro): Promise<void> {
    await this.ejecutar(async () => {
      this.equipo.set(await firstValueFrom(
        this.http.post<Miembro[]>(`${environment.api}/equipo/${m.usuarioId}/desbloquear`, {})));
      this.mensaje.set(`${m.nombre} puede volver a intentar su ingreso.`);
    });
  }

  async cerrarSesiones(m: Miembro): Promise<void> {
    if (!await this.ui.confirmar('Cerrar sus sesiones',
      `<b>${esc(m.nombre)}</b> saldrá de todos los equipos donde esté con su cuenta.`, 'Cerrar sesiones')) return;
    await this.ejecutar(async () => {
      this.equipo.set(await firstValueFrom(
        this.http.post<Miembro[]>(`${environment.api}/equipo/${m.usuarioId}/cerrar-sesiones`, {})));
      this.mensaje.set(`Se cerraron las sesiones de ${m.nombre}.`);
    });
  }

  /** La contraseña temporal se muestra UNA vez: después ya no se puede recuperar. */
  private mostrarClave(nombre: string, clave: string): Promise<void> {
    return this.ui.mostrarClave(nombre, clave,
      'Entrégasela ahora: no se vuelve a mostrar. La cambiará en su primer ingreso.');
  }

  private async ejecutar(accion: () => Promise<void>): Promise<void> {
    this.ocupada.set(true);
    this.error.set(null);
    this.mensaje.set(null);
    try { await accion(); }
    catch (e) { this.error.set(mensajeError(e)); }
    finally { this.ocupada.set(false); }
  }
}
