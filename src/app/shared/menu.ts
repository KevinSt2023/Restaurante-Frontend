import {
  ChangeDetectionStrategy, Component, ElementRef, HostListener, inject, input, signal,
} from '@angular/core';

/**
 * Menú desplegable táctil.
 *
 * Se usa envolviendo el disparador y el contenido:
 *
 *   <vf-menu alineacion="der">
 *     <button disparador class="btn-secundario">Opciones</button>
 *     <button class="menu-opcion" (click)="algo()">Hacer algo</button>
 *   </vf-menu>
 *
 * Cierra al tocar fuera, al pulsar Escape y al elegir una opción (el clic sube
 * por el panel). Todas las opciones miden 48 px: esto se usa con el dedo.
 */
@Component({
  selector: 'vf-menu',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="relative inline-flex">
      <span (click)="alternar()"><ng-content select="[disparador]" /></span>

      @if (abierto()) {
        <!-- En celular el panel se ancla al borde derecho para no salirse de la pantalla. -->
        <div class="menu-desplegable" role="menu"
             [class.right-0]="alineacion() === 'der'"
             [class.left-0]="alineacion() !== 'der'"
             [class.top-full]="posicion() !== 'arriba'"
             [class.bottom-full]="posicion() === 'arriba'"
             [class.mt-2]="posicion() !== 'arriba'"
             [class.mb-2]="posicion() === 'arriba'"
             (click)="cerrarSiEsOpcion($event)">
          <ng-content />
        </div>
      }
    </div>
  `,
})
export class Menu {
  alineacion = input<'izq' | 'der'>('izq');
  posicion = input<'abajo' | 'arriba'>('abajo');

  abierto = signal(false);
  private host = inject(ElementRef<HTMLElement>);

  alternar(): void { this.abierto.update(v => !v); }
  cerrar(): void { this.abierto.set(false); }

  /** Cierra solo si se tocó algo accionable, no al desplazarse por el panel. */
  cerrarSiEsOpcion(evento: Event): void {
    const destino = evento.target as HTMLElement | null;
    if (destino?.closest('button, a, [role="menuitem"]')) this.cerrar();
  }

  @HostListener('document:pointerdown', ['$event'])
  alTocarFuera(evento: Event): void {
    if (this.abierto() && !this.host.nativeElement.contains(evento.target as Node)) this.cerrar();
  }

  @HostListener('document:keydown.escape')
  alEscapar(): void { this.cerrar(); }
}
