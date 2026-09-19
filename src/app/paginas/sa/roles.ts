import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { MatrizPermisos, Permiso, Rol } from '../../core/modelos';
import { SaApi } from '../../core/sa-api';
import { Ui, mensajeError } from '../../core/ui';
import { Icono } from '../../shared/icono';

const ICONO_ROL: Record<number, string> = { 1: 'corona', 2: 'billete', 3: 'chef', 4: 'bandeja', 5: 'moto' };
// Deben coincidir con CatalogoService.PermisosDeDinero (la API es la que manda).
const PERMISOS_DINERO = ['VER_MONTOS', 'COBRAR', 'CAJA_ABRIR_CERRAR', 'CAJA_ARQUEO', 'CAJA_EGRESOS', 'NOTA_VENTA_EMITIR', 'FACTURA_EMITIR'];
const MINIMOS_ADMIN = ['USUARIOS_GESTIONAR', 'SUCURSALES_GESTIONAR', 'CONFIGURACION'];

@Component({
  selector: 'vf-roles',
  imports: [Icono],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mb-6">
      <h1 class="titulo-pagina">Roles y permisos</h1>
      <p class="subtitulo">Qué puede hacer cada rol en todos los restaurantes. En cada empresa, además, se recorta por las funciones de su plan.</p>
    </div>

    <!-- Selector de rol -->
    <div class="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      @for (r of matriz()?.roles ?? []; track r.rolId) {
        <button type="button" class="tarjeta flex min-h-[7rem] flex-col items-start gap-1 p-4 text-left transition-all active:scale-[0.98]"
                [class]="rolId() === r.rolId ? '!border-vino ring-2 ring-vino' : ''" (click)="elegir(r)">
          <div class="flex w-full items-center justify-between">
            <span class="flex h-10 w-10 items-center justify-center rounded-xl" [class]="rolId() === r.rolId ? 'bg-vino text-oro-claro' : 'bg-elevada text-oro'"><vf-icono [nombre]="icono(r.rolId)" /></span>
            <span class="text-xs text-tenue">{{ r.usuariosActivos }} activos</span>
          </div>
          <div class="mt-1 font-bold">{{ r.nombre }}</div>
          <div class="flex flex-wrap gap-1">
            @if (r.veDinero) { <span class="chip-exito">Maneja dinero</span> } @else { <span class="chip-neutro">No ve dinero</span> }
            @if (!r.ocupaCupo) { <span class="chip-oro">No ocupa cupo</span> }
          </div>
        </button>
      }
    </div>

    @if (rol(); as r) {
      <div class="tarjeta mb-4 flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <p class="flex-1 text-sm text-suave"><b class="text-texto">{{ r.nombre }}:</b> {{ r.descripcion }}</p>
        <div class="flex gap-2">
          <button type="button" class="btn-secundario" [disabled]="!cambios()" (click)="descartar()">Descartar</button>
          <button type="button" class="btn-primario" [disabled]="!cambios() || guardando()" (click)="guardar()"><vf-icono nombre="check" [tam]="18" /> Guardar ({{ cambios() }})</button>
        </div>
      </div>

      <div class="grid gap-4 lg:grid-cols-2">
        @for (m of modulos(); track m) {
          <div class="tarjeta p-4">
            <h2 class="mb-2 text-xs font-bold uppercase tracking-wide text-tenue">{{ m }}</h2>
            @for (p of permisosDe(m); track p.permisoId) {
              <div class="flex min-h-toque items-center gap-3 border-b border-borde/60 py-2.5 last:border-0">
                <div class="min-w-0 flex-1">
                  <div class="flex flex-wrap items-center gap-2 text-sm font-semibold">{{ p.nombre }}
                    @if (p.funcionNombre) { <span class="chip-info">Plan: {{ p.funcionNombre }}</span> }
                  </div>
                  <div class="text-xs text-suave">{{ p.descripcion }}</div>
                </div>
                @if (bloqueado(p)) {
                  <span class="flex h-8 w-14 items-center justify-center text-tenue" [title]="motivoBloqueo(p)"><vf-icono nombre="candado" [tam]="18" /></span>
                } @else {
                  <button type="button" role="switch" class="interruptor" [attr.aria-checked]="marcado(p)" (click)="alternar(p)" [attr.aria-label]="p.nombre"><span></span></button>
                }
              </div>
            }
          </div>
        }
      </div>
    }
  `,
})
export class Roles implements OnInit {
  private api = inject(SaApi);
  private ui = inject(Ui);

  matriz = signal<MatrizPermisos | null>(null);
  rolId = signal(1);
  seleccion = signal(new Set<number>());
  guardando = signal(false);

  rol = computed(() => this.matriz()?.roles.find(r => r.rolId === this.rolId()) ?? null);
  modulos = computed(() => [...new Set(this.matriz()?.permisos.map(p => p.modulo) ?? [])]);
  original = computed(() => new Set(this.matriz()?.permisos.filter(p => p.roles.includes(this.rolId())).map(p => p.permisoId) ?? []));
  cambios = computed(() => {
    const a = this.original(), b = this.seleccion();
    return [...a].filter(x => !b.has(x)).length + [...b].filter(x => !a.has(x)).length;
  });

  icono = (r: number) => ICONO_ROL[r] ?? 'usuario';
  permisosDe = (m: string) => this.matriz()?.permisos.filter(p => p.modulo === m) ?? [];
  marcado = (p: Permiso) => this.seleccion().has(p.permisoId);
  bloqueado = (p: Permiso) => (!this.rol()?.veDinero && PERMISOS_DINERO.includes(p.codigo)) || (this.rolId() === 1 && MINIMOS_ADMIN.includes(p.codigo));
  motivoBloqueo = (p: Permiso) => (this.rolId() === 1 ? 'El Administrador siempre conserva este permiso' : 'Este rol no maneja dinero');

  async ngOnInit(): Promise<void> {
    try { this.aplicar(await this.api.permisos()); } catch (e) { this.ui.error(e); }
  }

  private aplicar(m: MatrizPermisos): void {
    this.matriz.set(m);
    this.seleccion.set(new Set(this.original()));
  }

  async elegir(r: Rol): Promise<void> {
    if (this.cambios() && !(await this.ui.confirmar('Cambios sin guardar', 'Si cambias de rol se pierden los cambios.', 'Descartar y cambiar'))) return;
    this.rolId.set(r.rolId);
    this.seleccion.set(new Set(this.original()));
  }

  alternar(p: Permiso): void {
    const s = new Set(this.seleccion());
    s.has(p.permisoId) ? s.delete(p.permisoId) : s.add(p.permisoId);
    this.seleccion.set(s);
  }

  descartar(): void { this.seleccion.set(new Set(this.original())); }

  async guardar(): Promise<void> {
    this.guardando.set(true);
    try {
      this.aplicar(await this.api.guardarPermisos(this.rolId(), [...this.seleccion()]));
      this.ui.exito(`Permisos de ${this.rol()?.nombre} guardados`);
    } catch (e) {
      this.ui.error(mensajeError(e));
    } finally {
      this.guardando.set(false);
    }
  }
}
