import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, input, output } from '@angular/core';
import { Icono } from './icono';

// Modal táctil: en celular sube desde abajo (hoja), en tablet/escritorio va
// centrado. Contenido con .panel-desplazable (90dvh, barra siempre visible);
// el fondo de la página queda quieto mientras está abierto.
@Component({
  selector: 'vf-modal',
  imports: [Icono],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'cerrar.emit()' },
  template: `
    <div class="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" [attr.aria-label]="titulo()">
      <div class="absolute inset-0 bg-tinta/60 backdrop-blur-[2px] animate-[aparecer_.15s_ease-out]" (click)="cerrar.emit()"></div>
      <div class="panel-desplazable relative w-full rounded-t-3xl bg-superficie shadow-flotante sm:rounded-3xl animate-[subir_.2s_ease-out]"
           [class]="ancho()">
        <div class="sticky top-0 z-10 flex items-start gap-3 border-b border-borde bg-superficie/95 px-5 py-4 backdrop-blur sm:px-6">
          <div class="min-w-0 flex-1">
            <h2 class="text-lg font-bold leading-tight text-texto">{{ titulo() }}</h2>
            @if (subtitulo()) { <p class="mt-0.5 text-sm text-suave">{{ subtitulo() }}</p> }
          </div>
          <button type="button" class="btn-icono -mr-2 -mt-1" (click)="cerrar.emit()" aria-label="Cerrar"><vf-icono nombre="x" /></button>
        </div>
        <div class="px-5 py-5 sm:px-6"><ng-content /></div>
        <ng-content select="[pie]" />
      </div>
    </div>`,
  styles: [`
    @keyframes aparecer { from { opacity: 0 } to { opacity: 1 } }
    @keyframes subir { from { opacity: 0; transform: translateY(24px) } to { opacity: 1; transform: none } }
  `],
})
export class Modal implements OnInit, OnDestroy {
  titulo = input.required<string>();
  subtitulo = input<string | null>(null);
  ancho = input('sm:max-w-lg');
  cerrar = output<void>();

  ngOnInit(): void { document.body.style.overflow = 'hidden'; }
  ngOnDestroy(): void { document.body.style.overflow = ''; }
}
