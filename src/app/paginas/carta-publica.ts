import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

// ─────────────────────────────────────────────────────────────────────────────
// La carta que ve el comensal al escanear el QR de la mesa.
//
// Es la única pantalla del sistema SIN sesión: ni menú, ni barra lateral, ni
// nada que pida iniciar sesión. Se diseña para un celular sostenido con una
// mano, con hambre y a veces con mala señal.
//
// Solo mirar. Desde aquí no se pide.
// ─────────────────────────────────────────────────────────────────────────────
interface Variante { nombre: string; precio: number; }
interface Plato {
  nombre: string; descripcion: string | null; precio: number; imagen: string | null;
  etiquetas: string[] | null; agotado: boolean; variantes: Variante[];
}
interface Categoria { nombre: string; color: string; platos: Plato[]; }
interface Carta {
  negocio: string; sucursal: string; direccion: string | null; telefono: string | null;
  categorias: Categoria[];
}

@Component({
  selector: 'vf-carta-publica',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-fondo pb-16">
      @if (cargando()) {
        <div class="flex min-h-screen items-center justify-center p-8">
          <p class="text-sm font-semibold text-suave">Cargando la carta…</p>
        </div>
      } @else if (error()) {
        <div class="flex min-h-screen items-center justify-center p-8">
          <div class="max-w-xs text-center">
            <p class="text-5xl">🍽️</p>
            <h1 class="mt-4 text-xl font-black">Esta carta no está disponible</h1>
            <p class="mt-2 text-sm text-suave">
              Puede que el restaurante la haya apagado o que el código del QR ya no sea el vigente.
              Pídele la carta al mozo.
            </p>
          </div>
        </div>
      } @else if (carta()) {
        @let c = carta()!;
        <!-- Cabecera: quién es y dónde está -->
        <header class="bg-marino px-5 pb-6 pt-8 text-white">
          <h1 class="text-2xl font-black leading-tight">{{ c.negocio }}</h1>
          <p class="mt-1 text-sm font-semibold text-white/70">{{ c.sucursal }}</p>
          @if (c.direccion) { <p class="mt-2 text-xs text-white/60">{{ c.direccion }}</p> }
          @if (c.telefono) {
            <a class="mt-3 inline-flex items-center gap-1.5 rounded-full bg-naranja px-4 py-2 text-sm font-bold text-white"
               [href]="'tel:' + c.telefono">Llamar {{ c.telefono }}</a>
          }
        </header>

        <!-- Las categorías viajan en una tira horizontal: con 9 categorías, una
             lista vertical empuja la comida fuera de la pantalla. -->
        @if (c.categorias.length > 1) {
          <nav class="sticky top-0 z-10 flex gap-2 overflow-x-auto border-b border-borde bg-superficie/95 px-4 py-3 backdrop-blur">
            @for (cat of c.categorias; track cat.nombre) {
              <button type="button" [id]="'chip-' + ancla(cat.nombre)"
                      class="shrink-0 rounded-full px-4 py-2 text-sm font-bold transition"
                      [class.bg-naranja]="activa() === cat.nombre"
                      [class.text-white]="activa() === cat.nombre"
                      [class.bg-fondo]="activa() !== cat.nombre"
                      [class.text-suave]="activa() !== cat.nombre"
                      (click)="irA(cat.nombre)">{{ cat.nombre }}</button>
            }
          </nav>
        }

        <main class="px-4">
          @for (cat of c.categorias; track cat.nombre) {
            <section [id]="ancla(cat.nombre)" class="scroll-mt-20 pt-7">
              <h2 class="flex items-center gap-2 text-lg font-black">
                <span class="h-4 w-1.5 rounded-full" [style.background]="cat.color"></span>
                {{ cat.nombre }}
              </h2>
              <ul class="mt-3 grid gap-3">
                @for (p of cat.platos; track p.nombre) {
                  <li class="flex gap-3 rounded-2xl border border-borde bg-superficie p-3 shadow-tarjeta"
                      [class.opacity-60]="p.agotado">
                    @if (p.imagen) {
                      <img class="h-20 w-20 shrink-0 rounded-xl object-cover" loading="lazy"
                           [src]="foto(p.imagen)" [alt]="p.nombre">
                    }
                    <div class="min-w-0 flex-1">
                      <div class="flex items-start justify-between gap-3">
                        <h3 class="text-[15px] font-bold leading-snug">{{ p.nombre }}</h3>
                        @if (!p.variantes.length) {
                          <span class="cifra shrink-0 text-base">{{ p.precio | currency:'PEN':'symbol':'1.2-2' }}</span>
                        }
                      </div>
                      @if (p.descripcion) {
                        <p class="mt-0.5 text-xs leading-relaxed text-suave">{{ p.descripcion }}</p>
                      }
                      @if (p.etiquetas?.length) {
                        <div class="mt-1.5 flex flex-wrap gap-1">
                          @for (e of p.etiquetas; track e) {
                            <span class="rounded-full bg-naranja/10 px-2 py-0.5 text-[11px] font-bold text-naranja">{{ e }}</span>
                          }
                        </div>
                      }
                      <!-- Los tamaños son precios distintos del mismo plato: van
                           abajo, cada uno con el suyo, no escondidos en un combo. -->
                      @if (p.variantes.length) {
                        <div class="mt-2 grid gap-1">
                          @for (v of p.variantes; track v.nombre) {
                            <div class="flex items-baseline justify-between gap-3 border-t border-borde pt-1 text-sm">
                              <span class="font-semibold text-suave">{{ v.nombre }}</span>
                              <span class="cifra">{{ v.precio | currency:'PEN':'symbol':'1.2-2' }}</span>
                            </div>
                          }
                        </div>
                      }
                      @if (p.agotado) {
                        <span class="mt-2 inline-block rounded-full bg-peligro/15 px-2 py-0.5 text-[11px] font-black uppercase tracking-wide text-peligro">
                          Agotado hoy
                        </span>
                      }
                    </div>
                  </li>
                }
              </ul>
            </section>
          }
          @if (!c.categorias.length) {
            <p class="py-16 text-center text-sm text-suave">Este local todavía no tiene platos publicados.</p>
          }
        </main>

        <footer class="mt-10 border-t border-borde px-4 py-6 text-center">
          <p class="text-xs text-tenue">Los precios incluyen IGV. Carta sujeta a disponibilidad.</p>
          <p class="mt-2 text-[11px] font-bold tracking-wide text-tenue">Hecho con Valexa</p>
        </footer>
      }
    </div>
  `,
})
export class CartaPublicaPagina implements OnInit, OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly ruta = inject(ActivatedRoute);

  readonly carta = signal<Carta | null>(null);
  readonly cargando = signal(true);
  readonly error = signal(false);
  readonly activa = signal('');

  readonly titulo = computed(() => this.carta()?.negocio ?? 'Carta');

  async ngOnInit(): Promise<void> {
    const codigo = this.ruta.snapshot.paramMap.get('codigo') ?? '';
    try {
      const c = await firstValueFrom(this.http.get<Carta>(`${environment.api}/publico/carta/${encodeURIComponent(codigo)}`));
      this.carta.set(c);
      this.activa.set(c.categorias[0]?.nombre ?? '');
      document.title = `${c.negocio} · Carta`;
      // Ya hay categorias: desde aqui la tira sigue al pulgar.
      window.addEventListener('scroll', this.alDesplazar, { passive: true });
    } catch {
      // Cualquier error es el mismo error para el comensal: no hay carta aquí.
      this.error.set(true);
    } finally {
      this.cargando.set(false);
    }
  }

  // La tira de categorias tiene que seguir a lo que el pulgar esta mirando: si
  // marca "Tiraditos" mientras el cliente lee las sopas, deja de ser una guia.
  // Un listener de scroll y no un IntersectionObserver: el observer no entrega
  // nada mientras la pestana no se esta pintando, y aqui hace falta algo que se
  // pueda comprobar siempre.
  private readonly alDesplazar = () => {
    const cats = this.carta()?.categorias ?? [];
    if (!cats.length) return;
    let actual = cats[0].nombre;
    for (const c of cats) {
      const el = document.getElementById(this.ancla(c.nombre));
      if (el && el.getBoundingClientRect().top <= 120) actual = c.nombre;
    }
    if (actual !== this.activa()) {
      this.activa.set(actual);
      document.getElementById('chip-' + this.ancla(actual))
        ?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  };

  ngOnDestroy(): void { window.removeEventListener('scroll', this.alDesplazar); }

  foto(ruta: string): string { return `${environment.archivos}/${ruta}`; }

  /** Un ancla estable por nombre: no exponemos ids de la base en la URL. */
  ancla(nombre: string): string {
    return 'c-' + nombre.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-');
  }

  irA(nombre: string): void {
    this.activa.set(nombre);
    document.getElementById(this.ancla(nombre))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
