import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SesionService } from '../core/sesion';
import { Ui, mensajeError } from '../core/ui';
import { Icono } from '../shared/icono';

@Component({
  selector: 'vf-cambiar-password',
  imports: [FormsModule, Icono],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex min-h-dvh items-center justify-center bg-fondo px-4 py-10">
      <form class="tarjeta w-full max-w-md p-6 sm:p-8" (ngSubmit)="guardar()">
        <div class="mb-6 flex items-center gap-3">
          <img src="logo-icono.webp" alt="" class="h-12 w-12 rounded-xl" />
          <div>
            <h1 class="text-xl font-bold">Crea tu contraseña</h1>
            <p class="text-sm text-suave">Hola {{ sesion.usuario()?.nombre }}, reemplaza la contraseña temporal por una tuya.</p>
          </div>
        </div>

        <label class="etiqueta" for="actual">Contraseña temporal</label>
        <input id="actual" name="actual" type="password" class="campo mb-4" autocomplete="current-password" [(ngModel)]="actual" required />

        <label class="etiqueta" for="nueva">Nueva contraseña</label>
        <input id="nueva" name="nueva" type="password" class="campo" autocomplete="new-password" [ngModel]="nueva()" (ngModelChange)="nueva.set($event)" required />
        <ul class="mb-4 mt-2 space-y-1 text-sm">
          @for (r of reglas(); track r.texto) {
            <li class="flex items-center gap-2" [class.text-exito]="r.ok" [class.text-tenue]="!r.ok">
              <vf-icono [nombre]="r.ok ? 'check' : 'x'" [tam]="16" /> {{ r.texto }}
            </li>
          }
        </ul>

        <label class="etiqueta" for="repetir">Repite la nueva contraseña</label>
        <input id="repetir" name="repetir" type="password" class="campo mb-6" autocomplete="new-password" [(ngModel)]="repetir" required />

        <button type="submit" class="btn-primario w-full" [disabled]="cargando() || !valida()">Guardar y entrar</button>
        <button type="button" class="btn-fantasma mt-2 w-full" (click)="sesion.cerrarSesion()">Salir</button>
      </form>
    </div>
  `,
})
export class CambiarPassword {
  sesion = inject(SesionService);
  private router = inject(Router);
  private ui = inject(Ui);

  actual = '';
  repetir = '';
  nueva = signal('');
  cargando = signal(false);

  reglas = computed(() => {
    const n = this.nueva();
    return [
      { texto: 'Al menos 8 caracteres', ok: n.length >= 8 },
      { texto: 'Letras y números', ok: /[a-zA-ZñÑ]/.test(n) && /\d/.test(n) },
    ];
  });
  valida = computed(() => this.reglas().every(r => r.ok));

  async guardar(): Promise<void> {
    if (this.nueva() !== this.repetir) {
      this.ui.error('Las dos contraseñas nuevas no coinciden.');
      return;
    }
    this.cargando.set(true);
    try {
      await this.sesion.cambiarPassword(this.actual, this.nueva());
      this.ui.exito('Contraseña actualizada');
      await this.router.navigateByUrl(this.sesion.rutaInicio());
    } catch (e) {
      this.ui.error(mensajeError(e));
    } finally {
      this.cargando.set(false);
    }
  }
}
