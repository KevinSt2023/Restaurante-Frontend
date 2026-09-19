import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SesionService } from '../core/sesion';
import { mensajeError } from '../core/ui';
import { Icono } from '../shared/icono';

@Component({
  selector: 'vf-login',
  imports: [FormsModule, Icono],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="grid min-h-dvh bg-tinta lg:grid-cols-[1.15fr_1fr]">
      <!-- Imagen de marca -->
      <!-- La imagen se muestra completa y a escala (object-contain), centrada en
           cualquier pantalla: nunca se estira ni se recorta. -->
      <section class="relative hidden flex-col items-center justify-center gap-8 overflow-hidden p-10 lg:flex xl:p-16">
        <div class="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgb(128_29_49/0.18),transparent_65%)]"></div>
        <img src="login-fondo.webp" alt="ValexaFood · Gestión inteligente para restaurantes"
             class="logo-fundido relative h-auto max-h-[66vh] w-full max-w-[44rem] object-contain" />
        <p class="relative max-w-md text-center text-sm leading-relaxed text-white/60">
          Pedidos, cocina, delivery, mesas y caja en un solo lugar. Hecho en Perú para restaurantes que quieren crecer.
        </p>
      </section>

      <!-- Formulario -->
      <section class="relative flex items-center justify-center px-5 py-10 sm:px-10">
        <img src="login-fondo.webp" alt="" class="absolute inset-0 h-full w-full object-cover opacity-15 blur-[2px] lg:hidden" />
        <div class="relative w-full max-w-md">
          <div class="mb-8 flex flex-col items-center text-center lg:items-start lg:text-left">
            <img src="logo-icono.webp" alt="ValexaFood" class="mb-4 h-20 w-20 rounded-2xl ring-1 ring-oro/40 lg:hidden" />
            <h1 class="marca text-4xl">VALEXA<span>FOOD</span></h1>
            <p class="mt-2 text-[11px] font-semibold uppercase tracking-[0.3em] text-oro/80">Gestión inteligente para restaurantes</p>
          </div>

          <form class="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-flotante backdrop-blur-md sm:p-8" (ngSubmit)="ingresar()" autocomplete="on">
            <h2 class="text-xl font-bold text-white">Ingresa a tu cuenta</h2>
            <p class="mb-6 mt-1 text-sm text-white/55">Con el correo y la contraseña que te entregaron.</p>

            @if (sesion.motivoCierre(); as motivo) {
              <div class="mb-5 flex gap-3 rounded-xl border border-oro/30 bg-oro/10 p-3 text-sm text-oro-claro" role="status">
                <vf-icono nombre="info" class="mt-0.5" /> <span>{{ motivo }}</span>
              </div>
            }
            @if (error()) {
              <div class="mb-5 flex gap-3 rounded-xl border border-peligro/40 bg-peligro/15 p-3 text-sm text-red-200" role="alert">
                <vf-icono nombre="alerta" class="mt-0.5" /> <span>{{ error() }}</span>
              </div>
            }

            <label class="mb-1.5 block text-sm font-semibold text-white/70" for="email">Correo</label>
            <input id="email" name="email" type="email" inputmode="email" autocomplete="username" required
                   class="oscuro mb-4" [(ngModel)]="email" placeholder="tucorreo@restaurante.pe" />

            <label class="mb-1.5 block text-sm font-semibold text-white/70" for="password">Contraseña</label>
            <div class="relative mb-6">
              <input id="password" name="password" [type]="ver() ? 'text' : 'password'" autocomplete="current-password" required
                     class="oscuro pr-14" [(ngModel)]="password" placeholder="••••••••" />
              <button type="button" class="btn-icono absolute right-0 top-0 text-white/50 hover:bg-transparent hover:text-white"
                      (click)="ver.set(!ver())" [attr.aria-label]="ver() ? 'Ocultar contraseña' : 'Ver contraseña'">
                <vf-icono [nombre]="ver() ? 'candado' : 'ojo'" />
              </button>
            </div>

            <button type="submit" class="btn-oro h-14 w-full text-base" [disabled]="cargando()">
              @if (cargando()) { <span class="h-5 w-5 animate-spin rounded-full border-2 border-tinta/30 border-t-tinta"></span> Ingresando… }
              @else { Ingresar <vf-icono nombre="derecha" /> }
            </button>
          </form>
          <p class="mt-6 text-center text-xs text-white/35">© {{ anio }} VK Software Solutions · ValexaFood</p>
        </div>
      </section>
    </div>
  `,
  styles: [`
    /* Sin marco: los bordes de la imagen se desvanecen hacia el negro del fondo
       (dos degradados cruzados: horizontal y vertical) para que el logo "flote". */
    .logo-fundido {
      -webkit-mask-image: linear-gradient(90deg, transparent 0%, #000 16%, #000 84%, transparent 100%),
                          linear-gradient(180deg, transparent 0%, #000 14%, #000 86%, transparent 100%);
      -webkit-mask-composite: source-in;
      mask-image: linear-gradient(90deg, transparent 0%, #000 16%, #000 84%, transparent 100%),
                  linear-gradient(180deg, transparent 0%, #000 14%, #000 86%, transparent 100%);
      mask-composite: intersect;
    }
    .marca { font-family: Cinzel, Georgia, serif; font-weight: 700; letter-spacing: .05em;
      background: linear-gradient(180deg, #c0455d, #7d1b2f); -webkit-background-clip: text; background-clip: text; color: transparent; }
    .marca span { background: linear-gradient(180deg, #ecd08d, #b98a3e); -webkit-background-clip: text; background-clip: text; }
    .oscuro { display: block; width: 100%; min-height: 3.25rem; border-radius: .9rem; padding: 0 1rem; font-size: 1rem;
      color: #fff; background: rgb(255 255 255 / .06); border: 1px solid rgb(255 255 255 / .12); transition: border-color .15s, box-shadow .15s; }
    .oscuro::placeholder { color: rgb(255 255 255 / .3); }
    .oscuro:focus { outline: none; border-color: rgb(var(--vf-oro-claro)); box-shadow: 0 0 0 3px rgb(214 180 106 / .25); }
  `],
})
export class Login {
  sesion = inject(SesionService);
  private router = inject(Router);

  email = '';
  password = '';
  ver = signal(false);
  cargando = signal(false);
  error = signal<string | null>(null);
  anio = new Date().getFullYear();

  async ingresar(): Promise<void> {
    if (!this.email.trim() || !this.password) {
      this.error.set('Ingresa tu correo y tu contraseña.');
      return;
    }
    this.cargando.set(true);
    this.error.set(null);
    try {
      await this.sesion.login(this.email.trim(), this.password);
      await this.router.navigateByUrl(this.sesion.rutaInicio());
    } catch (e) {
      this.error.set(mensajeError(e));
      this.password = '';
    } finally {
      this.cargando.set(false);
    }
  }
}
