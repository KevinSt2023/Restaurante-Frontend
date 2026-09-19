import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { FechaHoraPipe } from '../../core/formato';
import { Bitacora, EmpresaLista } from '../../core/modelos';
import { SaApi } from '../../core/sa-api';
import { Ui } from '../../core/ui';
import { Icono } from '../../shared/icono';

@Component({
  selector: 'vf-bitacora',
  imports: [FormsModule, RouterLink, Icono, FechaHoraPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mb-6">
      <h1 class="titulo-pagina">Bitácora</h1>
      <p class="subtitulo">Quién hizo qué, cuándo y desde dónde. No se edita ni se borra.</p>
    </div>

    <form class="tarjeta mb-4 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-6" (ngSubmit)="buscarDesde(1)">
      <div class="relative lg:col-span-2">
        <vf-icono nombre="buscar" class="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-tenue" />
        <input type="search" name="q" aria-label="Buscar en la bitácora" class="campo pl-12" placeholder="Texto o persona" [(ngModel)]="f.buscar" />
      </div>
      <select class="campo" name="t" [(ngModel)]="f.tenantId" aria-label="Empresa">
        <option [ngValue]="null">Todas las empresas</option>
        @for (e of empresas(); track e.tenantId) { <option [ngValue]="e.tenantId">{{ e.nombreComercial }}</option> }
      </select>
      <select class="campo" name="a" [(ngModel)]="f.accion" aria-label="Acción">
        <option value="">Todas las acciones</option>
        @for (a of acciones(); track a) { <option [value]="a">{{ a }}</option> }
      </select>
      <input class="campo" type="date" name="d" [(ngModel)]="f.desde" aria-label="Desde" />
      <input class="campo" type="date" name="h" [(ngModel)]="f.hasta" aria-label="Hasta" />
      <label class="flex min-h-toque items-center gap-3 lg:col-span-2">
        <button type="button" role="switch" class="interruptor" aria-label="Solo acciones del SuperAdmin" [attr.aria-checked]="f.soloSaas" (click)="f.soloSaas = !f.soloSaas"><span></span></button>
        <span class="text-sm font-semibold">Solo acciones del SuperAdmin</span>
      </label>
      <div class="flex gap-2 lg:col-span-4 lg:justify-end">
        <button type="button" class="btn-secundario" (click)="limpiar()">Limpiar</button>
        <button type="submit" class="btn-primario"><vf-icono nombre="buscar" [tam]="18" /> Buscar</button>
      </div>
    </form>

    <p class="mb-2 text-sm text-suave">{{ total() }} registro(s)</p>
    <div class="tarjeta divide-y divide-borde">
      @for (b of items(); track b.bitacoraId) {
        <div class="flex gap-3 p-4">
          <div class="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" [class]="b.rolId === 0 ? 'bg-oro' : 'bg-vino'"></div>
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2 text-sm">
              <b>{{ b.usuarioNombre }}</b><span class="chip-neutro">{{ b.accion }}</span>
              @if (b.empresa) { <a [routerLink]="['/sa/empresas', b.tenantId]" class="chip-oro hover:underline">{{ b.empresa }}</a> }
            </div>
            <div class="mt-1 text-sm text-suave">{{ b.detalle }}</div>
            <div class="mt-0.5 text-xs text-tenue">{{ b.fecha | fechaHora }}{{ b.ip ? ' · IP ' + b.ip : '' }}</div>
          </div>
        </div>
      } @empty { <div class="p-8 text-center text-suave">Sin registros con esos filtros.</div> }
    </div>
    @if (items().length < total()) {
      <div class="mt-4 text-center"><button type="button" class="btn-secundario" (click)="buscarDesde(pagina + 1)">Cargar más</button></div>
    }
  `,
})
export class BitacoraPagina implements OnInit {
  private api = inject(SaApi);
  private ui = inject(Ui);

  items = signal<Bitacora[]>([]);
  total = signal(0);
  empresas = signal<EmpresaLista[]>([]);
  acciones = signal<string[]>([]);
  pagina = 1;
  f = { buscar: '', tenantId: null as number | null, accion: '', desde: '', hasta: '', soloSaas: false };

  async ngOnInit(): Promise<void> {
    try {
      const [e, a] = await Promise.all([this.api.empresas(), this.api.accionesBitacora()]);
      this.empresas.set(e);
      this.acciones.set(a);
    } catch (err) { this.ui.error(err); }
    await this.buscarDesde(1);
  }

  limpiar(): void {
    this.f = { buscar: '', tenantId: null, accion: '', desde: '', hasta: '', soloSaas: false };
    this.buscarDesde(1);
  }

  async buscarDesde(pagina: number): Promise<void> {
    try {
      const r = await this.api.bitacora({ ...this.f, pagina });
      this.pagina = pagina;
      this.items.set(pagina === 1 ? r.items : [...this.items(), ...r.items]);
      this.total.set(r.total);
    } catch (e) { this.ui.error(e); }
  }
}
