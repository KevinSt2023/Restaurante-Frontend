import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ESTADOS, FechaHoraPipe, FechaPipe, NIVELES, RelativoPipe, SolesPipe, enlaceWhatsapp, fmt } from '../../core/formato';
import {
  Acceso, Bitacora, EmpresaDatos, EmpresaDetalle, Movimiento, Plan, ROLES, SaludEmpresa, Sucursal, TIPOS_SERVICIO,
  UsuarioEmpresa, UsuarioGuardar,
} from '../../core/modelos';
import { SaApi } from '../../core/sa-api';
import { Ui, esc, mensajeError } from '../../core/ui';
import { Icono } from '../../shared/icono';
import { Modal } from '../../shared/modal';
import { RegistrarCobro } from '../../shared/registrar-cobro';

type Pestana = 'resumen' | 'suscripcion' | 'sucursales' | 'usuarios' | 'accesos' | 'bitacora' | 'salud';
type Dialogo = null | 'datos' | 'plan' | 'cobro' | 'sucursal' | 'usuario';

const ICONO_ROL: Record<number, string> = { 1: 'corona', 2: 'billete', 3: 'chef', 4: 'bandeja', 5: 'moto' };

@Component({
  selector: 'vf-empresa-ficha',
  imports: [FormsModule, RouterLink, Icono, Modal, RegistrarCobro, SolesPipe, FechaPipe, FechaHoraPipe, RelativoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a routerLink="/sa/empresas" class="btn-fantasma -ml-3 mb-2"><vf-icono nombre="izquierda" [tam]="18" /> Empresas</a>

    @if (e(); as e) {
      <!-- Encabezado -->
      <div class="tarjeta mb-4 overflow-hidden">
        <div class="h-2 bg-gradient-to-r from-vino via-vino-claro to-oro"></div>
        <div class="flex flex-col gap-4 p-5 sm:p-6 xl:flex-row xl:items-center">
          <div class="flex min-w-0 flex-1 items-center gap-4">
            <div class="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-vino to-vino-oscuro text-2xl font-extrabold text-oro-claro">
              {{ e.nombreComercial.trim().charAt(0).toUpperCase() }}
            </div>
            <div class="min-w-0">
              <h1 class="break-words text-2xl font-bold">{{ e.nombreComercial }}</h1>
              <div class="mt-1 flex flex-wrap items-center gap-2 text-sm text-suave">
                <span [class]="estados[e.estadoCobranza].chip">{{ estados[e.estadoCobranza].texto }}</span>
                <span class="chip-oro"><vf-icono nombre="corona" [tam]="12" /> {{ e.plan?.nombre ?? 'Sin plan' }}</span>
                <span>Vence {{ e.vencimiento | fecha }}@if (e.diasParaVencer !== null) { ({{ e.diasParaVencer >= 0 ? 'en ' + e.diasParaVencer + ' días' : 'hace ' + -e.diasParaVencer + ' días' }}) }</span>
              </div>
            </div>
          </div>
          <div class="flex flex-wrap gap-2">
            <button type="button" class="btn-oro" (click)="dialogo.set('cobro')"><vf-icono nombre="cobros" [tam]="18" /> Registrar cobro</button>
            @if (e.celularPeru) {
              <a class="btn-secundario" [href]="whatsapp()" target="_blank" rel="noopener"><vf-icono nombre="whatsapp" [tam]="18" /> WhatsApp</a>
            }
            <div class="relative">
              <button type="button" class="btn-secundario" (click)="menu.set(!menu())" aria-haspopup="menu"><vf-icono nombre="puntos" [tam]="18" /> Acciones</button>
              @if (menu()) {
                <div class="fixed inset-0 z-20" (click)="menu.set(false)"></div>
                <div class="absolute right-0 z-30 mt-2 w-64 rounded-2xl border border-borde bg-superficie p-2 shadow-flotante" role="menu">
                  <button type="button" class="accion" (click)="abrirDatos()"><vf-icono nombre="editar" [tam]="18" /> Editar datos</button>
                  <button type="button" class="accion" (click)="abrirPlan()"><vf-icono nombre="planes" [tam]="18" /> Cambiar de plan</button>
                  <button type="button" class="accion" (click)="cerrarSesiones()"><vf-icono nombre="salir" [tam]="18" /> Cerrar todas las sesiones</button>
                  <div class="my-1 h-px bg-borde"></div>
                  @if (e.activo) {
                    <button type="button" class="accion text-peligro" (click)="suspender()"><vf-icono nombre="power" [tam]="18" /> Suspender servicio</button>
                  } @else {
                    <button type="button" class="accion text-exito" (click)="reactivar()"><vf-icono nombre="power" [tam]="18" /> Reactivar servicio</button>
                  }
                </div>
              }
            </div>
          </div>
        </div>
        @if (!e.activo) {
          <div class="flex items-start gap-3 border-t border-borde bg-peligro/10 px-6 py-3 text-sm text-peligro">
            <vf-icono nombre="alerta" [tam]="18" /> <span><b>Suspendida</b> {{ e.fechaSuspension | fechaHora }}: {{ e.motivoSuspension }}</span>
          </div>
        }
      </div>

      <!-- Pestañas -->
      <nav class="pestanas mb-5" aria-label="Secciones de la empresa">
        @for (p of pestanas; track p.id) {
          <button type="button" class="pestana" [class.pestana-activa]="pestana() === p.id" (click)="irA(p.id)">
            {{ p.texto }}
            @if (p.id === 'usuarios') { <span class="ml-1 text-tenue">{{ e.usuariosLista.length }}</span> }
            @if (p.id === 'sucursales') { <span class="ml-1 text-tenue">{{ e.sucursalesLista.length }}</span> }
          </button>
        }
      </nav>

      @switch (pestana()) {
        <!-- ═══ RESUMEN ═══ -->
        @case ('resumen') {
          <div class="grid gap-4 xl:grid-cols-2">
            <div class="tarjeta p-5">
              <div class="mb-4 flex items-center justify-between"><h2 class="font-bold">Datos de la empresa</h2>
                <button type="button" class="btn-fantasma btn-sm" (click)="abrirDatos()"><vf-icono nombre="editar" [tam]="16" /> Editar</button></div>
              <dl class="grid gap-3 text-sm sm:grid-cols-2">
                <div><dt class="text-tenue">Razón social</dt><dd class="font-semibold">{{ e.razonSocial ?? '—' }}</dd></div>
                <div><dt class="text-tenue">RUC</dt><dd class="flex items-center gap-2 font-semibold">{{ e.ruc ?? '—' }}
                  @if (e.ruc) { <span [class]="e.rucValido ? 'chip-exito' : 'chip-peligro'">{{ e.rucValido ? 'válido' : 'inválido' }}</span> }</dd></div>
                <div><dt class="text-tenue">Tipo de negocio</dt><dd class="font-semibold">{{ tipo(e.tipoServicio) }}</dd></div>
                <div><dt class="text-tenue">Contacto</dt><dd class="font-semibold">{{ e.contactoNombre ?? '—' }}</dd></div>
                <div><dt class="text-tenue">Celular</dt><dd class="font-semibold">{{ e.telefono ?? '—' }}</dd></div>
                <div><dt class="text-tenue">Correo</dt><dd class="break-all font-semibold">{{ e.email ?? '—' }}</dd></div>
                <div class="sm:col-span-2"><dt class="text-tenue">Dirección</dt><dd class="font-semibold">{{ e.direccion ?? '—' }}</dd></div>
                <div><dt class="text-tenue">Cliente desde</dt><dd class="font-semibold">{{ e.createdAt | fecha }}</dd></div>
                <div><dt class="text-tenue">Último acceso</dt><dd class="font-semibold">{{ e.ultimoAcceso | relativo }}</dd></div>
              </dl>
            </div>

            <div class="tarjeta p-5">
              <div class="mb-4 flex items-center justify-between"><h2 class="font-bold">Plan y cupos</h2>
                <button type="button" class="btn-fantasma btn-sm" (click)="abrirPlan()"><vf-icono nombre="planes" [tam]="16" /> Cambiar</button></div>
              @if (e.plan; as p) {
                <div class="mb-4 flex items-end justify-between rounded-2xl bg-elevada p-4">
                  <div><div class="text-lg font-bold">{{ p.nombre }}</div><div class="text-sm text-suave">desde {{ e.planFechaInicio | fecha }}</div></div>
                  <div class="text-right"><div class="text-xl font-extrabold">{{ p.precioMensual | soles }}</div><div class="text-xs text-suave">al mes</div></div>
                </div>
                <div class="space-y-3">
                  <div>
                    <div class="mb-1 flex justify-between text-sm"><span class="font-semibold">Sucursales</span><span>{{ e.sucursalesActivas }} / {{ p.maxSucursales || '∞' }}</span></div>
                    <div class="barra"><div [class]="color(e.sucursalesActivas, p.maxSucursales)" [style.width.%]="pct(e.sucursalesActivas, p.maxSucursales)"></div></div>
                  </div>
                  <div>
                    <div class="mb-1 flex justify-between text-sm"><span class="font-semibold">Usuarios (sin el Admin)</span><span>{{ e.usuariosOperativos }} / {{ p.maxUsuarios || '∞' }}</span></div>
                    <div class="barra"><div [class]="color(e.usuariosOperativos, p.maxUsuarios)" [style.width.%]="pct(e.usuariosOperativos, p.maxUsuarios)"></div></div>
                  </div>
                  <div class="grid grid-cols-2 gap-2 pt-1 sm:grid-cols-4">
                    @for (r of e.usoPorRol; track r.rolId) {
                      <div class="rounded-xl border border-borde p-2.5 text-center" [class.opacity-50]="!r.permitido">
                        <vf-icono [nombre]="iconoRol(r.rolId)" [tam]="18" class="text-oro" />
                        <div class="text-xs text-suave">{{ r.rol }}</div>
                        <div class="font-bold">{{ r.permitido ? r.usados + ' / ' + (r.maximo || '∞') : 'No incluido' }}</div>
                      </div>
                    }
                  </div>
                  @if (p.adminAcumula.length) {
                    <p class="text-xs text-suave">El Administrador también opera como: {{ nombresRoles(p.adminAcumula) }}.</p>
                  }
                </div>
                @if (e.excesos.length) {
                  <div class="mt-4 rounded-xl bg-peligro/10 p-3 text-sm text-peligro">
                    <b>Excede su plan:</b> {{ e.excesos.join('; ') }}.
                  </div>
                }
              } @else {
                <p class="text-sm text-suave">La empresa no tiene plan asignado.</p>
              }
            </div>

            <div class="tarjeta p-5 xl:col-span-2">
              <div class="mb-3 flex items-center justify-between">
                <h2 class="flex items-center gap-2 font-bold"><vf-icono nombre="nota" [tam]="18" class="text-oro" /> Notas internas</h2>
                <span class="text-xs text-tenue">Solo las ve el SuperAdmin</span>
              </div>
              <textarea class="campo" rows="4" maxlength="4000" [(ngModel)]="notas" placeholder="Acuerdos comerciales, historial de soporte, preferencias del cliente…"></textarea>
              <div class="mt-3 flex justify-end"><button type="button" class="btn-secundario btn-sm" (click)="guardarNotas()" [disabled]="notas === (e.notasInternas ?? '')">Guardar notas</button></div>
            </div>
          </div>
        }

        <!-- ═══ SUSCRIPCIÓN ═══ -->
        @case ('suscripcion') {
          <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p class="text-sm text-suave">Cada pago o cortesía movió el vencimiento. Solo se anula el último, y con motivo.</p>
            <button type="button" class="btn-oro" (click)="dialogo.set('cobro')"><vf-icono nombre="mas" [tam]="18" /> Registrar cobro</button>
          </div>
          <div class="space-y-3">
            @for (m of movimientos(); track m.movimientoId) {
              <div class="tarjeta flex flex-col gap-3 p-4 sm:flex-row sm:items-center" [class.opacity-60]="m.estado === 'ANULADO'">
                <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl" [class]="m.tipo === 'PAGO' ? 'bg-exito/10 text-exito' : 'bg-oro/15 text-oro'">
                  <vf-icono [nombre]="m.tipo === 'PAGO' ? 'cobros' : 'regalo'" />
                </div>
                <div class="min-w-0 flex-1">
                  <div class="flex flex-wrap items-center gap-2 font-semibold">
                    {{ m.tipo === 'PAGO' ? (m.monto | soles) : 'Cortesía' }} · {{ m.meses }} mes(es) · {{ m.planNombre }}
                    @if (m.descuentoPct > 0) { <span class="chip-oro">−{{ m.descuentoPct }} %</span> }
                    @if (m.estado === 'ANULADO') { <span class="chip-peligro">Anulado</span> }
                  </div>
                  <div class="text-sm text-suave">
                    {{ m.fechaPago | fecha }}@if (m.metodoPago) { · {{ m.metodoPago }} }@if (m.numeroOperacion) { N° {{ m.numeroOperacion }} } ·
                    {{ m.venceAntes | fecha }} → <b class="text-texto">{{ m.venceDespues | fecha }}</b>
                  </div>
                  @if (m.observacion) { <div class="text-sm text-suave">“{{ m.observacion }}”</div> }
                  @if (m.estado === 'ANULADO') { <div class="text-sm text-peligro">Anulado por {{ m.anuladoPor }}: {{ m.motivoAnulacion }}</div> }
                  <div class="text-xs text-tenue">Registró {{ m.registradoPor }} · {{ m.fechaRegistro | fechaHora }}</div>
                </div>
                @if (m.anulable) {
                  <button type="button" class="btn-secundario btn-sm text-peligro" (click)="anular(m)"><vf-icono nombre="x" [tam]="16" /> Anular</button>
                }
              </div>
            } @empty { <div class="tarjeta p-8 text-center text-suave">Sin movimientos.</div> }
          </div>
        }

        <!-- ═══ SUCURSALES ═══ -->
        @case ('sucursales') {
          <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p class="text-sm text-suave">{{ e.sucursalesActivas }} de {{ e.plan?.maxSucursales || '∞' }} sucursales activas.</p>
            <button type="button" class="btn-primario" (click)="nuevaSucursal()" [disabled]="sinCupoSucursal()"><vf-icono nombre="mas" [tam]="18" /> Nueva sucursal</button>
          </div>
          @if (sinCupoSucursal()) { <p class="mb-3 text-sm text-alerta">El plan {{ e.plan?.nombre }} no permite más sucursales: cámbialo de plan para sumar otra.</p> }
          <div class="grid gap-3 md:grid-cols-2">
            @for (s of e.sucursalesLista; track s.sucursalId) {
              <div class="tarjeta p-4" [class.opacity-60]="!s.activo">
                <div class="flex items-start gap-3">
                  <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-elevada text-oro"><vf-icono nombre="tienda" /></div>
                  <div class="min-w-0 flex-1">
                    <div class="flex flex-wrap items-center gap-2 font-bold">{{ s.nombre }}
                      @if (s.esPrincipal) { <span class="chip-oro">Principal</span> }
                      @if (!s.activo) { <span class="chip-neutro">Desactivada</span> }
                    </div>
                    <div class="text-sm text-suave">{{ s.direccion ?? 'Sin dirección' }}{{ s.telefono ? ' · ' + s.telefono : '' }}</div>
                    <div class="text-xs text-tenue">{{ s.usuarios }} usuario(s) activo(s)</div>
                  </div>
                </div>
                <div class="mt-3 flex flex-wrap gap-2">
                  <button type="button" class="btn-secundario btn-sm" (click)="editarSucursal(s)"><vf-icono nombre="editar" [tam]="16" /> Editar</button>
                  @if (!s.esPrincipal && s.activo) { <button type="button" class="btn-secundario btn-sm" (click)="principal(s)"><vf-icono nombre="estrella" [tam]="16" /> Hacer principal</button> }
                  @if (!s.esPrincipal) {
                    <button type="button" class="btn-secundario btn-sm" [class.text-peligro]="s.activo" (click)="estadoSucursal(s)"><vf-icono nombre="power" [tam]="16" /> {{ s.activo ? 'Desactivar' : 'Activar' }}</button>
                  }
                </div>
              </div>
            }
          </div>
        }

        <!-- ═══ USUARIOS ═══ -->
        @case ('usuarios') {
          <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p class="text-sm text-suave">{{ e.usuariosOperativos }} de {{ e.plan?.maxUsuarios || '∞' }} usuarios, además del Administrador.</p>
            <button type="button" class="btn-primario" (click)="nuevoUsuario()"><vf-icono nombre="mas" [tam]="18" /> Nuevo usuario</button>
          </div>
          <div class="grid gap-3 xl:grid-cols-2">
            @for (u of e.usuariosLista; track u.usuarioId) {
              <div class="tarjeta p-4" [class.opacity-60]="!u.activo">
                <div class="flex items-start gap-3">
                  <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl" [class]="u.rolId === 1 ? 'bg-vino text-oro-claro' : 'bg-elevada text-oro'">
                    <vf-icono [nombre]="iconoRol(u.rolId)" />
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="flex flex-wrap items-center gap-2 font-bold">{{ u.nombre }}
                      <span class="chip-neutro">{{ u.rol }}</span>
                      @if (!u.activo) { <span class="chip-neutro">Inactivo</span> }
                      @if (u.bloqueado) { <span class="chip-peligro"><vf-icono nombre="candado" [tam]="12" /> Bloqueado</span> }
                      @if (u.debeCambiarPassword && u.activo) { <span class="chip-alerta">Clave temporal</span> }
                    </div>
                    <div class="truncate text-sm text-suave">{{ u.email }}</div>
                    <div class="text-xs text-tenue">{{ u.sucursal ?? 'Sin sucursal' }} · entró {{ u.ultimoLogin | relativo }}</div>
                  </div>
                </div>
                <div class="mt-3 flex flex-wrap gap-2">
                  <button type="button" class="btn-secundario btn-sm" (click)="editarUsuario(u)"><vf-icono nombre="editar" [tam]="16" /> Editar</button>
                  <button type="button" class="btn-secundario btn-sm" (click)="resetPassword(u)"><vf-icono nombre="llave" [tam]="16" /> Nueva clave</button>
                  @if (u.bloqueado) { <button type="button" class="btn-secundario btn-sm" (click)="desbloquear(u)"><vf-icono nombre="desbloquear" [tam]="16" /> Desbloquear</button> }
                  <button type="button" class="btn-secundario btn-sm" (click)="cerrarSesionUsuario(u)"><vf-icono nombre="salir" [tam]="16" /> Cerrar sesión</button>
                  @if (u.rolId !== 1) {
                    <button type="button" class="btn-secundario btn-sm" [class.text-peligro]="u.activo" (click)="estadoUsuario(u)"><vf-icono nombre="power" [tam]="16" /> {{ u.activo ? 'Desactivar' : 'Activar' }}</button>
                  }
                </div>
              </div>
            }
          </div>
        }

        <!-- ═══ ACCESOS ═══ -->
        @case ('accesos') {
          <div class="tarjeta overflow-x-auto">
            <table class="tabla">
              <thead><tr><th>Fecha</th><th>Usuario</th><th>Resultado</th><th>IP</th></tr></thead>
              <tbody>
                @for (a of accesos(); track a.accesoId) {
                  <tr>
                    <td class="whitespace-nowrap">{{ a.fecha | fechaHora }}</td>
                    <td><div class="font-semibold">{{ a.usuario ?? '—' }}</div><div class="text-xs text-suave">{{ a.email }}</div></td>
                    <td>@if (a.exito) { <span class="chip-exito">Ingresó</span> } @else { <span class="chip-peligro">{{ motivo(a.motivo) }}</span> }</td>
                    <td class="text-suave">{{ a.ip ?? '—' }}</td>
                  </tr>
                } @empty { <tr><td colspan="4" class="p-8 text-center text-suave">Nadie ha intentado ingresar todavía.</td></tr> }
              </tbody>
            </table>
          </div>
        }

        <!-- ═══ BITÁCORA ═══ -->
        @case ('bitacora') {
          <div class="tarjeta divide-y divide-borde">
            @for (b of bitacora(); track b.bitacoraId) {
              <div class="flex gap-3 p-4">
                <div class="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" [class]="b.rolId === 0 ? 'bg-oro' : 'bg-vino'"></div>
                <div class="min-w-0 flex-1">
                  <div class="text-sm"><b>{{ b.usuarioNombre }}</b> <span class="chip-neutro ml-1">{{ b.accion }}</span></div>
                  <div class="mt-0.5 text-sm text-suave">{{ b.detalle }}</div>
                  <div class="text-xs text-tenue">{{ b.fecha | fechaHora }}{{ b.ip ? ' · ' + b.ip : '' }}</div>
                </div>
              </div>
            } @empty { <div class="p-8 text-center text-suave">Sin registros.</div> }
          </div>
          @if (bitacora().length < bitacoraTotal()) {
            <div class="mt-4 text-center"><button type="button" class="btn-secundario" (click)="masBitacora()">Cargar más</button></div>
          }
        }

        <!-- ═══ SALUD ═══ -->
        @case ('salud') {
          @if (salud(); as s) {
            <div class="mb-4 grid gap-3 sm:grid-cols-4">
              <div class="tarjeta p-4"><div class="text-xs font-bold uppercase text-tenue">General</div><span [class]="niveles[s.nivelGeneral].chip" class="mt-2">{{ niveles[s.nivelGeneral].texto }}</span></div>
              <div class="tarjeta p-4"><div class="text-xs font-bold uppercase text-tenue">Accesos 7 días</div><div class="mt-1 text-2xl font-bold">{{ s.accesos7Dias }}</div></div>
              <div class="tarjeta p-4"><div class="text-xs font-bold uppercase text-tenue">Fallidos 24 h</div><div class="mt-1 text-2xl font-bold">{{ s.fallidos24h }}</div></div>
              <div class="tarjeta p-4"><div class="text-xs font-bold uppercase text-tenue">Usuarios activos</div><div class="mt-1 text-2xl font-bold">{{ s.usuariosActivos }}</div></div>
            </div>
            <div class="space-y-3">
              @for (h of s.hallazgos; track $index) {
                <div class="tarjeta flex gap-3 p-4">
                  <span class="mt-1.5 h-3 w-3 shrink-0 rounded-full" [class]="niveles[h.severidad].punto"></span>
                  <div><div class="font-semibold">{{ h.titulo }} <span class="chip-neutro ml-1">{{ h.area === 'USO' ? 'Uso' : 'Datos' }}</span></div>
                    <div class="text-sm text-suave">{{ h.detalle }}</div><div class="mt-1 text-sm"><b>Qué hacer:</b> {{ h.queHacer }}</div></div>
                </div>
              } @empty { <div class="tarjeta p-8 text-center text-exito">Todo en orden.</div> }
            </div>
          }
        }
      }

      <!-- ═══ DIÁLOGOS ═══ -->
      @switch (dialogo()) {
        @case ('cobro') {
          <vf-registrar-cobro [tenantId]="e.tenantId" [empresa]="e.nombreComercial" (cerrar)="dialogo.set(null)" (guardado)="trasCobro()" />
        }
        @case ('datos') {
          <vf-modal titulo="Editar datos de la empresa" ancho="sm:max-w-2xl" (cerrar)="dialogo.set(null)">
            <form (ngSubmit)="guardarDatos()">
              <label class="etiqueta">Tipo de negocio</label>
              <select aria-label="Tipo de negocio" class="campo mb-4" name="tipo" [(ngModel)]="datos.tipoServicio">@for (t of tipos; track t.valor) { <option [value]="t.valor">{{ t.texto }}</option> }</select>
              <div class="grid gap-4 sm:grid-cols-2">
                <div class="sm:col-span-2"><label class="etiqueta">Nombre comercial *</label><input aria-label="Nombre comercial" class="campo" name="nc" [(ngModel)]="datos.nombreComercial" maxlength="120" /></div>
                <div><label class="etiqueta">RUC</label><input aria-label="RUC" class="campo" name="ruc" [(ngModel)]="datos.ruc" inputmode="numeric" maxlength="11" /></div>
                <div><label class="etiqueta">Razón social</label><input aria-label="Razón social" class="campo" name="rs" [(ngModel)]="datos.razonSocial" maxlength="200" /></div>
                <div><label class="etiqueta">Celular</label><input aria-label="Celular" class="campo" name="tel" [(ngModel)]="datos.telefono" inputmode="tel" maxlength="12" /></div>
                <div><label class="etiqueta">Correo</label><input aria-label="Correo" class="campo" name="em" [(ngModel)]="datos.email" type="email" maxlength="120" /></div>
                <div><label class="etiqueta">Contacto</label><input aria-label="Contacto" class="campo" name="ct" [(ngModel)]="datos.contactoNombre" maxlength="120" /></div>
                <div><label class="etiqueta">Dirección</label><input aria-label="Dirección" class="campo" name="dir" [(ngModel)]="datos.direccion" maxlength="250" /></div>
              </div>
              <div class="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button type="button" class="btn-secundario" (click)="dialogo.set(null)">Cancelar</button>
                <button type="submit" class="btn-primario" [disabled]="guardando()">Guardar cambios</button>
              </div>
            </form>
          </vf-modal>
        }
        @case ('plan') {
          <vf-modal titulo="Cambiar de plan" subtitulo="El vencimiento no cambia; el nuevo precio rige desde el próximo cobro." ancho="sm:max-w-2xl" (cerrar)="dialogo.set(null)">
            <div class="grid gap-3 sm:grid-cols-2">
              @for (p of planes(); track p.planId) {
                <button type="button" class="rounded-2xl border-2 p-4 text-left transition-colors disabled:opacity-40"
                        [disabled]="!p.activo || p.planId === e.plan?.planId"
                        [class]="planNuevo() === p.planId ? 'border-vino bg-vino/5' : 'border-borde hover:border-oro'" (click)="planNuevo.set(p.planId)">
                  <div class="flex items-center justify-between"><span class="font-bold">{{ p.nombre }}</span>
                    @if (p.planId === e.plan?.planId) { <span class="chip-neutro">Actual</span> }
                    @else if (e.plan && p.precioMensual > e.plan.precioMensual) { <span class="chip-exito"><vf-icono nombre="sube" [tam]="12" /> Sube</span> }
                    @else if (e.plan) { <span class="chip-alerta"><vf-icono nombre="baja" [tam]="12" /> Baja</span> }
                  </div>
                  <div class="text-xl font-extrabold">{{ p.precioMensual | soles }}<span class="text-sm font-normal text-suave">/mes</span></div>
                  <div class="mt-1 text-xs text-suave">{{ p.maxSucursales || '∞' }} sucursal(es) · Admin + {{ p.maxUsuarios || '∞' }} usuario(s)</div>
                </button>
              }
            </div>
            <div class="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" class="btn-secundario" (click)="dialogo.set(null)">Cancelar</button>
              <button type="button" class="btn-primario" [disabled]="!planNuevo() || guardando()" (click)="cambiarPlan()">Cambiar plan</button>
            </div>
          </vf-modal>
        }
        @case ('sucursal') {
          <vf-modal [titulo]="sucursalEditando ? 'Editar sucursal' : 'Nueva sucursal'" (cerrar)="dialogo.set(null)">
            <form (ngSubmit)="guardarSucursal()">
              <label class="etiqueta">Nombre *</label><input aria-label="Nombre" class="campo mb-4" name="n" [(ngModel)]="sucursal.nombre" maxlength="100" />
              <label class="etiqueta">Dirección</label><input aria-label="Dirección" class="campo mb-4" name="d" [(ngModel)]="sucursal.direccion" maxlength="250" />
              <label class="etiqueta">Teléfono</label><input aria-label="Teléfono" class="campo" name="t" [(ngModel)]="sucursal.telefono" inputmode="tel" maxlength="12" />
              <div class="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button type="button" class="btn-secundario" (click)="dialogo.set(null)">Cancelar</button>
                <button type="submit" class="btn-primario" [disabled]="guardando()">Guardar</button>
              </div>
            </form>
          </vf-modal>
        }
        @case ('usuario') {
          <vf-modal [titulo]="usuarioEditando ? 'Editar usuario' : 'Nuevo usuario'" ancho="sm:max-w-2xl" (cerrar)="dialogo.set(null)">
            <form (ngSubmit)="guardarUsuario()">
              <label class="etiqueta">Rol</label>
              <div class="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                @for (r of rolesElegibles(); track r.rolId) {
                  <button type="button" class="opcion flex-col py-3" [class.opcion-activa]="usuario.rolId === r.rolId" [disabled]="!r.disponible" (click)="usuario.rolId = r.rolId">
                    <vf-icono [nombre]="iconoRol(r.rolId)" /> {{ r.rol }}
                    <span class="text-xs font-normal text-tenue">{{ r.detalle }}</span>
                  </button>
                }
              </div>
              <div class="grid gap-4 sm:grid-cols-2">
                <div class="sm:col-span-2"><label class="etiqueta">Nombre completo *</label><input aria-label="Nombre completo" class="campo" name="n" [(ngModel)]="usuario.nombre" maxlength="120" /></div>
                <div><label class="etiqueta">Correo (usuario) *</label><input aria-label="Correo (usuario)" class="campo" name="e" type="email" [(ngModel)]="usuario.email" maxlength="120" /></div>
                <div><label class="etiqueta">Sucursal *</label>
                  <select aria-label="Sucursal" class="campo" name="s" [(ngModel)]="usuario.sucursalId">
                    @for (s of sucursalesActivas(); track s.sucursalId) { <option [ngValue]="s.sucursalId">{{ s.nombre }}</option> }
                  </select></div>
                <div><label class="etiqueta">DNI</label><input aria-label="DNI" class="campo" name="d" [(ngModel)]="usuario.dni" inputmode="numeric" maxlength="8" /></div>
                <div><label class="etiqueta">Celular</label><input aria-label="Celular" class="campo" name="t" [(ngModel)]="usuario.telefono" inputmode="tel" maxlength="12" /></div>
              </div>
              @if (!usuarioEditando) {
                <p class="mt-4 rounded-xl bg-elevada p-3 text-sm text-suave">Se generará una contraseña temporal que verás una sola vez.</p>
              } @else if (usuarioEditando.rolId !== usuario.rolId || usuarioEditando.email !== usuario.email) {
                <p class="mt-4 rounded-xl bg-alerta/10 p-3 text-sm text-alerta">Cambiar el rol o el correo cierra sus sesiones abiertas.</p>
              }
              <div class="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button type="button" class="btn-secundario" (click)="dialogo.set(null)">Cancelar</button>
                <button type="submit" class="btn-primario" [disabled]="guardando()">Guardar</button>
              </div>
            </form>
          </vf-modal>
        }
      }
    } @else {
      <div class="tarjeta h-40 animate-pulse"></div>
    }
  `,
  styles: [`
    .accion { display:flex; width:100%; min-height:3rem; align-items:center; gap:.75rem; border-radius:.75rem; padding:0 .75rem; font-size:.95rem; font-weight:600; text-align:left; }
    .accion:hover { background: rgb(var(--vf-elevada)); }
    .barra { height:.6rem; overflow:hidden; border-radius:9999px; background: rgb(var(--vf-borde) / .6); }
    .barra > div { height:100%; border-radius:9999px; }
  `],
})
export class EmpresaFicha implements OnInit {
  private api = inject(SaApi);
  private ui = inject(Ui);
  private cdr = inject(ChangeDetectorRef);

  id = input.required<string>();
  e = signal<EmpresaDetalle | null>(null);
  pestana = signal<Pestana>('resumen');
  dialogo = signal<Dialogo>(null);
  menu = signal(false);
  guardando = signal(false);

  movimientos = signal<Movimiento[]>([]);
  accesos = signal<Acceso[]>([]);
  bitacora = signal<Bitacora[]>([]);
  bitacoraTotal = signal(0);
  private bitacoraPagina = 1;
  salud = signal<SaludEmpresa | null>(null);
  planes = signal<Plan[]>([]);
  planNuevo = signal<number | null>(null);

  notas = '';
  datos!: EmpresaDatos;
  sucursal = { nombre: '', direccion: null as string | null, telefono: null as string | null };
  sucursalEditando: Sucursal | null = null;
  usuario!: UsuarioGuardar;
  usuarioEditando: UsuarioEmpresa | null = null;

  estados = ESTADOS;
  niveles = NIVELES;
  tipos = TIPOS_SERVICIO;
  pestanas: { id: Pestana; texto: string }[] = [
    { id: 'resumen', texto: 'Resumen' }, { id: 'suscripcion', texto: 'Suscripción' }, { id: 'sucursales', texto: 'Sucursales' },
    { id: 'usuarios', texto: 'Usuarios' }, { id: 'accesos', texto: 'Accesos' }, { id: 'bitacora', texto: 'Bitácora' },
    { id: 'salud', texto: 'Salud' },
  ];

  private get tid(): number { return Number(this.id()); }

  sucursalesActivas = computed(() => this.e()?.sucursalesLista.filter(s => s.activo) ?? []);
  sinCupoSucursal = computed(() => {
    const e = this.e();
    return !!e?.plan && e.plan.maxSucursales > 0 && e.sucursalesActivas >= e.plan.maxSucursales;
  });
  whatsapp = computed(() => {
    const e = this.e();
    if (!e?.telefono) return '';
    const vence = e.vencimiento ? fmt.fecha(e.vencimiento) : '';
    return enlaceWhatsapp(e.telefono, `Hola ${e.contactoNombre ?? ''}, te saluda VK Software Solutions por tu servicio ValexaFood (${e.plan?.nombre ?? ''}). ` +
      (e.diasParaVencer !== null && e.diasParaVencer < 0 ? `Tu plan venció el ${vence}; renuévalo para que tu equipo siga trabajando.` : `Tu plan vence el ${vence}.`));
  });

  iconoRol = (r: number) => ICONO_ROL[r] ?? 'usuario';
  tipo = (t: string) => TIPOS_SERVICIO.find(x => x.valor === t)?.texto ?? t;
  pct = (n: number, max: number) => (max ? Math.min(100, (n / max) * 100) : n ? 20 : 0);
  color = (n: number, max: number) => (max && n > max ? 'bg-peligro' : max && n >= max ? 'bg-alerta' : 'bg-exito');
  motivo = (m: string | null) => ({ CLAVE_INCORRECTA: 'Clave incorrecta', BLOQUEADO: 'Bloqueado', USUARIO_INACTIVO: 'Usuario inactivo',
    EMPRESA_SUSPENDIDA: 'Empresa suspendida', PLAN_VENCIDO: 'Plan vencido' } as Record<string, string>)[m ?? ''] ?? (m ?? 'Rechazado');
  nombresRoles = (ids: number[]) => ids.map(i => ({ 2: 'Cajero', 3: 'Cocinero', 4: 'Mesero', 5: 'Delivery' } as Record<number, string>)[i]).join(', ');

  // Roles que se pueden elegir según el plan (y el Admin solo si no hay uno activo).
  rolesElegibles() {
    const e = this.e();
    if (!e) return [];
    const hayAdmin = e.usuariosLista.some(u => u.rolId === ROLES.ADMIN && u.activo);
    const lista = e.usoPorRol.filter(r => r.permitido).map(r => {
      const lleno = !!r.maximo && r.usados >= r.maximo;
      const esSuyo = this.usuarioEditando?.rolId === r.rolId;
      return { rolId: r.rolId, rol: r.rol, disponible: !lleno || esSuyo, detalle: r.maximo ? `${r.usados}/${r.maximo}` : 'sin tope' };
    });
    if (this.usuarioEditando?.rolId === ROLES.ADMIN) return [{ rolId: 1, rol: 'Administrador', disponible: true, detalle: 'único' }];
    if (!this.usuarioEditando && !hayAdmin) lista.unshift({ rolId: 1, rol: 'Administrador', disponible: true, detalle: 'único' });
    return lista;
  }

  async ngOnInit(): Promise<void> { await this.cargar(); }

  async cargar(): Promise<void> {
    try {
      const e = await this.api.empresa(this.tid);
      this.e.set(e);
      this.notas = e.notasInternas ?? '';
      this.cdr.markForCheck();
    } catch (err) { this.ui.error(err); }
  }

  async irA(p: Pestana): Promise<void> {
    this.pestana.set(p);
    try {
      if (p === 'suscripcion') this.movimientos.set(await this.api.movimientos(this.tid));
      if (p === 'accesos') this.accesos.set(await this.api.accesos(this.tid));
      if (p === 'salud') this.salud.set(await this.api.saludEmpresa(this.tid));
      if (p === 'bitacora') {
        this.bitacoraPagina = 1;
        const b = await this.api.bitacoraEmpresa(this.tid, 1);
        this.bitacora.set(b.items);
        this.bitacoraTotal.set(b.total);
      }
    } catch (e) { this.ui.error(e); }
  }

  async masBitacora(): Promise<void> {
    const b = await this.api.bitacoraEmpresa(this.tid, ++this.bitacoraPagina);
    this.bitacora.update(l => [...l, ...b.items]);
  }

  // Ejecuta una acción que devuelve la ficha actualizada.
  private async accion(fn: () => Promise<EmpresaDetalle | void>, exito: string, cerrarDialogo = true): Promise<boolean> {
    this.guardando.set(true);
    try {
      const r = await fn();
      if (r) { this.e.set(r); this.notas = r.notasInternas ?? ''; } else await this.cargar();
      this.ui.exito(exito);
      if (cerrarDialogo) this.dialogo.set(null);
      this.menu.set(false);
      return true;
    } catch (e) {
      this.ui.error(mensajeError(e));
      return false;
    } finally {
      this.guardando.set(false);
    }
  }

  async trasCobro(): Promise<void> {
    this.dialogo.set(null);
    await this.cargar();
    if (this.pestana() === 'suscripcion') this.movimientos.set(await this.api.movimientos(this.tid));
  }

  async anular(m: Movimiento): Promise<void> {
    const motivo = await this.ui.pedirTexto('Anular movimiento', `El vencimiento volverá a ${fmt.fecha(m.venceAntes)}. Motivo:`, 'Anular', 5, true);
    if (!motivo) return;
    try {
      await this.api.anularMovimiento(m.movimientoId, motivo);
      this.ui.exito('Movimiento anulado');
      await this.cargar();
      this.movimientos.set(await this.api.movimientos(this.tid));
    } catch (e) { this.ui.error(mensajeError(e)); }
  }

  abrirDatos(): void {
    const e = this.e()!;
    this.datos = { nombreComercial: e.nombreComercial, razonSocial: e.razonSocial, ruc: e.ruc, direccion: e.direccion,
      telefono: e.telefono, email: e.email, contactoNombre: e.contactoNombre, tipoServicio: e.tipoServicio };
    this.menu.set(false);
    this.dialogo.set('datos');
  }
  guardarDatos(): void { this.accion(() => this.api.actualizarEmpresa(this.tid, this.datos), 'Datos actualizados'); }
  guardarNotas(): void { this.accion(() => this.api.guardarNotas(this.tid, this.notas), 'Notas guardadas', false); }

  async abrirPlan(): Promise<void> {
    this.menu.set(false);
    this.planNuevo.set(null);
    try { this.planes.set(await this.api.planes()); this.dialogo.set('plan'); }
    catch (e) { this.ui.error(e); }
  }
  cambiarPlan(): void { this.accion(() => this.api.cambiarPlan(this.tid, this.planNuevo()!), 'Plan actualizado'); }

  async suspender(): Promise<void> {
    this.menu.set(false);
    const motivo = await this.ui.pedirTexto(`Suspender ${this.e()!.nombreComercial}`, 'Nadie de la empresa podrá entrar. Motivo:', 'Suspender', 5, true);
    if (motivo) this.accion(() => this.api.suspender(this.tid, motivo), 'Empresa suspendida');
  }
  async reactivar(): Promise<void> {
    this.menu.set(false);
    if (await this.ui.confirmar('Reactivar servicio', `${esc(this.e()!.nombreComercial)} podrá volver a entrar si su plan está vigente.`, 'Reactivar'))
      this.accion(() => this.api.reactivar(this.tid), 'Empresa reactivada');
  }
  async cerrarSesiones(): Promise<void> {
    this.menu.set(false);
    if (!(await this.ui.confirmar('Cerrar todas las sesiones', 'Todos los usuarios de la empresa tendrán que volver a ingresar (en menos de 30 segundos).', 'Cerrar sesiones', true))) return;
    try {
      const r = await this.api.cerrarSesionesEmpresa(this.tid);
      this.ui.exito(`Sesiones cerradas (${r.usuarios} usuarios)`);
    } catch (e) { this.ui.error(e); }
  }

  // ─── Sucursales ───
  nuevaSucursal(): void {
    this.sucursalEditando = null;
    this.sucursal = { nombre: '', direccion: null, telefono: null };
    this.dialogo.set('sucursal');
  }
  editarSucursal(s: Sucursal): void {
    this.sucursalEditando = s;
    this.sucursal = { nombre: s.nombre, direccion: s.direccion, telefono: s.telefono };
    this.dialogo.set('sucursal');
  }
  guardarSucursal(): void {
    const s = this.sucursalEditando;
    this.accion(() => (s ? this.api.editarSucursal(this.tid, s.sucursalId, this.sucursal) : this.api.crearSucursal(this.tid, this.sucursal)),
      s ? 'Sucursal actualizada' : 'Sucursal creada');
  }
  principal(s: Sucursal): void { this.accion(() => this.api.sucursalPrincipal(this.tid, s.sucursalId), `${s.nombre} es la principal`); }
  async estadoSucursal(s: Sucursal): Promise<void> {
    if (s.activo && !(await this.ui.confirmar('Desactivar sucursal', `¿Desactivar ${esc(s.nombre)}?`, 'Desactivar', true))) return;
    this.accion(() => this.api.estadoSucursal(this.tid, s.sucursalId, !s.activo), s.activo ? 'Sucursal desactivada' : 'Sucursal activada');
  }

  // ─── Usuarios ───
  nuevoUsuario(): void {
    this.usuarioEditando = null;
    const primero = this.rolesElegibles().find(r => r.disponible);
    this.usuario = { nombre: '', email: '', dni: null, telefono: null, rolId: primero?.rolId ?? ROLES.MESERO,
      sucursalId: this.sucursalesActivas().find(s => s.esPrincipal)?.sucursalId ?? this.sucursalesActivas()[0]?.sucursalId ?? null, password: null };
    this.dialogo.set('usuario');
  }
  editarUsuario(u: UsuarioEmpresa): void {
    this.usuarioEditando = u;
    this.usuario = { nombre: u.nombre, email: u.email, dni: u.dni, telefono: u.telefono, rolId: u.rolId, sucursalId: u.sucursalId, password: null };
    this.dialogo.set('usuario');
  }
  async guardarUsuario(): Promise<void> {
    const u = this.usuarioEditando;
    if (u) {
      await this.accion(() => this.api.editarUsuario(this.tid, u.usuarioId, this.usuario), 'Usuario actualizado');
      return;
    }
    this.guardando.set(true);
    try {
      const r = await this.api.crearUsuario(this.tid, this.usuario);
      this.e.set(r.empresa);
      this.dialogo.set(null);
      if (r.temporal) await this.ui.mostrarClave(this.usuario.nombre, r.temporal.passwordTemporal, `Usuario: ${this.usuario.email}. ${r.temporal.mensaje}`);
      this.ui.exito('Usuario creado');
    } catch (e) {
      this.ui.error(mensajeError(e));
    } finally {
      this.guardando.set(false);
    }
  }
  async resetPassword(u: UsuarioEmpresa): Promise<void> {
    if (!(await this.ui.confirmar('Generar nueva contraseña', `Se reemplazará la clave de <b>${esc(u.nombre)}</b> por una temporal y se cerrarán sus sesiones.`, 'Generar'))) return;
    try {
      const r = await this.api.resetPassword(this.tid, u.usuarioId);
      await this.ui.mostrarClave(u.nombre, r.passwordTemporal, `Usuario: ${u.email}. ${r.mensaje}`);
      await this.cargar();
    } catch (e) { this.ui.error(mensajeError(e)); }
  }
  desbloquear(u: UsuarioEmpresa): void { this.accion(() => this.api.desbloquear(this.tid, u.usuarioId), `${u.nombre} desbloqueado`, false); }
  cerrarSesionUsuario(u: UsuarioEmpresa): void { this.accion(() => this.api.cerrarSesionesUsuario(this.tid, u.usuarioId), `Sesiones de ${u.nombre} cerradas`, false); }
  async estadoUsuario(u: UsuarioEmpresa): Promise<void> {
    if (u.activo && !(await this.ui.confirmar('Desactivar usuario', `<b>${esc(u.nombre)}</b> no podrá entrar y liberará su cupo.`, 'Desactivar', true))) return;
    this.accion(() => this.api.estadoUsuario(this.tid, u.usuarioId, !u.activo), u.activo ? 'Usuario desactivado' : 'Usuario activado', false);
  }
}
