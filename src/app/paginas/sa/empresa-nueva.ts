import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { FechaPipe, SolesPipe, fmt } from '../../core/formato';
import { EmpresaCrear, Funcion, METODOS_PAGO, Plan, TIPOS_SERVICIO } from '../../core/modelos';
import { SaApi } from '../../core/sa-api';
import { Ui, mensajeError } from '../../core/ui';
import { Icono } from '../../shared/icono';

const PASOS = ['Empresa', 'Plan', 'Administrador', 'Primer cobro'];

export function sumarMeses(fechaIso: string, meses: number): string {
  const [a, m, d] = fechaIso.split('-').map(Number);
  const f = new Date(Date.UTC(a, m - 1 + meses, 1));
  const ultimo = new Date(Date.UTC(f.getUTCFullYear(), f.getUTCMonth() + 1, 0)).getUTCDate();
  f.setUTCDate(Math.min(d, ultimo));
  return f.toISOString().slice(0, 10);
}

@Component({
  selector: 'vf-empresa-nueva',
  imports: [FormsModule, RouterLink, Icono, SolesPipe, FechaPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a routerLink="/sa/empresas" class="btn-fantasma -ml-3 mb-2"><vf-icono nombre="izquierda" [tam]="18" /> Empresas</a>
    <h1 class="titulo-pagina">Nueva empresa</h1>
    <p class="subtitulo mb-6">Crea el restaurante, su sucursal principal, su Administrador y el primer cobro en un solo paso.</p>

    <!-- Pasos -->
    <ol class="mb-6 grid grid-cols-4 gap-2">
      @for (p of pasos; track p; let i = $index) {
        <li>
          <button type="button" class="flex w-full flex-col items-start gap-2 text-left" (click)="irA(i)" [disabled]="i > maxPaso()">
            <span class="h-1.5 w-full rounded-full transition-colors" [class]="i <= paso() ? 'bg-marino' : 'bg-borde'"></span>
            <span class="flex items-center gap-2 text-xs font-bold sm:text-sm" [class]="i === paso() ? 'text-marino' : i < paso() ? 'text-texto' : 'text-tenue'">
              <span class="hidden h-6 w-6 items-center justify-center rounded-full text-xs sm:flex" [class]="i < paso() ? 'bg-exito text-white' : i === paso() ? 'bg-marino text-white' : 'bg-borde text-suave'">
                @if (i < paso()) { <vf-icono nombre="check" [tam]="14" [grosor]="3" /> } @else { {{ i + 1 }} }
              </span>
              {{ p }}
            </span>
          </button>
        </li>
      }
    </ol>

    <div class="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <form class="tarjeta p-5 sm:p-6" (ngSubmit)="siguiente()">
        @switch (paso()) {
          <!-- 1. Empresa -->
          @case (0) {
            <h2 class="mb-4 text-lg font-bold">Datos del restaurante</h2>
            <label class="etiqueta">Tipo de negocio</label>
            <div class="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
              @for (t of tipos; track t.valor) {
                <button type="button" class="opcion" [class.opcion-activa]="f.tipoServicio === t.valor" (click)="f.tipoServicio = t.valor">{{ t.texto }}</button>
              }
            </div>
            <div class="grid gap-4 sm:grid-cols-2">
              <div class="sm:col-span-2"><label class="etiqueta">Nombre comercial *</label><input aria-label="Nombre comercial" class="campo" name="nc" [(ngModel)]="f.nombreComercial" placeholder="Ej. La Cevichería de Rosa" maxlength="120" /></div>
              <div><label class="etiqueta">RUC</label><input aria-label="RUC" class="campo" name="ruc" [(ngModel)]="f.ruc" inputmode="numeric" maxlength="11" placeholder="20xxxxxxxxx" /></div>
              <div><label class="etiqueta">Razón social</label><input aria-label="Razón social" class="campo" name="rs" [(ngModel)]="f.razonSocial" maxlength="200" /></div>
              <div><label class="etiqueta">Celular del negocio</label><input aria-label="Celular del negocio" class="campo" name="tel" [(ngModel)]="f.telefono" inputmode="tel" maxlength="12" placeholder="9xxxxxxxx" /><p class="ayuda">Para recordatorios por WhatsApp.</p></div>
              <div><label class="etiqueta">Correo del negocio</label><input aria-label="Correo del negocio" class="campo" name="em" [(ngModel)]="f.email" type="email" inputmode="email" maxlength="120" /></div>
              <div><label class="etiqueta">Persona de contacto</label><input aria-label="Persona de contacto" class="campo" name="ct" [(ngModel)]="f.contactoNombre" maxlength="120" /></div>
              <div><label class="etiqueta">Dirección</label><input aria-label="Dirección" class="campo" name="dir" [(ngModel)]="f.direccion" maxlength="250" /></div>
            </div>
          }

          <!-- 2. Plan -->
          @case (1) {
            <h2 class="mb-4 text-lg font-bold">Elige el plan</h2>
            <div class="grid gap-3 sm:grid-cols-2">
              @for (p of planesActivos(); track p.planId) {
                <button type="button" class="relative rounded-2xl border-2 p-4 text-left transition-colors active:scale-[0.99]"
                        [class]="f.planId === p.planId ? 'border-marino bg-marino/5' : 'border-borde hover:border-naranja'" (click)="f.planId = p.planId">
                  @if (p.destacado) { <span class="chip-naranja absolute right-3 top-3"><vf-icono nombre="estrella" [tam]="12" /> Más elegido</span> }
                  <div class="text-lg font-bold">{{ p.nombre }}</div>
                  <div class="mt-1">@if (p.aCotizar) { <span class="text-2xl font-extrabold">A cotizar</span> } @else { <span class="text-2xl font-extrabold">{{ p.precioMensual | soles }}</span><span class="text-sm text-suave">/mes</span> }</div>
                  <div class="mt-3 flex flex-wrap gap-1.5 text-xs">
                    <span class="chip-neutro">{{ p.maxSucursales ? p.maxSucursales + ' sucursal(es)' : 'Sucursales ilimitadas' }}</span>
                    <span class="chip-neutro">{{ p.maxUsuarios ? 'Admin + ' + p.maxUsuarios : 'Usuarios ilimitados' }}</span>
                  </div>
                  <div class="mt-2 text-xs text-suave">{{ rolesDe(p) }}</div>
                </button>
              }
            </div>
            <div class="mt-6 grid gap-4 sm:grid-cols-2">
              <div><label class="etiqueta">Nombre de la sucursal principal</label><input aria-label="Nombre de la sucursal principal" class="campo" name="sn" [(ngModel)]="f.sucursalNombre" maxlength="100" placeholder="Principal" /></div>
              <div><label class="etiqueta">Dirección de la sucursal</label><input aria-label="Dirección de la sucursal" class="campo" name="sd" [(ngModel)]="f.sucursalDireccion" maxlength="250" placeholder="La misma del negocio" /></div>
            </div>
          }

          <!-- 3. Administrador -->
          @case (2) {
            <h2 class="mb-1 text-lg font-bold">Administrador del restaurante</h2>
            <p class="mb-4 text-sm text-suave">Es único por empresa y gestiona todo su negocio. No ocupa cupo de usuarios.</p>
            <div class="grid gap-4 sm:grid-cols-2">
              <div class="sm:col-span-2"><label class="etiqueta">Nombre completo *</label><input aria-label="Nombre completo" class="campo" name="an" [(ngModel)]="f.admin.nombre" maxlength="120" /></div>
              <div><label class="etiqueta">Correo (será su usuario) *</label><input aria-label="Correo (será su usuario)" class="campo" name="ae" [(ngModel)]="f.admin.email" type="email" inputmode="email" maxlength="120" /></div>
              <div><label class="etiqueta">DNI</label><input aria-label="DNI" class="campo" name="ad" [(ngModel)]="f.admin.dni" inputmode="numeric" maxlength="8" /></div>
              <div><label class="etiqueta">Celular</label><input aria-label="Celular" class="campo" name="at" [(ngModel)]="f.admin.telefono" inputmode="tel" maxlength="12" /></div>
            </div>
            <div class="mt-5 rounded-2xl border border-borde p-4">
              <div class="flex items-center justify-between gap-4">
                <div><div class="font-semibold">Generar contraseña temporal</div><div class="text-sm text-suave">Recomendado: la verás una sola vez y la cambiará en su primer ingreso.</div></div>
                <button type="button" role="switch" class="interruptor" aria-label="Generar contraseña temporal" [attr.aria-checked]="claveAuto()" (click)="claveAuto.set(!claveAuto())"><span></span></button>
              </div>
              @if (!claveAuto()) {
                <div class="mt-4"><label class="etiqueta">Contraseña inicial</label><input aria-label="Contraseña inicial" class="campo" name="ap" type="text" [(ngModel)]="f.admin.password" autocomplete="off" maxlength="72" /><p class="ayuda">Mínimo 8 caracteres, con letras y números. Igual deberá cambiarla al entrar.</p></div>
              }
            </div>
          }

          <!-- 4. Primer cobro -->
          @case (3) {
            <h2 class="mb-1 text-lg font-bold">Primer cobro</h2>
            <p class="mb-4 text-sm text-suave">Ningún día de servicio sin su constancia: registra el pago o, si es una prueba, una cortesía con motivo.</p>
            <div class="mb-5 grid grid-cols-2 gap-2">
              <button type="button" class="opcion h-16" [class.opcion-activa]="f.primerCobro.tipo === 'PAGO'" (click)="tipoCobro('PAGO')"><vf-icono nombre="cobros" /> Pago</button>
              <button type="button" class="opcion h-16" [class.opcion-activa]="f.primerCobro.tipo === 'CORTESIA'" (click)="tipoCobro('CORTESIA')"><vf-icono nombre="regalo" /> Cortesía</button>
            </div>
            <label class="etiqueta">Meses</label>
            <div class="mb-5 grid grid-cols-4 gap-2">
              @for (m of [1, 3, 6, 12]; track m) {
                <button type="button" class="opcion" [class.opcion-activa]="f.primerCobro.meses === m" (click)="elegirMeses(m)">{{ m }} {{ m === 1 ? 'mes' : 'meses' }}</button>
              }
            </div>
            @if (f.primerCobro.tipo === 'PAGO') {
              @if (bienvenida() > 0 && planElegido()) {
                <div class="mb-4 flex items-start gap-3 rounded-xl bg-naranja/10 p-3 text-sm">
                  <vf-icono nombre="chispa" class="text-naranja" />
                  <span>Cliente nuevo: <b>{{ bienvenida() }} % de descuento</b> en la primera mensualidad. Precio de lista {{ lista() | soles }} → sugerido <b>{{ sugerido() | soles }}</b>.</span>
                </div>
              }
              <div class="grid gap-4 sm:grid-cols-2">
                <div><label class="etiqueta">Monto cobrado (S/, con IGV) *</label><input aria-label="Monto cobrado (S/, con IGV)" class="campo text-lg font-bold" name="mt" type="number" inputmode="decimal" step="0.01" min="0" [(ngModel)]="f.primerCobro.monto" /></div>
                <div><label class="etiqueta">Fecha del pago</label><input aria-label="Fecha del pago" class="campo" name="fp" type="date" [max]="hoy" [(ngModel)]="f.primerCobro.fechaPago" /></div>
              </div>
              <label class="etiqueta mt-4">Medio de pago</label>
              <div class="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
                @for (m of metodos; track m.valor) {
                  <button type="button" class="opcion" [class.opcion-activa]="f.primerCobro.metodoPago === m.valor" (click)="f.primerCobro.metodoPago = m.valor">{{ m.texto }}</button>
                }
              </div>
              <div class="grid gap-4 sm:grid-cols-2">
                @if (f.primerCobro.metodoPago !== 'EFECTIVO') {
                  <div><label class="etiqueta">N° de operación *</label><input aria-label="N° de operación" class="campo" name="op" [(ngModel)]="f.primerCobro.numeroOperacion" maxlength="50" autocomplete="off" /></div>
                }
                <div><label class="etiqueta">Comprobante emitido</label><input aria-label="Comprobante emitido" class="campo" name="cp" [(ngModel)]="f.primerCobro.comprobante" maxlength="30" placeholder="B001-00000123" /></div>
              </div>
            }
            <div class="mt-4"><label class="etiqueta">{{ f.primerCobro.tipo === 'CORTESIA' ? 'Motivo de la cortesía *' : 'Observación' }}</label>
              <textarea class="campo" name="ob" aria-label="Observación o motivo" rows="2" maxlength="300" [(ngModel)]="f.primerCobro.observacion" [placeholder]="f.primerCobro.tipo === 'CORTESIA' ? 'Ej. Mes de prueba acordado con el cliente' : ''"></textarea></div>
          }
        }

        <!-- Navegación -->
        <div class="mt-6 flex gap-3 border-t border-borde pt-5">
          @if (paso() > 0) { <button type="button" class="btn-secundario" (click)="irA(paso() - 1)"><vf-icono nombre="izquierda" [tam]="18" /> Atrás</button> }
          <span class="flex-1"></span>
          @if (paso() < pasos.length - 1) {
            <button type="submit" class="btn-primario min-w-[9rem]">Siguiente <vf-icono nombre="derecha" [tam]="18" /></button>
          } @else {
            <button type="submit" class="btn-naranja min-w-[11rem]" [disabled]="guardando()"><vf-icono nombre="check" [tam]="18" /> {{ guardando() ? 'Creando…' : 'Crear empresa' }}</button>
          }
        </div>
      </form>

      <!-- Resumen -->
      <aside class="tarjeta h-fit p-5 lg:sticky lg:top-6">
        <div class="mb-3 text-xs font-bold uppercase tracking-wide text-tenue">Resumen</div>
        <div class="text-lg font-bold">{{ f.nombreComercial || 'Nuevo restaurante' }}</div>
        <div class="text-sm text-suave">{{ tipoTexto() }}{{ f.ruc ? ' · RUC ' + f.ruc : '' }}</div>
        <dl class="mt-4 space-y-3 text-sm">
          <div class="flex justify-between gap-3"><dt class="text-suave">Plan</dt><dd class="font-semibold">{{ planElegido()?.nombre ?? '—' }}</dd></div>
          <div class="flex justify-between gap-3"><dt class="text-suave">Sucursal</dt><dd class="font-semibold">{{ f.sucursalNombre || 'Principal' }}</dd></div>
          <div class="flex justify-between gap-3"><dt class="text-suave">Administrador</dt><dd class="truncate font-semibold">{{ f.admin.nombre || '—' }}</dd></div>
          <div class="flex justify-between gap-3"><dt class="text-suave">Cobro</dt><dd class="font-semibold">{{ f.primerCobro.tipo === 'PAGO' ? (f.primerCobro.monto | soles) : 'Cortesía' }} · {{ f.primerCobro.meses }} m</dd></div>
          <div class="flex justify-between gap-3 border-t border-borde pt-3"><dt class="text-suave">Servicio hasta</dt><dd class="font-bold text-marino">{{ venceHasta() | fecha }}</dd></div>
        </dl>
      </aside>
    </div>
  `,
})
export class EmpresaNueva implements OnInit {
  private api = inject(SaApi);
  private ui = inject(Ui);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  pasos = PASOS;
  tipos = TIPOS_SERVICIO;
  metodos = METODOS_PAGO;
  hoy = fmt.hoyLima();

  paso = signal(0);
  maxPaso = signal(0);
  planes = signal<Plan[]>([]);
  funciones = signal<Funcion[]>([]);
  bienvenida = signal(0);
  claveAuto = signal(true);
  guardando = signal(false);

  f: EmpresaCrear = {
    nombreComercial: '', razonSocial: null, ruc: null, direccion: null, telefono: null, email: null, contactoNombre: null,
    tipoServicio: 'RESTAURANTE', planId: 0, sucursalNombre: 'Principal', sucursalDireccion: null,
    admin: { nombre: '', email: '', dni: null, telefono: null, password: null },
    primerCobro: { tipo: 'PAGO', meses: 1, monto: 0, metodoPago: 'YAPE_PLIN', numeroOperacion: null, fechaPago: this.hoy, comprobante: null, observacion: null },
  };

  planesActivos = computed(() => this.planes().filter(p => p.activo));

  // El formulario es un objeto con ngModel; OnPush vuelve a pintar tras cada
  // evento de esta plantilla, así que el resumen se calcula con métodos simples.
  planElegido(): Plan | null { return this.planes().find(p => p.planId === this.f.planId) ?? null; }
  lista(): number {
    const p = this.planElegido();
    if (!p) return 0;
    return this.f.primerCobro.meses === 12 && p.precioAnual ? p.precioAnual : p.precioMensual * this.f.primerCobro.meses;
  }
  sugerido(): number {
    const p = this.planElegido();
    return p ? Math.round((this.lista() - (p.precioMensual * this.bienvenida()) / 100) * 100) / 100 : 0;
  }
  venceHasta(): string { return sumarMeses(this.hoy, this.f.primerCobro.meses); }
  tipoTexto(): string { return TIPOS_SERVICIO.find(t => t.valor === this.f.tipoServicio)?.texto ?? ''; }

  rolesDe(p: Plan): string {
    const roles = p.cupos.map(c => (c.maximo ? `${c.maximo} ${c.rolNombre}` : c.rolNombre));
    return roles.length ? roles.join(' · ') : 'Solo el Administrador';
  }

  async ngOnInit(): Promise<void> {
    try {
      const [planes, config] = await Promise.all([this.api.planes(), this.api.configuracion()]);
      this.planes.set(planes);
      this.bienvenida.set(config.descuentoBienvenidaPct);
      const destacado = planes.find(p => p.destacado && p.activo) ?? planes.find(p => p.activo);
      if (destacado) this.f.planId = destacado.planId;
      this.recalcularMonto();
      this.cdr.markForCheck();
    } catch (e) {
      this.ui.error(e);
    }
  }

  tipoCobro(t: 'PAGO' | 'CORTESIA'): void {
    this.f.primerCobro.tipo = t;
    this.recalcularMonto();
  }

  elegirMeses(m: number): void {
    this.f.primerCobro.meses = m;
    this.recalcularMonto();
  }

  private recalcularMonto(): void {
    this.f.primerCobro.monto = this.f.primerCobro.tipo === 'PAGO' ? this.sugerido() : 0;
  }

  irA(i: number): void {
    if (i > this.maxPaso()) return;
    this.paso.set(i);
    this.arriba();
  }

  // En celular el botón "Siguiente" queda abajo: cada paso empieza desde arriba.
  private arriba(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  private validarPaso(): string | null {
    const f = this.f;
    switch (this.paso()) {
      case 0:
        if (f.nombreComercial.trim().length < 2) return 'Escribe el nombre comercial del restaurante.';
        if (f.ruc && !/^(10|15|16|17|20)\d{9}$/.test(f.ruc.trim())) return 'El RUC debe tener 11 dígitos y empezar con 10, 15, 16, 17 o 20.';
        return null;
      case 1:
        return f.planId ? null : 'Elige un plan.';
      case 2:
        if (f.admin.nombre.trim().length < 3) return 'Escribe el nombre del Administrador.';
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.admin.email.trim())) return 'El correo del Administrador no es válido.';
        if (f.admin.dni && !/^\d{8}$/.test(f.admin.dni.trim())) return 'El DNI debe tener 8 dígitos.';
        return null;
      default:
        return null;
    }
  }

  async siguiente(): Promise<void> {
    const error = this.validarPaso();
    if (error) { this.ui.error(error, 'Revisa los datos'); return; }
    if (this.paso() === 1) this.recalcularMonto();
    if (this.paso() < PASOS.length - 1) {
      this.paso.update(p => p + 1);
      this.maxPaso.update(m => Math.max(m, this.paso()));
      this.arriba();
      return;
    }
    await this.crear();
  }

  private async crear(): Promise<void> {
    const c = this.f.primerCobro;
    const dto: EmpresaCrear = {
      ...this.f,
      admin: { ...this.f.admin, password: this.claveAuto() ? null : this.f.admin.password },
      primerCobro: {
        ...c,
        monto: c.tipo === 'PAGO' ? Number(c.monto) : 0,
        metodoPago: c.tipo === 'PAGO' ? c.metodoPago : null,
        numeroOperacion: c.tipo === 'PAGO' && c.metodoPago !== 'EFECTIVO' ? c.numeroOperacion : null,
      },
    };
    this.guardando.set(true);
    try {
      const r = await this.api.crearEmpresa(dto);
      if (r.passwordTemporal)
        await this.ui.mostrarClave(dto.admin.nombre, r.passwordTemporal,
          `Usuario: ${dto.admin.email}. Entrégale esta contraseña temporal: la cambiará en su primer ingreso. No se volverá a mostrar.`);
      if (r.advertencia) this.ui.aviso(r.advertencia);
      this.ui.exito(`${r.empresa.nombreComercial} creada`);
      await this.router.navigate(['/sa/empresas', r.empresa.tenantId]);
    } catch (e) {
      this.ui.error(mensajeError(e), 'No se pudo crear la empresa');
    } finally {
      this.guardando.set(false);
    }
  }
}
