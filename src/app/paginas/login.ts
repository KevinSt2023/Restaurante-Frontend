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
    <div class="grid min-h-dvh bg-tinta lg:grid-cols-[1.1fr_1fr]">
      <!-- Lado de marca. El logotipo ya viene con fondo transparente, así que no
           necesita máscara ni recuadro: se apoya directo sobre el marino. -->
      <section class="relative hidden flex-col items-center justify-center gap-10 overflow-hidden p-10 lg:flex xl:p-16">
        <div class="halo pointer-events-none absolute inset-0"></div>
        <img src="logo-valexa-oscuro.webp" alt="Valexa · Software para restaurantes"
             class="relative h-auto w-full max-w-[34rem] object-contain" />
        <div class="relative grid max-w-md gap-4">
          <p class="text-center text-[15px] leading-relaxed text-white/60">
            Mesas, pedidos, cocina, caja y delivery en un solo lugar.
            Hecho en Perú para restaurantes que quieren crecer.
          </p>
          <ul class="flex flex-wrap justify-center gap-2">
            @for (f of fortalezas; track f) {
              <li class="rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-xs font-semibold text-white/70">{{ f }}</li>
            }
          </ul>
        </div>
      </section>

      <!-- Formulario -->
      <section class="relative flex items-center justify-center px-5 py-10 sm:px-10">
        <div class="halo pointer-events-none absolute inset-0 lg:hidden"></div>
        <div class="relative w-full max-w-md">
          <div class="mb-8 flex flex-col items-center text-center lg:items-start lg:text-left">
            <img src="logo-valexa-oscuro.webp" alt="Valexa · Software para restaurantes"
                 class="mb-2 h-auto w-64 object-contain lg:hidden" />
            <h1 class="text-[28px] font-extrabold tracking-tight text-white lg:text-[32px]">Ingresa a tu cuenta</h1>
            <p class="mt-1.5 text-sm text-white/55">Con el correo y la contraseña que te entregaron.</p>
          </div>

          <form class="rounded-3xl border border-white/10 bg-white/[0.05] p-6 shadow-flotante backdrop-blur-md sm:p-8" (ngSubmit)="ingresar()" autocomplete="on">
            @if (sesion.motivoCierre(); as motivo) {
              <div class="mb-5 flex gap-3 rounded-xl border border-naranja-claro/30 bg-naranja-claro/10 p-3 text-sm text-naranja-claro" role="status">
                <vf-icono nombre="info" class="mt-0.5 shrink-0" /> <span>{{ motivo }}</span>
              </div>
            }
            @if (error()) {
              <div class="mb-5 flex gap-3 rounded-xl border border-peligro/40 bg-peligro/15 p-3 text-sm text-red-200" role="alert">
                <vf-icono nombre="alerta" class="mt-0.5 shrink-0" /> <span>{{ error() }}</span>
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

            <button type="submit" class="btn-grande-naranja w-full" [disabled]="cargando()">
              @if (cargando()) { <span class="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white"></span> Ingresando… }
              @else { Ingresar <vf-icono nombre="derecha" /> }
            </button>
          </form>
          <p class="mt-6 text-center text-xs text-white/35">© {{ anio }} VK Software Solutions · Valexa</p>
        </div>
      </section>
    </div>
  `,
  styles: [`
    /* Resplandor naranja de marca detrás del logotipo, sobre el marino del fondo. */
    .halo {
      background:
        radial-gradient(60% 55% at 50% 42%, rgb(250 99 7 / .20), transparent 70%),
        radial-gradient(45% 40% at 78% 78%, rgb(254 162 2 / .12), transparent 72%);
    }
    .oscuro { display: block; width: 100%; min-height: 3.25rem; border-radius: .9rem; padding: 0 1rem; font-size: 1rem;
      color: #fff; background: rgb(255 255 255 / .06); border: 1px solid rgb(255 255 255 / .14); transition: border-color .15s, box-shadow .15s; }
    .oscuro::placeholder { color: rgb(255 255 255 / .3); }
    .oscuro:focus { outline: none; border-color: rgb(var(--vf-naranja)); box-shadow: 0 0 0 3px rgb(250 99 7 / .25); }
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
  fortalezas = ['Mesas y salón', 'Comandas a cocina', 'Caja y comprobantes', 'Delivery', 'Multisucursal'];

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
