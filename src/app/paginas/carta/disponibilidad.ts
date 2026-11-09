import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CartaApi, Disponibilidad, DisponibilidadItem, SucursalSimple, urlFoto } from '../../core/carta-api';
import { FechaPipe } from '../../core/formato';
import { Ui, mensajeError } from '../../core/ui';
import { Icono } from '../../shared/icono';

// Pantalla de cocina y caja: un toque marca "agotado hoy" y otro lo repone.
// Sin precios (la cocina no ve dinero). Cada sucursal lleva lo suyo.
@Component({
  selector: 'vf-disponibilidad',
  imports: [FormsModule, Icono, FechaPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mb-5 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="titulo-pagina">Agotados de hoy</h1>
        <p class="subtitulo">{{ d()?.sucursal }} · {{ d()?.fecha | fecha }} · toca un plato para marcarlo o reponerlo.</p>
      </div>
      @if (sucursales().length > 1) {
        <select class="campo sm:w-64" aria-label="Sucursal" [ngModel]="sucursalId()" (ngModelChange)="cambiarSucursal($event)">
          @for (s of sucursales(); track s.sucursalId) { <option [ngValue]="s.sucursalId">{{ s.nombre }}</option> }
        </select>
      }
    </div>

    <div class="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
      <div class="tarjeta p-4"><div class="text-xs font-bold uppercase text-tenue">Disponibles</div><div class="text-3xl font-extrabold text-exito">{{ disponibles() }}</div></div>
      <button type="button" class="tarjeta p-4 text-left" [class.ring-2]="soloAgotados()" [class.ring-peligro]="soloAgotados()" (click)="soloAgotados.set(!soloAgotados())">
        <div class="text-xs font-bold uppercase text-tenue">Agotados {{ soloAgotados() ? '· mostrando' : '' }}</div>
        <div class="text-3xl font-extrabold text-peligro">{{ agotados() }}</div>
      </button>
      <div class="relative col-span-2 sm:col-span-1">
        <vf-icono nombre="buscar" class="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-tenue" />
        <input type="search" aria-label="Buscar plato" class="campo h-full pl-12" placeholder="Buscar plato" [ngModel]="buscar()" (ngModelChange)="buscar.set($event)" />
      </div>
    </div>

    @for (c of porCategoria(); track c.id) {
      <h2 class="mb-2 mt-5 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-suave">
        <span class="h-3 w-3 rounded-full" [style.background]="c.color"></span> {{ c.nombre }}
      </h2>
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
        @for (p of c.items; track p.productoId) {
          <button type="button" class="relative flex min-h-[7.5rem] flex-col overflow-hidden rounded-2xl border-2 text-left shadow-tarjeta transition-all active:scale-[0.97]"
                  [class]="p.agotado ? 'border-peligro bg-peligro/10' : 'border-borde bg-superficie'" [disabled]="ocupado() === p.productoId"
                  (click)="alternar(p)" [attr.aria-pressed]="p.agotado" [attr.aria-label]="p.nombre + (p.agotado ? ', agotado' : ', disponible')">
            @if (foto(p.imagen); as src) {
              <img [src]="src" alt="" class="h-20 w-full object-cover" [class.grayscale]="p.agotado" [class.opacity-50]="p.agotado" loading="lazy" />
            }
            <div class="flex flex-1 flex-col justify-between gap-2 p-3">
              <span class="line-clamp-2 font-bold leading-snug" [class.line-through]="p.agotado">{{ p.nombre }}</span>
              <span class="flex items-center gap-1.5 text-sm font-bold" [class]="p.agotado ? 'text-peligro' : 'text-exito'">
                <vf-icono [nombre]="p.agotado ? 'prohibido' : 'check'" [tam]="16" [grosor]="2.5" /> {{ p.agotado ? 'AGOTADO' : 'Disponible' }}
              </span>
            </div>
            @if (ocupado() === p.productoId) { <span class="absolute inset-0 flex items-center justify-center bg-superficie/60"><span class="h-6 w-6 animate-spin rounded-full border-2 border-borde border-t-marino"></span></span> }
          </button>
        }
      </div>
    } @empty {
      <div class="tarjeta p-10 text-center text-suave">{{ d() ? 'No hay platos con ese filtro.' : 'Cargando…' }}</div>
    }
  `,
})
export class DisponibilidadPagina implements OnInit {
  private api = inject(CartaApi);
  private ui = inject(Ui);

  d = signal<Disponibilidad | null>(null);
  sucursales = signal<SucursalSimple[]>([]);
  sucursalId = signal<number | null>(null);
  buscar = signal('');
  soloAgotados = signal(false);
  ocupado = signal<number | null>(null);

  foto = urlFoto;
  agotados = computed(() => this.d()?.productos.filter(p => p.agotado).length ?? 0);
  disponibles = computed(() => (this.d()?.productos.length ?? 0) - this.agotados());
  porCategoria = computed(() => {
    const q = this.buscar().trim().toLowerCase();
    const lista = (this.d()?.productos ?? []).filter(p => (!this.soloAgotados() || p.agotado) && (!q || p.nombre.toLowerCase().includes(q)));
    const grupos = new Map<number, { id: number; nombre: string; color: string; items: DisponibilidadItem[] }>();
    for (const p of lista) {
      if (!grupos.has(p.categoriaId)) grupos.set(p.categoriaId, { id: p.categoriaId, nombre: p.categoria, color: p.categoriaColor, items: [] });
      grupos.get(p.categoriaId)!.items.push(p);
    }
    return [...grupos.values()];
  });

  async ngOnInit(): Promise<void> {
    try {
      const s = await this.api.sucursales();
      this.sucursales.set(s);
      await this.cargar(s.find(x => x.esPrincipal)?.sucursalId ?? s[0]?.sucursalId ?? null);
    } catch (e) { this.ui.error(e); }
  }

  async cambiarSucursal(id: number): Promise<void> { await this.cargar(id); }

  private async cargar(id: number | null): Promise<void> {
    try {
      const r = await this.api.disponibilidad(id);
      this.d.set(r);
      this.sucursalId.set(r.sucursalId);
    } catch (e) { this.ui.error(e); }
  }

  async alternar(p: DisponibilidadItem): Promise<void> {
    this.ocupado.set(p.productoId);
    try {
      this.d.set(await this.api.marcarAgotado(this.d()!.sucursalId, p.productoId, !p.agotado));
      this.ui.exito(p.agotado ? `${p.nombre} disponible otra vez` : `${p.nombre} marcado como agotado`);
    } catch (e) {
      this.ui.error(mensajeError(e));
    } finally {
      this.ocupado.set(null);
    }
  }
}
