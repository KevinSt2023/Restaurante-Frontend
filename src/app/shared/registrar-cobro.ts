import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FechaPipe, SolesPipe, fmt } from '../core/formato';
import { METODOS_PAGO, RegistrarMovimiento, SugerenciaCobro } from '../core/modelos';
import { SaApi } from '../core/sa-api';
import { Ui, mensajeError } from '../core/ui';
import { Icono } from './icono';
import { Modal } from './modal';

@Component({
  selector: 'vf-registrar-cobro',
  imports: [FormsModule, Modal, Icono, SolesPipe, FechaPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <vf-modal [titulo]="'Registrar cobro · ' + empresa()" subtitulo="Cada día de servicio queda con su constancia." ancho="sm:max-w-xl" (cerrar)="cerrar.emit()">
      <form (ngSubmit)="guardar()">
        <div class="mb-4 grid grid-cols-2 gap-2">
          <button type="button" class="opcion h-14" [class.opcion-activa]="d.tipo === 'PAGO'" (click)="d.tipo = 'PAGO'; aplicarSugerido()"><vf-icono nombre="cobros" /> Pago</button>
          <button type="button" class="opcion h-14" [class.opcion-activa]="d.tipo === 'CORTESIA'" (click)="d.tipo = 'CORTESIA'"><vf-icono nombre="regalo" /> Cortesía</button>
        </div>

        <label class="etiqueta">Meses</label>
        <div class="mb-4 grid grid-cols-4 gap-2">
          @for (m of [1, 3, 6, 12]; track m) {
            <button type="button" class="opcion" [class.opcion-activa]="d.meses === m" (click)="elegirMeses(m)">{{ m }} {{ m === 1 ? 'mes' : 'meses' }}</button>
          }
        </div>

        @if (s(); as s) {
          <div class="mb-4 grid grid-cols-2 gap-3 rounded-2xl bg-elevada p-4 text-sm">
            <div><div class="text-tenue">Plan</div><div class="font-semibold">{{ s.planNombre }}</div></div>
            <div><div class="text-tenue">Precio de lista</div><div class="font-semibold">{{ s.precioLista | soles }}</div></div>
            <div><div class="text-tenue">Vence hoy</div><div class="font-semibold">{{ s.venceActual | fecha }}</div></div>
            <div><div class="text-tenue">Quedará hasta</div><div class="font-bold text-marino">{{ s.venceraHasta | fecha }}</div></div>
            @if (s.localesCobrados > 0) {
              <div class="col-span-2 border-t border-borde pt-2 text-xs text-suave">
                Incluye <b>{{ s.localesCobrados }}</b> local(es) además del incluido
                ({{ s.localesActivos }} activos) a {{ s.precioSucursalAdicional | soles }} cada uno:
                <b>{{ s.cargoPorLocales | soles }}</b> del total.
              </div>
            }
          </div>
          @if (d.tipo === 'PAGO' && s.bienvenidaDisponible && s.descuentoBienvenidaPct > 0) {
            <div class="mb-4 flex items-start gap-3 rounded-xl bg-naranja/10 p-3 text-sm">
              <vf-icono nombre="chispa" class="text-naranja" />
              <span>Primer pago: <b>{{ s.descuentoBienvenidaPct }} % de bienvenida</b> en la primera mensualidad → sugerido <b>{{ s.montoSugerido | soles }}</b>.</span>
            </div>
          }
        }

        @if (d.tipo === 'PAGO') {
          <div class="grid gap-4 sm:grid-cols-2">
            <div><label class="etiqueta">Monto cobrado (S/, con IGV) *</label><input aria-label="Monto cobrado (S/, con IGV)" class="campo text-lg font-bold" name="monto" type="number" inputmode="decimal" step="0.01" min="0" [(ngModel)]="d.monto" /></div>
            <div><label class="etiqueta">Fecha del pago</label><input aria-label="Fecha del pago" class="campo" name="fecha" type="date" [max]="hoy" [(ngModel)]="d.fechaPago" /></div>
          </div>
          <label class="etiqueta mt-4">Medio de pago</label>
          <div class="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
            @for (m of metodos; track m.valor) {
              <button type="button" class="opcion" [class.opcion-activa]="d.metodoPago === m.valor" (click)="d.metodoPago = m.valor">{{ m.texto }}</button>
            }
          </div>
          <div class="grid gap-4 sm:grid-cols-2">
            @if (d.metodoPago !== 'EFECTIVO') {
              <div><label class="etiqueta">N° de operación *</label><input aria-label="N° de operación" class="campo" name="op" [(ngModel)]="d.numeroOperacion" maxlength="50" autocomplete="off" /></div>
            }
            <div><label class="etiqueta">Comprobante emitido</label><input aria-label="Comprobante emitido" class="campo" name="cp" [(ngModel)]="d.comprobante" maxlength="30" placeholder="B001-00000123" /></div>
          </div>
        }
        <div class="mt-4">
          <label class="etiqueta">{{ d.tipo === 'CORTESIA' ? 'Motivo de la cortesía *' : 'Observación' }}</label>
          <textarea class="campo" name="obs" aria-label="Observación o motivo" rows="2" maxlength="300" [(ngModel)]="d.observacion"></textarea>
        </div>

        <div class="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" class="btn-secundario" (click)="cerrar.emit()">Cancelar</button>
          <button type="submit" class="btn-naranja" [disabled]="guardando()"><vf-icono nombre="check" [tam]="18" /> {{ guardando() ? 'Guardando…' : 'Registrar' }}</button>
        </div>
      </form>
    </vf-modal>
  `,
})
export class RegistrarCobro implements OnInit {
  private api = inject(SaApi);
  private ui = inject(Ui);
  private cdr = inject(ChangeDetectorRef);

  tenantId = input.required<number>();
  empresa = input.required<string>();
  cerrar = output<void>();
  guardado = output<void>();

  metodos = METODOS_PAGO;
  hoy = fmt.hoyLima();
  s = signal<SugerenciaCobro | null>(null);
  guardando = signal(false);
  d: RegistrarMovimiento = { tipo: 'PAGO', meses: 1, monto: 0, metodoPago: 'YAPE_PLIN', numeroOperacion: null, fechaPago: this.hoy, comprobante: null, observacion: null };

  ngOnInit(): void { this.elegirMeses(1); }

  async elegirMeses(m: number): Promise<void> {
    this.d.meses = m;
    try {
      this.s.set(await this.api.sugerencia(this.tenantId(), m));
      this.aplicarSugerido();
      this.cdr.markForCheck();
    } catch (e) {
      this.ui.error(e);
    }
  }

  aplicarSugerido(): void {
    if (this.d.tipo === 'PAGO' && this.s()) this.d.monto = this.s()!.montoSugerido;
  }

  async guardar(): Promise<void> {
    const d = this.d;
    this.guardando.set(true);
    try {
      const r = await this.api.registrarMovimiento(this.tenantId(), {
        ...d,
        monto: d.tipo === 'PAGO' ? Number(d.monto) : 0,
        metodoPago: d.tipo === 'PAGO' ? d.metodoPago : null,
        numeroOperacion: d.tipo === 'PAGO' && d.metodoPago !== 'EFECTIVO' ? d.numeroOperacion : null,
      });
      this.ui.exito(`${d.tipo === 'PAGO' ? 'Pago' : 'Cortesía'} registrado. Vence el ${fmt.fecha(r.movimiento.venceDespues)}`);
      if (r.advertencia) this.ui.aviso(r.advertencia);
      this.guardado.emit();
    } catch (e) {
      this.ui.error(mensajeError(e), 'No se registró');
    } finally {
      this.guardando.set(false);
    }
  }
}
