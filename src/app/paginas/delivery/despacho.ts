import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Envio, EstadoEnvio } from '../../core/modelos';
import { SesionService } from '../../core/sesion';
import { Ui, esc, mensajeError } from '../../core/ui';
import { Icono } from '../../shared/icono';

interface Repartidor { usuarioId: number; nombre: string; rol: string; rolId: number; activo: boolean; }

const COLUMNAS: { estado: EstadoEnvio; titulo: string; icono: string; color: string }[] = [
  { estado: 'PENDIENTE', titulo: 'Por asignar', icono: 'caja', color: 'text-alerta' },
  { estado: 'ASIGNADO', titulo: 'Esperando salida', icono: 'reloj', color: 'text-marino' },
  { estado: 'EN_RUTA', titulo: 'En ruta', icono: 'moto', color: 'text-naranja' },
];

/**
 * La pizarra del despacho.
 *
 * En celular es una lista de tarjetas con el paso siguiente a la vista; en una
 * tablet o una PC se abre en tres columnas, que es como el encargado mira el
 * turno completo de un vistazo.
 */
@Component({
  selector: 'vf-despacho',
  imports: [CommonModule, FormsModule, Icono],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <p class="text-xs font-bold uppercase tracking-wider text-naranja">Delivery</p>
        <h1 class="titulo-pagina">Despacho</h1>
        <p class="subtitulo">Lo que falta salir y lo que ya está en la calle.</p>
      </div>
      <button type="button" class="btn-secundario btn-sm" (click)="cargar()">
        <vf-icono nombre="refrescar" [tam]="18" [class.animate-spin]="cargando()" /> Actualizar
      </button>
    </div>

    @if (error(); as e) { <div class="mb-4 rounded-xl bg-peligro/10 p-3 text-sm text-peligro">{{ e }}</div> }
    @if (mensaje(); as m) { <div class="mb-4 rounded-xl bg-exito/10 p-3 text-sm text-exito">{{ m }}</div> }

    @if (!cargando() && !envios().length) {
      <div class="tarjeta flex flex-col items-center gap-3 p-12 text-center">
        <vf-icono nombre="moto" [tam]="48" class="text-tenue" />
        <p class="text-lg font-bold">No hay envíos en curso</p>
        <p class="text-sm text-suave">Los pedidos a domicilio aparecen acá apenas se toman.</p>
      </div>
    } @else {
      <div class="grid gap-4 lg:grid-cols-3">
        @for (col of COLUMNAS; track col.estado) {
          <section>
            <div class="mb-2 flex items-center gap-2 px-1">
              <vf-icono [nombre]="col.icono" [tam]="19" [class]="col.color" />
              <h2 class="text-sm font-bold uppercase tracking-wide">{{ col.titulo }}</h2>
              <span class="chip-neutro">{{ deEstado(col.estado).length }}</span>
            </div>

            @if (!deEstado(col.estado).length) {
              <p class="rounded-2xl border border-dashed border-borde px-4 py-6 text-center text-sm text-tenue">
                Nada por acá
              </p>
            }

            <div class="grid gap-3">
              @for (e of deEstado(col.estado); track e.envioId) {
                <article class="tarjeta p-4">
                  <div class="flex items-start justify-between gap-2">
                    <div class="min-w-0">
                      <div class="truncate font-extrabold">{{ e.cliente }}</div>
                      <div class="text-xs text-tenue">#{{ e.pedidoId }} · {{ e.creadoEn | date:'HH:mm' }}</div>
                    </div>
                    @if (e.momentoPago === 'CONTRA_ENTREGA') {
                      <span class="chip-naranja shrink-0">Cobra S/ {{ e.saldoPendiente | number:'1.2-2' }}</span>
                    } @else {
                      <span class="chip-exito shrink-0">Pagado</span>
                    }
                  </div>

                  <p class="mt-2 text-sm leading-snug">{{ e.direccion }}</p>
                  @if (e.referencia) { <p class="mt-0.5 text-xs text-suave">{{ e.referencia }}</p> }
                  <p class="mt-1 text-xs text-tenue">
                    {{ e.zona ?? 'Sin zona' }} · envío S/ {{ e.costoEnvio | number:'1.2-2' }}
                  </p>

                  @if (e.repartidor) {
                    <div class="mt-3 flex items-center gap-2 rounded-xl bg-elevada px-3 py-2 text-sm">
                      <vf-icono nombre="moto" [tam]="17" class="text-naranja" />
                      <span class="flex-1 truncate font-semibold">{{ e.repartidor }}</span>
                      @if (e.salidaEn) { <span class="text-xs text-tenue">salió {{ e.salidaEn | date:'HH:mm' }}</span> }
                    </div>
                  }

                  <div class="mt-3 grid gap-2"
                       [class.grid-cols-2]="e.estado !== 'EN_RUTA'">
                    @if (e.estado !== 'EN_RUTA') {
                      <button type="button" class="btn-naranja btn-sm" [disabled]="ocupada()" (click)="abrirAsignar(e)">
                        <vf-icono nombre="moto" [tam]="17" />
                        {{ e.repartidor ? 'Cambiar' : 'Asignar' }}
                      </button>
                    }
                    <button type="button" class="btn-secundario btn-sm" [disabled]="ocupada()" (click)="cancelar(e)">
                      <vf-icono nombre="x" [tam]="17" /> No se entregó
                    </button>
                  </div>
                </article>
              }
            </div>
          </section>
        }
      </div>
    }

    <!-- Elegir repartidor: hoja grande, para tocar con el dedo. -->
    @if (asignando(); as e) {
      <div class="fixed inset-0 z-50 flex items-end justify-center bg-tinta/60 backdrop-blur-[2px] sm:items-center"
           (click)="asignando.set(null)">
        <div class="w-full max-w-md rounded-t-3xl bg-superficie p-5 shadow-flotante sm:rounded-3xl" (click)="$event.stopPropagation()">
          <div class="mx-auto mb-4 h-1.5 w-12 rounded-full bg-borde sm:hidden"></div>
          <h2 class="text-xl font-extrabold">¿Quién lo lleva?</h2>
          <p class="mt-1 text-sm text-suave">{{ e.cliente }} · {{ e.direccion }}</p>

          @if (!repartidores().length) {
            <p class="mt-4 rounded-xl bg-alerta/10 p-3 text-sm text-alerta">
              No hay nadie con rol Delivery en esta sucursal. Créalo en Tu equipo.
            </p>
          }

          <div class="mt-4 grid gap-2">
            @for (r of repartidores(); track r.usuarioId) {
              <button type="button" class="btn-grande-borde justify-start !px-4"
                      [class.!border-naranja]="e.repartidorId === r.usuarioId"
                      [disabled]="ocupada()" (click)="asignar(e, r)">
                <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-marino text-sm font-bold text-white">
                  {{ iniciales(r.nombre) }}
                </span>
                <span class="flex-1 truncate text-left">{{ r.nombre }}</span>
                <span class="chip-neutro">{{ cargaDe(r.usuarioId) }} en curso</span>
              </button>
            }
          </div>

          <button type="button" class="btn-secundario mt-4 w-full" (click)="asignando.set(null)">Cancelar</button>
        </div>
      </div>
    }
  `,
})
export class DespachoPagina {
  readonly s = inject(SesionService);
  private readonly http = inject(HttpClient);
  private readonly ui = inject(Ui);

  readonly COLUMNAS = COLUMNAS;
  readonly envios = signal<Envio[]>([]);
  readonly repartidores = signal<Repartidor[]>([]);
  readonly cargando = signal(false);
  readonly ocupada = signal(false);
  readonly error = signal<string | null>(null);
  readonly mensaje = signal<string | null>(null);
  readonly asignando = signal<Envio | null>(null);

  constructor() {
    effect(() => {
      if (this.s.sucursalActivaId() != null) void this.cargar();
    });
  }

  deEstado = (estado: EstadoEnvio) => this.envios().filter(e => e.estado === estado);
  cargaDe = (usuarioId: number) =>
    this.envios().filter(e => e.repartidorId === usuarioId && e.estado !== 'PENDIENTE').length;
  iniciales = (n: string) => n.split(' ').filter(Boolean).slice(0, 2).map(p => p[0].toUpperCase()).join('');

  async cargar(): Promise<void> {
    this.cargando.set(true);
    this.error.set(null);
    try {
      const [envios, equipo] = await Promise.all([
        firstValueFrom(this.http.get<Envio[]>(`${environment.api}/delivery/pendientes`)),
        // Si no gestiona usuarios igual puede despachar: la lista queda vacía y
        // se asigna desde la ficha. No se rompe por un permiso que no tiene.
        firstValueFrom(this.http.get<Repartidor[]>(`${environment.api}/equipo`)).catch(() => [] as Repartidor[]),
      ]);
      this.envios.set(envios);
      this.repartidores.set(equipo.filter(u => u.rolId === 5 && u.activo));
    } catch (e) {
      this.error.set(mensajeError(e));
    } finally {
      this.cargando.set(false);
    }
  }

  abrirAsignar(e: Envio): void {
    this.error.set(null);
    this.asignando.set(e);
  }

  async asignar(e: Envio, r: Repartidor): Promise<void> {
    await this.ejecutar(async () => {
      await firstValueFrom(this.http.post<Envio>(`${environment.api}/delivery/${e.envioId}/asignar`,
        { repartidorId: r.usuarioId }));
      this.asignando.set(null);
      this.mensaje.set(`${r.nombre} lleva el pedido de ${e.cliente}.`);
      await this.cargar();
    });
  }

  async cancelar(e: Envio): Promise<void> {
    if (!await this.ui.confirmar('No se entregó',
      `El envío de <b>${esc(e.cliente)}</b> queda cerrado sin entregar. Esto no se deshace.`,
      'Sí, cerrarlo', true)) return;
    const motivo = await this.ui.pedirTexto('No se entregó', '¿Qué pasó?', 'Registrar');
    if (!motivo) return;
    await this.ejecutar(async () => {
      await firstValueFrom(this.http.post<Envio>(`${environment.api}/delivery/${e.envioId}/no-entregado`, { motivo }));
      this.mensaje.set('Queda registrado con su motivo.');
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
