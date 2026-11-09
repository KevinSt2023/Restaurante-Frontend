import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ESTADOS, FechaPipe, RelativoPipe } from '../../core/formato';
import { EmpresaLista, EstadoCobranza, TIPOS_SERVICIO } from '../../core/modelos';
import { SaApi } from '../../core/sa-api';
import { Ui } from '../../core/ui';
import { Icono } from '../../shared/icono';

type Filtro = 'TODAS' | EstadoCobranza;

@Component({
  selector: 'vf-empresas',
  imports: [FormsModule, RouterLink, Icono, FechaPipe, RelativoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="titulo-pagina">Empresas</h1>
        <p class="subtitulo">{{ empresas().length }} restaurantes registrados · {{ activas() }} activos</p>
      </div>
      <a routerLink="/sa/empresas/nueva" class="btn-naranja"><vf-icono nombre="mas" [tam]="18" /> Nueva empresa</a>
    </div>

    <div class="tarjeta mb-4 p-3 sm:p-4">
      <div class="flex flex-col gap-3 md:flex-row">
        <div class="relative flex-1">
          <vf-icono nombre="buscar" class="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-tenue" />
          <input type="search" aria-label="Buscar" class="campo pl-12" placeholder="Buscar por nombre, razón social o RUC" [ngModel]="buscar()" (ngModelChange)="buscar.set($event)" />
        </div>
        <select class="campo md:w-56" [ngModel]="plan()" (ngModelChange)="plan.set($event)" aria-label="Filtrar por plan">
          <option [ngValue]="null">Todos los planes</option>
          @for (p of planes(); track p) { <option [ngValue]="p">{{ p }}</option> }
        </select>
      </div>
      <div class="-mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1">
        @for (f of filtros; track f.valor) {
          <button type="button" class="btn btn-sm shrink-0 border" (click)="filtro.set(f.valor)"
                  [class]="filtro() === f.valor ? 'border-marino bg-marino text-white' : 'border-borde bg-superficie text-suave hover:text-texto'">
            {{ f.texto }} <span class="rounded-full bg-black/10 px-2 text-xs">{{ conteo(f.valor) }}</span>
          </button>
        }
      </div>
    </div>

    @if (cargando() && !empresas().length) {
      <div class="space-y-3">@for (i of [1, 2, 3]; track i) { <div class="tarjeta h-20 animate-pulse"></div> }</div>
    } @else if (!filtradas().length) {
      <div class="tarjeta flex flex-col items-center gap-3 p-10 text-center">
        <vf-icono nombre="empresa" [tam]="40" class="text-tenue" />
        <p class="font-semibold">{{ empresas().length ? 'Ninguna empresa coincide con el filtro.' : 'Todavía no hay empresas.' }}</p>
        @if (!empresas().length) { <a routerLink="/sa/empresas/nueva" class="btn-primario">Registrar la primera</a> }
      </div>
    } @else {
      <!-- Celular y tablet vertical: tarjetas -->
      <div class="grid gap-3 md:hidden">
        @for (e of filtradas(); track e.tenantId) {
          <button type="button" class="tarjeta p-4 text-left active:scale-[0.99]" (click)="abrir(e)">
            <div class="flex items-start gap-3">
              <div class="avatar">{{ inicial(e.nombreComercial) }}</div>
              <div class="min-w-0 flex-1">
                <div class="truncate font-bold">{{ e.nombreComercial }}</div>
                <div class="truncate text-sm text-suave">{{ e.ruc ?? 'Sin RUC' }} · {{ tipo(e.tipoServicio) }}</div>
              </div>
              <span [class]="estado(e.estadoCobranza).chip">{{ estado(e.estadoCobranza).texto }}</span>
            </div>
            <div class="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
              <div class="rounded-xl bg-elevada p-2"><div class="text-xs text-tenue">Plan</div><div class="truncate font-semibold">{{ e.planNombre ?? '—' }}</div></div>
              <div class="rounded-xl bg-elevada p-2"><div class="text-xs text-tenue">Usuarios</div><div class="font-semibold" [class.text-peligro]="e.excede">{{ e.usuarios }}/{{ e.maxUsuarios || '∞' }}</div></div>
              <div class="rounded-xl bg-elevada p-2"><div class="text-xs text-tenue">Vence</div><div class="font-semibold">{{ e.vencimiento | fecha }}</div></div>
            </div>
          </button>
        }
      </div>

      <!-- Escritorio: tabla -->
      <div class="tarjeta hidden overflow-x-auto md:block">
        <table class="tabla">
          <thead><tr><th>Empresa</th><th>Plan</th><th>Estado</th><th class="text-center">Sucursales</th><th class="text-center">Usuarios</th><th>Último acceso</th><th></th></tr></thead>
          <tbody>
            @for (e of filtradas(); track e.tenantId) {
              <tr class="fila-clic" (click)="abrir(e)">
                <td>
                  <div class="flex items-center gap-3">
                    <div class="avatar">{{ inicial(e.nombreComercial) }}</div>
                    <div class="min-w-0">
                      <div class="font-bold">{{ e.nombreComercial }}</div>
                      <div class="text-xs text-suave">{{ e.ruc ?? 'Sin RUC' }} · {{ tipo(e.tipoServicio) }}</div>
                    </div>
                  </div>
                </td>
                <td class="font-semibold">{{ e.planNombre ?? '—' }}</td>
                <td>
                  <span [class]="estado(e.estadoCobranza).chip">{{ estado(e.estadoCobranza).texto }}</span>
                  <div class="mt-1 text-xs text-suave">vence {{ e.vencimiento | fecha }}</div>
                </td>
                <td class="text-center font-semibold">{{ e.sucursales }}/{{ e.maxSucursales || '∞' }}</td>
                <td class="text-center font-semibold" [class.text-peligro]="e.excede">{{ e.usuarios }}/{{ e.maxUsuarios || '∞' }}
                  @if (e.excede) { <div class="text-xs font-normal">excede</div> }
                </td>
                <td class="text-suave">{{ e.ultimoAcceso | relativo }}</td>
                <td class="w-12 text-tenue"><vf-icono nombre="derecha" [tam]="18" /></td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }
  `,
  styles: [`.avatar { display:flex; height:2.75rem; width:2.75rem; flex-shrink:0; align-items:center; justify-content:center; border-radius:.75rem;
    background: linear-gradient(135deg, rgb(var(--vf-marino)), rgb(var(--vf-marino-oscuro))); color: rgb(var(--vf-naranja-claro)); font-weight: 800; }`],
})
export class Empresas implements OnInit {
  private api = inject(SaApi);
  private ui = inject(Ui);
  private router = inject(Router);

  empresas = signal<EmpresaLista[]>([]);
  cargando = signal(false);
  buscar = signal('');
  filtro = signal<Filtro>('TODAS');
  plan = signal<string | null>(null);

  filtros: { valor: Filtro; texto: string }[] = [
    { valor: 'TODAS', texto: 'Todas' }, { valor: 'AL_DIA', texto: 'Al día' }, { valor: 'POR_VENCER', texto: 'Por vencer' },
    { valor: 'VENCIDA', texto: 'Vencidas' }, { valor: 'SUSPENDIDA', texto: 'Suspendidas' },
  ];

  activas = computed(() => this.empresas().filter(e => e.activo).length);
  planes = computed(() => [...new Set(this.empresas().map(e => e.planNombre).filter((p): p is string => !!p))].sort());
  filtradas = computed(() => {
    const q = this.buscar().trim().toLowerCase();
    return this.empresas().filter(e =>
      (this.filtro() === 'TODAS' || e.estadoCobranza === this.filtro()) &&
      (!this.plan() || e.planNombre === this.plan()) &&
      (!q || e.nombreComercial.toLowerCase().includes(q) || (e.razonSocial ?? '').toLowerCase().includes(q) || (e.ruc ?? '').includes(q)));
  });

  conteo = (f: Filtro) => (f === 'TODAS' ? this.empresas().length : this.empresas().filter(e => e.estadoCobranza === f).length);
  estado = (e: EstadoCobranza) => ESTADOS[e];
  tipo = (t: string) => TIPOS_SERVICIO.find(x => x.valor === t)?.texto ?? t;
  inicial = (n: string) => n.trim()[0]?.toUpperCase() ?? '?';
  abrir = (e: EmpresaLista) => this.router.navigate(['/sa/empresas', e.tenantId]);

  async ngOnInit(): Promise<void> {
    this.cargando.set(true);
    try { this.empresas.set(await this.api.empresas()); }
    catch (e) { this.ui.error(e); }
    finally { this.cargando.set(false); }
  }
}
