import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { SesionService } from '../core/sesion';
import { FechaPipe } from '../core/formato';
import { Icono } from '../shared/icono';

// Inicio provisional para los usuarios de cada restaurante: muestra su plan y
// lo que su rol podrá hacer. Los módulos operativos llegan en las fases 1-5.
@Component({
  selector: 'vf-inicio',
  imports: [Icono, FechaPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="titulo-pagina">Hola, {{ s.usuario()?.nombre }}</h1>
    <p class="subtitulo">{{ s.usuario()?.rolNombre }} · {{ s.usuario()?.empresa }} · {{ s.usuario()?.sucursal }}</p>

    <div class="mt-6 grid gap-4 md:grid-cols-2">
      <div class="tarjeta p-5">
        <div class="flex items-center gap-2 text-sm font-semibold text-suave"><vf-icono nombre="corona" [tam]="18" class="text-oro" /> Tu plan</div>
        <div class="mt-2 text-2xl font-bold">{{ s.sesion()?.plan?.nombre ?? '—' }}</div>
        <div class="mt-1 text-sm text-suave">Vigente hasta {{ s.sesion()?.plan?.vencimiento | fecha }}</div>
      </div>
      <div class="tarjeta p-5">
        <div class="flex items-center gap-2 text-sm font-semibold text-suave"><vf-icono nombre="chispa" [tam]="18" class="text-oro" /> En construcción</div>
        <p class="mt-2 text-sm text-suave">Muy pronto aquí: salón y mesas, pantalla de cocina, cobro y delivery, según tu plan.</p>
      </div>
    </div>

    <div class="tarjeta mt-4 p-5">
      <div class="mb-3 text-sm font-semibold text-suave">Lo que podrás hacer con tu rol ({{ permisos().length }})</div>
      <div class="flex flex-wrap gap-2">
        @for (p of permisos(); track p) { <span class="chip-neutro">{{ p }}</span> }
      </div>
    </div>
  `,
})
export class Inicio {
  s = inject(SesionService);
  permisos = computed(() => this.s.sesion()?.permisos ?? []);
}
