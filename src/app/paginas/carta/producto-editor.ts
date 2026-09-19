import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  Area, CartaApi, Categoria, ComboGrupo, ETIQUETAS_SUGERIDAS, Grupo, ProductoDetalle, ProductoGuardar, ProductoLista,
  ProductoSucursal, TIPOS_PRODUCTO, TipoProducto, Variante, urlFoto,
} from '../../core/carta-api';
import { SolesPipe } from '../../core/formato';
import { SesionService } from '../../core/sesion';
import { Ui, esc, mensajeError } from '../../core/ui';
import { Icono } from '../../shared/icono';

interface Formulario {
  tipo: TipoProducto; nombre: string; categoriaId: number | null; areaId: number | null; codigo: string; descripcion: string;
  precio: number; afectacionIgv: string; tiempoPreparacionMin: number | null; etiquetas: string[];
}

@Component({
  selector: 'vf-producto-editor',
  imports: [FormsModule, RouterLink, Icono, SolesPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a routerLink="/carta" class="btn-fantasma -ml-3 mb-2"><vf-icono nombre="izquierda" [tam]="18" /> Carta</a>
    <div class="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 class="titulo-pagina">{{ esNuevo() ? 'Nuevo plato' : f.nombre || 'Plato' }}</h1>
        @if (p(); as p) { <p class="subtitulo">{{ p.activo ? 'Activo' : 'Inactivo' }} · actualizado {{ p.updatedAt.slice(0, 10) }}</p> }
      </div>
      @if (p(); as p) {
        <div class="flex flex-wrap gap-2">
          <button type="button" class="btn-secundario btn-sm" (click)="duplicar()"><vf-icono nombre="copiar" [tam]="16" /> Duplicar</button>
          <button type="button" class="btn-secundario btn-sm" (click)="alternarEstado()"><vf-icono nombre="power" [tam]="16" /> {{ p.activo ? 'Desactivar' : 'Activar' }}</button>
          <button type="button" class="btn-secundario btn-sm text-peligro" (click)="eliminar()"><vf-icono nombre="basura" [tam]="16" /> Eliminar</button>
        </div>
      }
    </div>

    <form class="grid gap-4 pb-24 xl:grid-cols-[1fr_22rem]" (ngSubmit)="guardar()">
      <div class="space-y-4">
        <!-- ═══ General ═══ -->
        <section class="tarjeta p-5">
          <h2 class="mb-3 font-bold">¿Qué es?</h2>
          <div class="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
            @for (t of tipos; track t.valor) {
              <button type="button" class="opcion h-16 flex-col gap-1" [class.opcion-activa]="f.tipo === t.valor"
                      [disabled]="t.valor === 'COMBO' && !puedeCombos()" (click)="f.tipo = t.valor">
                <vf-icono [nombre]="t.icono" /> {{ t.texto }}
                @if (t.valor === 'COMBO' && !puedeCombos()) { <span class="text-[11px] font-normal">plan Avanzado</span> }
              </button>
            }
          </div>

          <div class="grid gap-4 sm:grid-cols-2">
            <div class="sm:col-span-2"><label class="etiqueta" for="nom">Nombre *</label>
              <input id="nom" class="campo text-lg font-semibold" name="nombre" [(ngModel)]="f.nombre" maxlength="120" placeholder="Ej. Ceviche clásico" /></div>
            <div><label class="etiqueta" for="cat">Categoría *</label>
              <select id="cat" class="campo" name="cat" [(ngModel)]="f.categoriaId">
                @for (c of categoriasActivas(); track c.categoriaId) { <option [ngValue]="c.categoriaId">{{ c.nombre }}</option> }
              </select></div>
            @if (f.tipo !== 'COMBO') {
              <div><label class="etiqueta" for="area">Se prepara en</label>
                <select id="area" class="campo" name="area" [(ngModel)]="f.areaId">
                  <option [ngValue]="null">No requiere preparación</option>
                  @for (a of areasActivas(); track a.areaId) { <option [ngValue]="a.areaId">{{ a.nombre }}</option> }
                </select></div>
            } @else {
              <div class="flex items-end"><p class="ayuda">Cada producto del combo va a la cocina o barra que le corresponde.</p></div>
            }
            <div><label class="etiqueta" for="pre">{{ tieneVariantes() ? 'Precio base (referencial)' : 'Precio (S/, con IGV) *' }}</label>
              <input id="pre" class="campo text-2xl font-extrabold" name="precio" type="number" step="0.10" min="0" inputmode="decimal" [(ngModel)]="f.precio" /></div>
            <div><label class="etiqueta" for="cod">Código corto</label>
              <input id="cod" class="campo uppercase" name="codigo" [(ngModel)]="f.codigo" maxlength="20" placeholder="Ej. CEV-01" /></div>
            <div class="sm:col-span-2"><label class="etiqueta" for="des">Descripción</label>
              <textarea id="des" class="campo" name="desc" rows="2" maxlength="500" [(ngModel)]="f.descripcion" placeholder="Lo que verá el mesero y el cliente"></textarea></div>
            @if (f.tipo !== 'COMBO' && f.tipo !== 'PRODUCTO') {
              <div><label class="etiqueta" for="tp">Tiempo de preparación (min)</label>
                <input id="tp" class="campo" name="tp" type="number" min="0" max="240" inputmode="numeric" [(ngModel)]="f.tiempoPreparacionMin" /></div>
            }
            <div><span class="etiqueta">IGV</span>
              <div class="grid grid-cols-3 gap-2">
                @for (a of ['GRAVADO', 'EXONERADO', 'INAFECTO']; track a) {
                  <button type="button" class="opcion text-sm" [class.opcion-activa]="f.afectacionIgv === a" (click)="f.afectacionIgv = a">{{ igv(a) }}</button>
                }
              </div></div>
          </div>

          <span class="etiqueta mt-5">Etiquetas</span>
          <div class="flex flex-wrap gap-2">
            @for (e of etiquetasVisibles(); track e) {
              <button type="button" class="chip min-h-[2.5rem] border px-3.5 text-sm" (click)="alternarEtiqueta(e)"
                      [class]="f.etiquetas.includes(e) ? 'border-oro bg-oro/15 text-oro-oscuro' : 'border-borde text-suave'">
                @if (f.etiquetas.includes(e)) { <vf-icono nombre="check" [tam]="14" [grosor]="3" /> } {{ e }}
              </button>
            }
            <input class="campo !min-h-[2.5rem] w-40 !rounded-full text-sm" name="nuevaEt" [(ngModel)]="nuevaEtiqueta" maxlength="20" placeholder="+ otra" aria-label="Nueva etiqueta"
                   (keydown.enter)="$event.preventDefault(); agregarEtiqueta()" (blur)="agregarEtiqueta()" />
          </div>
        </section>

        <!-- ═══ Variantes ═══ -->
        @if (f.tipo !== 'COMBO') {
          <section class="tarjeta p-5" [class.opacity-60]="!puedeCombos()">
            <div class="mb-3 flex items-center justify-between gap-2">
              <div><h2 class="font-bold">Tamaños o variantes</h2><p class="text-sm text-suave">Ej. Personal / Familiar, Vaso / Jarra. Cada una con su precio.</p></div>
              @if (puedeCombos()) {
                <button type="button" class="btn-secundario btn-sm shrink-0" (click)="variantes.push({ varianteId: null, nombre: '', precio: f.precio, activo: true })"><vf-icono nombre="mas" [tam]="16" /> Variante</button>
              } @else { <span class="chip-oro shrink-0"><vf-icono nombre="candado" [tam]="12" /> Plan Avanzado</span> }
            </div>
            @for (v of variantes; track $index; let i = $index) {
              <div class="mb-2 grid grid-cols-[1fr_8rem_auto_auto] items-center gap-2">
                <input class="campo" [name]="'vn' + i" [(ngModel)]="v.nombre" maxlength="60" placeholder="Nombre" aria-label="Nombre de la variante" [disabled]="!puedeCombos()" />
                <input class="campo font-bold" [name]="'vp' + i" type="number" step="0.10" min="0" inputmode="decimal" [(ngModel)]="v.precio" aria-label="Precio de la variante" [disabled]="!puedeCombos()" />
                <button type="button" role="switch" class="interruptor" [attr.aria-checked]="v.activo" (click)="v.activo = !v.activo" [disabled]="!puedeCombos()" aria-label="Variante activa"><span></span></button>
                <button type="button" class="btn-icono text-peligro" (click)="variantes.splice(i, 1)" [disabled]="!puedeCombos()" aria-label="Quitar variante"><vf-icono nombre="x" /></button>
              </div>
            } @empty { <p class="text-sm text-tenue">Sin variantes: se vende a un solo precio.</p> }
          </section>

          <!-- ═══ Modificadores ═══ -->
          <section class="tarjeta p-5" [class.opacity-60]="!puedeCombos()">
            <div class="mb-3 flex items-center justify-between gap-2">
              <div><h2 class="font-bold">Modificadores</h2><p class="text-sm text-suave">Qué puede pedir el cliente: término, adicionales, "sin cebolla"… (en el orden en que los marques).</p></div>
              @if (!puedeCombos()) { <span class="chip-oro shrink-0"><vf-icono nombre="candado" [tam]="12" /> Plan Avanzado</span> }
            </div>
            <div class="grid gap-2 sm:grid-cols-2">
              @for (g of grupos(); track g.grupoId) {
                <button type="button" class="flex min-h-toque items-start gap-3 rounded-2xl border p-3 text-left transition-colors" [disabled]="!puedeCombos()"
                        [class]="grupoIds.includes(g.grupoId) ? 'border-vino bg-vino/5' : 'border-borde'" (click)="alternarGrupo(g.grupoId)">
                  <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-sm font-bold"
                        [class]="grupoIds.includes(g.grupoId) ? 'bg-vino text-white' : 'border-2 border-borde'">{{ posicion(g.grupoId) }}</span>
                  <span><span class="block font-semibold">{{ g.nombre }}</span><span class="block text-xs text-suave">{{ resumenGrupo(g) }}</span></span>
                </button>
              } @empty { <p class="text-sm text-tenue">No hay grupos creados. Créalos en Carta → Modificadores.</p> }
            </div>
          </section>
        } @else {
          <!-- ═══ Combo ═══ -->
          <section class="tarjeta p-5">
            <div class="mb-3 flex items-center justify-between gap-2">
              <div><h2 class="font-bold">Arma el combo</h2><p class="text-sm text-suave">Grupos como "Plato de fondo" o "Bebida": el cliente elige de cada uno.</p></div>
              <button type="button" class="btn-secundario btn-sm shrink-0" (click)="combo.push({ nombre: '', cantidad: 1, opciones: [] })"><vf-icono nombre="mas" [tam]="16" /> Grupo</button>
            </div>
            @for (g of combo; track $index; let gi = $index) {
              <div class="mb-3 rounded-2xl border border-borde p-3">
                <div class="mb-2 grid grid-cols-[1fr_auto_auto] items-center gap-2">
                  <input class="campo font-semibold" [name]="'cg' + gi" [(ngModel)]="g.nombre" maxlength="80" placeholder="Ej. Bebida" aria-label="Nombre del grupo" />
                  <div class="flex items-center gap-1">
                    <button type="button" class="btn-icono border border-borde" (click)="g.cantidad = mayor(1, g.cantidad - 1)" aria-label="Menos">−</button>
                    <span class="w-14 text-center text-sm"><b class="text-lg">{{ g.cantidad }}</b> elige</span>
                    <button type="button" class="btn-icono border border-borde" (click)="g.cantidad = g.cantidad + 1" aria-label="Más">+</button>
                  </div>
                  <button type="button" class="btn-icono text-peligro" (click)="combo.splice(gi, 1)" aria-label="Quitar grupo"><vf-icono nombre="basura" /></button>
                </div>
                @for (o of g.opciones; track $index; let oi = $index) {
                  <div class="mb-2 grid grid-cols-[1fr_7rem_auto] items-center gap-2 pl-2">
                    <select class="campo" [name]="'co' + gi + '_' + oi" [(ngModel)]="o.productoId" aria-label="Producto">
                      @for (c of componentes(); track c.productoId) { <option [ngValue]="c.productoId">{{ c.nombre }}</option> }
                    </select>
                    <input class="campo" [name]="'cx' + gi + '_' + oi" type="number" step="0.10" min="0" inputmode="decimal" [(ngModel)]="o.precioExtra" aria-label="Precio extra" />
                    <button type="button" class="btn-icono text-peligro" (click)="g.opciones.splice(oi, 1)" aria-label="Quitar"><vf-icono nombre="x" /></button>
                  </div>
                }
                <button type="button" class="btn-fantasma btn-sm" (click)="g.opciones.push({ productoId: primerComponente(), precioExtra: 0 })" [disabled]="!componentes().length">
                  <vf-icono nombre="mas" [tam]="16" /> Producto
                </button>
              </div>
            } @empty { <p class="text-sm text-tenue">Agrega el primer grupo del combo.</p> }
            <p class="ayuda">El precio extra se suma si el cliente elige esa opción (ej. chicha +S/ 2).</p>
          </section>
        }
      </div>

      <!-- ═══ Columna derecha: foto y sucursales ═══ -->
      <div class="space-y-4">
        <section class="tarjeta overflow-hidden">
          <div class="relative aspect-[4/3] bg-elevada">
            @if (foto(); as src) {
              <img [src]="src" [alt]="f.nombre" class="h-full w-full object-cover" />
            } @else {
              <div class="flex h-full flex-col items-center justify-center gap-2 text-tenue"><vf-icono nombre="foto" [tam]="40" /><span class="text-sm">Sin foto</span></div>
            }
            @if (subiendo()) { <div class="absolute inset-0 flex items-center justify-center bg-tinta/50"><span class="h-8 w-8 animate-spin rounded-full border-4 border-white/30 border-t-white"></span></div> }
          </div>
          <div class="flex gap-2 p-3">
            @if (esNuevo()) {
              <p class="text-sm text-suave">Guarda el plato para subirle una foto.</p>
            } @else {
              <label class="btn-secundario btn-sm flex-1 cursor-pointer"><vf-icono nombre="foto" [tam]="16" /> {{ p()?.imagen ? 'Cambiar foto' : 'Subir foto' }}
                <input type="file" accept="image/jpeg,image/png,image/webp" class="sr-only" (change)="subirFoto($event)" /></label>
              @if (p()?.imagen) { <button type="button" class="btn-icono border border-borde" (click)="quitarFoto()" aria-label="Quitar foto"><vf-icono nombre="basura" [tam]="18" /></button> }
            }
          </div>
          <p class="px-3 pb-3 text-xs text-tenue">JPG, PNG o WEBP de hasta 2 MB. Se ve en el POS táctil y en la carta del mesero.</p>
        </section>

        <section class="tarjeta p-4">
          <h2 class="mb-1 font-bold">Dónde se vende</h2>
          <p class="mb-3 text-sm text-suave">{{ tieneVariantes() ? 'Con variantes, el precio va en cada variante.' : 'Deja el precio vacío para usar el precio base.' }}</p>
          @for (s of sucursales; track s.sucursalId) {
            <div class="mb-2 rounded-2xl border border-borde p-3" [class.opacity-60]="!s.activa">
              <div class="flex items-center justify-between gap-3">
                <span class="font-semibold">{{ s.sucursal }} @if (s.agotadoHoy) { <span class="chip-peligro ml-1">Agotado hoy</span> }</span>
                <button type="button" role="switch" class="interruptor" [attr.aria-checked]="s.activa" (click)="s.activa = !s.activa" [attr.aria-label]="'Se vende en ' + s.sucursal"><span></span></button>
              </div>
              @if (s.activa && !tieneVariantes()) {
                <input class="campo mt-2" type="number" step="0.10" min="0" inputmode="decimal" [name]="'sp' + s.sucursalId" [(ngModel)]="s.precio"
                       [placeholder]="'Precio base ' + (f.precio | soles)" [attr.aria-label]="'Precio en ' + s.sucursal" />
              }
            </div>
          }
        </section>
      </div>

      <!-- Barra de guardado: siempre a mano del dedo -->
      <div class="fixed inset-x-0 bottom-0 z-20 border-t border-borde bg-superficie/95 px-4 py-3 backdrop-blur lg:left-[17rem]">
        <div class="mx-auto flex max-w-7xl items-center justify-end gap-2">
          <a routerLink="/carta" class="btn-secundario">Cancelar</a>
          <button type="submit" class="btn-primario min-w-[10rem]" [disabled]="guardando()"><vf-icono nombre="check" [tam]="18" /> {{ guardando() ? 'Guardando…' : 'Guardar plato' }}</button>
        </div>
      </div>
    </form>
  `,
})
export class ProductoEditor implements OnInit {
  private api = inject(CartaApi);
  private ui = inject(Ui);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private s = inject(SesionService);

  id = input<string>();
  tipos = TIPOS_PRODUCTO;
  p = signal<ProductoDetalle | null>(null);
  categorias = signal<Categoria[]>([]);
  areas = signal<Area[]>([]);
  grupos = signal<Grupo[]>([]);
  productos = signal<ProductoLista[]>([]);
  guardando = signal(false);
  subiendo = signal(false);

  f: Formulario = { tipo: 'PLATO', nombre: '', categoriaId: null, areaId: null, codigo: '', descripcion: '', precio: 0,
    afectacionIgv: 'GRAVADO', tiempoPreparacionMin: 15, etiquetas: [] };
  variantes: Variante[] = [];
  grupoIds: number[] = [];
  combo: ComboGrupo[] = [];
  sucursales: ProductoSucursal[] = [];
  nuevaEtiqueta = '';

  esNuevo = computed(() => !this.p());
  puedeCombos = computed(() => { this.s.sesion(); return this.s.tienePermiso('COMBOS_GESTIONAR'); });
  categoriasActivas = computed(() => this.categorias().filter(c => c.activo || c.categoriaId === this.p()?.categoriaId));
  areasActivas = computed(() => this.areas().filter(a => a.activo || a.areaId === this.p()?.areaId));
  componentes = computed(() => this.productos().filter(x => x.tipo !== 'COMBO' && x.activo && x.productoId !== this.p()?.productoId));
  foto = computed(() => urlFoto(this.p()?.imagen ?? null));

  tieneVariantes = () => this.puedeCombos() && this.variantes.some(v => v.activo);
  etiquetasVisibles = () => [...new Set([...ETIQUETAS_SUGERIDAS, ...this.f.etiquetas])];
  mayor = (a: number, b: number) => Math.max(a, b);
  primerComponente = () => this.componentes().at(0)?.productoId ?? 0;
  igv = (a: string) => a.charAt(0) + a.slice(1).toLowerCase();
  posicion = (id: number) => { const i = this.grupoIds.indexOf(id); return i >= 0 ? i + 1 : ''; };
  resumenGrupo = (g: Grupo) => `${g.minimo > 0 ? 'obligatorio' : 'opcional'} · ${g.opciones.map(o => o.nombre).slice(0, 4).join(', ')}${g.opciones.length > 4 ? '…' : ''}`;

  async ngOnInit(): Promise<void> {
    try {
      const [c, a, prods] = await Promise.all([this.api.categorias(), this.api.areas(), this.api.productos()]);
      this.categorias.set(c);
      this.areas.set(a);
      this.productos.set(prods);
      if (this.puedeCombos()) this.grupos.set(await this.api.grupos());
      const id = Number(this.id());
      if (id) this.cargar(await this.api.producto(id));
      else {
        this.f.categoriaId = c.find(x => x.activo)?.categoriaId ?? null;
        this.f.areaId = a.find(x => x.activo)?.areaId ?? null;
        const sucs = await this.api.sucursales();
        this.sucursales = sucs.map(x => ({ sucursalId: x.sucursalId, sucursal: x.nombre, activa: true, precio: null, agotadoHoy: false }));
      }
      this.cdr.markForCheck();
    } catch (e) { this.ui.error(e); }
  }

  private cargar(p: ProductoDetalle): void {
    this.p.set(p);
    this.f = { tipo: p.tipo, nombre: p.nombre, categoriaId: p.categoriaId, areaId: p.areaId, codigo: p.codigo ?? '',
      descripcion: p.descripcion ?? '', precio: p.precio, afectacionIgv: p.afectacionIgv, tiempoPreparacionMin: p.tiempoPreparacionMin,
      etiquetas: [...p.etiquetas] };
    this.variantes = p.variantes.map(v => ({ ...v }));
    this.grupoIds = [...p.grupoIds];
    this.combo = p.comboGrupos.map(g => ({ nombre: g.nombre, cantidad: g.cantidad, opciones: g.opciones.map(o => ({ productoId: o.productoId, precioExtra: o.precioExtra })) }));
    this.sucursales = p.sucursales.map(s => ({ ...s }));
    this.cdr.markForCheck();
  }

  alternarEtiqueta(e: string): void {
    this.f.etiquetas = this.f.etiquetas.includes(e) ? this.f.etiquetas.filter(x => x !== e) : [...this.f.etiquetas, e];
  }
  agregarEtiqueta(): void {
    const e = this.nuevaEtiqueta.trim().toLowerCase();
    if (e && !this.f.etiquetas.includes(e)) this.f.etiquetas = [...this.f.etiquetas, e];
    this.nuevaEtiqueta = '';
  }
  alternarGrupo(id: number): void {
    this.grupoIds = this.grupoIds.includes(id) ? this.grupoIds.filter(x => x !== id) : [...this.grupoIds, id];
  }

  private dto(): ProductoGuardar {
    const num = (v: unknown) => (v === null || v === undefined || v === '' ? null : Number(v));
    const combos = this.puedeCombos();
    return {
      categoriaId: this.f.categoriaId ?? 0, areaId: this.f.tipo === 'COMBO' ? null : this.f.areaId, tipo: this.f.tipo,
      codigo: this.f.codigo.trim() || null, nombre: this.f.nombre, descripcion: this.f.descripcion.trim() || null,
      precio: Number(this.f.precio) || 0, afectacionIgv: this.f.afectacionIgv, tiempoPreparacionMin: num(this.f.tiempoPreparacionMin),
      etiquetas: this.f.etiquetas,
      // Sin la función del plan se envía null: el servidor conserva lo que ya existía.
      variantes: combos && this.f.tipo !== 'COMBO' ? this.variantes.map(v => ({ varianteId: v.varianteId, nombre: v.nombre, precio: Number(v.precio) || 0, activo: v.activo })) : null,
      grupoIds: combos && this.f.tipo !== 'COMBO' ? this.grupoIds : null,
      comboGrupos: combos && this.f.tipo === 'COMBO' ? this.combo.map(g => ({ nombre: g.nombre, cantidad: g.cantidad,
        opciones: g.opciones.map(o => ({ productoId: Number(o.productoId), precioExtra: Number(o.precioExtra) || 0 })) })) : null,
      sucursales: this.sucursales.map(s => ({ sucursalId: s.sucursalId, activa: s.activa, precio: this.tieneVariantes() ? null : num(s.precio) })),
    };
  }

  async guardar(): Promise<void> {
    if (!this.f.nombre.trim()) { this.ui.error('Escribe el nombre del plato.', 'Falta un dato'); return; }
    if (!this.f.categoriaId) { this.ui.error('Elige una categoría (créala primero en la pestaña Categorías).', 'Falta un dato'); return; }
    this.guardando.set(true);
    try {
      const r = await this.api.guardarProducto(this.p()?.productoId ?? null, this.dto());
      const eraNuevo = this.esNuevo();
      this.cargar(r);
      this.ui.exito(eraNuevo ? 'Plato creado: ya puedes subirle una foto' : 'Plato guardado');
      if (eraNuevo) await this.router.navigate(['/carta/platos', r.productoId], { replaceUrl: true });
    } catch (e) {
      this.ui.error(mensajeError(e), 'No se guardó');
    } finally {
      this.guardando.set(false);
    }
  }

  async subirFoto(ev: Event): Promise<void> {
    const archivo = (ev.target as HTMLInputElement).files?.[0];
    (ev.target as HTMLInputElement).value = '';
    if (!archivo || !this.p()) return;
    if (archivo.size > 2 * 1024 * 1024) { this.ui.error('La foto pesa más de 2 MB: redúcela e intenta de nuevo.'); return; }
    this.subiendo.set(true);
    try {
      const r = await this.api.subirFoto(this.p()!.productoId, archivo);
      this.p.set(r);
      this.ui.exito('Foto actualizada');
    } catch (e) { this.ui.error(mensajeError(e)); }
    finally { this.subiendo.set(false); }
  }

  async quitarFoto(): Promise<void> {
    try { this.p.set(await this.api.quitarFoto(this.p()!.productoId)); } catch (e) { this.ui.error(mensajeError(e)); }
  }

  async duplicar(): Promise<void> {
    try {
      const r = await this.api.duplicar(this.p()!.productoId);
      this.ui.exito(`Se creó "${r.nombre}"`);
      await this.router.navigate(['/carta/platos', r.productoId]);
      this.cargar(r);
    } catch (e) { this.ui.error(mensajeError(e)); }
  }

  async alternarEstado(): Promise<void> {
    try {
      const r = await this.api.estadoProducto(this.p()!.productoId, !this.p()!.activo);
      this.cargar(r);
      this.ui.exito(r.activo ? 'Plato activado' : 'Plato desactivado: ya no sale en la venta');
    } catch (e) { this.ui.error(mensajeError(e)); }
  }

  async eliminar(): Promise<void> {
    if (!(await this.ui.confirmar('Eliminar plato', `¿Eliminar <b>${esc(this.p()!.nombre)}</b>? Si solo quieres dejar de venderlo, mejor desactívalo.`, 'Eliminar', true))) return;
    try {
      await this.api.eliminarProducto(this.p()!.productoId);
      this.ui.exito('Plato eliminado');
      await this.router.navigate(['/carta']);
    } catch (e) { this.ui.error(mensajeError(e)); }
  }
}
