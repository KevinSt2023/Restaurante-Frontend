import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ConfiguracionSaas } from '../../core/modelos';
import { SaApi } from '../../core/sa-api';
import { TemaService } from '../../core/tema';
import { Ui, mensajeError } from '../../core/ui';
import { Icono } from '../../shared/icono';

@Component({
  selector: 'vf-configuracion',
  imports: [FormsModule, Icono],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mb-6">
      <h1 class="titulo-pagina">Configuración del SaaS</h1>
      <p class="subtitulo">Condiciones comerciales que aplican a todas las empresas.</p>
    </div>

    <div class="grid gap-4 lg:grid-cols-2">
      @if (c) {
        <form class="tarjeta p-5 sm:p-6" (ngSubmit)="guardar()">
          <h2 class="mb-4 font-bold">Comercial</h2>
          <label class="etiqueta">Descuento de bienvenida (%)</label>
          <input aria-label="Descuento de bienvenida (%)" class="campo" name="b" type="number" min="0" max="100" step="0.5" inputmode="decimal" [(ngModel)]="c.descuentoBienvenidaPct" />
          <p class="ayuda mb-4">Se sugiere en el primer pago de cada empresa, sobre la primera mensualidad (cotización: 20 %).</p>

          <label class="etiqueta">Avisar "por vencer" con (días)</label>
          <input aria-label="Avisar &quot;por vencer&quot; con (días)" class="campo" name="d" type="number" min="1" max="60" inputmode="numeric" [(ngModel)]="c.diasPorVencer" />
          <p class="ayuda mb-4">Desde cuántos días antes una empresa pasa a "Por vencer" en Cobros y el Tablero.</p>

          <label class="etiqueta">WhatsApp de ventas</label>
          <input aria-label="WhatsApp de ventas" class="campo" name="w" inputmode="tel" maxlength="12" [(ngModel)]="c.whatsappVentas" />
          <label class="etiqueta mt-4">Correo de soporte</label>
          <input aria-label="Correo de soporte" class="campo" name="e" type="email" maxlength="120" [(ngModel)]="c.emailSoporte" />

          <div class="mt-6 flex justify-end"><button type="submit" class="btn-primario" [disabled]="guardando()"><vf-icono nombre="check" [tam]="18" /> Guardar</button></div>
        </form>
      }

      <div class="tarjeta p-5 sm:p-6">
        <h2 class="mb-4 font-bold">Apariencia (este dispositivo)</h2>
        <div class="grid grid-cols-3 gap-2">
          @for (t of temas; track t.valor) {
            <button type="button" class="opcion flex-col py-4" [class.opcion-activa]="tema.tema() === t.valor" (click)="tema.fijar(t.valor)">
              <vf-icono [nombre]="t.icono" /> {{ t.texto }}
            </button>
          }
        </div>
        <p class="ayuda mt-3">"Sistema" sigue el modo claro u oscuro del equipo.</p>
      </div>
    </div>
  `,
})
export class Configuracion implements OnInit {
  private api = inject(SaApi);
  private ui = inject(Ui);
  private cdr = inject(ChangeDetectorRef);
  tema = inject(TemaService);

  c: ConfiguracionSaas | null = null;
  guardando = signal(false);
  temas = [
    { valor: 'claro' as const, texto: 'Claro', icono: 'sol' },
    { valor: 'oscuro' as const, texto: 'Oscuro', icono: 'luna' },
    { valor: 'sistema' as const, texto: 'Sistema', icono: 'ajustes' },
  ];

  async ngOnInit(): Promise<void> {
    try { this.c = await this.api.configuracion(); this.cdr.markForCheck(); } catch (e) { this.ui.error(e); }
  }

  async guardar(): Promise<void> {
    if (!this.c) return;
    this.guardando.set(true);
    try {
      this.c = await this.api.guardarConfiguracion({
        ...this.c, descuentoBienvenidaPct: Number(this.c.descuentoBienvenidaPct), diasPorVencer: Number(this.c.diasPorVencer),
        whatsappVentas: this.c.whatsappVentas || null, emailSoporte: this.c.emailSoporte || null,
      });
      this.ui.exito('Configuración guardada');
    } catch (e) {
      this.ui.error(mensajeError(e));
    } finally {
      this.guardando.set(false);
    }
  }
}
