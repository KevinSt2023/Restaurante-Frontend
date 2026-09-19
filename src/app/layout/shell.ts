import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { SesionService } from '../core/sesion';
import { TemaService } from '../core/tema';
import { Icono } from '../shared/icono';

interface ItemMenu { ruta: string; texto: string; icono: string; grupo?: string; permisos?: string[]; }

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
  { ruta: '/carta', texto: 'Carta', icono: 'cubiertos', grupo: 'Carta', permisos: ['CARTA_GESTIONAR'] },
  { ruta: '/carta/disponibilidad', texto: 'Disponibilidad', icono: 'prohibido', grupo: 'Carta', permisos: ['CARTA_DISPONIBILIDAD'] },
];

@Component({
  selector: 'vf-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icono],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-dvh lg:pl-[17rem]">
      <!-- Barra superior (celular y tablet) -->
      <header class="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-white/5 bg-tinta px-2 text-white lg:hidden">
        <button type="button" class="btn-icono text-white/80 hover:bg-white/10 hover:text-white" (click)="abierto.set(true)" aria-label="Abrir menú">
          <vf-icono nombre="menu" [tam]="24" />
        </button>
        <img src="logo-icono.webp" alt="" class="h-9 w-9 rounded-lg" />
        <span class="marca text-lg">VALEXA<span class="text-oro-claro">FOOD</span></span>
        <span class="flex-1"></span>
        <button type="button" class="btn-icono text-white/80 hover:bg-white/10 hover:text-white" (click)="tema.alternar()" [attr.aria-label]="tema.oscuroEfectivo() ? 'Modo claro' : 'Modo oscuro'">
          <vf-icono [nombre]="tema.oscuroEfectivo() ? 'sol' : 'luna'" />
        </button>
      </header>

      <!-- Fondo del cajón -->
      @if (abierto()) {
        <div class="fixed inset-0 z-40 bg-tinta/60 backdrop-blur-[2px] lg:hidden" (click)="abierto.set(false)"></div>
      }

      <!-- Barra lateral -->
      <aside class="fixed inset-y-0 left-0 z-50 flex w-[17rem] flex-col bg-tinta text-white shadow-flotante transition-transform duration-200 lg:translate-x-0 lg:shadow-none"
             [class.-translate-x-full]="!abierto()">
        <div class="relative flex items-center gap-3 px-5 pb-5 pt-6">
          <img src="logo-icono.webp" alt="ValexaFood" class="h-12 w-12 rounded-xl ring-1 ring-oro/30" />
          <div class="min-w-0">
            <div class="marca text-[1.35rem] leading-none">VALEXA<span class="text-oro-claro">FOOD</span></div>
            <div class="mt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-oro/80">{{ esSA() ? 'Panel SaaS' : (sesion.usuario()?.empresa ?? '') }}</div>
          </div>
          <button type="button" class="btn-icono absolute right-2 top-5 text-white/60 hover:bg-white/10 hover:text-white lg:hidden" (click)="abierto.set(false)" aria-label="Cerrar menú">
            <vf-icono nombre="x" />
          </button>
        </div>
        <div class="mx-5 h-px bg-gradient-to-r from-oro/0 via-oro/40 to-oro/0"></div>

        <nav class="flex-1 overflow-y-auto px-3 py-4" aria-label="Menú principal">
          @for (item of menu(); track item.ruta; let i = $index) {
            @if (item.grupo && (i === 0 || item.grupo !== menu()[i - 1].grupo)) {
              <div class="px-3 pb-2 pt-4 text-[11px] font-bold uppercase tracking-[0.16em] text-white/35 first:pt-0">{{ item.grupo }}</div>
            }
            <a [routerLink]="item.ruta" routerLinkActive="activo" [routerLinkActiveOptions]="{ exact: item.ruta === '/carta' }" (click)="abierto.set(false)"
               class="item group relative mb-1 flex min-h-toque items-center gap-3 rounded-xl px-3 text-[15px] font-medium text-white/70 transition-colors hover:bg-white/[0.06] hover:text-white">
              <vf-icono [nombre]="item.icono" [tam]="21" class="text-white/50 transition-colors group-hover:text-oro-claro" />
              {{ item.texto }}
            </a>
          }
        </nav>

        <div class="border-t border-white/5 p-3">
          <div class="flex items-center gap-3 rounded-xl px-2 py-2">
            <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-vino to-vino-oscuro text-sm font-bold text-oro-claro ring-1 ring-oro/30">
              {{ iniciales() }}
            </div>
            <div class="min-w-0 flex-1">
              <div class="truncate text-sm font-semibold">{{ sesion.usuario()?.nombre }}</div>
              <div class="truncate text-xs text-white/50">{{ sesion.usuario()?.rolNombre }}</div>
            </div>
          </div>
          <div class="mt-1 grid grid-cols-2 gap-2">
            <button type="button" class="btn btn-sm justify-start bg-white/[0.06] text-white/80 hover:bg-white/10 hover:text-white" (click)="tema.alternar()">
              <vf-icono [nombre]="tema.oscuroEfectivo() ? 'sol' : 'luna'" [tam]="18" /> {{ tema.oscuroEfectivo() ? 'Claro' : 'Oscuro' }}
            </button>
            <button type="button" class="btn btn-sm justify-start bg-white/[0.06] text-white/80 hover:bg-vino hover:text-white" (click)="sesion.cerrarSesion()">
              <vf-icono nombre="salir" [tam]="18" /> Salir
            </button>
          </div>
        </div>
      </aside>

      <main class="mx-auto w-full max-w-7xl px-4 pb-16 pt-6 sm:px-6 lg:px-8 lg:pt-8">
        <router-outlet />
      </main>
    </div>
  `,
  styles: [`
    .marca { font-family: Cinzel, Georgia, serif; font-weight: 700; letter-spacing: .06em;
      background: linear-gradient(180deg, #d9b56d, #b9853c); -webkit-background-clip: text; background-clip: text; color: transparent; }
    .marca span { background: inherit; -webkit-background-clip: text; background-clip: text; }
    .item.activo { background: linear-gradient(90deg, rgb(var(--vf-vino) / .55), rgb(var(--vf-vino) / .15)); color: #fff; }
    .item.activo::before { content: ''; position: absolute; left: -12px; top: 10px; bottom: 10px; width: 4px; border-radius: 0 4px 4px 0; background: rgb(var(--vf-oro-claro)); }
    .item.activo vf-icono { color: rgb(var(--vf-oro-claro)); }
  `],
})
export class Shell {
  sesion = inject(SesionService);
  tema = inject(TemaService);
  abierto = signal(false);

  esSA = this.sesion.esSuperAdmin;
  menu = computed(() => {
    if (this.esSA()) return MENU_SA;
    this.sesion.sesion(); // se recalcula cuando cambian los permisos
    return MENU_EMPRESA.filter(i => !i.permisos || this.sesion.tieneAlguno(...i.permisos));
  });
  iniciales = computed(() =>
    (this.sesion.usuario()?.nombre ?? '?').split(' ').filter(Boolean).slice(0, 2).map(p => p[0].toUpperCase()).join('')
  );

  constructor() {
    if (!this.sesion.esSuperAdmin()) this.sesion.refrescarPerfil().catch(() => { /* el interceptor ya maneja sesión vencida */ });
    inject(Router).events.pipe(filter(e => e instanceof NavigationEnd)).subscribe(() => this.abierto.set(false));
  }
}
