import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Area, CartaApi, Categoria, Grupo, GrupoGuardar, ProductoLista, TIPOS_PRODUCTO, urlFoto } from '../../core/carta-api';
import { SolesPipe } from '../../core/formato';
import { SesionService } from '../../core/sesion';
import { Ui, esc, mensajeError } from '../../core/ui';
import { Icono } from '../../shared/icono';
import { Modal } from '../../shared/modal';

type Pestana = 'platos' | 'categorias' | 'modificadores' | 'areas';

export const PALETA = ['#801D31', '#B08834', '#C2410C', '#15803D', '#0E7490', '#1D4ED8', '#7C3AED', '#BE185D', '#4B5563', '#0F766E'];

@Component({
  selector: 'vf-carta',
  imports: [FormsModule, RouterLink, Icono, Modal, SolesPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mb-5 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="titulo-pagina">Carta</h1>
        <p class="subtitulo">{{ plural(productos().length, 'plato', 'platos') }} · {{ plural(categorias().length, 'categoría', 'categorías') }} · lo que se vende en cada sucursal.</p>
      </div>
      <div class="flex flex-wrap gap-2">
        @if (s.tienePermiso('CARTA_DISPONIBILIDAD')) {
          <a routerLink="/carta/disponibilidad" class="btn-secundario"><vf-icono nombre="prohibido" [tam]="18" /> Agotados de hoy</a>
        }
        <a routerLink="/carta/platos/nuevo" class="btn-oro"><vf-icono nombre="mas" [tam]="18" /> Nuevo plato</a>
      </div>
    </div>

    <nav class="pestanas mb-5" aria-label="Secciones de la carta">
      @for (p of pestanas; track p.id) {
        <button type="button" class="pestana" [class.pestana-activa]="pestana() === p.id" (click)="pestana.set(p.id)">
          {{ p.texto }}
          @if (p.id === 'modificadores' && !puedeCombos()) { <vf-icono nombre="candado" [tam]="14" class="ml-1 text-tenue" /> }
        </button>
      }
    </nav>

    @switch (pestana()) {
      <!-- ═══ PLATOS ═══ -->
      @case ('platos') {
        <div class="tarjeta mb-4 p-3 sm:p-4">
          <div class="flex flex-col gap-3 md:flex-row">
            <div class="relative flex-1">
              <vf-icono nombre="buscar" class="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-tenue" />
              <input type="search" aria-label="Buscar plato" class="campo pl-12" placeholder="Buscar por nombre o código" [ngModel]="buscar()" (ngModelChange)="buscar.set($event)" />
            </div>
            <div class="flex gap-2">
              <select class="campo md:w-44" aria-label="Tipo" [ngModel]="tipo()" (ngModelChange)="tipo.set($event)">
                <option [ngValue]="null">Todos los tipos</option>
                @for (t of tipos; track t.valor) { <option [ngValue]="t.valor">{{ t.texto }}</option> }
              </select>
              <button type="button" class="btn-secundario shrink-0" [class.!border-vino]="inactivos()" (click)="alternarInactivos()">
                <vf-icono [nombre]="inactivos() ? 'ojo' : 'prohibido'" [tam]="18" /> <span class="hidden sm:inline">{{ inactivos() ? 'Con inactivos' : 'Solo activos' }}</span>
              </button>
            </div>
          </div>
          <div class="-mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1">
            <button type="button" class="chipcat" [class.chipcat-activo]="categoria() === null" (click)="categoria.set(null)">Todas <b>{{ productos().length }}</b></button>
            @for (c of categorias(); track c.categoriaId) {
              <button type="button" class="chipcat" [class.chipcat-activo]="categoria() === c.categoriaId" (click)="categoria.set(c.categoriaId)">
                <span class="h-3 w-3 rounded-full" [style.background]="c.color"></span> {{ c.nombre }} <b>{{ conteo(c.categoriaId) }}</b>
              </button>
            }
          </div>
        </div>

        @if (!categorias().length) {
          <div class="tarjeta flex flex-col items-center gap-3 p-10 text-center">
            <vf-icono nombre="cubiertos" [tam]="40" class="text-tenue" />
            <p class="font-semibold">Empieza creando tus categorías (Entradas, Fondos, Bebidas…).</p>
            <button type="button" class="btn-primario" (click)="pestana.set('categorias'); nuevaCategoria()">Crear categoría</button>
          </div>
        } @else if (!filtrados().length) {
          <div class="tarjeta p-10 text-center text-suave">No hay platos con ese filtro.</div>
        } @else {
          <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            @for (p of filtrados(); track p.productoId) {
              <a [routerLink]="['/carta/platos', p.productoId]" class="tarjeta group flex flex-col overflow-hidden transition-transform active:scale-[0.98]" [class.opacity-55]="!p.activo">
                <div class="relative aspect-[4/3] bg-elevada">
                  @if (foto(p.imagen); as src) {
                    <img [src]="src" [alt]="p.nombre" loading="lazy" class="h-full w-full object-cover" />
                  } @else {
                    <div class="flex h-full items-center justify-center" [style.background]="p.categoriaColor + '1a'">
                      <vf-icono [nombre]="iconoTipo(p.tipo)" [tam]="36" [style.color]="p.categoriaColor" />
                    </div>
                  }
                  <span class="absolute left-0 top-0 h-full w-1.5" [style.background]="p.categoriaColor"></span>
                  @if (!p.activo) { <span class="chip-neutro absolute right-2 top-2">Inactivo</span> }
                  @if (p.tipo === 'COMBO') { <span class="chip-oro absolute right-2 top-2">Combo</span> }
                </div>
                <div class="flex flex-1 flex-col p-3">
                  <div class="line-clamp-2 font-bold leading-snug">{{ p.nombre }}</div>
                  <div class="mt-0.5 truncate text-xs text-suave">{{ p.categoria }}{{ p.area ? ' · ' + p.area : '' }}</div>
                  <div class="mt-auto pt-2">
                    @if (p.variantes) { <div class="text-[11px] font-semibold uppercase tracking-wide text-tenue">desde</div> }
                  <div class="flex items-end justify-between gap-1">
                    <span class="whitespace-nowrap text-lg font-extrabold">{{ (p.precioDesde ?? p.precio) | soles }}</span>
                    <span class="flex shrink-0 gap-1 text-tenue">
                      @if (p.variantes) { <span class="chip-neutro" title="Variantes">{{ p.variantes }} tam.</span> }
                      @if (p.grupos) { <span class="chip-neutro" title="Grupos de modificadores">+{{ p.grupos }}</span> }
                    </span>
                  </div>
                  </div>
                </div>
              </a>
            }
          </div>
        }
      }

      <!-- ═══ CATEGORÍAS ═══ -->
      @case ('categorias') {
        <div class="mb-3 flex items-center justify-between gap-2">
          <p class="text-sm text-suave">El orden de aquí es el orden en el que el mesero y el cajero ven la carta.</p>
          <button type="button" class="btn-primario shrink-0" (click)="nuevaCategoria()"><vf-icono nombre="mas" [tam]="18" /> Categoría</button>
        </div>
        <div class="tarjeta divide-y divide-borde">
          @for (c of categorias(); track c.categoriaId; let i = $index, ultimo = $last) {
            <div class="flex items-center gap-3 p-3 sm:p-4" [class.opacity-55]="!c.activo">
              <span class="h-10 w-2 shrink-0 rounded-full" [style.background]="c.color"></span>
              <div class="min-w-0 flex-1">
                <div class="font-bold">{{ c.nombre }} @if (!c.activo) { <span class="chip-neutro ml-1">Inactiva</span> }</div>
                <div class="truncate text-sm text-suave">{{ c.productos }} plato(s){{ c.descripcion ? ' · ' + c.descripcion : '' }}</div>
              </div>
              <button type="button" class="btn-icono" [disabled]="i === 0" (click)="moverCategoria(i, -1)" aria-label="Subir"><vf-icono nombre="arriba" /></button>
              <button type="button" class="btn-icono" [disabled]="ultimo" (click)="moverCategoria(i, 1)" aria-label="Bajar"><vf-icono nombre="abajo" /></button>
              <button type="button" class="btn-icono" (click)="editarCategoria(c)" aria-label="Editar"><vf-icono nombre="editar" /></button>
            </div>
          } @empty { <div class="p-8 text-center text-suave">Todavía no hay categorías.</div> }
        </div>
      }

      <!-- ═══ MODIFICADORES ═══ -->
      @case ('modificadores') {
        @if (!puedeCombos()) {
          <div class="tarjeta flex flex-col items-center gap-3 p-10 text-center">
            <span class="flex h-14 w-14 items-center justify-center rounded-2xl bg-oro/15 text-oro"><vf-icono nombre="candado" [tam]="28" /></span>
            <p class="max-w-md font-semibold">Los modificadores (término de la carne, adicionales, "sin cebolla"), las variantes y los combos vienen en el plan Avanzado.</p>
            <p class="text-sm text-suave">Consulta con VK Software Solutions para subir de plan.</p>
          </div>
        } @else {
          <div class="mb-3 flex items-center justify-between gap-2">
            <p class="text-sm text-suave">Grupos reutilizables: se crean una vez y se asignan a muchos platos.</p>
            <button type="button" class="btn-primario shrink-0" (click)="nuevoGrupo()"><vf-icono nombre="mas" [tam]="18" /> Grupo</button>
          </div>
          <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            @for (g of grupos(); track g.grupoId) {
              <button type="button" class="tarjeta p-4 text-left active:scale-[0.99]" [class.opacity-55]="!g.activo" (click)="editarGrupo(g)">
                <div class="flex items-start justify-between gap-2">
                  <div class="font-bold">{{ g.nombre }}</div>
                  <span [class]="g.minimo > 0 ? 'chip-alerta' : 'chip-neutro'">{{ reglaGrupo(g) }}</span>
                </div>
                <div class="mt-2 flex flex-wrap gap-1.5">
                  @for (o of g.opciones; track o.opcionId) {
                    <span class="chip-neutro" [class.line-through]="!o.activo">{{ o.nombre }}{{ o.precioExtra ? ' +' + (o.precioExtra | soles) : '' }}</span>
                  }
                </div>
                <div class="mt-3 text-xs text-tenue">En {{ g.productos }} plato(s){{ g.activo ? '' : ' · inactivo' }}</div>
              </button>
            } @empty { <div class="tarjeta p-8 text-center text-suave md:col-span-2 xl:col-span-3">Aún no hay grupos. Ej.: "Término de la carne" (elige 1) o "Adicionales" (hasta 3).</div> }
          </div>
        }
      }

      <!-- ═══ ÁREAS ═══ -->
      @case ('areas') {
        <div class="mb-3 flex items-center justify-between gap-2">
          <p class="text-sm text-suave">Cada plato va a la pantalla (y la impresora) de su área: Cocina, Bar, Parrilla…</p>
          <button type="button" class="btn-primario shrink-0" (click)="nuevaArea()"><vf-icono nombre="mas" [tam]="18" /> Área</button>
        </div>
        <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          @for (a of areas(); track a.areaId) {
            <button type="button" class="tarjeta flex items-center gap-3 p-4 text-left" [class.opacity-55]="!a.activo" (click)="editarArea(a)">
              <span class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white" [style.background]="a.color"><vf-icono nombre="chef" /></span>
              <div class="min-w-0 flex-1">
                <div class="font-bold">{{ a.nombre }} @if (!a.activo) { <span class="chip-neutro ml-1">Inactiva</span> }</div>
                <div class="text-sm text-suave">{{ a.productos }} plato(s) · {{ a.imprimeComanda ? 'imprime comanda' : 'sin comanda impresa' }}</div>
              </div>
              <vf-icono nombre="derecha" [tam]="18" class="text-tenue" />
            </button>
          }
        </div>
      }
    }

    <!-- ═══ Modal categoría ═══ -->
    @if (dialogo() === 'categoria') {
      <vf-modal [titulo]="editId ? 'Editar categoría' : 'Nueva categoría'" (cerrar)="dialogo.set(null)">
        <form (ngSubmit)="guardarCategoria()">
          <label class="etiqueta" for="cn">Nombre *</label>
          <input id="cn" class="campo mb-4" name="n" [(ngModel)]="cat.nombre" maxlength="60" placeholder="Ej. Ceviches" />
          <label class="etiqueta" for="cd">Descripción</label>
          <input id="cd" class="campo mb-4" name="d" [(ngModel)]="cat.descripcion" maxlength="200" />
          <label class="etiqueta">Color</label>
          <div class="mb-2 grid grid-cols-5 gap-2 sm:grid-cols-10">
            @for (c of paleta; track c) {
              <button type="button" class="h-12 rounded-xl ring-offset-2 ring-offset-superficie transition" [style.background]="c"
                      [class.ring-2]="cat.color === c" [class.ring-texto]="cat.color === c" (click)="cat.color = c" [attr.aria-label]="'Color ' + c"></button>
            }
          </div>
          <div class="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            @if (editId) {
              <div class="flex gap-2">
                <button type="button" class="btn-secundario" (click)="estadoCategoria()">{{ catActual()?.activo ? 'Desactivar' : 'Activar' }}</button>
                <button type="button" class="btn-fantasma text-peligro" (click)="eliminarCategoria()"><vf-icono nombre="basura" [tam]="18" /></button>
              </div>
            } @else { <span></span> }
            <div class="flex flex-col-reverse gap-2 sm:flex-row">
              <button type="button" class="btn-secundario" (click)="dialogo.set(null)">Cancelar</button>
              <button type="submit" class="btn-primario" [disabled]="guardando()">Guardar</button>
            </div>
          </div>
        </form>
      </vf-modal>
    }

    <!-- ═══ Modal área ═══ -->
    @if (dialogo() === 'area') {
      <vf-modal [titulo]="editId ? 'Editar área' : 'Nueva área de preparación'" (cerrar)="dialogo.set(null)">
        <form (ngSubmit)="guardarArea()">
          <label class="etiqueta" for="an">Nombre *</label>
          <input id="an" class="campo mb-4" name="n" [(ngModel)]="area.nombre" maxlength="60" placeholder="Ej. Parrilla" />
          <label class="etiqueta">Color</label>
          <div class="mb-4 grid grid-cols-5 gap-2 sm:grid-cols-10">
            @for (c of paleta; track c) {
              <button type="button" class="h-12 rounded-xl ring-offset-2 ring-offset-superficie" [style.background]="c"
                      [class.ring-2]="area.color === c" [class.ring-texto]="area.color === c" (click)="area.color = c" [attr.aria-label]="'Color ' + c"></button>
            }
          </div>
          <div class="flex items-center justify-between gap-3 rounded-2xl border border-borde p-3">
            <div><div class="font-semibold">Imprime comanda</div><div class="text-sm text-suave">Al enviar un pedido, sale un ticket en la impresora de esta área.</div></div>
            <button type="button" role="switch" class="interruptor" aria-label="Imprime comanda" [attr.aria-checked]="area.imprimeComanda" (click)="area.imprimeComanda = !area.imprimeComanda"><span></span></button>
          </div>
          <div class="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            @if (editId) {
              <div class="flex gap-2">
                <button type="button" class="btn-secundario" (click)="estadoArea()">{{ areaActual()?.activo ? 'Desactivar' : 'Activar' }}</button>
                <button type="button" class="btn-fantasma text-peligro" (click)="eliminarArea()"><vf-icono nombre="basura" [tam]="18" /></button>
              </div>
            } @else { <span></span> }
            <div class="flex flex-col-reverse gap-2 sm:flex-row">
              <button type="button" class="btn-secundario" (click)="dialogo.set(null)">Cancelar</button>
              <button type="submit" class="btn-primario" [disabled]="guardando()">Guardar</button>
            </div>
          </div>
        </form>
      </vf-modal>
    }

    <!-- ═══ Modal grupo de modificadores ═══ -->
    @if (dialogo() === 'grupo') {
      <vf-modal [titulo]="editId ? 'Editar grupo' : 'Nuevo grupo de modificadores'" subtitulo="Ej.: Término de la carne · Adicionales · Sin ingredientes" ancho="sm:max-w-2xl" (cerrar)="dialogo.set(null)">
        <form (ngSubmit)="guardarGrupo()">
          <label class="etiqueta" for="gn">Nombre *</label>
          <input id="gn" class="campo mb-4" name="n" [(ngModel)]="grupo.nombre" maxlength="80" />
          <div class="mb-4 grid grid-cols-2 gap-3">
            <div>
              <span class="etiqueta">Mínimo a elegir</span>
              <div class="flex items-center gap-2">
                <button type="button" class="btn-secundario btn-icono" (click)="grupo.minimo = max0(grupo.minimo - 1)" aria-label="Menos">−</button>
                <span class="w-10 text-center text-xl font-bold">{{ grupo.minimo }}</span>
                <button type="button" class="btn-secundario btn-icono" (click)="grupo.minimo = grupo.minimo + 1; grupo.maximo = mayor(grupo.maximo, grupo.minimo)" aria-label="Más">+</button>
              </div>
            </div>
            <div>
              <span class="etiqueta">Máximo a elegir</span>
              <div class="flex items-center gap-2">
                <button type="button" class="btn-secundario btn-icono" (click)="grupo.maximo = mayor(1, grupo.maximo - 1); grupo.minimo = menor(grupo.minimo, grupo.maximo)" aria-label="Menos">−</button>
                <span class="w-10 text-center text-xl font-bold">{{ grupo.maximo }}</span>
                <button type="button" class="btn-secundario btn-icono" (click)="grupo.maximo = grupo.maximo + 1" aria-label="Más">+</button>
              </div>
            </div>
          </div>
          <p class="mb-4 rounded-xl bg-elevada p-3 text-sm text-suave">{{ reglaGrupo(grupo) }}</p>

          <span class="etiqueta">Opciones</span>
          @for (o of grupo.opciones; track $index; let i = $index) {
            <div class="mb-2 grid grid-cols-[1fr_7rem_auto_auto] items-center gap-2">
              <input class="campo" [name]="'on' + i" [(ngModel)]="o.nombre" maxlength="80" placeholder="Opción" aria-label="Nombre de la opción" />
              <input class="campo" [name]="'op' + i" type="number" step="0.10" min="0" inputmode="decimal" [(ngModel)]="o.precioExtra" aria-label="Precio extra" />
              <button type="button" role="switch" class="interruptor" [attr.aria-checked]="o.activo" (click)="o.activo = !o.activo" aria-label="Opción activa"><span></span></button>
              <button type="button" class="btn-icono text-peligro" (click)="grupo.opciones.splice(i, 1)" aria-label="Quitar opción"><vf-icono nombre="x" /></button>
            </div>
          }
          <button type="button" class="btn-secundario btn-sm mt-1" (click)="grupo.opciones.push({ opcionId: null, nombre: '', precioExtra: 0, activo: true })"><vf-icono nombre="mas" [tam]="16" /> Opción</button>
          <p class="ayuda">El precio extra es lo que suma al plato (0 = sin costo).</p>

          <div class="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            @if (editId) {
              <div class="flex gap-2">
                <button type="button" class="btn-secundario" (click)="estadoGrupo()">{{ grupoActual()?.activo ? 'Desactivar' : 'Activar' }}</button>
                <button type="button" class="btn-fantasma text-peligro" (click)="eliminarGrupo()"><vf-icono nombre="basura" [tam]="18" /></button>
              </div>
            } @else { <span></span> }
            <div class="flex flex-col-reverse gap-2 sm:flex-row">
              <button type="button" class="btn-secundario" (click)="dialogo.set(null)">Cancelar</button>
              <button type="submit" class="btn-primario" [disabled]="guardando()">Guardar</button>
            </div>
          </div>
        </form>
      </vf-modal>
    }
  `,
  styles: [`
    .chipcat { display:inline-flex; min-height:2.75rem; flex-shrink:0; align-items:center; gap:.5rem; border-radius:9999px; border:1px solid rgb(var(--vf-borde));
      background: rgb(var(--vf-superficie)); padding: 0 1rem; font-size:.9rem; font-weight:600; color: rgb(var(--vf-suave)); }
    .chipcat b { font-weight:700; color: rgb(var(--vf-tenue)); }
    .chipcat-activo { border-color: rgb(var(--vf-vino)); background: rgb(var(--vf-vino)); color:#fff; }
    .chipcat-activo b { color: rgb(255 255 255 / .75); }
  `],
})
export class Carta implements OnInit {
  private api = inject(CartaApi);
  private ui = inject(Ui);
  private router = inject(Router);
  s = inject(SesionService);

  pestanas: { id: Pestana; texto: string }[] = [
    { id: 'platos', texto: 'Platos' }, { id: 'categorias', texto: 'Categorías' },
    { id: 'modificadores', texto: 'Modificadores' }, { id: 'areas', texto: 'Áreas de preparación' },
  ];
  tipos = TIPOS_PRODUCTO;
  paleta = PALETA;

  pestana = signal<Pestana>('platos');
  productos = signal<ProductoLista[]>([]);
  categorias = signal<Categoria[]>([]);
  grupos = signal<Grupo[]>([]);
  areas = signal<Area[]>([]);
  buscar = signal('');
  categoria = signal<number | null>(null);
  tipo = signal<string | null>(null);
  inactivos = signal(false);
  dialogo = signal<null | 'categoria' | 'area' | 'grupo'>(null);
  guardando = signal(false);

  puedeCombos = computed(() => { this.s.sesion(); return this.s.tienePermiso('COMBOS_GESTIONAR'); });
  filtrados = computed(() => {
    const q = this.buscar().trim().toLowerCase();
    return this.productos().filter(p => (this.categoria() === null || p.categoriaId === this.categoria()) &&
      (!this.tipo() || p.tipo === this.tipo()) &&
      (!q || p.nombre.toLowerCase().includes(q) || (p.codigo ?? '').toLowerCase().includes(q)));
  });

  editId: number | null = null;
  cat = { nombre: '', descripcion: null as string | null, color: PALETA[1] };
  area = { nombre: '', color: PALETA[0], imprimeComanda: true };
  grupo: GrupoGuardar = { nombre: '', minimo: 0, maximo: 1, opciones: [] };
  catActual = () => this.categorias().find(c => c.categoriaId === this.editId);
  areaActual = () => this.areas().find(a => a.areaId === this.editId);
  grupoActual = () => this.grupos().find(g => g.grupoId === this.editId);

  foto = urlFoto;
  plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;
  conteo = (id: number) => this.productos().filter(p => p.categoriaId === id).length;
  iconoTipo = (t: string) => TIPOS_PRODUCTO.find(x => x.valor === t)?.icono ?? 'cubiertos';
  max0 = (n: number) => Math.max(0, n);
  mayor = (a: number, b: number) => Math.max(a, b);
  menor = (a: number, b: number) => Math.min(a, b);
  reglaGrupo(g: { minimo: number; maximo: number }): string {
    if (g.minimo === 0) return g.maximo === 1 ? 'Opcional · hasta 1' : `Opcional · hasta ${g.maximo}`;
    if (g.minimo === g.maximo) return `Obligatorio · elige ${g.minimo}`;
    return `Obligatorio · de ${g.minimo} a ${g.maximo}`;
  }

  async ngOnInit(): Promise<void> {
    try {
      const [c, a] = await Promise.all([this.api.categorias(), this.api.areas()]);
      this.categorias.set(c);
      this.areas.set(a);
      await this.cargarProductos();
      if (this.puedeCombos()) this.grupos.set(await this.api.grupos());
    } catch (e) { this.ui.error(e); }
  }

  async cargarProductos(): Promise<void> {
    this.productos.set(await this.api.productos({ incluirInactivos: this.inactivos() }));
  }

  async alternarInactivos(): Promise<void> {
    this.inactivos.set(!this.inactivos());
    await this.cargarProductos();
  }

  private async ejecutar<T>(fn: () => Promise<T>, exito: string, alTerminar: (r: T) => void): Promise<void> {
    this.guardando.set(true);
    try {
      const r = await fn();
      alTerminar(r);
      this.ui.exito(exito);
      this.dialogo.set(null);
    } catch (e) {
      this.ui.error(mensajeError(e));
    } finally {
      this.guardando.set(false);
    }
  }

  // ─── Categorías ───
  nuevaCategoria(): void { this.editId = null; this.cat = { nombre: '', descripcion: null, color: PALETA[this.categorias().length % PALETA.length] }; this.dialogo.set('categoria'); }
  editarCategoria(c: Categoria): void { this.editId = c.categoriaId; this.cat = { nombre: c.nombre, descripcion: c.descripcion, color: c.color }; this.dialogo.set('categoria'); }
  guardarCategoria(): void { this.ejecutar(() => this.api.guardarCategoria(this.editId, this.cat), 'Categoría guardada', r => this.categorias.set(r)); }
  estadoCategoria(): void { this.ejecutar(() => this.api.estadoCategoria(this.editId!, !this.catActual()!.activo), 'Categoría actualizada', r => this.categorias.set(r)); }
  async eliminarCategoria(): Promise<void> {
    if (!(await this.ui.confirmar('Eliminar categoría', `¿Eliminar <b>${esc(this.cat.nombre)}</b>?`, 'Eliminar', true))) return;
    this.ejecutar(() => this.api.eliminarCategoria(this.editId!), 'Categoría eliminada', r => this.categorias.set(r));
  }
  async moverCategoria(i: number, delta: number): Promise<void> {
    const ids = this.categorias().map(c => c.categoriaId);
    [ids[i], ids[i + delta]] = [ids[i + delta], ids[i]];
    try { this.categorias.set(await this.api.ordenarCategorias(ids)); } catch (e) { this.ui.error(e); }
  }

  // ─── Áreas ───
  nuevaArea(): void { this.editId = null; this.area = { nombre: '', color: PALETA[2], imprimeComanda: true }; this.dialogo.set('area'); }
  editarArea(a: Area): void { this.editId = a.areaId; this.area = { nombre: a.nombre, color: a.color, imprimeComanda: a.imprimeComanda }; this.dialogo.set('area'); }
  guardarArea(): void { this.ejecutar(() => this.api.guardarArea(this.editId, this.area), 'Área guardada', r => this.areas.set(r)); }
  estadoArea(): void { this.ejecutar(() => this.api.estadoArea(this.editId!, !this.areaActual()!.activo), 'Área actualizada', r => this.areas.set(r)); }
  async eliminarArea(): Promise<void> {
    if (!(await this.ui.confirmar('Eliminar área', `¿Eliminar <b>${esc(this.area.nombre)}</b>?`, 'Eliminar', true))) return;
    this.ejecutar(() => this.api.eliminarArea(this.editId!), 'Área eliminada', r => this.areas.set(r));
  }

  // ─── Modificadores ───
  nuevoGrupo(): void {
    this.editId = null;
    this.grupo = { nombre: '', minimo: 1, maximo: 1, opciones: [{ opcionId: null, nombre: '', precioExtra: 0, activo: true }] };
    this.dialogo.set('grupo');
  }
  editarGrupo(g: Grupo): void {
    this.editId = g.grupoId;
    this.grupo = { nombre: g.nombre, minimo: g.minimo, maximo: g.maximo,
      opciones: g.opciones.map(o => ({ opcionId: o.opcionId, nombre: o.nombre, precioExtra: o.precioExtra, activo: o.activo })) };
    this.dialogo.set('grupo');
  }
  guardarGrupo(): void {
    const dto: GrupoGuardar = { ...this.grupo, opciones: this.grupo.opciones.map(o => ({ ...o, precioExtra: Number(o.precioExtra) || 0 })) };
    this.ejecutar(() => this.api.guardarGrupo(this.editId, dto), 'Grupo guardado', r => this.grupos.set(r));
  }
  estadoGrupo(): void { this.ejecutar(() => this.api.estadoGrupo(this.editId!, !this.grupoActual()!.activo), 'Grupo actualizado', r => this.grupos.set(r)); }
  async eliminarGrupo(): Promise<void> {
    const g = this.grupoActual();
    if (!(await this.ui.confirmar('Eliminar grupo', `¿Eliminar <b>${esc(this.grupo.nombre)}</b>? Se quitará de ${g?.productos ?? 0} plato(s).`, 'Eliminar', true))) return;
    this.ejecutar(() => this.api.eliminarGrupo(this.editId!), 'Grupo eliminado', r => this.grupos.set(r));
  }
}
