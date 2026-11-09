import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SolesPipe } from '../../core/formato';
import { EmpresaExcedida, Funcion, Plan, PlanGuardar } from '../../core/modelos';
import { SaApi } from '../../core/sa-api';
import { Ui, esc, mensajeError } from '../../core/ui';
import { Icono } from '../../shared/icono';
import { Modal } from '../../shared/modal';

interface RolEditor { rolId: number; nombre: string; icono: string; incluido: boolean; maximo: number; porSucursal: boolean; adminOpera: boolean; }

const ROLES_OPERATIVOS = [
  { rolId: 6, nombre: 'Gerente de local', icono: 'tienda' },
  { rolId: 2, nombre: 'Cajero', icono: 'billete' },
  { rolId: 3, nombre: 'Cocinero', icono: 'chef' },
  { rolId: 4, nombre: 'Mesero', icono: 'bandeja' },
  { rolId: 5, nombre: 'Delivery', icono: 'moto' },
];

@Component({
  selector: 'vf-planes',
  imports: [FormsModule, Icono, Modal, SolesPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="titulo-pagina">Planes de licencia</h1>
        <p class="subtitulo">Precios con IGV. FE viene incluida en todos los planes; cada empresa conecta su propia cuenta Nubefact.</p>
      </div>
      <button type="button" class="btn-naranja" (click)="nuevo()"><vf-icono nombre="mas" [tam]="18" /> Nuevo plan</button>
    </div>

    <!-- Tarjetas -->
    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
      @for (p of planes(); track p.planId) {
        <div class="tarjeta relative flex flex-col p-5" [class.opacity-60]="!p.activo" [class.ring-2]="p.destacado" [class.ring-naranja]="p.destacado">
          @if (p.destacado) { <span class="chip-naranja absolute right-4 top-4"><vf-icono nombre="estrella" [tam]="12" /> Más elegido</span> }
          <div class="text-lg font-bold">{{ p.nombre }}</div>
          @if (!p.activo) { <span class="chip-neutro mt-1 w-fit">Inactivo</span> }
          <div class="mt-2">@if (p.aCotizar) { <span class="text-3xl font-extrabold">A cotizar</span> } @else { <span class="text-3xl font-extrabold">{{ p.precioMensual | soles }}</span><span class="text-sm text-suave">/mes</span> }</div>
          <div class="text-xs text-tenue">{{ p.precioAnual ? (p.precioAnual | soles) + ' al año' : 'Sin precio anual' }}</div>
          <p class="mt-3 text-sm text-suave">{{ p.descripcion }}</p>
          <div class="mt-4 space-y-2 text-sm">
            <div class="flex items-center gap-2"><vf-icono nombre="tienda" [tam]="16" class="text-naranja" />
              @if (!p.maxSucursales) { Locales ilimitados, sin cargo }
              @else if (p.precioSucursalAdicional > 0) { {{ p.maxSucursales }} local incluido · <b>+{{ p.precioSucursalAdicional | soles }}</b> por local }
              @else { {{ p.maxSucursales }} sucursal(es) }
            </div>
            @if (p.precioSucursalAdicional > 0) {
              <div class="rounded-xl bg-marino/5 px-3 py-2 text-xs text-suave">
                {{ 2 }} locales {{ precioCon(p, 2) | soles }} · {{ 3 }} locales {{ precioCon(p, 3) | soles }} · {{ 5 }} locales {{ precioCon(p, 5) | soles }}
              </div>
            }
            <div class="flex items-center gap-2"><vf-icono nombre="usuarios" [tam]="16" class="text-naranja" /> {{ p.maxUsuarios ? 'Admin + ' + p.maxUsuarios + ' usuario(s)' : 'Usuarios ilimitados' }}</div>
            @for (c of p.cupos; track c.rolId) {
              <div class="flex items-center gap-2 pl-6 text-suave">· {{ c.rolNombre }}: {{ c.maximo ? c.maximo + (c.porSucursal ? ' por local' : '') : 'sin tope propio' }}</div>
            }
            @if (p.adminAcumula.length) {
              <div class="flex items-center gap-2"><vf-icono nombre="corona" [tam]="16" class="text-naranja" /> Admin opera como {{ nombresRoles(p.adminAcumula) }}</div>
            }
            <div class="flex items-center gap-2"><vf-icono nombre="chispa" [tam]="16" class="text-naranja" /> {{ p.funciones.length }} funciones</div>
          </div>
          <div class="mt-auto pt-4">
            <div class="mb-3 text-xs text-tenue">{{ p.empresas }} empresa(s) · {{ p.empresasActivas }} activa(s)</div>
            <div class="flex gap-2">
              <button type="button" class="btn-secundario btn-sm flex-1" (click)="editar(p)"><vf-icono nombre="editar" [tam]="16" /> Editar</button>
              @if (!p.empresas) { <button type="button" class="btn-icono border border-borde" (click)="eliminar(p)" aria-label="Eliminar plan"><vf-icono nombre="basura" [tam]="18" /></button> }
            </div>
          </div>
        </div>
      }
    </div>

    <!-- Comparativo -->
    <div class="tarjeta mt-6 overflow-x-auto">
      <table class="tabla">
        <thead><tr><th class="sticky left-0 bg-superficie">Función</th>@for (p of planes(); track p.planId) { <th class="text-center">{{ p.nombre }}</th> }</tr></thead>
        <tbody>
          @for (f of funciones(); track f.codigo; let i = $index) {
            @if (i === 0 || funciones()[i - 1].grupo !== f.grupo) {
              <tr><td [attr.colspan]="planes().length + 1" class="bg-elevada text-xs font-bold uppercase tracking-wide text-tenue">{{ f.grupo }}</td></tr>
            }
            <tr>
              <td class="sticky left-0 bg-superficie"><div class="font-semibold">{{ f.nombre }}</div><div class="text-xs text-suave">{{ f.descripcion }}</div></td>
              @for (p of planes(); track p.planId) {
                <td class="text-center">@if (p.funciones.includes(f.codigo)) { <vf-icono nombre="check" [tam]="20" [grosor]="2.5" class="text-exito" /> } @else { <span class="text-tenue">—</span> }</td>
              }
            </tr>
          }
        </tbody>
      </table>
    </div>

    <!-- Editor -->
    @if (editando()) {
      <vf-modal [titulo]="planId ? 'Editar plan' : 'Nuevo plan'" ancho="sm:max-w-3xl" (cerrar)="editando.set(false)">
        <form (ngSubmit)="guardar()">
          <div class="grid gap-4 sm:grid-cols-2">
            <div><label class="etiqueta">Nombre *</label><input aria-label="Nombre" class="campo" name="n" [(ngModel)]="f.nombre" maxlength="60" /></div>
            <div><label class="etiqueta">Orden en la página</label><input aria-label="Orden en la página" class="campo" name="o" type="number" inputmode="numeric" [(ngModel)]="f.orden" /></div>
            <div class="sm:col-span-2"><label class="etiqueta">Descripción</label><textarea aria-label="Descripción" class="campo" name="d" rows="2" maxlength="400" [(ngModel)]="f.descripcion"></textarea></div>
            <div><label class="etiqueta">Precio mensual (S/, con IGV) *</label><input aria-label="Precio mensual (S/, con IGV)" class="campo text-lg font-bold" name="pm" type="number" step="0.01" inputmode="decimal" [(ngModel)]="f.precioMensual" /></div>
            <div><label class="etiqueta">Precio anual (S/)</label>
              <div class="flex gap-2"><input aria-label="Precio anual (S/)" class="campo" name="pa" type="number" step="0.01" inputmode="decimal" [(ngModel)]="f.precioAnual" />
                <button type="button" class="btn-secundario btn-sm shrink-0" (click)="anualSugerido()">10 meses</button></div>
              <p class="ayuda">El botón deja dos meses gratis, como el resto del mercado.</p></div>
            <div><label class="etiqueta">Locales incluidos en el precio</label><input aria-label="Locales incluidos en el precio" class="campo" name="ms" type="number" inputmode="numeric" min="0" [(ngModel)]="f.maxSucursales" /><p class="ayuda">0 = ilimitados y sin cargo por local</p></div>
            <div><label class="etiqueta">Precio por local adicional (S/ al mes)</label><input aria-label="Precio por local adicional" class="campo" name="psa" type="number" step="0.01" inputmode="decimal" min="0" [(ngModel)]="f.precioSucursalAdicional" /><p class="ayuda">0 = los locales no se cobran aparte, y los incluidos pasan a ser el tope</p></div>
            <div><label class="etiqueta">Precio anual por local adicional (S/)</label><input aria-label="Precio anual por local adicional" class="campo" name="psaa" type="number" step="0.01" inputmode="decimal" min="0" [(ngModel)]="f.precioSucursalAdicionalAnual" /><p class="ayuda">Vacío = se cobra el mensual por doce</p></div>
            <div><label class="etiqueta">Máximo de usuarios (sin el Admin)</label><input aria-label="Máximo de usuarios (sin el Admin)" class="campo" name="mu" type="number" inputmode="numeric" min="0" [(ngModel)]="f.maxUsuarios" /><p class="ayuda">0 = ilimitados</p></div>
          </div>

          <div class="mt-4 grid gap-3 sm:grid-cols-2">
            <div class="flex items-center justify-between gap-3 rounded-2xl border border-borde p-3"><span class="text-sm font-semibold">Activo (se puede vender)</span>
              <button type="button" role="switch" class="interruptor" aria-label="Activo" [attr.aria-checked]="f.activo" (click)="f.activo = !f.activo"><span></span></button></div>
            <div class="flex items-center justify-between gap-3 rounded-2xl border border-borde p-3"><span class="text-sm font-semibold">"Más elegido"</span>
              <button type="button" role="switch" class="interruptor" aria-label="Más elegido" [attr.aria-checked]="f.destacado" (click)="f.destacado = !f.destacado"><span></span></button></div>
            <div class="flex items-center justify-between gap-3 rounded-2xl border border-borde p-3 sm:col-span-2">
              <div><span class="text-sm font-semibold">Precio a cotizar</span>
                <p class="text-xs text-tenue">En vez del monto se muestra "A cotizar": el precio se acuerda con cada cliente.</p></div>
              <button type="button" role="switch" class="interruptor" aria-label="Precio a cotizar" [attr.aria-checked]="f.aCotizar" (click)="f.aCotizar = !f.aCotizar"><span></span></button></div>
          </div>

          <h3 class="mb-2 mt-6 font-bold">Roles del plan</h3>
          <p class="mb-3 text-sm text-suave">Qué roles puede tener la empresa y cuántos de cada uno (0 = sin tope propio). "Admin lo opera" deja que el Administrador haga ese trabajo, por ejemplo cobrar en los planes de entrada. Con el cupo <b>por local</b>, el tope se cuenta dentro de cada sede: "2 meseros por local" da 2 en cada una, no 2 entre todas.</p>
          <div class="grid gap-3 sm:grid-cols-2">
            @for (r of roles; track r.rolId) {
              <div class="rounded-2xl border p-3" [class]="r.incluido ? 'border-marino/40 bg-marino/5' : 'border-borde'">
                <div class="flex items-center gap-3">
                  <vf-icono [nombre]="r.icono" class="text-naranja" />
                  <span class="flex-1 font-semibold">{{ r.nombre }}</span>
                  <button type="button" role="switch" class="interruptor" [attr.aria-checked]="r.incluido" (click)="r.incluido = !r.incluido" [attr.aria-label]="'Incluir ' + r.nombre"><span></span></button>
                </div>
                <div class="mt-3 grid grid-cols-2 gap-2">
                  <div><label class="text-xs text-suave">Cupo</label><input class="campo" type="number" min="0" inputmode="numeric" [name]="'c' + r.rolId" [(ngModel)]="r.maximo" [disabled]="!r.incluido" /></div>
                  <button type="button" class="opcion mt-4 text-sm" [class.opcion-activa]="r.adminOpera" (click)="r.adminOpera = !r.adminOpera">Admin lo opera</button>
                </div>
                <button type="button" class="opcion mt-2 w-full text-sm" [class.opcion-activa]="r.porSucursal"
                        [disabled]="!r.incluido || !r.maximo" (click)="r.porSucursal = !r.porSucursal">
                  {{ r.porSucursal ? 'El cupo es por local' : 'El cupo es de toda la empresa' }}
                </button>
              </div>
            }
          </div>

          <h3 class="mb-2 mt-6 font-bold">Funciones</h3>
          <p class="mb-3 text-sm text-suave">La facturación electrónica se incluye en cualquier plan. La empresa configura su ruta y token de Nubefact.</p>
          @for (g of grupos(); track g) {
            <div class="mb-3">
              <div class="mb-2 text-xs font-bold uppercase tracking-wide text-tenue">{{ g }}</div>
              <div class="grid gap-2 sm:grid-cols-2">
                @for (fn of funcionesDe(g); track fn.codigo) {
                  <button type="button" class="flex min-h-toque items-start gap-3 rounded-2xl border p-3 text-left transition-colors"
                          [class]="tiene(fn.codigo) ? 'border-exito/50 bg-exito/5' : 'border-borde'"
                          [disabled]="fn.codigo === 'FACTURACION_SUNAT'" [attr.aria-pressed]="tiene(fn.codigo)"
                          (click)="alternarFuncion(fn.codigo)">
                    <span class="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-2" [class]="tiene(fn.codigo) ? 'border-exito bg-exito text-white' : 'border-borde'">
                      @if (tiene(fn.codigo)) { <vf-icono nombre="check" [tam]="14" [grosor]="3" /> }
                    </span>
                    <span><span class="block text-sm font-semibold">{{ fn.nombre }}</span><span class="block text-xs text-suave">{{ fn.descripcion }}</span></span>
                  </button>
                }
              </div>
            </div>
          }

          <div class="mt-6 flex flex-col-reverse gap-2 border-t border-borde pt-5 sm:flex-row sm:justify-end">
            <button type="button" class="btn-secundario" (click)="editando.set(false)">Cancelar</button>
            <button type="submit" class="btn-primario" [disabled]="guardando()">Guardar plan</button>
          </div>
        </form>
      </vf-modal>
    }
  `,
})
export class Planes implements OnInit {
  private api = inject(SaApi);
  private ui = inject(Ui);

  planes = signal<Plan[]>([]);
  funciones = signal<Funcion[]>([]);
  editando = signal(false);
  guardando = signal(false);

  planId: number | null = null;
  f!: PlanGuardar;
  roles: RolEditor[] = [];
  private seleccion = signal(new Set<string>());

  grupos = computed(() => [...new Set(this.funciones().map(f => f.grupo))]);
  funcionesDe = (g: string) => this.funciones().filter(f => f.grupo === g);
  tiene = (c: string) => this.seleccion().has(c);
  nombresRoles = (ids: number[]) => ids.map(i => ROLES_OPERATIVOS.find(r => r.rolId === i)?.nombre).join(', ');

  async ngOnInit(): Promise<void> { await this.cargar(); }

  async cargar(): Promise<void> {
    try {
      const [p, f] = await Promise.all([this.api.planes(), this.api.funciones()]);
      this.planes.set(p);
      this.funciones.set(f);
    } catch (e) { this.ui.error(e); }
  }

  nuevo(): void {
    this.abrir(null);
  }

  editar(p: Plan): void {
    this.abrir(p);
  }

  private abrir(p: Plan | null): void {
    this.planId = p?.planId ?? null;
    this.f = {
      nombre: p?.nombre ?? '', descripcion: p?.descripcion ?? '', precioMensual: p?.precioMensual ?? 0,
      precioAnual: p?.precioAnual ?? null,
      precioSucursalAdicional: p?.precioSucursalAdicional ?? 0,
      precioSucursalAdicionalAnual: p?.precioSucursalAdicionalAnual ?? null,
      maxSucursales: p?.maxSucursales ?? 1, maxUsuarios: p?.maxUsuarios ?? 1,
      adminAcumula: [], cupos: [], funciones: [], destacado: p?.destacado ?? false,
      aCotizar: p?.aCotizar ?? false,
      orden: p?.orden ?? this.planes().length + 1, activo: p?.activo ?? true,
    };
    this.roles = ROLES_OPERATIVOS.map(r => {
      const c = p?.cupos.find(x => x.rolId === r.rolId);
      return { ...r, incluido: !!c, maximo: c?.maximo ?? 1, porSucursal: c?.porSucursal ?? false,
               adminOpera: p?.adminAcumula.includes(r.rolId) ?? r.rolId === 2 };
    });
    this.seleccion.set(new Set([...(p?.funciones ?? ['PEDIDOS_LOCAL', 'CARTA', 'MESAS', 'NOTA_VENTA']), 'FACTURACION_SUNAT']));
    this.editando.set(true);
  }

  /** Doce meses pagando diez: el descuento anual con el que compite el mercado. */
  anualSugerido(): void {
    this.f.precioAnual = Math.round(Number(this.f.precioMensual) * 10 * 100) / 100;
    if (Number(this.f.precioSucursalAdicional) > 0)
      this.f.precioSucursalAdicionalAnual = Math.round(Number(this.f.precioSucursalAdicional) * 10 * 100) / 100;
  }

  /** Lo que pagaría una empresa con esa cantidad de locales, al mes. */
  precioCon(p: Plan, locales: number): number {
    const incluidos = Math.max(p.maxSucursales, 1);
    return p.precioMensual + Math.max(0, locales - incluidos) * p.precioSucursalAdicional;
  }

  alternarFuncion(c: string): void {
    if (c === 'FACTURACION_SUNAT') return;
    const s = new Set(this.seleccion());
    s.has(c) ? s.delete(c) : s.add(c);
    this.seleccion.set(s);
  }

  async guardar(confirmar = false): Promise<void> {
    const dto: PlanGuardar = {
      ...this.f,
      precioMensual: Number(this.f.precioMensual), precioAnual: this.f.precioAnual === null || (this.f.precioAnual as unknown) === '' ? null : Number(this.f.precioAnual),
      maxSucursales: Number(this.f.maxSucursales), maxUsuarios: Number(this.f.maxUsuarios), orden: Number(this.f.orden),
      precioSucursalAdicional: Number(this.f.precioSucursalAdicional) || 0,
      // Vacío significa "sin precio anual por local". Como el backend conserva lo
      // que no le mandan, hay que decírselo aparte para poder borrarlo.
      precioSucursalAdicionalAnual: this.f.precioSucursalAdicionalAnual === null || (this.f.precioSucursalAdicionalAnual as unknown) === ''
        ? null : Number(this.f.precioSucursalAdicionalAnual),
      quitarPrecioSucursalAnual: this.f.precioSucursalAdicionalAnual === null || (this.f.precioSucursalAdicionalAnual as unknown) === '',
      // Sin tope (0) no hay nada que contar por local.
      cupos: this.roles.filter(r => r.incluido).map(r => ({
        rolId: r.rolId, maximo: Number(r.maximo) || 0, porSucursal: !!Number(r.maximo) && r.porSucursal,
      })),
      adminAcumula: this.roles.filter(r => r.adminOpera).map(r => r.rolId),
      funciones: [...this.seleccion()],
      confirmarExcedidas: confirmar,
    };
    this.guardando.set(true);
    try {
      if (this.planId) await this.api.actualizarPlan(this.planId, dto);
      else await this.api.crearPlan(dto);
      this.ui.exito('Plan guardado');
      this.editando.set(false);
      await this.cargar();
    } catch (e) {
      const ex = (e as HttpErrorResponse).error?.empresasExcedidas as EmpresaExcedida[] | undefined;
      if (e instanceof HttpErrorResponse && e.status === 409 && ex) {
        const lista = ex.map(x => `<li><b>${esc(x.nombre)}</b>: ${esc(x.problemas.join('; '))}</li>`).join('');
        const ok = await this.ui.confirmar('Hay empresas que ya usan más', `${esc(mensajeError(e))}<ul style="text-align:left;margin-top:.75rem">${lista}</ul>`, 'Guardar igual', true);
        if (ok) { this.guardando.set(false); await this.guardar(true); return; }
      } else {
        this.ui.error(mensajeError(e), 'No se guardó el plan');
      }
    } finally {
      this.guardando.set(false);
    }
  }

  async eliminar(p: Plan): Promise<void> {
    if (!(await this.ui.confirmar('Eliminar plan', `¿Eliminar el plan <b>${esc(p.nombre)}</b>? No tiene empresas.`, 'Eliminar', true))) return;
    try {
      await this.api.eliminarPlan(p.planId);
      this.ui.exito('Plan eliminado');
      await this.cargar();
    } catch (e) { this.ui.error(mensajeError(e)); }
  }
}
