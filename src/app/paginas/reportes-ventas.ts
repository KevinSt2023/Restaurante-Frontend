import { CommonModule, CurrencyPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { SesionService } from '../core/sesion';

type SucursalVentas = { sucursalId: number; sucursal: string; ventas: number; pedidosPagados: number; pedidosPendientes: number; pendienteCobro: number; efectivo: number; digital: number };
type MedioPago = { medio: string; total: number; operaciones: number };
type CanalVentas = { canal: string; ventas: number; pedidosConMovimientoPago: number; pedidosPendientes: number; pendienteCobro: number };
type ProductoVendido = { producto: string; unidades: number; total: number };
type Reporte = { fecha: string; consolidado: boolean; totalVentas: number; pedidosPagados: number; pedidosPendientes: number; pendienteCobro: number; efectivo: number; digital: number; sucursales: SucursalVentas[]; mediosPago: MedioPago[]; canales: CanalVentas[]; productos: ProductoVendido[] };

@Component({
  selector: 'vf-reportes-ventas', imports: [CommonModule, FormsModule, CurrencyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-6xl space-y-6">
      <header class="flex flex-wrap items-end justify-between gap-4">
        <div><p class="text-xs font-bold uppercase tracking-[0.16em] text-marino">Control · Reportes</p><h1 class="mt-1 text-2xl font-bold">Ventas del día</h1><p class="mt-2 text-sm text-slate-600 dark:text-slate-300">Totales según pagos registrados, con fecha operativa de Lima.</p></div>
        <div class="flex flex-wrap items-end gap-2">
          <label class="text-sm font-semibold">Fecha <input type="date" [max]="hoy" [(ngModel)]="fecha" (change)="cargar()" class="mt-1 block min-h-11 rounded-xl border px-3 dark:bg-slate-800" /></label>
          @if (puedeConsolidar()) { <button class="min-h-11 rounded-xl border px-4 font-semibold" [class.bg-marino]="consolidado()" [class.text-white]="consolidado()" (click)="cambiarConsolidado()">{{ consolidado() ? 'Vista consolidada' : 'Ver todas las sucursales' }}</button> }
        </div>
      </header>
      @if (error()) { <div role="alert" class="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">{{ error() }}</div> }
      @if (cargando()) { <div class="rounded-2xl border p-6 text-sm text-slate-500">Actualizando reporte…</div> }
      @if (reporte(); as r) {
        <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <article class="rounded-2xl bg-slate-900 p-5 text-white"><div class="text-sm text-white/65">Ventas cobradas</div><div class="mt-2 text-2xl font-bold">{{ r.totalVentas | currency:'PEN':'symbol':'1.2-2' }}</div><div class="mt-1 text-xs text-white/60">{{ r.pedidosPagados }} pedidos pagados</div></article>
          <article class="rounded-2xl border bg-white p-5 dark:border-slate-700 dark:bg-slate-900"><div class="text-sm text-slate-500">Efectivo recibido</div><div class="mt-2 text-2xl font-bold">{{ r.efectivo | currency:'PEN':'symbol':'1.2-2' }}</div><div class="mt-1 text-xs text-slate-500">Aplicado a pedidos pagados</div></article>
          <article class="rounded-2xl border bg-white p-5 dark:border-slate-700 dark:bg-slate-900"><div class="text-sm text-slate-500">Medios digitales</div><div class="mt-2 text-2xl font-bold">{{ r.digital | currency:'PEN':'symbol':'1.2-2' }}</div><div class="mt-1 text-xs text-slate-500">Yape, Plin, tarjeta y transferencia</div></article>
          <article class="rounded-2xl border border-amber-300 bg-amber-50 p-5 dark:bg-amber-950/30"><div class="text-sm text-amber-800 dark:text-amber-200">Pendiente de cobro</div><div class="mt-2 text-2xl font-bold">{{ r.pendienteCobro | currency:'PEN':'symbol':'1.2-2' }}</div><div class="mt-1 text-xs text-amber-800 dark:text-amber-200">{{ r.pedidosPendientes }} pedidos abiertos creados este día</div></article>
        </div>
        <div class="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
          <section class="overflow-hidden rounded-2xl border bg-white dark:border-slate-700 dark:bg-slate-900">
            <div class="border-b p-4 dark:border-slate-700"><h2 class="font-bold">{{ r.consolidado ? 'Resultado por sucursal' : 'Resultado de la sucursal' }}</h2><p class="mt-1 text-xs text-slate-500">Día operativo: {{ r.fecha }}</p></div>
            <div class="overflow-x-auto"><table class="w-full min-w-[650px] text-left text-sm"><thead class="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800"><tr><th class="px-4 py-3">Sucursal</th><th class="px-4 py-3">Ventas</th><th class="px-4 py-3">Pagados</th><th class="px-4 py-3">Abiertos</th><th class="px-4 py-3">Pendiente</th></tr></thead><tbody class="divide-y dark:divide-slate-700">@for (s of r.sucursales; track s.sucursalId) { <tr><td class="px-4 py-3 font-semibold">{{ s.sucursal }}</td><td class="px-4 py-3">{{ s.ventas | currency:'PEN':'symbol':'1.2-2' }}</td><td class="px-4 py-3">{{ s.pedidosPagados }}</td><td class="px-4 py-3">{{ s.pedidosPendientes }}</td><td class="px-4 py-3">{{ s.pendienteCobro | currency:'PEN':'symbol':'1.2-2' }}</td></tr> }</tbody></table></div>
          </section>
          <section class="rounded-2xl border bg-white p-4 dark:border-slate-700 dark:bg-slate-900"><h2 class="font-bold">Medios de pago</h2><div class="mt-3 divide-y dark:divide-slate-700">@for (m of r.mediosPago; track m.medio) { <div class="flex items-center justify-between gap-3 py-3 text-sm"><div><div class="font-semibold">{{ etiquetaMedio(m.medio) }}</div><div class="text-xs text-slate-500">{{ m.operaciones }} operaciones</div></div><div class="font-bold">{{ m.total | currency:'PEN':'symbol':'1.2-2' }}</div></div> } @if (!r.mediosPago.length) { <p class="py-5 text-sm text-slate-500">No hay pagos registrados en esta fecha.</p> }</div></section>
        </div>
        <section class="overflow-hidden rounded-2xl border bg-white dark:border-slate-700 dark:bg-slate-900"><div class="border-b p-4 dark:border-slate-700"><h2 class="font-bold">Ventas por canal</h2><p class="mt-1 text-xs text-slate-500">Ventas netas por fecha de pago; pedidos abiertos y su saldo por fecha de creación.</p></div><div class="overflow-x-auto"><table class="w-full min-w-[680px] text-left text-sm"><thead class="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800"><tr><th class="px-4 py-3">Canal</th><th class="px-4 py-3">Ventas netas</th><th class="px-4 py-3">Pedidos con pago</th><th class="px-4 py-3">Abiertos</th><th class="px-4 py-3">Saldo abierto</th></tr></thead><tbody class="divide-y dark:divide-slate-700">@for (c of r.canales; track c.canal) { <tr><td class="px-4 py-3 font-semibold">{{ etiquetaCanal(c.canal) }}</td><td class="px-4 py-3">{{ c.ventas | currency:'PEN':'symbol':'1.2-2' }}</td><td class="px-4 py-3">{{ c.pedidosConMovimientoPago }}</td><td class="px-4 py-3">{{ c.pedidosPendientes }}</td><td class="px-4 py-3">{{ c.pendienteCobro | currency:'PEN':'symbol':'1.2-2' }}</td></tr> }</tbody></table></div></section>
        <section class="rounded-2xl border bg-white p-4 dark:border-slate-700 dark:bg-slate-900"><h2 class="font-bold">Productos más vendidos</h2><div class="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">@for (p of r.productos; track p.producto) { <article class="rounded-xl bg-slate-50 p-3 dark:bg-slate-800"><div class="font-semibold">{{ p.producto }}</div><div class="mt-1 flex justify-between text-sm text-slate-500"><span>{{ p.unidades }} unidades</span><span class="font-semibold text-slate-800 dark:text-white">{{ p.total | currency:'PEN':'symbol':'1.2-2' }}</span></div></article> } @if (!r.productos.length) { <p class="text-sm text-slate-500">Aún no hay productos vendidos en esta fecha.</p> }</div></section>
        <p class="text-xs text-slate-500">El reporte considera pagos confirmados por fecha de registro y pedidos pendientes creados ese día. No reemplaza la conciliación de caja ni los reportes tributarios.</p>
      }
    </section>`
})
export class ReportesVentasPagina {
  private http = inject(HttpClient); private sesion = inject(SesionService);
  readonly hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(new Date());
  fecha = this.hoy; readonly consolidado = signal(false); readonly reporte = signal<Reporte | null>(null); readonly cargando = signal(false); readonly error = signal('');
  puedeConsolidar = () => this.sesion.tienePermiso('PANEL_CENTRALIZADO');
  constructor() { void this.cargar(); }
  async cargar() { this.error.set(''); this.cargando.set(true); try { const params = new URLSearchParams({ fecha: this.fecha, consolidado: String(this.consolidado()) }); const r = await firstValueFrom(this.http.get<Reporte>(`${environment.api}/reportes/ventas?${params}`)); this.reporte.set(r); } catch (e) { const x=e as {error?:{mensaje?:string}}; this.error.set(x.error?.mensaje ?? 'No se pudo cargar el reporte.'); } finally { this.cargando.set(false); } }
  cambiarConsolidado() { this.consolidado.update(x => !x); void this.cargar(); }
  etiquetaMedio(m: string) { return ({EFECTIVO:'Efectivo', YAPE:'Yape', PLIN:'Plin', TARJETA:'Tarjeta', TRANSFERENCIA:'Transferencia'} as Record<string,string>)[m] ?? m; }
  etiquetaCanal(c: string) { return ({SALON:'Salón', MOSTRADOR:'Mostrador', PARA_LLEVAR:'Para llevar'} as Record<string,string>)[c] ?? c; }
}
