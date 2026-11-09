import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { FechaPipe } from '../core/formato';
import { SesionService } from '../core/sesion';
import { Icono } from '../shared/icono';

interface PermisoCatalogo {
  codigo: string; nombre: string; modulo: string; descripcion: string; funcionRequerida: string | null;
}
interface Acceso { ruta: string; texto: string; icono: string; permisos: string[]; }

/** Los mismos accesos del menú, como mosaicos grandes para entrar de un toque. */
const ACCESOS: Acceso[] = [
  { ruta: '/operacion', texto: 'Salón y pedidos', icono: 'cubiertos', permisos: ['SALON_VER', 'PEDIDO_TOMAR'] },
  { ruta: '/cocina', texto: 'Cocina', icono: 'chef', permisos: ['COCINA_VER'] },
  { ruta: '/caja', texto: 'Caja y turnos', icono: 'billete', permisos: ['CAJA_ABRIR_CERRAR'] },
  { ruta: '/facturacion', texto: 'Comprobantes', icono: 'nota', permisos: ['NOTA_VENTA_EMITIR', 'FACTURA_EMITIR'] },
  { ruta: '/reportes/ventas', texto: 'Ventas del día', icono: 'tablero', permisos: ['REPORTES_BASICOS'] },
  { ruta: '/carta', texto: 'Carta', icono: 'cubiertos', permisos: ['CARTA_GESTIONAR'] },
  { ruta: '/carta/disponibilidad', texto: 'Agotados de hoy', icono: 'prohibido', permisos: ['CARTA_DISPONIBILIDAD'] },
  { ruta: '/inventario', texto: 'Inventario y recetas', icono: 'caja', permisos: ['INVENTARIO_VER', 'INVENTARIO_GESTIONAR'] },
];

@Component({
  selector: 'vf-inicio',
  imports: [Icono, FechaPipe, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="space-y-5">
      <header>
        <h1 class="titulo-pagina">Hola, {{ s.usuario()?.nombre }}</h1>
        <p class="subtitulo mt-1">{{ s.usuario()?.rolNombre }} · {{ s.usuario()?.empresa }} · {{ s.usuario()?.sucursal }}</p>
      </header>

      <div class="grid gap-4 md:grid-cols-2">
        <div class="tarjeta p-5">
          <div class="flex items-center gap-2 text-sm font-semibold text-suave">
            <vf-icono nombre="corona" [tam]="18" class="text-naranja" /> Tu plan
          </div>
          <div class="mt-2 text-2xl font-extrabold">{{ s.sesion()?.plan?.nombre ?? '—' }}</div>
          <div class="mt-1 text-sm text-suave">Vigente hasta {{ s.sesion()?.plan?.vencimiento | fecha }}</div>
          @if (s.sesion()?.plan?.diasParaVencer; as dias) {
            @if (dias <= 15) {
              <p class="mt-2 text-sm font-bold" [class.text-peligro]="dias <= 5" [class.text-alerta]="dias > 5">
                Quedan {{ dias }} día(s). Renueva para no perder el servicio.
              </p>
            }
          }
        </div>
        <div class="tarjeta p-5">
          <div class="flex items-center gap-2 text-sm font-semibold text-suave">
            <vf-icono nombre="escudo" [tam]="18" class="text-naranja" /> Tu rol
          </div>
          <div class="mt-2 text-2xl font-extrabold">{{ s.usuario()?.rolNombre }}</div>
          <div class="mt-1 text-sm text-suave">
            {{ puede().length }} acción(es) habilitadas por tu rol y tu plan
          </div>
        </div>
      </div>

      <!-- Accesos directos, grandes -->
      @if (accesos().length) {
        <section>
          <h2 class="mb-2 text-lg font-bold">A qué puedes entrar</h2>
          <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            @for (a of accesos(); track a.ruta) {
              <a [routerLink]="a.ruta"
                 class="flex min-h-[6.5rem] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-borde bg-superficie p-4 text-center text-[15px] font-bold transition-all hover:border-naranja hover:text-naranja active:scale-[0.97]">
                <vf-icono [nombre]="a.icono" [tam]="28" class="text-naranja" />
                {{ a.texto }}
              </a>
            }
          </div>
        </section>
      } @else {
        <section class="rounded-2xl border border-dashed border-borde p-8 text-center">
          <vf-icono nombre="info" [tam]="32" class="text-tenue" />
          <p class="mt-2 font-bold">Tu rol todavía no tiene pantallas disponibles</p>
          <p class="mt-1 text-sm text-suave">
            Tu plan incluye tu rol, pero el módulo que te corresponde aún no está publicado.
            Avísale al administrador del restaurante.
          </p>
        </section>
      }

      <!-- Qué puede hacer este rol, en castellano y agrupado por módulo -->
      <section class="tarjeta p-5">
        <h2 class="text-lg font-bold">Lo que puedes hacer</h2>
        <p class="mt-1 text-sm text-suave">Esto lo deciden dos cosas: tu rol en el restaurante y el plan contratado.</p>
        <div class="mt-4 grid gap-4 sm:grid-cols-2">
          @for (g of porModulo(); track g.modulo) {
            <div>
              <p class="text-[11px] font-bold uppercase tracking-[0.14em] text-tenue">{{ g.modulo }}</p>
              <ul class="mt-1.5 space-y-1">
                @for (p of g.permisos; track p.codigo) {
                  <li class="flex items-start gap-2 text-sm">
                    <vf-icono nombre="check" [tam]="16" class="mt-0.5 shrink-0 text-exito" />
                    <span>{{ p.nombre }}</span>
                  </li>
                }
              </ul>
            </div>
          }
        </div>

        @if (bloqueadas().length) {
          <details class="mt-5">
            <summary class="min-h-toque cursor-pointer select-none pt-2 text-sm font-bold text-suave">
              Lo que tu plan no incluye ({{ bloqueadas().length }})
            </summary>
            <ul class="mt-2 space-y-1">
              @for (p of bloqueadas(); track p.codigo) {
                <li class="flex items-start gap-2 text-sm text-tenue">
                  <vf-icono nombre="candado" [tam]="16" class="mt-0.5 shrink-0" />
                  <span>{{ p.nombre }} <span class="text-xs">· {{ p.modulo }}</span></span>
                </li>
              }
            </ul>
            <p class="mt-2 text-xs text-tenue">Se habilitan subiendo de plan, no cambiando de rol.</p>
          </details>
        }
      </section>
    </section>
  `,
})
export class Inicio {
  s = inject(SesionService);
  private http = inject(HttpClient);

  private catalogo = signal<PermisoCatalogo[]>([]);

  /** Los permisos que este usuario SÍ tiene, con su nombre en castellano. */
  puede = computed(() => {
    const mios = new Set(this.s.sesion()?.permisos ?? []);
    return this.catalogo().filter(p => mios.has(p.codigo));
  });

  /** Lo que su rol podría hacer pero el plan no incluye: explica el candado. */
  bloqueadas = computed(() => {
    const mios = new Set(this.s.sesion()?.permisos ?? []);
    const funciones = new Set(this.s.sesion()?.funciones ?? []);
    return this.catalogo().filter(p =>
      !mios.has(p.codigo) && p.funcionRequerida !== null && !funciones.has(p.funcionRequerida));
  });

  porModulo = computed(() => {
    const grupos = new Map<string, PermisoCatalogo[]>();
    for (const p of this.puede()) {
      const lista = grupos.get(p.modulo) ?? [];
      lista.push(p);
      grupos.set(p.modulo, lista);
    }
    return [...grupos].map(([modulo, permisos]) => ({ modulo, permisos }));
  });

  accesos = computed(() => {
    this.s.sesion();
    return ACCESOS.filter(a => this.s.tieneAlguno(...a.permisos));
  });

  constructor() {
    void this.cargarCatalogo();
  }

  private async cargarCatalogo(): Promise<void> {
    try {
      this.catalogo.set(await firstValueFrom(
        this.http.get<PermisoCatalogo[]>(`${environment.api}/auth/catalogo-permisos`)));
    } catch {
      /* Sin catálogo la pantalla sigue siendo útil: muestra el plan y los accesos. */
    }
  }
}
