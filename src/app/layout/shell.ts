import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { SesionService } from '../core/sesion';
import { TemaService } from '../core/tema';
import { Icono } from '../shared/icono';
import { Menu } from '../shared/menu';

interface ItemMenu { ruta: string; texto: string; icono: string; grupo: string; permisos?: string[]; }

const MENU_SA: ItemMenu[] = [
  { ruta: '/sa/tablero', texto: 'Tablero', icono: 'tablero', grupo: 'Negocio' },
  { ruta: '/sa/empresas', texto: 'Empresas', icono: 'empresa', grupo: 'Negocio' },
  { ruta: '/sa/cobros', texto: 'Cobros', icono: 'cobros', grupo: 'Negocio' },
  { ruta: '/sa/salud', texto: 'Salud', icono: 'salud', grupo: 'Negocio' },
  { ruta: '/sa/planes', texto: 'Planes', icono: 'planes', grupo: 'Producto' },
  { ruta: '/sa/roles', texto: 'Roles y permisos', icono: 'escudo', grupo: 'Producto' },
  { ruta: '/sa/bitacora', texto: 'Bitácora', icono: 'historial', grupo: 'Control' },
  { ruta: '/sa/configuracion', texto: 'Configuración', icono: 'ajustes', grupo: 'Control' },
];
// Cada ítem declara qué permisos lo muestran: el rol y el plan deciden, no el código.
const MENU_EMPRESA: ItemMenu[] = [
  { ruta: '/inicio', texto: 'Inicio', icono: 'tablero', grupo: 'General' },
  { ruta: '/operacion', texto: 'Salón y pedidos', icono: 'cubiertos', grupo: 'Servicio', permisos: ['SALON_VER', 'PEDIDO_TOMAR'] },
  { ruta: '/cocina', texto: 'Cocina', icono: 'chef', grupo: 'Servicio', permisos: ['COCINA_VER'] },
  { ruta: '/delivery/mis-envios', texto: 'Mis envíos', icono: 'moto', grupo: 'Servicio', permisos: ['DELIVERY_REPARTIR'] },
  { ruta: '/delivery/despacho', texto: 'Despacho', icono: 'moto', grupo: 'Servicio', permisos: ['DELIVERY_ASIGNAR'] },
  { ruta: '/caja', texto: 'Caja y turnos', icono: 'billete', grupo: 'Caja', permisos: ['CAJA_ABRIR_CERRAR'] },
  { ruta: '/facturacion', texto: 'Comprobantes', icono: 'nota', grupo: 'Caja', permisos: ['NOTA_VENTA_EMITIR', 'FACTURA_EMITIR'] },
  { ruta: '/reportes/ventas', texto: 'Ventas del día', icono: 'tablero', grupo: 'Control', permisos: ['REPORTES_BASICOS'] },
  { ruta: '/carta', texto: 'Carta', icono: 'cubiertos', grupo: 'Carta', permisos: ['CARTA_GESTIONAR'] },
  { ruta: '/carta/disponibilidad', texto: 'Agotados de hoy', icono: 'prohibido', grupo: 'Carta', permisos: ['CARTA_DISPONIBILIDAD'] },
  { ruta: '/inventario', texto: 'Inventario y recetas', icono: 'caja', grupo: 'Carta', permisos: ['INVENTARIO_VER', 'INVENTARIO_GESTIONAR'] },
  { ruta: '/equipo', texto: 'Tu equipo', icono: 'usuarios', grupo: 'Negocio', permisos: ['USUARIOS_GESTIONAR'] },
];

/**
 * Los cuatro destinos de la barra inferior, en el orden en que de verdad se
 * usan durante un turno. Se toman los primeros que el rol y el plan permitan;
 * todo lo demás vive detrás de "Más".
 */
const BARRA_MOVIL: ItemMenu[] = [
  { ruta: '/operacion', texto: 'Salón', icono: 'cubiertos', grupo: '', permisos: ['SALON_VER', 'PEDIDO_TOMAR'] },
  { ruta: '/cocina', texto: 'Cocina', icono: 'chef', grupo: '', permisos: ['COCINA_VER'] },
  { ruta: '/delivery/mis-envios', texto: 'Envíos', icono: 'moto', grupo: '', permisos: ['DELIVERY_REPARTIR'] },
  { ruta: '/delivery/despacho', texto: 'Despacho', icono: 'moto', grupo: '', permisos: ['DELIVERY_ASIGNAR'] },
  { ruta: '/caja', texto: 'Caja', icono: 'billete', grupo: '', permisos: ['CAJA_ABRIR_CERRAR'] },
  { ruta: '/facturacion', texto: 'Comprobantes', icono: 'nota', grupo: '', permisos: ['NOTA_VENTA_EMITIR', 'FACTURA_EMITIR'] },
  { ruta: '/inicio', texto: 'Inicio', icono: 'tablero', grupo: '' },
];

@Component({
  selector: 'vf-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icono, Menu],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-dvh lg:pl-[17.5rem]">
      <!-- ─── Barra superior: en celular abre el cajón; en escritorio lleva los menús ─── -->
      <header class="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-borde bg-superficie/90 px-2 backdrop-blur sm:px-4">
        <button type="button" class="btn-icono lg:hidden" (click)="abierto.set(true)" aria-label="Abrir menú">
          <vf-icono nombre="menu" [tam]="24" />
        </button>
        <img src="logo-marca.webp" alt="Valexa" class="solo-claro h-9 w-9 object-contain lg:hidden" />
        <img src="logo-marca-oscuro.webp" alt="" aria-hidden="true" class="solo-oscuro h-9 w-9 object-contain lg:hidden" />

        <div class="hidden min-w-0 lg:block">
          <div class="truncate text-[15px] font-bold leading-tight">{{ tituloPagina() }}</div>
          <div class="truncate text-xs text-tenue">{{ esSA() ? 'Panel SaaS' : (sesion.usuario()?.empresa ?? '') }}</div>
        </div>

        <span class="flex-1"></span>

        <!-- Sucursal: menú desplegable, no un select del sistema -->
        @if (!esSA() && sesion.sucursales().length) {
          <vf-menu alineacion="der">
            <button disparador type="button"
                    class="btn btn-sm gap-2 border border-borde bg-elevada text-texto hover:bg-borde/40"
                    aria-label="Cambiar de sucursal">
              <vf-icono nombre="tienda" [tam]="18" class="text-naranja" />
              <span class="max-w-[9rem] truncate">{{ sucursalActiva()?.nombre ?? 'Sucursal' }}</span>
              <vf-icono nombre="abajo" [tam]="16" class="text-tenue" />
            </button>
            <div class="menu-titulo">Sucursal activa</div>
            @for (s of sesion.sucursales(); track s.sucursalId) {
              <button type="button" role="menuitem" class="menu-opcion"
                      [class.menu-opcion-activa]="s.sucursalId === sesion.sucursalActivaId()"
                      (click)="elegirSucursal(s.sucursalId)">
                <vf-icono [nombre]="s.sucursalId === sesion.sucursalActivaId() ? 'check' : 'tienda'" [tam]="18" />
                <span class="flex-1 truncate">{{ s.nombre }}</span>
                @if (s.esPrincipal) { <span class="chip-neutro">Principal</span> }
              </button>
            }
          </vf-menu>
        }

        <!-- Usuario: tema, contraseña y salir -->
        <vf-menu alineacion="der">
          <button disparador type="button" class="flex min-h-toque items-center gap-2 rounded-xl px-1.5 hover:bg-elevada" aria-label="Menú de usuario">
            <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-marino text-sm font-bold text-white">{{ iniciales() }}</span>
            <vf-icono nombre="abajo" [tam]="16" class="hidden text-tenue sm:block" />
          </button>
          <div class="px-3 pb-2 pt-1">
            <div class="truncate text-sm font-bold">{{ sesion.usuario()?.nombre }}</div>
            <div class="truncate text-xs text-tenue">{{ sesion.usuario()?.rolNombre }}</div>
          </div>
          <div class="menu-separador"></div>
          <button type="button" role="menuitem" class="menu-opcion" (click)="tema.alternar()">
            <vf-icono [nombre]="tema.oscuroEfectivo() ? 'sol' : 'luna'" [tam]="19" class="text-tenue" />
            {{ tema.oscuroEfectivo() ? 'Modo claro' : 'Modo oscuro' }}
          </button>
          <a role="menuitem" class="menu-opcion" routerLink="/cambiar-password">
            <vf-icono nombre="llave" [tam]="19" class="text-tenue" /> Cambiar contraseña
          </a>
          <div class="menu-separador"></div>
          <button type="button" role="menuitem" class="menu-opcion text-peligro hover:bg-peligro/10" (click)="sesion.cerrarSesion()">
            <vf-icono nombre="salir" [tam]="19" /> Cerrar sesión
          </button>
        </vf-menu>
      </header>

      <!-- Fondo del cajón en celular -->
      @if (abierto()) {
        <div class="fixed inset-0 z-40 bg-tinta/60 backdrop-blur-[2px] lg:hidden" (click)="abierto.set(false)"></div>
      }

      <!-- ─── Barra lateral con grupos desplegables ─── -->
      <aside class="fixed inset-y-0 left-0 z-50 flex w-[17.5rem] flex-col bg-tinta text-white shadow-flotante transition-transform duration-200 lg:translate-x-0 lg:shadow-none"
             [class.-translate-x-full]="!abierto()">
        <div class="relative flex items-center px-5 pb-4 pt-5">
          <img src="logo-valexa-oscuro.webp" alt="Valexa · Software para restaurantes" class="h-auto w-44 object-contain" />
          <button type="button" class="btn-icono absolute right-2 top-4 text-white/60 hover:bg-white/10 hover:text-white lg:hidden" (click)="abierto.set(false)" aria-label="Cerrar menú">
            <vf-icono nombre="x" />
          </button>
        </div>
        <div class="mx-5 h-px bg-gradient-to-r from-naranja/0 via-naranja/50 to-naranja/0"></div>

        <nav class="flex-1 overflow-y-auto px-3 py-3" aria-label="Menú principal">
          @for (g of grupos(); track g.nombre) {
            <!-- Cabecera del grupo: toca y se despliega. -->
            <button type="button"
                    class="mt-1 flex min-h-toque w-full items-center gap-2 rounded-xl px-3 text-[11px] font-bold uppercase tracking-[0.16em] text-white/40 transition-colors hover:bg-white/[0.05] hover:text-white/70"
                    [attr.aria-expanded]="estaAbierto(g.nombre)"
                    (click)="alternarGrupo(g.nombre)">
              <span class="flex-1 text-left">{{ g.nombre }}</span>
              @if (!estaAbierto(g.nombre) && g.tieneActivo) { <span class="h-1.5 w-1.5 rounded-full bg-naranja"></span> }
              <vf-icono nombre="abajo" [tam]="16"
                        class="transition-transform duration-200"
                        [class.-rotate-90]="!estaAbierto(g.nombre)" />
            </button>

            @if (estaAbierto(g.nombre)) {
              <div class="grid gap-1 pb-1">
                @for (item of g.items; track item.ruta) {
                  <a [routerLink]="item.ruta" routerLinkActive="activo"
                     [routerLinkActiveOptions]="{ exact: item.ruta === '/carta' }"
                     (click)="abierto.set(false)"
                     class="item group relative flex min-h-toque items-center gap-3 rounded-xl px-3 text-[15px] font-medium text-white/70 transition-colors hover:bg-white/[0.06] hover:text-white">
                    <vf-icono [nombre]="item.icono" [tam]="21" class="text-white/45 transition-colors group-hover:text-naranja-claro" />
                    {{ item.texto }}
                  </a>
                }
              </div>
            }
          }
        </nav>

        <div class="border-t border-white/5 p-3">
          <div class="flex items-center gap-3 rounded-xl px-2 py-2">
            <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-naranja text-sm font-bold text-white">
              {{ iniciales() }}
            </div>
            <div class="min-w-0 flex-1">
              <div class="truncate text-sm font-semibold">{{ sesion.usuario()?.nombre }}</div>
              <div class="truncate text-xs text-white/50">{{ sesion.usuario()?.rolNombre }}</div>
            </div>
            <button type="button" class="btn-icono text-white/60 hover:bg-white/10 hover:text-white"
                    (click)="sesion.cerrarSesion()" aria-label="Cerrar sesión">
              <vf-icono nombre="salir" [tam]="20" />
            </button>
          </div>
        </div>
      </aside>

      <!-- pb-24 en celular: la barra inferior no puede tapar el último botón -->
      <main class="mx-auto w-full max-w-7xl px-4 pb-24 pt-5 sm:px-6 lg:px-8 lg:pb-16">
        <router-outlet />
      </main>

      <!-- ─── Barra inferior: en el celular y la tablet, la app se maneja desde acá ─── -->
      @if (barra().length) {
        <nav class="barra-inferior" aria-label="Accesos rápidos">
          @for (item of barra(); track item.ruta) {
            <a [routerLink]="item.ruta" routerLinkActive="activo" class="barra-item">
              <vf-icono [nombre]="item.icono" [tam]="23" />
              <span class="barra-texto">{{ item.texto }}</span>
            </a>
          }
          <button type="button" class="barra-item" [class.activo]="abierto()" (click)="abierto.set(true)">
            <vf-icono nombre="menu" [tam]="23" />
            <span class="barra-texto">Más</span>
          </button>
        </nav>
      }
    </div>
  `,
  styles: [`
    .item.activo { background: linear-gradient(90deg, rgb(250 99 7 / .22), rgb(250 99 7 / .04)); color: #fff; }
    .item.activo::before { content: ''; position: absolute; left: -12px; top: 10px; bottom: 10px; width: 4px; border-radius: 0 4px 4px 0; background: rgb(var(--vf-naranja)); }
    .item.activo vf-icono { color: rgb(var(--vf-naranja-claro)); }
  `],
})
export class Shell {
  sesion = inject(SesionService);
  tema = inject(TemaService);
  private router = inject(Router);

  abierto = signal(false);
  /** Grupos plegados a mano. Lo que no está aquí, está abierto. */
  private plegados = signal<ReadonlySet<string>>(new Set());
  private url = signal('');

  esSA = this.sesion.esSuperAdmin;

  private menu = computed<ItemMenu[]>(() => {
    if (this.esSA()) return MENU_SA;
    this.sesion.sesion(); // se recalcula cuando cambian los permisos
    return MENU_EMPRESA.filter(i => !i.permisos || this.sesion.tieneAlguno(...i.permisos));
  });

  grupos = computed(() => {
    const url = this.url();
    const porNombre = new Map<string, ItemMenu[]>();
    for (const item of this.menu()) {
      const lista = porNombre.get(item.grupo) ?? [];
      lista.push(item);
      porNombre.set(item.grupo, lista);
    }
    return [...porNombre].map(([nombre, items]) => ({
      nombre, items,
      tieneActivo: items.some(i => url === i.ruta || url.startsWith(i.ruta + '/')),
    }));
  });

  /**
   * Hasta cuatro accesos, los primeros que el rol y el plan permitan. El quinto
   * espacio siempre es "Más": con cinco iconos el pulgar ya no acierta.
   */
  barra = computed<ItemMenu[]>(() => {
    if (this.esSA()) return [];
    this.sesion.sesion();
    return BARRA_MOVIL.filter(i => !i.permisos || this.sesion.tieneAlguno(...i.permisos)).slice(0, 4);
  });

  sucursalActiva = computed(() =>
    this.sesion.sucursales().find(s => s.sucursalId === this.sesion.sucursalActivaId()));

  tituloPagina = computed(() => {
    const url = this.url();
    const exacto = this.menu().find(i => i.ruta === url);
    return exacto?.texto
      ?? this.menu().find(i => url.startsWith(i.ruta + '/'))?.texto
      ?? 'Valexa';
  });

  iniciales = computed(() =>
    (this.sesion.usuario()?.nombre ?? '?').split(' ').filter(Boolean).slice(0, 2).map(p => p[0].toUpperCase()).join('')
  );

  constructor() {
    this.url.set(this.router.url);
    if (!this.sesion.esSuperAdmin()) {
      this.sesion.refrescarPerfil().catch(() => { /* el interceptor ya maneja sesión vencida */ });
      this.sesion.cargarSucursales().catch(() => { /* se informa al operar si falta una sucursal válida */ });
    }
    this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe(e => {
      this.url.set((e as NavigationEnd).urlAfterRedirects);
      this.abierto.set(false);
    });
    // Al entrar a una sección, su grupo se despliega aunque estuviera plegado.
    effect(() => {
      const activo = this.grupos().find(g => g.tieneActivo)?.nombre;
      if (!activo) return;
      const plegados = this.plegados();
      if (!plegados.has(activo)) return;
      const copia = new Set(plegados); copia.delete(activo);
      this.plegados.set(copia);
    });
  }

  estaAbierto(grupo: string): boolean { return !this.plegados().has(grupo); }

  alternarGrupo(grupo: string): void {
    const copia = new Set(this.plegados());
    copia.has(grupo) ? copia.delete(grupo) : copia.add(grupo);
    this.plegados.set(copia);
  }

  elegirSucursal(id: number): void {
    if (!Number.isInteger(id) || id <= 0 || id === this.sesion.sucursalActivaId()) return;
    this.sesion.seleccionarSucursal(id);
    const actual = this.router.url;
    this.router.navigateByUrl('/inicio', { skipLocationChange: true })
      .then(() => this.router.navigateByUrl(actual));
  }
}
