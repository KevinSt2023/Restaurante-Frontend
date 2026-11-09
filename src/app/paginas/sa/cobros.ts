import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ESTADOS, FechaHoraPipe, FechaPipe, SolesPipe, enlaceWhatsapp, fmt } from '../../core/formato';
import { Cobranza, EstadoCobranza, Movimiento } from '../../core/modelos';
import { SaApi } from '../../core/sa-api';
import { Ui } from '../../core/ui';
import { Icono } from '../../shared/icono';
import { RegistrarCobro } from '../../shared/registrar-cobro';

@Component({
  selector: 'vf-cobros',
  imports: [FormsModule, RouterLink, Icono, RegistrarCobro, SolesPipe, FechaPipe, FechaHoraPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mb-6">
      <h1 class="titulo-pagina">Cobros</h1>
      <p class="subtitulo">Suscripciones de cada restaurante. Primero lo vencido, luego lo que está por vencer.</p>
    </div>

    <div class="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
      @for (k of resumen(); track k.texto) {
        <button type="button" class="tarjeta p-4 text-left transition-colors" [class.ring-2]="filtro() === k.estado" [class.ring-marino]="filtro() === k.estado" (click)="filtro.set(filtro() === k.estado ? null : k.estado)">
          <div class="text-xs font-bold uppercase text-tenue">{{ k.texto }}</div>
          <div class="mt-1 text-2xl font-extrabold" [class]="k.color">{{ k.n }}</div>
        </button>
      }
    </div>

    <div class="relative mb-4">
      <vf-icono nombre="buscar" class="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-tenue" />
      <input type="search" aria-label="Buscar" class="campo pl-12" placeholder="Buscar empresa o RUC" [ngModel]="buscar()" (ngModelChange)="buscar.set($event)" />
    </div>

    <div class="grid gap-4 xl:grid-cols-[1fr_22rem]">
      <div class="space-y-3">
        @for (c of filtradas(); track c.tenantId) {
          <div class="tarjeta p-4">
            <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-2">
                  <a [routerLink]="['/sa/empresas', c.tenantId]" class="font-bold hover:text-marino">{{ c.nombre }}</a>
                  <span [class]="estados[c.estado].chip">{{ estados[c.estado].texto }}</span>
                  @if (c.bienvenidaDisponible) { <span class="chip-naranja">Bienvenida</span> }
                </div>
                <div class="mt-1 text-sm text-suave">
                  {{ c.planNombre ?? 'Sin plan' }} · {{ c.precioMensual | soles }}/mes ·
                  vence <b class="text-texto">{{ c.vencimiento | fecha }}</b>
                  @if (c.diasParaVencer !== null) { ({{ c.diasParaVencer >= 0 ? 'en ' + c.diasParaVencer + ' d' : 'hace ' + -c.diasParaVencer + ' d' }}) }
                </div>
                <div class="text-xs text-tenue">Último pago: {{ c.ultimoPagoFecha ? (c.ultimoPagoFecha | fecha) + ' · ' + (c.ultimoPagoMonto | soles) : 'ninguno' }} · 12 meses: {{ c.pagado12Meses | soles }}</div>
              </div>
              <div class="flex gap-2">
                @if (c.celularPeru) {
                  <a class="btn-secundario btn-sm" [href]="recordatorio(c)" target="_blank" rel="noopener" aria-label="Recordar por WhatsApp"><vf-icono nombre="whatsapp" [tam]="18" /><span class="hidden sm:inline">Recordar</span></a>
                }
                <button type="button" class="btn-naranja btn-sm" (click)="cobrar.set(c)" [disabled]="!c.planId"><vf-icono nombre="cobros" [tam]="18" /> Cobrar</button>
              </div>
            </div>
          </div>
        } @empty { <div class="tarjeta p-8 text-center text-suave">No hay empresas con ese filtro.</div> }
      </div>

      <aside class="tarjeta h-fit p-5 xl:sticky xl:top-6">
        <h2 class="mb-3 font-bold">Últimos movimientos</h2>
        @for (m of movimientos(); track m.movimientoId) {
          <div class="flex items-start gap-3 border-b border-borde py-3 last:border-0" [class.opacity-50]="m.estado === 'ANULADO'">
            <vf-icono [nombre]="m.tipo === 'PAGO' ? 'cobros' : 'regalo'" [tam]="18" [class]="m.tipo === 'PAGO' ? 'text-exito' : 'text-naranja'" class="mt-0.5" />
            <div class="min-w-0 flex-1">
              <div class="truncate text-sm font-semibold">{{ m.empresa }}</div>
              <div class="text-xs text-suave">{{ m.tipo === 'PAGO' ? (m.monto | soles) : 'Cortesía' }} · {{ m.meses }} m · {{ m.fechaRegistro | fechaHora }}</div>
            </div>
            @if (m.estado === 'ANULADO') { <span class="chip-peligro">Anulado</span> }
          </div>
        } @empty { <p class="text-sm text-suave">Aún no hay movimientos.</p> }
      </aside>
    </div>

    @if (cobrar(); as c) {
      <vf-registrar-cobro [tenantId]="c.tenantId" [empresa]="c.nombre" (cerrar)="cobrar.set(null)" (guardado)="trasCobro()" />
    }
  `,
})
export class Cobros implements OnInit {
  private api = inject(SaApi);
  private ui = inject(Ui);

  estados = ESTADOS;
  lista = signal<Cobranza[]>([]);
  movimientos = signal<Movimiento[]>([]);
  filtro = signal<EstadoCobranza | null>(null);
  buscar = signal('');
  cobrar = signal<Cobranza | null>(null);

  resumen = computed(() => {
    const l = this.lista();
    const n = (e: EstadoCobranza) => l.filter(c => c.estado === e).length;
    return [
      { texto: 'Vencidas', estado: 'VENCIDA' as EstadoCobranza, n: n('VENCIDA'), color: 'text-peligro' },
      { texto: 'Por vencer', estado: 'POR_VENCER' as EstadoCobranza, n: n('POR_VENCER'), color: 'text-alerta' },
      { texto: 'Al día', estado: 'AL_DIA' as EstadoCobranza, n: n('AL_DIA'), color: 'text-exito' },
      { texto: 'Suspendidas', estado: 'SUSPENDIDA' as EstadoCobranza, n: n('SUSPENDIDA'), color: 'text-suave' },
    ];
  });
  filtradas = computed(() => {
    const q = this.buscar().trim().toLowerCase();
    return this.lista().filter(c => (!this.filtro() || c.estado === this.filtro()) &&
      (!q || c.nombre.toLowerCase().includes(q) || (c.ruc ?? '').includes(q)));
  });

  recordatorio(c: Cobranza): string {
    const vence = fmt.fecha(c.vencimiento);
    const texto = c.estado === 'VENCIDA'
      ? `Hola, te saluda VK Software Solutions. El plan ${c.planNombre} de ${c.nombre} en Valexa venció el ${vence}. Para que tu equipo vuelva a entrar, renueva por ${fmt.soles(c.precioMensual)} al mes. ¡Gracias!`
      : `Hola, te saluda VK Software Solutions. Te recordamos que el plan ${c.planNombre} de ${c.nombre} en Valexa vence el ${vence}. La renovación es de ${fmt.soles(c.precioMensual)} al mes. ¡Gracias por confiar en nosotros!`;
    return enlaceWhatsapp(c.telefono!, texto);
  }

  async ngOnInit(): Promise<void> { await this.cargar(); }

  async cargar(): Promise<void> {
    try {
      const [l, m] = await Promise.all([this.api.cobranza(), this.api.ultimosMovimientos(25)]);
      this.lista.set(l);
      this.movimientos.set(m);
    } catch (e) { this.ui.error(e); }
  }

  async trasCobro(): Promise<void> {
    this.cobrar.set(null);
    await this.cargar();
  }
}
