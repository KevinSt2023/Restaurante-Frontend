import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FechaPipe, SolesPipe, fmt } from '../../core/formato';
import { Tablero as TableroDto, TableroAlerta } from '../../core/modelos';
import { SaApi } from '../../core/sa-api';
import { Ui } from '../../core/ui';
import { Icono } from '../../shared/icono';

@Component({
  selector: 'vf-tablero',
  imports: [RouterLink, Icono, SolesPipe, FechaPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="titulo-pagina">Tablero del negocio</h1>
        <p class="subtitulo">Valexa al {{ t()?.hoy | fecha }} · precios con IGV</p>
      </div>
      <div class="flex gap-2">
        <button type="button" class="btn-secundario" (click)="cargar()" [disabled]="cargando()"><vf-icono nombre="refrescar" [tam]="18" /> Actualizar</button>
        <a routerLink="/sa/empresas/nueva" class="btn-naranja"><vf-icono nombre="mas" [tam]="18" /> Nueva empresa</a>
      </div>
    </div>

    @if (t(); as t) {
      <!-- Indicadores principales -->
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div class="kpi relative overflow-hidden bg-gradient-to-br from-marino to-marino-oscuro text-white">
          <div class="absolute -right-6 -top-6 h-28 w-28 rounded-full bg-naranja/20 blur-2xl"></div>
          <div class="kpi-titulo text-white/70">Ingreso recurrente mensual</div>
          <div class="kpi-valor">{{ t.ingresoRecurrente | soles }}</div>
          <div class="text-sm text-white/65">{{ t.ingresoRecurrenteSinIgv | soles }} sin IGV</div>
        </div>
        <div class="kpi tarjeta">
          <div class="kpi-titulo">Cobrado este mes</div>
          <div class="kpi-valor">{{ t.cobradoMes | soles }}</div>
          <div class="flex items-center gap-1 text-sm" [class.text-exito]="(t.variacionPct ?? 0) >= 0" [class.text-peligro]="(t.variacionPct ?? 0) < 0">
            @if (t.variacionPct !== null) {
              <vf-icono [nombre]="t.variacionPct >= 0 ? 'sube' : 'baja'" [tam]="16" /> {{ t.variacionPct }} % vs. mes anterior
            } @else { <span class="text-suave">Sin cobros el mes anterior</span> }
          </div>
        </div>
        <div class="kpi tarjeta">
          <div class="kpi-titulo">Empresas con servicio</div>
          <div class="kpi-valor">{{ t.alDia + t.porVencer }}<span class="text-lg font-semibold text-tenue"> / {{ t.empresas }}</span></div>
          <div class="text-sm text-suave">{{ t.usuariosActivos }} usuarios · {{ t.sucursalesActivas }} sucursales</div>
        </div>
        <div class="kpi tarjeta">
          <div class="kpi-titulo">Ticket promedio</div>
          <div class="kpi-valor">{{ t.ticketPromedio | soles }}</div>
          <div class="text-sm text-suave">por empresa al mes</div>
        </div>
      </div>

      <!-- Estado de la cartera -->
      <div class="tarjeta mt-4 p-5">
        <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 class="font-bold">Estado de las empresas</h2>
          <div class="flex gap-4 text-sm text-suave">
            <span><b class="text-exito">+{{ t.altasMes }}</b> altas del mes</span>
            <span><b class="text-peligro">−{{ t.bajasMes }}</b> bajas</span>
            <span>Descuentos: <b class="text-texto">{{ t.descuentosMes | soles }}</b></span>
          </div>
        </div>
        <div class="flex h-4 overflow-hidden rounded-full bg-borde/60">
          @for (s of segmentos(); track s.texto) {
            @if (s.n > 0) { <div [class]="s.color" [style.width.%]="(s.n / t.empresas) * 100" [title]="s.texto + ': ' + s.n"></div> }
          }
        </div>
        <div class="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm">
          @for (s of segmentos(); track s.texto) {
            <span class="flex items-center gap-2"><span class="h-3 w-3 rounded-full" [class]="s.color"></span>{{ s.texto }} <b>{{ s.n }}</b></span>
          }
        </div>
      </div>

      <div class="mt-4 grid gap-4 xl:grid-cols-3">
        <!-- Serie 12 meses -->
        <div class="tarjeta p-5 xl:col-span-2">
          <div class="mb-4 flex items-center justify-between">
            <h2 class="font-bold">Cobrado por mes</h2>
            <span class="text-sm text-suave">Últimos 12 meses · {{ totalAnio() | soles }}</span>
          </div>
          <div class="flex h-52 items-end gap-1.5 sm:gap-2.5">
            @for (m of t.serie; track m.mes; let ultimo = $last) {
              <div class="group flex h-full flex-1 flex-col items-center justify-end gap-2">
                <div class="relative w-full flex-1">
                  <div class="absolute inset-x-0 bottom-0 rounded-t-lg transition-all group-hover:opacity-90"
                       [class]="ultimo ? 'bg-gradient-to-t from-naranja-oscuro to-naranja-claro' : 'bg-gradient-to-t from-marino-oscuro to-marino-claro'"
                       [style.height.%]="altura(m.cobrado)" [style.min-height.px]="m.cobrado > 0 ? 4 : 0"></div>
                  <div class="pointer-events-none absolute -top-9 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-tinta px-2 py-1 text-xs text-white shadow group-hover:block">
                    {{ m.cobrado | soles }} · {{ m.altas }} alta(s)
                  </div>
                </div>
                <span class="text-[11px] font-medium uppercase text-tenue">{{ mes(m.mes) }}</span>
              </div>
            }
          </div>
        </div>

        <!-- Ingreso por plan -->
        <div class="tarjeta p-5">
          <h2 class="mb-4 font-bold">Ingreso mensual por plan</h2>
          @for (p of t.porPlan; track p.planId) {
            <div class="mb-4">
              <div class="mb-1 flex justify-between text-sm"><span class="font-semibold">{{ p.plan }} <span class="font-normal text-tenue">· {{ p.empresas }}</span></span><span>{{ p.ingresoMensual | soles }}</span></div>
              <div class="h-2.5 overflow-hidden rounded-full bg-borde/60"><div class="h-full rounded-full bg-gradient-to-r from-marino to-naranja" [style.width.%]="t.ingresoRecurrente ? (p.ingresoMensual / t.ingresoRecurrente) * 100 : 0"></div></div>
            </div>
          } @empty {
            <p class="text-sm text-suave">Todavía no hay empresas con servicio vigente.</p>
          }
        </div>
      </div>

      <!-- Alertas -->
      <div class="mt-4 grid gap-4 lg:grid-cols-3">
        @for (b of bloques(); track b.titulo) {
          <div class="tarjeta p-5">
            <h2 class="mb-3 flex items-center gap-2 font-bold"><vf-icono [nombre]="b.icono" [tam]="18" [class]="b.color" /> {{ b.titulo }} <span class="chip-neutro ml-auto">{{ b.lista.length }}</span></h2>
            @for (a of b.lista; track a.tenantId) {
              <a [routerLink]="['/sa/empresas', a.tenantId]" class="-mx-2 flex min-h-toque items-center gap-3 rounded-xl px-2 py-2 hover:bg-elevada">
                <div class="min-w-0 flex-1">
                  <div class="truncate font-semibold">{{ a.empresa }}</div>
                  <div class="text-sm text-suave">{{ a.detalle }}</div>
                </div>
                <vf-icono nombre="derecha" [tam]="18" class="text-tenue" />
              </a>
            } @empty { <p class="text-sm text-suave">{{ b.vacio }}</p> }
          </div>
        }
      </div>
    } @else {
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        @for (i of [1, 2, 3, 4]; track i) { <div class="tarjeta h-32 animate-pulse"></div> }
      </div>
    }
  `,
  styles: [`
    .kpi { border-radius: 1rem; padding: 1.25rem; display: flex; flex-direction: column; gap: .35rem; min-height: 8.5rem; }
    .kpi-titulo { font-size: .8rem; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: rgb(var(--vf-tenue)); }
    .kpi-valor { font-size: 1.85rem; font-weight: 800; letter-spacing: -.02em; line-height: 1.1; }
  `],
})
export class Tablero implements OnInit {
  private api = inject(SaApi);
  private ui = inject(Ui);
  t = signal<TableroDto | null>(null);
  cargando = signal(false);

  segmentos = computed(() => {
    const t = this.t();
    if (!t) return [];
    return [
      { texto: 'Al día', n: t.alDia, color: 'bg-exito' },
      { texto: 'Por vencer', n: t.porVencer, color: 'bg-alerta' },
      { texto: 'Vencidas', n: t.vencidas, color: 'bg-peligro' },
      { texto: 'Suspendidas', n: t.suspendidas, color: 'bg-tenue' },
      { texto: 'Sin plan', n: t.sinPlan, color: 'bg-info' },
    ];
  });
  maximo = computed(() => Math.max(1, ...(this.t()?.serie.map(m => m.cobrado) ?? [1])));
  totalAnio = computed(() => (this.t()?.serie ?? []).reduce((a, m) => a + m.cobrado, 0));
  bloques = computed(() => {
    const t = this.t();
    const b = (titulo: string, icono: string, color: string, lista: TableroAlerta[], vacio: string) => ({ titulo, icono, color, lista, vacio });
    return t ? [
      b('Vencidas', 'alerta', 'text-peligro', t.vencidasLista, 'Ninguna empresa vencida.'),
      b('Por vencer', 'reloj', 'text-alerta', t.porVencerLista, 'Nada vence en los próximos días.'),
      b('Exceden su plan', 'sube', 'text-info', t.excedidas, 'Todas caben en su plan.'),
    ] : [];
  });

  altura = (v: number) => (v / this.maximo()) * 100;
  mes = (m: string) => fmt.mes(m);

  ngOnInit(): void { this.cargar(); }

  async cargar(): Promise<void> {
    this.cargando.set(true);
    try { this.t.set(await this.api.tablero()); }
    catch (e) { this.ui.error(e); }
    finally { this.cargando.set(false); }
  }
}
