import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { CajaLista, SesionCajaResumen } from '../core/modelos';
import { SesionService } from '../core/sesion';
import { Icono } from '../shared/icono';

interface MedioCierre { medio: string; monto: number; operaciones: number; }
interface MovimientoCaja {
  cajaMovimientoId: number; sesionCajaId: number; tipo: 'INGRESO' | 'EGRESO';
  monto: number; motivo: string; registradoPor: number; registradoEn: string;
}
interface Arqueo {
  sesion: SesionCajaResumen; fondoInicial: number; ventasEfectivo: number; devolucionesEfectivo: number;
  ingresosManuales: number; egresosManuales: number; efectivoEsperado: number;
  ventasPorMedio: MedioCierre[]; movimientos: MovimientoCaja[];
}

/** Billetes y monedas que circulan en Perú, de mayor a menor. */
const DENOMINACIONES = [200, 100, 50, 20, 10, 5, 2, 1, 0.5, 0.2, 0.1] as const;

@Component({
  selector: 'vf-caja-pagina',
  imports: [CommonModule, FormsModule, CurrencyPipe, DatePipe, Icono],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-5xl space-y-5">
      <header>
        <p class="text-xs font-bold uppercase tracking-[0.16em] text-naranja">{{ sucursal() }}</p>
        <h1 class="titulo-pagina mt-0.5">Caja y turnos</h1>
        <p class="subtitulo mt-1.5">Cada turno guarda quién lo abrió, quién lo cerró y cualquier diferencia.</p>
      </header>

      @if (error()) { <div role="alert" class="flex items-start gap-3 rounded-2xl border border-peligro/40 bg-peligro/10 px-4 py-3 text-sm font-medium text-peligro"><vf-icono nombre="alerta" class="mt-0.5 shrink-0" />{{ error() }}</div> }
      @if (mensaje()) { <div role="status" class="flex items-start gap-3 rounded-2xl border border-exito/40 bg-exito/10 px-4 py-3 text-sm font-medium text-exito"><vf-icono nombre="check" class="mt-0.5 shrink-0" />{{ mensaje() }}</div> }

      @if (cargando()) {
        <div class="tarjeta p-8 text-center text-sm text-tenue">Cargando cajas…</div>
      } @else if (!cajas().length) {
        <div class="rounded-2xl border border-dashed border-borde p-10 text-center">
          <h2 class="font-bold">No hay cajas configuradas</h2>
          <p class="mt-2 text-sm text-suave">Pide al Administrador que cree una caja para esta sucursal.</p>
        </div>
      } @else {
        <div class="grid gap-4">
          @for (caja of cajas(); track caja.cajaId) {
            <article class="tarjeta p-4 sm:p-5">
              <div class="flex flex-wrap items-center justify-between gap-3">
                <div class="flex items-center gap-3">
                  <span class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
                        [class.bg-exito]="!!caja.sesionAbierta" [class.bg-elevada]="!caja.sesionAbierta">
                    <vf-icono nombre="billete" [tam]="24" [class.text-white]="!!caja.sesionAbierta" [class.text-tenue]="!caja.sesionAbierta" />
                  </span>
                  <div>
                    <h2 class="text-lg font-bold">{{ caja.nombre }}</h2>
                    <p class="text-sm" [class.text-exito]="!!caja.sesionAbierta" [class.text-tenue]="!caja.sesionAbierta">
                      {{ caja.sesionAbierta ? 'Turno abierto' : (caja.activa ? 'Sin turno abierto' : 'Caja inactiva') }}
                    </p>
                  </div>
                </div>
                @if (caja.sesionAbierta) { <span class="chip-exito">ABIERTA</span> }
              </div>

              <!-- ─────────── Turno abierto ─────────── -->
              @if (caja.sesionAbierta; as turno) {
                <div class="mt-4 grid gap-3 rounded-2xl bg-elevada p-4 sm:grid-cols-3">
                  <div><p class="text-[11px] font-bold uppercase tracking-wide text-tenue">Fondo inicial</p><p class="cifra text-lg">{{ turno.fondoInicial | currency:'PEN':'symbol':'1.2-2' }}</p></div>
                  <div><p class="text-[11px] font-bold uppercase tracking-wide text-tenue">Abierto por</p><p class="truncate font-bold">{{ turno.abiertoPorNombre }}</p></div>
                  <div><p class="text-[11px] font-bold uppercase tracking-wide text-tenue">Desde</p><p class="font-bold">{{ turno.abiertaEn | date:'dd/MM HH:mm' }}</p></div>
                </div>

                @if (arqueoDe(turno.sesionCajaId); as a) {
                  <!-- El cuadre, línea por línea, para poder seguirlo con el dedo -->
                  <section class="mt-4 rounded-2xl border border-borde p-4">
                    <div class="flex items-center justify-between gap-2">
                      <h3 class="font-bold">Cuadre del turno</h3>
                      <button type="button" class="btn btn-sm btn-secundario" [disabled]="ocupada()" (click)="cargarArqueo(turno.sesionCajaId)">
                        <vf-icono nombre="refrescar" [tam]="17" /> Actualizar
                      </button>
                    </div>
                    <dl class="mt-3 divide-y divide-borde text-sm">
                      <div class="flex justify-between py-2"><dt>Fondo inicial</dt><dd class="cifra">{{ a.fondoInicial | currency:'PEN':'symbol':'1.2-2' }}</dd></div>
                      <div class="flex justify-between py-2"><dt>+ Ventas cobradas en efectivo</dt><dd class="cifra text-exito">{{ a.ventasEfectivo | currency:'PEN':'symbol':'1.2-2' }}</dd></div>
                      <div class="flex justify-between py-2"><dt>+ Ingresos registrados</dt><dd class="cifra text-exito">{{ a.ingresosManuales | currency:'PEN':'symbol':'1.2-2' }}</dd></div>
                      <div class="flex justify-between py-2"><dt>− Egresos registrados</dt><dd class="cifra text-peligro">{{ a.egresosManuales | currency:'PEN':'symbol':'1.2-2' }}</dd></div>
                      <div class="flex justify-between py-2"><dt>− Devoluciones en efectivo</dt><dd class="cifra text-peligro">{{ a.devolucionesEfectivo | currency:'PEN':'symbol':'1.2-2' }}</dd></div>
                      <div class="flex items-center justify-between border-t-2 border-borde py-3">
                        <dt class="text-base font-extrabold">Debe haber en caja</dt>
                        <dd class="cifra text-2xl">{{ a.efectivoEsperado | currency:'PEN':'symbol':'1.2-2' }}</dd>
                      </div>
                    </dl>

                    @if (a.ventasPorMedio.length) {
                      <p class="etiqueta mt-3">Cobrado por medio de pago <span class="font-medium normal-case text-tenue">· ya con las devoluciones descontadas</span></p>
                      <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        @for (m of a.ventasPorMedio; track m.medio) {
                          <div class="rounded-xl bg-elevada px-3 py-2">
                            <p class="text-[11px] font-bold uppercase tracking-wide text-tenue">{{ m.medio }}</p>
                            <p class="cifra">{{ m.monto | currency:'PEN':'symbol':'1.2-2' }}</p>
                            <p class="text-[11px] text-tenue">{{ m.operaciones }} operación(es)</p>
                          </div>
                        }
                      </div>
                      <p class="mt-2 text-xs text-tenue">Solo el efectivo entra a la caja física. Yape, Plin, tarjeta y transferencia quedan registrados aparte.</p>
                    }

                    @if (a.movimientos.length) {
                      <p class="etiqueta mt-4">Movimientos del turno</p>
                      <ul class="divide-y divide-borde text-sm">
                        @for (m of a.movimientos; track m.cajaMovimientoId) {
                          <li class="flex items-start justify-between gap-3 py-2">
                            <div class="min-w-0">
                              <span class="chip" [class.chip-exito]="m.tipo === 'INGRESO'" [class.chip-peligro]="m.tipo === 'EGRESO'">{{ m.tipo }}</span>
                              <span class="ml-2">{{ m.motivo }}</span>
                              <span class="block text-xs text-tenue">{{ m.registradoEn | date:'dd/MM HH:mm' }}</span>
                            </div>
                            <span class="cifra shrink-0" [class.text-exito]="m.tipo === 'INGRESO'" [class.text-peligro]="m.tipo === 'EGRESO'">
                              {{ (m.tipo === 'EGRESO' ? -m.monto : m.monto) | currency:'PEN':'symbol':'1.2-2' }}
                            </span>
                          </li>
                        }
                      </ul>
                    }
                  </section>

                  <!-- Ingreso / egreso de efectivo -->
                  @if (sesion.tienePermiso('CAJA_EGRESOS')) {
                    <section class="mt-4 rounded-2xl border border-borde p-4">
                      <h3 class="font-bold">Entrada o salida de efectivo</h3>
                      <p class="mt-1 text-xs text-tenue">Todo lo que entra o sale de la caja fuera de una venta: pago a proveedor, compra de última hora, retiro.</p>
                      <div class="mt-3 grid grid-cols-2 gap-2">
                        <button type="button" class="opcion min-h-[3.5rem]" [class.opcion-activa]="tipoMovimiento === 'INGRESO'" (click)="tipoMovimiento = 'INGRESO'">
                          <vf-icono nombre="sube" [tam]="20" /> Ingreso
                        </button>
                        <button type="button" class="opcion min-h-[3.5rem]" [class.opcion-activa]="tipoMovimiento === 'EGRESO'" (click)="tipoMovimiento = 'EGRESO'">
                          <vf-icono nombre="baja" [tam]="20" /> Egreso
                        </button>
                      </div>
                      <div class="mt-2 rounded-xl border-2 border-marino p-3">
                        <span class="text-[11px] font-bold uppercase tracking-wide text-tenue">Monto</span>
                        <span class="cifra block text-2xl">{{ (montoMovimiento || 0) | currency:'PEN':'symbol':'1.2-2' }}</span>
                      </div>
                      <div class="mt-2 grid grid-cols-3 gap-2">
                        @for (t of TECLAS; track t) { <button type="button" class="tecla" (click)="teclearMovimiento(t)">{{ t }}</button> }
                        <button type="button" class="tecla-accion" (click)="teclearMovimiento('borrar')" aria-label="Borrar un dígito"><vf-icono nombre="izquierda" [tam]="22" /></button>
                        <button type="button" class="tecla" (click)="teclearMovimiento('0')">0</button>
                        <button type="button" class="tecla-accion" (click)="teclearMovimiento('limpiar')" aria-label="Limpiar el monto">C</button>
                      </div>
                      <label class="mt-3 block">
                        <span class="etiqueta">Motivo (obligatorio)</span>
                        <input class="campo" maxlength="200" [(ngModel)]="motivoMovimiento" name="motivoMovimiento" placeholder="Ej. pago al proveedor de pescado" />
                      </label>
                      <button class="btn-grande-marino mt-3 w-full" [disabled]="ocupada() || !(montoMovimiento > 0) || motivoMovimiento.trim().length < 3"
                              (click)="registrarMovimiento(turno)">
                        Registrar {{ tipoMovimiento === 'INGRESO' ? 'ingreso' : 'egreso' }} de {{ (montoMovimiento || 0) | currency:'PEN':'symbol':'1.2-2' }}
                      </button>
                    </section>
                  }

                  <!-- Conteo del efectivo y cierre -->
                  <section class="mt-4 rounded-2xl border border-borde p-4">
                    <h3 class="font-bold">Contar el efectivo y cerrar</h3>
                    <p class="mt-1 text-xs text-tenue">Cuenta billete por billete; la suma se calcula sola. Si prefieres, escribe el total directo abajo.</p>

                    <div class="mt-3 grid gap-1.5 sm:grid-cols-2">
                      @for (d of DENOMINACIONES; track d) {
                        <div class="flex items-center justify-between gap-2 rounded-xl bg-elevada px-3 py-1.5">
                          <span class="w-16 shrink-0 text-sm font-bold">{{ d >= 1 ? ('S/ ' + d) : (d * 100 + ' cént.') }}</span>
                          <div class="flex items-center gap-1">
                            <button type="button" class="btn-icono h-10 w-10 border border-borde" [disabled]="(conteo[d] ?? 0) <= 0"
                                    (click)="ajustarConteo(d, -1)" [attr.aria-label]="'Quitar un ' + d"><vf-icono nombre="baja" [tam]="18" /></button>
                            <input class="h-10 w-14 rounded-lg border border-borde bg-superficie text-center text-base font-bold" type="number" min="0" inputmode="numeric"
                                   [ngModel]="conteo[d] ?? null" (ngModelChange)="fijarConteo(d, $event)" [name]="'den-' + d" [attr.aria-label]="'Cantidad de ' + d" />
                            <button type="button" class="btn-icono h-10 w-10 border border-borde" (click)="ajustarConteo(d, 1)" [attr.aria-label]="'Agregar un ' + d"><vf-icono nombre="sube" [tam]="18" /></button>
                          </div>
                          <span class="cifra w-24 shrink-0 text-right text-sm">{{ (d * (conteo[d] ?? 0)) | currency:'PEN':'symbol':'1.2-2' }}</span>
                        </div>
                      }
                    </div>

                    <div class="mt-3 grid gap-3 sm:grid-cols-2">
                      <div class="rounded-xl bg-elevada p-3">
                        <p class="text-[11px] font-bold uppercase tracking-wide text-tenue">Contado</p>
                        <p class="cifra text-2xl">{{ contado() | currency:'PEN':'symbol':'1.2-2' }}</p>
                      </div>
                      <div class="rounded-xl p-3" [class.bg-exito]="sinDiferencia(a)" [class.bg-alerta]="!sinDiferencia(a)">
                        <p class="text-[11px] font-bold uppercase tracking-wide text-white/80">Diferencia</p>
                        <p class="cifra text-2xl text-white">{{ diferencia(a) | currency:'PEN':'symbol':'1.2-2' }}</p>
                        <p class="text-[11px] font-semibold text-white/80">{{ sinDiferencia(a) ? 'La caja cuadra' : (diferencia(a) > 0 ? 'Sobra efectivo' : 'Falta efectivo') }}</p>
                      </div>
                    </div>

                    <label class="mt-3 block">
                      <span class="etiqueta">Total contado (si no usaste el conteo de arriba)</span>
                      <input class="campo" type="number" min="0" step="0.01" inputmode="decimal" name="contado-{{ caja.cajaId }}"
                             [ngModel]="contadoManual" (ngModelChange)="fijarContadoManual($event)" placeholder="0.00" />
                    </label>
                    <label class="mt-3 block">
                      <span class="etiqueta">Nota de cierre @if (!sinDiferencia(a)) { <span class="text-peligro">· obligatoria si hay diferencia</span> } @else { <span class="font-medium text-tenue">(opcional)</span> }</span>
                      <input class="campo" maxlength="500" [(ngModel)]="notaCierre" name="nota-{{ caja.cajaId }}" placeholder="Explica la diferencia o deja una observación" />
                    </label>

                    <button class="btn-grande-naranja mt-3 w-full" [disabled]="ocupada() || (!sinDiferencia(a) && notaCierre.trim().length < 5)" (click)="cerrar(turno, a)">
                      <vf-icono nombre="candado" [tam]="22" /> Cerrar turno
                    </button>
                    @if (!sinDiferencia(a) && notaCierre.trim().length < 5) {
                      <p class="mt-2 text-xs font-semibold text-peligro">Hay diferencia: escribe en la nota qué pasó antes de cerrar.</p>
                    }
                  </section>
                } @else {
                  <div class="mt-4 rounded-2xl border border-borde p-6 text-center text-sm text-tenue">Cargando el cuadre del turno…</div>
                }

              <!-- ─────────── Sin turno ─────────── -->
              } @else if (caja.activa) {
                <div class="mt-4 rounded-2xl border border-borde p-4">
                  <label class="block">
                    <span class="etiqueta">Fondo inicial con el que abres</span>
                    <input class="campo" type="number" min="0" step="0.01" inputmode="decimal" name="fondo-{{ caja.cajaId }}"
                           [(ngModel)]="fondosIniciales[caja.cajaId]" placeholder="0.00" />
                  </label>
                  <div class="mt-2 grid grid-cols-4 gap-2">
                    @for (f of FONDOS_RAPIDOS; track f) {
                      <button type="button" class="btn btn-sm btn-secundario" (click)="fondosIniciales[caja.cajaId] = f">S/ {{ f }}</button>
                    }
                  </div>
                  <button class="btn-grande-exito mt-3 w-full" [disabled]="ocupada()" (click)="abrir(caja.cajaId)">
                    <vf-icono nombre="desbloquear" [tam]="22" /> Abrir turno
                  </button>
                </div>
              }
            </article>
          }
        </div>
      }

      <!-- Límites de descuento del negocio -->
      @if (sesion.tienePermiso('CONFIGURACION')) {
        <form class="tarjeta p-4 sm:p-5" (ngSubmit)="guardarLimites()">
          <h2 class="font-bold">Límites de descuento del negocio</h2>
          <p class="mt-1 text-xs text-tenue">Se aplican al total de la cuenta, antes de cobrar. Cada descuento exige motivo y queda auditado.</p>
          <div class="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <label class="block"><span class="etiqueta">Porcentaje máximo</span>
              <input class="campo" name="descuentoPct" type="number" min="0" max="100" step="0.01" required [(ngModel)]="limites.descuentoMaximoPct" />
            </label>
            <label class="block"><span class="etiqueta">Monto máximo (S/)</span>
              <input class="campo" name="descuentoMonto" type="number" min="0" step="0.01" required [(ngModel)]="limites.descuentoMaximoMonto" />
            </label>
            <button class="btn btn-secundario" [disabled]="ocupada()">Guardar</button>
          </div>
        </form>
      }
    </section>
  `,
})
export class CajaPagina {
  private readonly http = inject(HttpClient);
  readonly sesion = inject(SesionService);

  readonly DENOMINACIONES = DENOMINACIONES;
  readonly TECLAS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.'] as const;
  readonly FONDOS_RAPIDOS = [50, 100, 200, 300] as const;

  readonly cajas = signal<CajaLista[]>([]);
  readonly arqueos = signal<Record<number, Arqueo>>({});
  readonly cargando = signal(false);
  readonly ocupada = signal(false);
  readonly error = signal<string | null>(null);
  readonly mensaje = signal<string | null>(null);

  readonly fondosIniciales: Record<number, number | null> = {};
  readonly limites = { descuentoMaximoPct: 20, descuentoMaximoMonto: 200 };

  /** Conteo por denominación; manda sobre el total escrito a mano. */
  conteo: Record<number, number> = {};
  contadoManual: number | null = null;
  notaCierre = '';

  tipoMovimiento: 'INGRESO' | 'EGRESO' = 'EGRESO';
  montoMovimiento = 0;
  private textoMovimiento = '';
  motivoMovimiento = '';

  readonly sucursal = () => this.sesion.sucursales().find(s => s.sucursalId === this.sesion.sucursalActivaId())?.nombre ?? 'Sucursal';

  constructor() {
    effect(() => {
      if (this.sesion.sucursalActivaId() != null) void this.cargar();
    });
  }

  arqueoDe(sesionCajaId: number): Arqueo | undefined { return this.arqueos()[sesionCajaId]; }

  /** Suma del conteo por denominación. Si no se contó nada, vale el total escrito. */
  contado(): number {
    const porDenominacion = DENOMINACIONES.reduce((s, d) => s + d * (this.conteo[d] ?? 0), 0);
    if (porDenominacion > 0) return Math.round(porDenominacion * 100) / 100;
    return Math.round((this.contadoManual ?? 0) * 100) / 100;
  }
  diferencia(a: Arqueo): number { return Math.round((this.contado() - a.efectivoEsperado) * 100) / 100; }
  sinDiferencia(a: Arqueo): boolean { return this.diferencia(a) === 0; }

  ajustarConteo(denominacion: number, delta: number): void {
    const actual = this.conteo[denominacion] ?? 0;
    this.conteo = { ...this.conteo, [denominacion]: Math.max(0, actual + delta) };
    this.contadoManual = null;
  }
  fijarConteo(denominacion: number, valor: unknown): void {
    const n = Math.max(0, Math.trunc(Number(valor) || 0));
    this.conteo = { ...this.conteo, [denominacion]: n };
    this.contadoManual = null;
  }
  fijarContadoManual(valor: unknown): void {
    this.contadoManual = valor === null || valor === '' ? null : Number(valor);
    this.conteo = {};   // el conteo por denominación y el total a mano no conviven
  }

  teclearMovimiento(tecla: string): void {
    let t = this.textoMovimiento;
    if (tecla === 'borrar') t = t.slice(0, -1);
    else if (tecla === 'limpiar') t = '';
    else if (tecla === '.') { if (t.includes('.')) return; t = (t || '0') + '.'; }
    else {
      const dec = t.split('.')[1];
      if (dec !== undefined && dec.length >= 2) return;
      if (t.replace('.', '').length >= 7) return;
      t = t === '0' ? tecla : t + tecla;
    }
    this.textoMovimiento = t;
    this.montoMovimiento = t === '' || t === '.' ? 0 : Number(t);
  }

  async cargar(): Promise<void> {
    this.cargando.set(true);
    this.error.set(null);
    try {
      const cajas = await firstValueFrom(this.http.get<CajaLista[]>(`${environment.api}/caja`));
      this.cajas.set(cajas);
      await Promise.all(cajas.filter(c => c.sesionAbierta).map(c => this.cargarArqueo(c.sesionAbierta!.sesionCajaId)));
      if (this.sesion.tienePermiso('CONFIGURACION')) {
        const x = await firstValueFrom(this.http.get<typeof this.limites>(`${environment.api}/caja/limites-ajuste`));
        this.limites.descuentoMaximoPct = x.descuentoMaximoPct;
        this.limites.descuentoMaximoMonto = x.descuentoMaximoMonto;
      }
    } catch (e) {
      this.error.set(this.mensajeError(e));
    } finally {
      this.cargando.set(false);
    }
  }

  async cargarArqueo(sesionCajaId: number): Promise<void> {
    try {
      const a = await firstValueFrom(this.http.get<Arqueo>(`${environment.api}/caja/sesiones/${sesionCajaId}/arqueo`));
      this.arqueos.update(m => ({ ...m, [sesionCajaId]: a }));
    } catch (e) {
      this.error.set(this.mensajeError(e));
    }
  }

  async abrir(cajaId: number): Promise<void> {
    const fondo = Number(this.fondosIniciales[cajaId] ?? 0);
    if (!Number.isFinite(fondo) || fondo < 0) { this.error.set('Ingresa un fondo inicial válido.'); return; }
    await this.ejecutar(async () => {
      await firstValueFrom(this.http.post(`${environment.api}/caja/${cajaId}/sesiones`, { fondoInicial: fondo }));
      this.mensaje.set('Turno abierto.');
    });
  }

  async registrarMovimiento(turno: SesionCajaResumen): Promise<void> {
    const monto = Math.round(this.montoMovimiento * 100) / 100;
    if (!(monto > 0)) { this.error.set('Ingresa un monto mayor a cero.'); return; }
    if (this.motivoMovimiento.trim().length < 3) { this.error.set('El motivo es obligatorio.'); return; }
    await this.ejecutar(async () => {
      await firstValueFrom(this.http.post(`${environment.api}/caja/sesiones/${turno.sesionCajaId}/movimientos`, {
        tipo: this.tipoMovimiento, monto, motivo: this.motivoMovimiento.trim(), claveIdempotencia: crypto.randomUUID(),
      }));
      this.mensaje.set(`${this.tipoMovimiento === 'INGRESO' ? 'Ingreso' : 'Egreso'} de S/ ${monto.toFixed(2)} registrado y sumado al cuadre.`);
      this.montoMovimiento = 0; this.textoMovimiento = ''; this.motivoMovimiento = '';
    });
  }

  async cerrar(turno: SesionCajaResumen, arqueo: Arqueo): Promise<void> {
    const contado = this.contado();
    if (!Number.isFinite(contado) || contado < 0) { this.error.set('Ingresa un efectivo contado válido.'); return; }
    if (this.diferencia(arqueo) !== 0 && this.notaCierre.trim().length < 5) {
      this.error.set('Hay diferencia entre lo contado y lo esperado: explica el motivo en la nota antes de cerrar.');
      return;
    }
    await this.ejecutar(async () => {
      const r = await firstValueFrom(this.http.put<{ sesion: SesionCajaResumen }>(
        `${environment.api}/caja/sesiones/${turno.sesionCajaId}/cerrar`,
        { efectivoContado: contado, nota: this.notaCierre.trim() || null }));
      const dif = Number(r.sesion.diferencia ?? 0);
      this.mensaje.set(dif === 0
        ? `Turno cerrado y cuadrado: S/ ${Number(r.sesion.efectivoEsperado).toFixed(2)} esperados y contados.`
        : `Turno cerrado. Esperado S/ ${Number(r.sesion.efectivoEsperado).toFixed(2)}, contado S/ ${Number(r.sesion.efectivoContado).toFixed(2)}, diferencia S/ ${dif.toFixed(2)}.`);
      this.conteo = {}; this.contadoManual = null; this.notaCierre = '';
      this.arqueos.update(m => { const n = { ...m }; delete n[turno.sesionCajaId]; return n; });
    });
  }

  async guardarLimites(): Promise<void> {
    const { descuentoMaximoPct, descuentoMaximoMonto } = this.limites;
    if (!Number.isFinite(descuentoMaximoPct) || descuentoMaximoPct < 0 || descuentoMaximoPct > 100
      || !Number.isFinite(descuentoMaximoMonto) || descuentoMaximoMonto < 0) {
      this.error.set('Configura un porcentaje entre 0 y 100 y un monto máximo válido.'); return;
    }
    await this.ejecutar(async () => {
      const x = await firstValueFrom(this.http.put<typeof this.limites>(`${environment.api}/caja/limites-ajuste`, this.limites));
      this.limites.descuentoMaximoPct = x.descuentoMaximoPct;
      this.limites.descuentoMaximoMonto = x.descuentoMaximoMonto;
      this.mensaje.set('Límites de descuento guardados y auditados.');
    });
  }

  private async ejecutar(accion: () => Promise<void>): Promise<void> {
    this.ocupada.set(true);
    this.error.set(null);
    this.mensaje.set(null);
    try { await accion(); await this.cargar(); }
    catch (e) { this.error.set(this.mensajeError(e)); }
    finally { this.ocupada.set(false); }
  }

  private mensajeError(e: unknown): string {
    if (e instanceof HttpErrorResponse) return e.error?.mensaje ?? 'No se pudo completar la operación de caja.';
    return 'No se pudo completar la operación de caja.';
  }
}
