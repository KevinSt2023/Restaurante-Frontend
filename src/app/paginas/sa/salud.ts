import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ESTADOS, NIVELES, RelativoPipe, enlaceWhatsapp } from '../../core/formato';
import { Nivel, SaludEmpresa } from '../../core/modelos';
import { SaApi } from '../../core/sa-api';
import { Ui } from '../../core/ui';
import { Icono } from '../../shared/icono';

@Component({
  selector: 'vf-salud',
  imports: [RouterLink, Icono, RelativoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="titulo-pagina">Salud de las empresas</h1>
        <p class="subtitulo">Detecta abandono y datos incompletos antes de perder al cliente. Solo lectura, en vivo.</p>
      </div>
      <button type="button" class="btn-secundario" (click)="cargar()"><vf-icono nombre="refrescar" [tam]="18" /> Actualizar</button>
    </div>

    <div class="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
      @for (n of conteos(); track n.nivel) {
        <button type="button" class="tarjeta flex items-center gap-3 p-4 text-left" [class.ring-2]="filtro() === n.nivel" [class.ring-marino]="filtro() === n.nivel"
                (click)="filtro.set(filtro() === n.nivel ? null : n.nivel)">
          <span class="h-3.5 w-3.5 rounded-full" [class]="niveles[n.nivel].punto"></span>
          <div><div class="text-xs font-bold uppercase text-tenue">{{ niveles[n.nivel].texto }}</div><div class="text-2xl font-extrabold">{{ n.n }}</div></div>
        </button>
      }
    </div>

    <div class="space-y-3">
      @for (s of filtradas(); track s.tenantId) {
        <div class="tarjeta overflow-hidden">
          <button type="button" class="flex w-full items-center gap-3 p-4 text-left hover:bg-elevada" (click)="alternar(s.tenantId)">
            <span class="h-3.5 w-3.5 shrink-0 rounded-full" [class]="niveles[s.nivelGeneral].punto"></span>
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-2 font-bold">{{ s.empresa }}
                <span [class]="estados[s.estadoCobranza].chip">{{ estados[s.estadoCobranza].texto }}</span>
              </div>
              <div class="text-sm text-suave">{{ s.plan ?? 'Sin plan' }} · entró {{ s.ultimoAcceso | relativo }} · {{ s.accesos7Dias }} accesos en 7 días</div>
            </div>
            <div class="hidden gap-2 sm:flex">
              <span [class]="niveles[s.nivelUso].chip">Uso: {{ niveles[s.nivelUso].texto }}</span>
              <span [class]="niveles[s.nivelDatos].chip">Datos: {{ niveles[s.nivelDatos].texto }}</span>
            </div>
            <vf-icono [nombre]="abiertas().has(s.tenantId) ? 'abajo' : 'derecha'" [tam]="18" class="text-tenue" />
          </button>
          @if (abiertas().has(s.tenantId)) {
            <div class="border-t border-borde bg-elevada/50 p-4">
              @for (h of s.hallazgos; track $index) {
                <div class="flex gap-3 py-2">
                  <span class="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" [class]="niveles[h.severidad].punto"></span>
                  <div class="text-sm"><b>{{ h.titulo }}.</b> {{ h.detalle }} <span class="text-suave">→ {{ h.queHacer }}</span></div>
                </div>
              } @empty { <p class="text-sm text-exito">Sin hallazgos: todo en orden.</p> }
              <div class="mt-3 flex flex-wrap gap-2">
                <a [routerLink]="['/sa/empresas', s.tenantId]" class="btn-secundario btn-sm"><vf-icono nombre="empresa" [tam]="16" /> Abrir ficha</a>
                @if (s.celularPeru && criticos(s).length) {
                  <a class="btn-secundario btn-sm" [href]="whatsapp(s)" target="_blank" rel="noopener"><vf-icono nombre="whatsapp" [tam]="16" /> Avisar por WhatsApp</a>
                }
              </div>
            </div>
          }
        </div>
      } @empty { <div class="tarjeta p-8 text-center text-suave">Nada que mostrar con ese filtro.</div> }
    </div>
  `,
})
export class Salud implements OnInit {
  private api = inject(SaApi);
  private ui = inject(Ui);

  niveles = NIVELES;
  estados = ESTADOS;
  lista = signal<SaludEmpresa[]>([]);
  filtro = signal<Nivel | null>(null);
  abiertas = signal(new Set<number>());

  conteos = computed(() => (['CRITICO', 'ATENCION', 'INFO', 'OK'] as Nivel[]).map(nivel => ({ nivel, n: this.lista().filter(s => s.nivelGeneral === nivel).length })));
  filtradas = computed(() => this.lista().filter(s => !this.filtro() || s.nivelGeneral === this.filtro()));

  criticos = (s: SaludEmpresa) => s.hallazgos.filter(h => h.severidad === 'CRITICO');
  whatsapp = (s: SaludEmpresa) => enlaceWhatsapp(s.telefono!, `Hola, te saluda VK Software Solutions (Valexa). Notamos lo siguiente en ${s.empresa}: ` +
    this.criticos(s).map(h => `${h.titulo}: ${h.detalle}`).join(' ') + ' ¿Te ayudamos?');

  alternar(id: number): void {
    const s = new Set(this.abiertas());
    s.has(id) ? s.delete(id) : s.add(id);
    this.abiertas.set(s);
  }

  async ngOnInit(): Promise<void> { await this.cargar(); }
  async cargar(): Promise<void> {
    try { this.lista.set(await this.api.salud()); } catch (e) { this.ui.error(e); }
  }
}
