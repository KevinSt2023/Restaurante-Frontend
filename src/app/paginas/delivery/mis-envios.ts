import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Envio } from '../../core/modelos';
import { SesionService } from '../../core/sesion';
import { Ui, mensajeError } from '../../core/ui';
import { Icono } from '../../shared/icono';

const MEDIOS = [
  { codigo: 'EFECTIVO', texto: 'Efectivo', icono: 'billete' },
  { codigo: 'YAPE', texto: 'Yape', icono: 'telefono' },
  { codigo: 'PLIN', texto: 'Plin', icono: 'telefono' },
  { codigo: 'TARJETA', texto: 'Tarjeta', icono: 'tarjeta' },
] as const;

/**
 * La pantalla del repartidor, en su celular.
 *
 * Pensada para una mano y en movimiento: una tarjeta por envío, un botón grande
 * por paso y nada más. Sin tablas, sin filtros, sin menús. Lo único que tiene
 * que decidir es "salgo" y "entregué", y para eso no debería tener que leer.
 */
@Component({
  selector: 'vf-mis-envios',
  imports: [CommonModule, FormsModule, Icono],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto max-w-lg">
      <div class="mb-4 flex items-end justify-between gap-3">
        <div>
          <p class="text-xs font-bold uppercase tracking-wider text-naranja">Reparto</p>
          <h1 class="text-2xl font-extrabold">Mis envíos</h1>
        </div>
        <button type="button" class="btn-icono border border-borde" (click)="cargar()" aria-label="Actualizar">
          <vf-icono nombre="refrescar" [tam]="20" [class.animate-spin]="cargando()" />
        </button>
      </div>

      @if (error(); as e) { <div class="mb-4 rounded-xl bg-peligro/10 p-3 text-sm text-peligro">{{ e }}</div> }
      @if (mensaje(); as m) { <div class="mb-4 rounded-xl bg-exito/10 p-3 text-sm text-exito">{{ m }}</div> }

      @if (!cargando() && !envios().length) {
        <div class="tarjeta flex flex-col items-center gap-3 p-10 text-center">
          <vf-icono nombre="moto" [tam]="44" class="text-tenue" />
          <p class="text-lg font-bold">No tienes envíos</p>
          <p class="text-sm text-suave">Cuando te asignen uno, aparece acá.</p>
        </div>
      }

      <!-- Salir con varios de una: lo que pidió el dueño. -->
      @if (porSalir().length) {
        <button type="button" class="btn-grande-naranja mb-4 w-full" [disabled]="ocupada()" (click)="salir()">
          <vf-icono nombre="moto" [tam]="26" />
          Salir con {{ porSalir().length }} {{ porSalir().length === 1 ? 'envío' : 'envíos' }}
        </button>
      }

      <div class="grid gap-3">
        @for (e of envios(); track e.envioId) {
          <article class="tarjeta overflow-hidden">
            <div class="flex items-start gap-3 p-4">
              <span class="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                    [class]="e.estado === 'EN_RUTA' ? 'bg-naranja/15 text-naranja' : 'bg-marino/10 text-marino'">
                <vf-icono [nombre]="e.estado === 'EN_RUTA' ? 'moto' : 'caja'" [tam]="22" />
              </span>
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="truncate text-lg font-extrabold">{{ e.cliente }}</span>
                  <span [class]="e.estado === 'EN_RUTA' ? 'chip-naranja' : 'chip-neutro'">
                    {{ e.estado === 'EN_RUTA' ? 'En ruta' : 'Por salir' }}
                  </span>
                </div>
                <p class="mt-0.5 text-[15px] leading-snug">{{ e.direccion }}</p>
                @if (e.referencia) {
                  <p class="mt-1 flex items-start gap-1.5 text-sm text-suave">
                    <vf-icono nombre="info" [tam]="15" class="mt-0.5 shrink-0 text-tenue" />
                    <span>{{ e.referencia }}</span>
                  </p>
                }
                @if (e.zona) { <p class="mt-1 text-xs text-tenue">{{ e.zona }} · pedido #{{ e.pedidoId }}</p> }
              </div>
            </div>

            <!-- Cuánto hay que cobrar, bien grande: es lo que el repartidor mira. -->
            <div class="flex items-center justify-between gap-3 border-t border-borde bg-elevada px-4 py-3">
              @if (e.momentoPago === 'CONTRA_ENTREGA') {
                <div>
                  <div class="text-xs font-semibold uppercase tracking-wide text-naranja">Cobrar</div>
                  <div class="text-2xl font-extrabold leading-tight">{{ e.saldoPendiente | currency:'PEN':'symbol-narrow':'1.2-2' }}</div>
                </div>
              } @else {
                <div class="flex items-center gap-2 text-exito">
                  <vf-icono nombre="check" [tam]="20" />
                  <span class="font-bold">Ya pagó en tienda</span>
                </div>
              }
              <a class="btn-icono border border-borde" [href]="'tel:' + e.telefono" [attr.aria-label]="'Llamar a ' + e.cliente">
                <vf-icono nombre="telefono" [tam]="20" />
              </a>
            </div>

            <!-- Un solo paso visible por vez. -->
            @if (e.estado === 'EN_RUTA') {
              <div class="grid grid-cols-[1fr_auto] gap-2 p-3">
                <button type="button" class="btn-grande-exito" [disabled]="ocupada()" (click)="abrirEntrega(e)">
                  <vf-icono nombre="check" [tam]="24" /> Entregué
                </button>
                <button type="button" class="btn-grande-borde !px-4" [disabled]="ocupada()" (click)="noEntregado(e)"
                        aria-label="No se pudo entregar">
                  <vf-icono nombre="x" [tam]="24" />
                </button>
              </div>
            }
          </article>
        }
      </div>
    </div>

    <!-- Hoja de cobro: sube desde abajo, como en una app. -->
    @if (entregando(); as e) {
      <div class="fixed inset-0 z-50 flex items-end justify-center bg-tinta/60 backdrop-blur-[2px] sm:items-center"
           (click)="entregando.set(null)">
        <div class="w-full max-w-lg rounded-t-3xl bg-superficie p-5 shadow-flotante sm:rounded-3xl" (click)="$event.stopPropagation()">
          <div class="mx-auto mb-4 h-1.5 w-12 rounded-full bg-borde sm:hidden"></div>
          <h2 class="text-xl font-extrabold">Entregar a {{ e.cliente }}</h2>

          @if (e.momentoPago === 'CONTRA_ENTREGA') {
            <p class="mt-1 text-sm text-suave">¿Con qué te pagaron?</p>
            <div class="mt-3 grid grid-cols-2 gap-2">
              @for (m of MEDIOS; track m.codigo) {
                <button type="button" class="medio-pago" [class.medio-pago-activo]="medio() === m.codigo"
                        (click)="medio.set(m.codigo)">
                  <vf-icono [nombre]="m.icono" [tam]="26" />
                  <span class="leading-none">{{ m.texto }}</span>
                </button>
              }
            </div>
            <label class="mt-4 block">
              <span class="etiqueta">¿Cuánto cobraste?</span>
              <input class="campo cifra" type="number" inputmode="decimal" step="0.01" min="0"
                     [(ngModel)]="monto" name="monto" />
            </label>
            <p class="mt-1 text-xs text-tenue">La cuenta debe {{ e.saldoPendiente | currency:'PEN':'symbol-narrow':'1.2-2' }}.</p>
          } @else {
            <p class="mt-2 text-sm text-suave">Ya pagó en tienda: solo confirma la entrega.</p>
          }

          <div class="mt-5 grid grid-cols-2 gap-2">
            <button type="button" class="btn-grande-borde" (click)="entregando.set(null)">Cancelar</button>
            <button type="button" class="btn-grande-exito" [disabled]="ocupada() || !puedeEntregar()" (click)="entregar()">
              <vf-icono nombre="check" [tam]="24" /> Entregar
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class MisEnviosPagina {
  readonly s = inject(SesionService);
  private readonly http = inject(HttpClient);
  private readonly ui = inject(Ui);

  readonly MEDIOS = MEDIOS;
  readonly envios = signal<Envio[]>([]);
  readonly cargando = signal(false);
  readonly ocupada = signal(false);
  readonly error = signal<string | null>(null);
  readonly mensaje = signal<string | null>(null);
  readonly entregando = signal<Envio | null>(null);
  readonly medio = signal<string>('EFECTIVO');
  monto: number | null = null;

  readonly porSalir = computed(() => this.envios().filter(e => e.estado === 'ASIGNADO'));

  constructor() {
    effect(() => {
      if (this.s.sucursalActivaId() != null) void this.cargar();
    });
  }

  puedeEntregar(): boolean {
    const e = this.entregando();
    if (!e) return false;
    if (e.momentoPago !== 'CONTRA_ENTREGA') return true;
    return !!this.medio() && (this.monto ?? 0) > 0;
  }

  abrirEntrega(e: Envio): void {
    this.error.set(null);
    this.medio.set('EFECTIVO');
    // Llega con el monto exacto puesto: lo normal es que cobre lo que debe.
    this.monto = e.momentoPago === 'CONTRA_ENTREGA' ? e.saldoPendiente : null;
    this.entregando.set(e);
  }

  async cargar(): Promise<void> {
    this.cargando.set(true);
    this.error.set(null);
    try {
      this.envios.set(await firstValueFrom(this.http.get<Envio[]>(`${environment.api}/delivery/mis-envios`)));
    } catch (e) {
      this.error.set(mensajeError(e));
    } finally {
      this.cargando.set(false);
    }
  }

  async salir(): Promise<void> {
    const ids = this.porSalir().map(e => e.envioId);
    await this.ejecutar(async () => {
      this.envios.set(await firstValueFrom(this.http.post<Envio[]>(`${environment.api}/delivery/salir`, ids)));
      this.mensaje.set(`Saliste con ${ids.length} ${ids.length === 1 ? 'envío' : 'envíos'}. Buen viaje.`);
    });
  }

  async entregar(): Promise<void> {
    const e = this.entregando();
    if (!e || !this.puedeEntregar()) return;
    const cuerpo = e.momentoPago === 'CONTRA_ENTREGA'
      ? { medio: this.medio(), monto: Number(this.monto) }
      : {};
    await this.ejecutar(async () => {
      await firstValueFrom(this.http.post<Envio>(`${environment.api}/delivery/${e.envioId}/entregar`, cuerpo));
      this.entregando.set(null);
      this.mensaje.set(`Entregado a ${e.cliente}.`);
      await this.cargar();
    });
  }

  async noEntregado(e: Envio): Promise<void> {
    const motivo = await this.ui.pedirTexto('No se pudo entregar',
      `¿Qué pasó con el envío de ${e.cliente}?`, 'Registrar');
    if (!motivo) return;
    await this.ejecutar(async () => {
      await firstValueFrom(this.http.post<Envio>(`${environment.api}/delivery/${e.envioId}/no-entregado`, { motivo }));
      this.mensaje.set('Queda registrado. Avisa en el local.');
      await this.cargar();
    });
  }

  private async ejecutar(accion: () => Promise<void>): Promise<void> {
    this.ocupada.set(true);
    this.error.set(null);
    this.mensaje.set(null);
    try {
      await accion();
    } catch (e) {
      this.error.set(mensajeError(e));
    } finally {
      this.ocupada.set(false);
    }
  }
}
