import { CommonModule, CurrencyPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { SesionService } from '../core/sesion';
import { Icono } from '../shared/icono';
import { calcularPrecioConfiguradoPos, comboSeleccionValida, precioDesdeConfiguracionPos } from '../core/pos-precios';
import { IntentosIdempotentes, respuestaOperacionIncierta } from '../core/idempotencia-operaciones';

type Mesa = { mesaId: number; nombre: string; capacidad: number; activa: boolean; pedidoId: number | null; estadoPedido: string | null; total: number; sinEnviar: number };
type PedidoNuevo = { mesaId: number | null; canal: 'SALON' | 'MOSTRADOR' | 'PARA_LLEVAR'; nota: string | null; claveIdempotencia: string };
type ModificadorOpcion = { opcionId: number; nombre: string; precioExtra: number };
type ModificadorGrupo = { grupoId: number; nombre: string; minimo: number; maximo: number; opciones: ModificadorOpcion[] };
type Variante = { varianteId: number; nombre: string; precio: number };
type ComboOpcion = { productoId: number; nombre: string; precioExtra: number; agotado: boolean; variantes: Variante[]; grupos: ModificadorGrupo[] };
type ComboGrupo = { comboGrupoId: number; nombre: string; cantidad: number; opciones: ComboOpcion[] };
type ModificadorSnapshot = { grupoId: number; grupo: string; opciones: ModificadorOpcion[] };
type ComboSnapshot = { comboGrupoId: number; grupo: string; opciones: { productoId: number; nombre: string; areaId: number | null; cantidad: number; precioExtra: number; varianteId: number | null; variante: string | null; modificadores: ModificadorSnapshot[] }[] };
// `enviado` = la línea ya tiene comanda. Lo que no lo tiene es lo que se puede
// corregir y lo que viaja en el próximo envío a cocina.
type Item = { pedidoItemId: number; comandaItemId: number | null; productoId: number; nombre: string; areaId: number | null; cantidad: number; cantidadPagada: number; precioUnitario: number; total: number; nota: string | null; estado: string; resumenSeleccion: string | null; enviado: boolean; paraLlevar: boolean; empaque: string | null };
type EmpaqueConfig = { taperPrecio: number; bolsaPrecio: number };
type PagoAplicacion = { pedidoItemId: number; producto: string; cantidad: number; monto: number };
type Pago = { pagoId: number; pedidoId: number; medio: string; monto: number; recibido: number; vuelto: number; sesionCajaId: number; registradoEn: string; referencia: string | null; aplicaciones: PagoAplicacion[] | null };
type AjusteVenta = { ajusteVentaId: number; tipo: 'DESCUENTO' | 'DEVOLUCION'; monto: number; motivo: string; pedidoId: number; pagoId: number | null; sesionCajaId: number | null; registradoPor: number; registradoEn: string };
type Pedido = { pedidoId: number; mesaId: number | null; canal: string; estado: string; creadoEn: string; nota: string | null; total: number; totalPagado: number; saldoPendiente: number; pagos: Pago[]; items: Item[]; puedeDividirPorLineas: boolean; descuento: number; totalDevuelto: number; ajustes: AjusteVenta[] };
type Producto = { productoId: number; nombre: string; tipo: 'PLATO' | 'BEBIDA' | 'PRODUCTO' | 'COMBO'; precio: number; agotado: boolean; areaId: number | null; imagen: string | null; variantes: Variante[]; grupos: ModificadorGrupo[]; combo: ComboGrupo[] };
type Categoria = { categoriaId: number; nombre: string; productos: Producto[] };
type PrintPayload = { pedidoId: number; comandaId: number; area: string; enviadaEn: string; mesaId: number | null; canal: string;
  lineas: { nombre: string; cantidad: number; nota: string | null; seleccion: string; paraLlevar?: boolean; empaque?: string | null }[];
  componentes: { nombre: string; cantidad: number; nota: string | null; paraLlevar?: boolean; empaque?: string | null }[] };
type PrintJob = { trabajoImpresionId: number; comandaId: number; estado: 'PENDIENTE' | 'SOLICITADA' | 'ERROR' | 'IMPRESA'; intentos: number; ultimoError: string | null; creadoEn: string; payload: PrintPayload };
type ResultadoImpresionPendiente = { impresa: boolean; detalle: string | null; claveIdempotencia: string };
type PrintEvent = { tipo: string; detalle: string | null; registradoPor: number | null; registradoEn: string };
type Comanda = { comandaId: number; pedidoId: number; areaId: number; area: string; estado: string; enviadaEn: string; mesa: string | null; canal: string; items: Item[]; impresion: PrintJob | null };
type CajaCobro = { sesionCajaId: number; cajaId: number; caja: string; abiertaEn: string };

@Component({
  selector: 'vf-operacion-pagina', imports: [CommonModule, FormsModule, CurrencyPipe, Icono], changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="space-y-5">
      <!-- ─── Cabecera ─── -->
      <header class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p class="text-xs font-bold uppercase tracking-[0.16em] text-naranja">{{ sucursal() }}</p>
          <h1 class="titulo-pagina mt-0.5">{{ vista() === 'cocina' ? 'Cocina' : 'Salón y pedidos' }}</h1>
        </div>
        @if (sesion.tieneAlguno('SALON_VER') && sesion.tieneAlguno('COCINA_VER')) {
          <div class="flex gap-1 rounded-2xl border border-borde bg-elevada p-1">
            <button type="button" class="min-h-toque rounded-xl px-5 text-[15px] font-bold transition-colors"
                    [class.bg-marino]="vista() === 'salon'" [class.text-white]="vista() === 'salon'"
                    [class.text-suave]="vista() !== 'salon'" (click)="vista.set('salon')">Salón</button>
            <button type="button" class="min-h-toque rounded-xl px-5 text-[15px] font-bold transition-colors"
                    [class.bg-marino]="vista() === 'cocina'" [class.text-white]="vista() === 'cocina'"
                    [class.text-suave]="vista() !== 'cocina'" (click)="vista.set('cocina'); cargarCocina()">Cocina</button>
          </div>
        }
      </header>

      @if (error()) { <div role="alert" class="flex items-start gap-3 rounded-2xl border border-peligro/40 bg-peligro/10 px-4 py-3 text-sm font-medium text-peligro"><vf-icono nombre="alerta" class="mt-0.5 shrink-0" />{{ error() }}</div> }
      @if (mensaje()) { <div role="status" class="flex items-start gap-3 rounded-2xl border border-exito/40 bg-exito/10 px-4 py-3 text-sm font-medium text-exito"><vf-icono nombre="check" class="mt-0.5 shrink-0" />{{ mensaje() }}</div> }
      @if (vista() === 'salon' && pedidoCreacionIncierta()) {
        <div class="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-alerta/40 bg-alerta/10 p-3 text-sm font-medium text-alerta" role="alert">
          <span>No se confirmó si el pedido se creó. Reintenta la misma solicitud para recuperar el resultado sin duplicarlo.</span>
          <button class="btn btn-sm bg-alerta text-white" [disabled]="ocupada()" (click)="reintentarPedidoPendiente()">Conciliar creación</button>
        </div>
      }

      @if (vista() === 'salon') {
        <div class="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(400px,0.85fr)]">

          <!-- ─────────── Mapa de mesas ─────────── -->
          <section class="space-y-4">
            <!-- Mostrador y Para llevar los atiende quien está en la caja. El
                 mesero trabaja mesas: lo que se lleva o sale a reparto lo
                 despacha otro, y no tiene por qué ensuciarle la pantalla. -->
            @if (atiendeMostrador()) {
              <div class="grid grid-cols-2 gap-3">
                <button class="btn-grande-naranja" [disabled]="ocupada() || pedidoCreacionIncierta() || !!pedido()" (click)="crearPedidoRapido('MOSTRADOR')">
                  <vf-icono nombre="tienda" [tam]="22" /> Mostrador
                </button>
                <button class="btn-grande-borde" [disabled]="ocupada() || pedidoCreacionIncierta() || !!pedido()" (click)="crearPedidoRapido('PARA_LLEVAR')">
                  <vf-icono nombre="bandeja" [tam]="22" /> Para llevar
                </button>
              </div>
            }

            <div class="flex flex-wrap items-center justify-between gap-2">
              <h2 class="text-lg font-bold">Mesas</h2>
              <div class="flex items-center gap-3">
                <!-- Leyenda: el color de cada mesa dice en qué va el servicio. -->
                <div class="hidden items-center gap-3 text-[11px] font-semibold text-tenue sm:flex">
                  <span class="flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-full border border-borde"></span>Libre</span>
                  <span class="flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-full bg-naranja"></span>Atendiendo</span>
                  <span class="flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-full bg-alerta"></span>En cocina</span>
                  <span class="flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-full bg-exito"></span>Lista</span>
                  <span class="flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-full bg-peligro"></span>Sin enviar</span>
                </div>
                @if (sesion.tienePermiso('MESAS_GESTIONAR')) {
                  <button class="btn btn-sm btn-secundario" (click)="agregarMesa()"><vf-icono nombre="mas" [tam]="18" /> Mesa</button>
                }
              </div>
            </div>

            @if (cargando()) {
              <div class="tarjeta p-8 text-center text-sm text-tenue">Cargando operación…</div>
            }
            <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 2xl:grid-cols-4">
              @for (m of mesas(); track m.mesaId) {
                <button class="mesa" [ngClass]="claseMesa(m)"
                        [class.mesa-elegida]="mesaSeleccionada()?.mesaId === m.mesaId"
                        [class.opacity-40]="!m.activa"
                        [disabled]="!m.activa || ocupada()" (click)="seleccionarMesa(m)">
                  <span class="mesa-nombre">{{ m.nombre }}</span>
                  @if (m.pedidoId) {
                    <span class="cifra text-xl">{{ m.total | currency:'PEN':'symbol':'1.2-2' }}</span>
                    <span class="mesa-dato">{{ etiquetaEstadoMesa(m) }}</span>
                  } @else {
                    <span class="mesa-dato">{{ m.capacidad }} personas</span>
                  }
                </button>
              }
              @if (!mesas().length && !cargando()) {
                <div class="col-span-full rounded-2xl border border-dashed border-borde p-8 text-center text-sm text-tenue">
                  Aún no hay mesas. Crea la primera para empezar a atender el salón.
                </div>
              }
            </div>
          </section>

          <!-- ─────────── Pedido abierto ─────────── -->
          <section class="tarjeta min-w-0 p-4 sm:p-5">
            @if (!pedido()) {
              <div class="flex min-h-60 flex-col items-center justify-center gap-3 text-center">
                <vf-icono nombre="cubiertos" [tam]="44" class="text-borde" />
                <div class="text-lg font-bold">Inicia una venta</div>
                <p class="max-w-sm text-sm text-suave">
                  @if (atiendeMostrador()) { Toca una mesa, o usa Mostrador o Para llevar. }
                  @else { Toca una mesa para empezar a atenderla. }
                  Después agrega productos y envía la comanda a cocina.
                </p>
              </div>
            } @else {
              <div class="flex items-start justify-between gap-3">
                <div>
                  <p class="text-xs font-bold uppercase tracking-wide text-naranja">{{ mesaSeleccionada()?.nombre ?? etiquetaCanal(pedido()!.canal) }} · Pedido #{{ pedido()!.pedidoId }}</p>
                  <h2 class="mt-0.5 text-xl font-extrabold">{{ etiquetaEstadoPedido(pedido()!.estado) }}</h2>
                </div>
                <button class="btn-icono" (click)="cerrarDetalle()" aria-label="Cerrar pedido"><vf-icono nombre="x" /></button>
              </div>

              <!-- Agregar no es pedir: hasta que no se manda, cocina no sabe que
                   existe. Decirlo aqui es mas barato que un cliente esperando. -->
              @if (aPreparacion() > 0) {
                <div role="alert" class="mt-3 flex items-center gap-2 rounded-2xl border border-peligro/40 bg-peligro/10 px-3 py-2 text-sm font-semibold text-peligro">
                  <vf-icono nombre="alerta" [tam]="18" class="shrink-0" />
                  <span>Cocina todavía no ve {{ aPreparacion() }} {{ aPreparacion() === 1 ? 'producto' : 'productos' }} de esta mesa.</span>
                </div>
              }

              @if (itemIncierto(pedido()!.pedidoId) && !productoConfigurando()) {
                <div class="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-alerta/40 bg-alerta/10 p-3 text-sm font-medium text-alerta" role="alert">
                  <span>No se confirmó si la última línea se agregó. Concíliala con la misma clave antes de continuar.</span>
                  <button class="btn btn-sm bg-alerta text-white" [disabled]="ocupada()" (click)="reintentarItemPendiente()">Conciliar línea</button>
                </div>
              }

              <!-- Carta táctil: categorías en pestañas y platos en mosaicos.
                   Se puede seguir agregando mientras la cuenta no esté cobrada:
                   la mesa pide otra ronda, el postre, lo que falte. -->
              @if (puedeAgregar()) {
                <div class="mt-4">
                  <div class="pestanas">
                    @for (c of carta(); track c.categoriaId) {
                      <button type="button" class="pestana" [class.pestana-activa]="categoriaActiva() === c.categoriaId"
                              (click)="categoriaActiva.set(c.categoriaId)">{{ c.nombre }}</button>
                    }
                  </div>
                  <div class="mt-3 grid max-h-[22rem] grid-cols-2 gap-2.5 overflow-y-auto pr-1 sm:grid-cols-3 xl:grid-cols-2 2xl:grid-cols-3">
                    @for (p of productosCategoria(); track p.productoId) {
                      <button class="flex min-h-[5.5rem] flex-col items-start justify-between gap-1 rounded-2xl border-2 border-borde bg-superficie p-3 text-left transition-all hover:border-naranja active:scale-[0.97] disabled:opacity-40"
                              [disabled]="p.agotado || ocupada() || itemIncierto(pedido()!.pedidoId)" (click)="configurarProducto(p)">
                        <span class="line-clamp-2 text-[15px] font-bold leading-tight">{{ p.nombre }}</span>
                        <span class="flex w-full items-center justify-between gap-2">
                          <span class="cifra text-[15px] text-naranja">
                            @if (p.agotado) { <span class="text-peligro">Agotado</span> }
                            @else { {{ tienePrecioVariable(p) ? 'Desde ' : '' }}{{ precioDesde(p) | currency:'PEN':'symbol':'1.2-2' }} }
                          </span>
                          @if (p.tipo === 'COMBO') { <span class="chip-naranja">Combo</span> }
                        </span>
                      </button>
                    }
                    @if (!productosCategoria().length) {
                      <p class="col-span-full py-6 text-center text-sm text-tenue">Esta categoría no tiene platos disponibles hoy.</p>
                    }
                  </div>
                </div>
              }

              <!-- ─── Hoja de personalización del plato ─── -->
              @if (productoConfigurando(); as productoConfig) {
                <div class="fixed inset-0 z-50 flex items-end justify-center bg-tinta/70 backdrop-blur-sm sm:items-center sm:p-4" role="presentation">
                  <section class="panel-desplazable w-full max-w-2xl rounded-t-3xl bg-superficie p-5 shadow-flotante sm:rounded-3xl" role="dialog" aria-modal="true" aria-labelledby="config-producto-titulo">
                    <div class="flex items-start justify-between gap-4">
                      <div>
                        <p class="text-xs font-bold uppercase tracking-wider text-naranja">Personalizar</p>
                        <h3 id="config-producto-titulo" class="mt-0.5 text-2xl font-extrabold">{{ productoConfig.nombre }}</h3>
                      </div>
                      @if (!reintentoPendiente()) {
                        <button type="button" class="btn-icono" (click)="cancelarConfiguracion()" aria-label="Cerrar personalización"><vf-icono nombre="x" /></button>
                      }
                    </div>

                    @if (productoConfig.variantes.length) {
                      <fieldset class="mt-5">
                        <legend class="mb-2 text-sm font-bold">Tamaño o presentación</legend>
                        <div class="grid gap-2 sm:grid-cols-2">
                          @for (v of productoConfig.variantes; track v.varianteId) {
                            <button type="button" class="opcion min-h-[3.5rem] justify-between px-4"
                                    [class.opcion-activa]="varianteElegida() === v.varianteId"
                                    [disabled]="reintentoPendiente()" (click)="varianteElegida.set(v.varianteId)">
                              <span>{{ v.nombre }}</span>
                              <span class="cifra">{{ v.precio | currency:'PEN':'symbol':'1.2-2' }}</span>
                            </button>
                          }
                        </div>
                      </fieldset>
                    }

                    @for (g of productoConfig.grupos; track g.grupoId) {
                      <fieldset class="mt-5">
                        <legend class="text-sm font-bold">{{ g.nombre }} <span class="font-medium text-tenue">· {{ reglaGrupo(g) }}</span></legend>
                        <div class="mt-2 grid gap-2 sm:grid-cols-2">
                          @for (o of g.opciones; track o.opcionId) {
                            <button type="button" class="opcion min-h-[3.5rem] justify-between px-4"
                                    [class.opcion-activa]="modificadorElegido(g.grupoId, o.opcionId)"
                                    [disabled]="reintentoPendiente() || (!modificadorElegido(g.grupoId, o.opcionId) && grupoLleno(g, g.grupoId))"
                                    (click)="alternarModificador(g.grupoId, o.opcionId)">
                              <span class="flex items-center gap-2">
                                @if (modificadorElegido(g.grupoId, o.opcionId)) { <vf-icono nombre="check" [tam]="18" /> }
                                {{ o.nombre }}
                              </span>
                              <span class="text-sm font-semibold text-tenue">{{ o.precioExtra ? ('+' + (o.precioExtra | currency:'PEN':'symbol':'1.2-2')) : 'Incluido' }}</span>
                            </button>
                          }
                        </div>
                      </fieldset>
                    }

                    @for (g of productoConfig.combo; track g.comboGrupoId) {
                      <fieldset class="mt-5 rounded-2xl border border-borde p-3">
                        <legend class="px-1 text-sm font-bold">{{ g.nombre }} <span class="font-medium text-tenue">· elige {{ g.cantidad }}</span></legend>
                        @for (slot of comboSlots(g); track slot) {
                          <div class="mt-3 rounded-xl bg-elevada p-3">
                            <p class="mb-2 text-sm font-bold">Opción {{ slot + 1 }}</p>
                            <div class="grid gap-2 sm:grid-cols-2">
                              @for (o of g.opciones; track o.productoId) {
                                <button type="button" class="opcion min-h-[3.5rem] justify-between px-4"
                                        [class.opcion-activa]="comboElegido(g.comboGrupoId, slot) === o.productoId"
                                        [disabled]="reintentoPendiente() || o.agotado || comboOpcionRepetida(g.comboGrupoId, slot, o.productoId)"
                                        (click)="elegirCombo(g, slot, o.productoId)">
                                  <span>{{ o.nombre }}</span>
                                  <span class="text-sm font-semibold text-tenue">
                                    @if (o.agotado) { Agotado }
                                    @else if (comboOpcionRepetida(g.comboGrupoId, slot, o.productoId)) { Ya elegido }
                                    @else if (o.precioExtra) { +{{ o.precioExtra | currency:'PEN':'symbol':'1.2-2' }} }
                                  </span>
                                </button>
                              }
                            </div>

                            @if (comboOpcionElegida(g, slot); as opcion) {
                              @if (opcion.variantes.length) {
                                <p class="mb-2 mt-3 text-sm font-bold">Presentación</p>
                                <div class="grid gap-2 sm:grid-cols-2">
                                  @for (v of opcion.variantes; track v.varianteId) {
                                    <button type="button" class="opcion justify-between px-4"
                                            [class.opcion-activa]="comboVariante(g.comboGrupoId, slot) === v.varianteId"
                                            [disabled]="reintentoPendiente()" (click)="elegirComboVariante(g.comboGrupoId, slot, v.varianteId)">
                                      <span>{{ v.nombre }}</span><span class="cifra">{{ v.precio | currency:'PEN':'symbol':'1.2-2' }}</span>
                                    </button>
                                  }
                                </div>
                              }
                              @for (cg of opcion.grupos; track cg.grupoId) {
                                <p class="mb-2 mt-3 text-sm font-bold">{{ cg.nombre }} <span class="font-medium text-tenue">· {{ reglaGrupo(cg) }}</span></p>
                                <div class="grid gap-2 sm:grid-cols-2">
                                  @for (co of cg.opciones; track co.opcionId) {
                                    <button type="button" class="opcion justify-between px-4"
                                            [class.opcion-activa]="comboModificadorElegido(g.comboGrupoId, slot, cg.grupoId, co.opcionId)"
                                            [disabled]="reintentoPendiente() || (!comboModificadorElegido(g.comboGrupoId, slot, cg.grupoId, co.opcionId) && comboGrupoLleno(g.comboGrupoId, slot, cg, cg.grupoId))"
                                            (click)="alternarComboModificador(g.comboGrupoId, slot, cg.grupoId, co.opcionId)">
                                      <span>{{ co.nombre }}</span>
                                      <span class="text-xs font-semibold text-tenue">{{ co.precioExtra ? ('+' + (co.precioExtra | currency:'PEN':'symbol':'1.2-2')) : '' }}</span>
                                    </button>
                                  }
                                </div>
                              }
                            }
                          </div>
                        }
                      </fieldset>
                    }

                    <!-- La familia come en la mesa y pide un plato más para llevarse:
                         pasa todo el tiempo y antes obligaba a abrir otro pedido. -->
                    @if (pedido()?.canal === 'SALON') {
                      <fieldset class="mt-5">
                        <legend class="mb-2 text-sm font-bold">¿Dónde se come?</legend>
                        <div class="grid grid-cols-2 gap-2">
                          <button type="button" class="medio-pago" [class.medio-pago-activo]="!itemParaLlevar()"
                                  [disabled]="reintentoPendiente()" (click)="fijarDestino(false)">
                            <vf-icono nombre="cubiertos" [tam]="26" />
                            <span class="leading-none">En la mesa</span>
                          </button>
                          <button type="button" class="medio-pago" [class.medio-pago-activo]="itemParaLlevar()"
                                  [disabled]="reintentoPendiente()" (click)="fijarDestino(true)">
                            <vf-icono nombre="bandeja" [tam]="26" />
                            <span class="leading-none">Para llevar</span>
                          </button>
                        </div>

                        @if (itemParaLlevar()) {
                          <p class="mb-2 mt-4 text-sm font-bold">¿En qué lo empacamos?</p>
                          <div class="grid grid-cols-2 gap-2">
                            <button type="button" class="opcion justify-between px-4" [class.opcion-activa]="itemEmpaque() === 'TAPER'"
                                    [disabled]="reintentoPendiente()" (click)="itemEmpaque.set('TAPER')">
                              <span>Táper</span>
                              <span class="cifra">{{ empaque().taperPrecio | currency:'PEN':'symbol':'1.2-2' }}</span>
                            </button>
                            <button type="button" class="opcion justify-between px-4" [class.opcion-activa]="itemEmpaque() === 'BOLSA'"
                                    [disabled]="reintentoPendiente()" (click)="itemEmpaque.set('BOLSA')">
                              <span>Bolsa</span>
                              <span class="cifra">{{ empaque().bolsaPrecio ? (empaque().bolsaPrecio | currency:'PEN':'symbol':'1.2-2') : 'Gratis' }}</span>
                            </button>
                          </div>
                          <p class="mt-2 text-xs text-tenue">El empaque entra como su propia línea de la cuenta.</p>
                        }
                      </fieldset>
                    }

                    <label class="mt-5 block">
                      <span class="etiqueta">Nota para cocina <span class="font-medium text-tenue">(opcional)</span></span>
                      <input class="campo" maxlength="200" [value]="notaProducto()" [disabled]="reintentoPendiente()"
                             (input)="notaProducto.set($any($event.target).value)" placeholder="Ej. sin cebolla, salsa aparte" />
                    </label>
                    @if (errorConfiguracion()) { <p class="mt-3 rounded-xl bg-peligro/10 px-3 py-2 text-sm font-medium text-peligro" role="alert">{{ errorConfiguracion() }}</p> }

                    <div class="sticky bottom-0 -mx-5 mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-borde bg-superficie px-5 pb-1 pt-4">
                      <div aria-live="polite">
                        @if (configuracionValida(productoConfig)) {
                          <p class="text-xs font-semibold text-tenue">Precio unitario</p>
                          <p class="cifra text-2xl">{{ precioConfigurado(productoConfig) | currency:'PEN':'symbol':'1.2-2' }}</p>
                        } @else {
                          <p class="max-w-xs text-sm text-suave">Completa las opciones obligatorias para ver el precio.</p>
                        }
                      </div>
                      <div class="flex flex-1 justify-end gap-2">
                        @if (!reintentoPendiente()) { <button type="button" class="btn-grande-borde" (click)="cancelarConfiguracion()">Cancelar</button> }
                        <button type="button" class="btn-grande-naranja flex-1 sm:flex-none" [disabled]="ocupada() || !configuracionValida(productoConfig)" (click)="confirmarProducto()">
                          {{ reintentoPendiente() ? 'Reintentar sin duplicar' : 'Agregar' }}
                        </button>
                      </div>
                    </div>
                  </section>
                </div>
              }

              <!-- ─── Líneas del pedido ─── -->
              <div class="mt-5 divide-y divide-borde">
                @for (i of pedido()!.items; track i.pedidoItemId) {
                  <div class="flex items-start justify-between gap-3 py-2.5">
                    <div class="min-w-0">
                      <span class="text-[15px] font-bold">{{ i.cantidad }} × {{ i.nombre }}</span>
                      @if (i.paraLlevar) {
                        <span class="ml-2 align-middle chip-naranja">Para llevar@if (i.empaque) { · {{ i.empaque === 'TAPER' ? 'táper' : 'bolsa' }} }</span>
                      }
                      @if (!i.enviado && i.estado !== 'ANULADO') {
                        <!-- "PENDIENTE" se lee como "cocina lo tiene y falta que salga".
                             Lo que pasa de verdad es que cocina ni se enteró. -->
                        <span class="ml-2 align-middle rounded-full bg-peligro/15 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-peligro">Sin enviar</span>
                      } @else {
                        <span class="ml-2 align-middle text-[11px] font-bold uppercase tracking-wide"
                              [class.text-peligro]="i.estado === 'ANULADO'" [class.text-tenue]="i.estado !== 'ANULADO'">{{ i.estado }}</span>
                      }
                      @if (i.resumenSeleccion) { <span class="block text-xs text-suave">{{ i.resumenSeleccion }}</span> }
                      @if (i.cantidadPagada) { <span class="block text-xs font-semibold text-exito">{{ i.cantidadPagada }} de {{ i.cantidad }} unidad(es) en cuentas</span> }
                    </div>
                    <div class="flex shrink-0 items-center gap-2">
                      <span class="cifra">{{ i.total | currency:'PEN':'symbol':'1.2-2' }}</span>
                      @if (puedeEntregar(i)) {
                        <button class="btn btn-sm border border-exito/40 font-bold text-exito hover:bg-exito/10"
                                [disabled]="ocupada()" (click)="entregar(i)">Entregar</button>
                      }
                      @if (sesion.tienePermiso('PEDIDO_ANULAR_ITEM') && ((pedido()!.estado !== 'PAGADO' && i.estado !== 'ANULADO') || anulacionIncierta(i.pedidoItemId))) {
                        <button class="btn btn-sm border border-peligro/40 text-peligro hover:bg-peligro/10" [disabled]="ocupada()" (click)="anularItem(i)">
                          {{ anulacionIncierta(i.pedidoItemId) ? 'Conciliar' : 'Anular' }}
                        </button>
                      }
                    </div>
                  </div>
                }
                @if (!pedido()!.items.length) { <p class="py-6 text-center text-sm text-tenue">Agrega productos desde la carta.</p> }
              </div>

              <div class="mt-4 flex items-center justify-between border-t border-borde pt-4">
                <span class="text-lg font-bold">Total</span>
                <span class="cifra text-3xl">{{ pedido()!.total | currency:'PEN':'symbol':'1.2-2' }}</span>
              </div>
              @if (pedido()!.descuento > 0) { <p class="mt-1 text-right text-sm font-semibold text-exito">Descuento auditado: −{{ pedido()!.descuento | currency:'PEN':'symbol':'1.2-2' }}</p> }

              <div class="accion-fija -mx-4 mt-4 grid gap-3 px-4 pb-2 pt-3 sm:-mx-5 sm:px-5">
                <!-- Lo listo está en el pase, no en la mesa. El que camina es el
                     que cierra el circuito, y lo hace desde aquí. -->
                @if (porEntregar() > 0 && sesion.tienePermiso('PEDIDO_ENTREGAR')) {
                  <button class="btn-grande-exito w-full" [disabled]="ocupada()" (click)="entregar()">
                    <vf-icono nombre="check" [tam]="22" />
                    Entregar {{ porEntregar() }} {{ porEntregar() === 1 ? 'plato listo' : 'platos listos' }}
                  </button>
                }
                @if (sinEnviar() > 0) {
                  <button class="btn-grande-marino w-full" [disabled]="ocupada()" (click)="enviar()">
                    <vf-icono nombre="chef" [tam]="22" />
                    @if (aPreparacion() > 0) {
                      Enviar {{ aPreparacion() }} {{ aPreparacion() === 1 ? 'producto' : 'productos' }} a cocina
                    } @else {
                      Enviar a cocina
                    }
                  </button>
                }
                @if (pedido()!.estado === 'ABIERTO' && !pedido()!.items.length) {
                  <button class="btn-grande-borde w-full border-peligro/40 text-peligro" [disabled]="ocupada()" (click)="anularBorrador()">Liberar mesa</button>
                }

                <!-- El cobro vive en su propia pantalla: en un celular, tener que
                     desplazarse hasta el fondo para cobrar es una mala experiencia. -->
                @if (pedido()!.estado !== 'PAGADO' && sesion.tienePermiso('COBRAR')) {
                  <button class="btn-grande-exito w-full" [disabled]="ocupada() || !pedido()!.items.length" (click)="abrirCobro()">
                    <vf-icono nombre="billete" [tam]="22" />
                    Cobrar {{ pedido()!.saldoPendiente | currency:'PEN':'symbol':'1.2-2' }}
                  </button>
                }
              </div>

              @if (pedido()!.estado === 'PAGADO') {
                <p class="mt-3 flex items-center gap-2 rounded-2xl bg-exito/10 p-3 text-sm font-bold text-exito">
                  <vf-icono nombre="check" [tam]="20" /> Pedido cobrado y registrado en la caja activa.
                </p>
              }
              @if (pedido()!.pagos.length && pedido()!.ajustes.length) {
                <section class="mt-4 rounded-2xl border border-borde p-3">
                  <h3 class="text-sm font-bold">Ajustes auditados</h3>
                  @for (a of pedido()!.ajustes; track a.ajusteVentaId) { <p class="mt-2 text-xs text-suave">{{ a.tipo }} · {{ a.monto | currency:'PEN':'symbol':'1.2-2' }} · {{ a.motivo }}</p> }
                </section>
              }
              @if (sesion.tienePermiso('PAGO_DEVOLVER') && pedido()!.pagos.length && (cajasAbiertas().length || pedidoTieneDevolucionIncierta(pedido()!.pagos))) {
                <section class="mt-4 space-y-2 rounded-2xl border border-peligro/30 p-3">
                  <h3 class="text-sm font-bold">Devoluciones compensatorias</h3>
                  @for (p of pedido()!.pagos; track p.pagoId) {
                    @if (p.monto - devueltoPago(p.pagoId) > 0 || devolucionIncierta(p.pagoId)) {
                      <button class="btn w-full justify-start border border-peligro/40 text-peligro hover:bg-peligro/10" [disabled]="ocupada()" (click)="devolverPago(p)">
                        <span>{{ devolucionIncierta(p.pagoId) ? 'Conciliar devolución' : 'Devolver a ' + p.medio }}</span>
                        @if (!devolucionIncierta(p.pagoId)) { <span class="text-suave">· hasta {{ (p.monto - devueltoPago(p.pagoId)) | currency:'PEN':'symbol':'1.2-2' }}</span> }
                      </button>
                    }
                  }
                </section>
              }
            }
          </section>
        </div>

      }

      <!-- ─────────── Cobro: pantalla aparte ───────────
           Sube desde abajo y tapa todo. En el celular del mesero, tener que
           desplazarse media pantalla para llegar al teclado era el problema. -->
      @if (cobrando() && pedido()) {
        <div class="fixed inset-0 z-50 flex items-end justify-center bg-tinta/60 backdrop-blur-[2px] sm:items-center"
             (click)="cerrarCobro()">
          <div class="hoja max-h-[94dvh] w-full max-w-3xl overflow-y-auto !p-4 sm:!p-6" (click)="$event.stopPropagation()">
            <div class="hoja-asa"></div>
            <!-- El saldo va en el encabezado, no en una tarjeta aparte: es el dato
                 que importa y así se gana el alto de una fila. -->
            @if (aPreparacion() > 0) {
              <div role="alert" class="mb-3 rounded-2xl border border-peligro/40 bg-peligro/10 px-3 py-2 text-sm font-semibold text-peligro">
                Estás por cobrar {{ aPreparacion() }} {{ aPreparacion() === 1 ? 'producto que nunca salió' : 'productos que nunca salieron' }} a cocina.
              </div>
            }
            <div class="mb-3 flex items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="truncate text-xs font-bold uppercase tracking-wide text-naranja">
                  {{ mesaSeleccionada()?.nombre ?? etiquetaCanal(pedido()!.canal) }} · Pedido #{{ pedido()!.pedidoId }}
                </p>
                <h2 class="cifra mt-0.5 text-3xl leading-none">{{ pedido()!.saldoPendiente | currency:'PEN':'symbol':'1.2-2' }}</h2>
                @if (pedido()!.totalPagado > 0) {
                  <p class="mt-1 text-xs font-semibold text-exito">
                    Ya pagó {{ pedido()!.totalPagado | currency:'PEN':'symbol':'1.2-2' }} de {{ pedido()!.total | currency:'PEN':'symbol':'1.2-2' }}
                  </p>
                }
              </div>
              <button class="btn-icono shrink-0" (click)="cerrarCobro()" aria-label="Cerrar cobro"><vf-icono nombre="x" /></button>
            </div>
            <!-- Con ancho de tablet, medios e importes a la izquierda y el teclado
                 a la derecha: todo cabe de una, sin desplazar. -->
            <div class="grid gap-3 md:grid-cols-2 md:items-start">
              <!-- Izquierda: a quién se le cobra y con qué -->
              <div class="space-y-3">

                    @if (cobroIncierto(pedido()!.pedidoId)) {
                      <p class="rounded-xl border border-alerta/40 bg-alerta/10 p-3 text-sm font-medium text-alerta" role="alert">
                        No se confirmó la respuesta del último cobro. Reintenta el mismo pago para consultar el resultado sin duplicarlo; sus datos están bloqueados.
                      </p>
                    }

                    @if ((sesion.tienePermiso('DESCUENTO_APLICAR') && pedido()!.descuento === 0 && !pedido()!.pagos.length) || descuentoIncierto(pedido()!.pedidoId)) {
                      <button class="btn btn-secundario w-full border-alerta/50 text-alerta" [disabled]="ocupada() || cobroIncierto(pedido()!.pedidoId)" (click)="aplicarDescuento()">
                        <vf-icono nombre="etiqueta" [tam]="18" /> {{ descuentoIncierto(pedido()!.pedidoId) ? 'Conciliar descuento' : 'Aplicar descuento' }}
                      </button>
                    }

                    @if (pedido()!.puedeDividirPorLineas && pedido()!.descuento === 0) {
                      <button type="button" class="opcion justify-start gap-2 px-3 py-2 text-sm" [class.opcion-activa]="dividirPorLineas"
                              [disabled]="cobroIncierto(pedido()!.pedidoId)" (click)="alternarDivision()">
                        <vf-icono [nombre]="dividirPorLineas ? 'check' : 'usuarios'" [tam]="18" /> Dividir por productos
                      </button>
                    } @else if (!pedido()!.puedeDividirPorLineas) {
                      <p class="text-xs text-tenue">Este pedido tiene un abono general previo; sus siguientes pagos se registran contra el saldo.</p>
                    } @else {
                      <p class="text-xs text-tenue">Para conservar la imputación del descuento, cobra esta cuenta como total general.</p>
                    }

                    @if (dividirPorLineas && pedido()!.puedeDividirPorLineas) {
                      <div class="space-y-2 rounded-xl bg-superficie p-3">
                        <p class="text-xs font-semibold text-suave">Cuántas unidades de cada línea van en esta cuenta.</p>
                        @for (i of pedido()!.items; track i.pedidoItemId) {
                          @if (i.cantidad - i.cantidadPagada > 0) {
                            <div class="flex items-center justify-between gap-3 border-b border-borde py-2 last:border-0">
                              <div class="min-w-0">
                                <p class="truncate text-sm font-semibold">{{ i.nombre }}</p>
                                <p class="text-xs text-tenue">quedan {{ i.cantidad - i.cantidadPagada }} · {{ i.precioUnitario | currency:'PEN':'symbol':'1.2-2' }} c/u</p>
                              </div>
                              <div class="flex shrink-0 items-center gap-1">
                                <button type="button" class="btn-icono border border-borde" [disabled]="cobroIncierto(pedido()!.pedidoId) || cantidadCuenta(i.pedidoItemId) <= 0"
                                        (click)="ajustarCuenta(i, -1)" [attr.aria-label]="'Quitar una unidad de ' + i.nombre"><vf-icono nombre="baja" [tam]="20" /></button>
                                <span class="cifra w-9 text-center text-lg">{{ cantidadCuenta(i.pedidoItemId) }}</span>
                                <button type="button" class="btn-icono border border-borde" [disabled]="cobroIncierto(pedido()!.pedidoId) || cantidadCuenta(i.pedidoItemId) >= i.cantidad - i.cantidadPagada"
                                        (click)="ajustarCuenta(i, 1)" [attr.aria-label]="'Agregar una unidad de ' + i.nombre"><vf-icono nombre="sube" [tam]="20" /></button>
                              </div>
                            </div>
                          }
                        }
                      </div>
                      <label class="block">
                        <span class="etiqueta">Nombre o referencia de la cuenta</span>
                        <input class="campo" maxlength="80" [(ngModel)]="referenciaCuenta" [disabled]="cobroIncierto(pedido()!.pedidoId)" placeholder="Ej. Mesa 4 · Ana" />
                      </label>
                    }

                    <!-- Medios de pago como mosaicos grandes -->
                    <div>
                      <p class="etiqueta">Medio de pago</p>
                      <div class="grid grid-cols-5 gap-1.5">
                        @for (mp of MEDIOS; track mp.codigo) {
                          <button type="button" class="medio-pago" [class.medio-pago-activo]="medio === mp.codigo"
                                  [disabled]="cobroIncierto(pedido()!.pedidoId)" (click)="elegirMedio(mp.codigo)">
                            @if (mp.logo) {
                              <span class="flex h-8 w-full items-center justify-center rounded-lg bg-white px-1.5">
                                <img [src]="mp.logo" [alt]="mp.nombre" class="max-h-6 w-auto object-contain" />
                              </span>
                            } @else {
                              <vf-icono [nombre]="mp.icono" [tam]="26" />
                            }
                            <span class="leading-none">{{ mp.nombre }}</span>
                          </button>
                        }
                      </div>
                    </div>

                    <!-- Importe y, si es efectivo, lo recibido -->
                    <div class="grid gap-2" [class.grid-cols-2]="medio === 'EFECTIVO'">
                      <button type="button" class="rounded-xl border-2 px-3 py-2 text-left transition-colors"
                              [class.border-marino]="campoMonto() === 'aplicar'" [class.border-borde]="campoMonto() !== 'aplicar'"
                              [disabled]="dividirPorLineas || cobroIncierto(pedido()!.pedidoId)" (click)="campoMonto.set('aplicar')">
                        <span class="text-[10px] font-bold uppercase tracking-wide text-tenue">{{ dividirPorLineas ? 'Esta cuenta' : 'A cobrar' }}</span>
                        <span class="cifra block text-xl leading-tight">{{ importeACobrar() | currency:'PEN':'symbol':'1.2-2' }}</span>
                      </button>
                      @if (medio === 'EFECTIVO') {
                        <button type="button" class="rounded-xl border-2 px-3 py-2 text-left transition-colors"
                                [class.border-marino]="campoMonto() === 'recibido'" [class.border-borde]="campoMonto() !== 'recibido'"
                                [disabled]="cobroIncierto(pedido()!.pedidoId)" (click)="campoMonto.set('recibido')">
                          <span class="text-[10px] font-bold uppercase tracking-wide text-tenue">Recibido</span>
                          <span class="cifra block text-xl leading-tight">{{ (recibido ?? importeACobrar()) | currency:'PEN':'symbol':'1.2-2' }}</span>
                        </button>
                      }
                    </div>
              </div>

              <!-- Derecha: cuánto, el teclado y el botón -->
              <div class="space-y-3">
                    @if (medio === 'EFECTIVO') {
                      <div class="grid grid-cols-5 gap-1.5">
                        <button type="button" class="btn btn-sm btn-secundario !px-1" [disabled]="cobroIncierto(pedido()!.pedidoId)" (click)="fijarMonto('recibido', importeACobrar())">Exacto</button>
                        @for (b of BILLETES; track b) {
                          <button type="button" class="btn btn-sm btn-secundario !px-1" [disabled]="cobroIncierto(pedido()!.pedidoId)" (click)="fijarMonto('recibido', b)">{{ b }}</button>
                        }
                      </div>
                      <div class="flex items-center justify-between rounded-xl bg-superficie px-3 py-1.5">
                        <span class="text-sm font-bold">Vuelto</span>
                        <span class="cifra text-xl" [class.text-naranja]="vueltoPrevisto() > 0">{{ vueltoPrevisto() | currency:'PEN':'symbol':'1.2-2' }}</span>
                      </div>
                    }

                    <!-- El teclado solo cuando hace falta: el cobro normal es exacto
                         o con un billete redondo, y asi en un celular entra todo sin
                         desplazar. En tablet hay sitio y se queda siempre abierto. -->
                    @if (!dividirPorLineas || medio === 'EFECTIVO') {
                      <button type="button" class="opcion w-full justify-center gap-2 py-2 text-sm md:hidden"
                              [class.opcion-activa]="tecladoAbierto()" (click)="tecladoAbierto.set(!tecladoAbierto())">
                        <vf-icono [nombre]="tecladoAbierto() ? 'abajo' : 'arriba'" [tam]="18" />
                        {{ tecladoAbierto() ? 'Ocultar teclado' : 'Otro monto' }}
                      </button>
                      <div class="grid-cols-3 gap-2 md:grid" [class.grid]="tecladoAbierto()" [class.hidden]="!tecladoAbierto()">
                        @for (t of TECLAS; track t) {
                          <button type="button" class="tecla" [disabled]="cobroIncierto(pedido()!.pedidoId)" (click)="teclear(t)">{{ t }}</button>
                        }
                        <button type="button" class="tecla-accion" [disabled]="cobroIncierto(pedido()!.pedidoId)" (click)="teclear('borrar')" aria-label="Borrar un dígito">
                          <vf-icono nombre="izquierda" [tam]="22" />
                        </button>
                        <button type="button" class="tecla" [disabled]="cobroIncierto(pedido()!.pedidoId)" (click)="teclear('0')">0</button>
                        <button type="button" class="tecla-accion" [disabled]="cobroIncierto(pedido()!.pedidoId)" (click)="teclear('limpiar')" aria-label="Limpiar el importe">C</button>
                      </div>
                    }

                    <!-- Caja del turno -->
                    @if (cajasAbiertas().length > 1) {
                      <div>
                        <p class="etiqueta">Caja del turno</p>
                        <div class="grid grid-cols-2 gap-2">
                          @for (c of cajasAbiertas(); track c.sesionCajaId) {
                            <button type="button" class="opcion" [class.opcion-activa]="sesionCajaId === c.sesionCajaId"
                                    [disabled]="cobroIncierto(pedido()!.pedidoId)" (click)="sesionCajaId = c.sesionCajaId">{{ c.caja }}</button>
                          }
                        </div>
                      </div>
                    }

                    <button class="btn-grande-exito w-full" [disabled]="botonCobroBloqueado(pedido()!.pedidoId, pedido()!.saldoPendiente)" (click)="cobrar()">
                      <vf-icono nombre="billete" [tam]="22" />
                      {{ cobroIncierto(pedido()!.pedidoId) ? 'Reintentar mismo pago' : ('Cobrar ' + (importeACobrar() | currency:'PEN':'symbol':'1.2-2')) }}
                    </button>

                    @if (!cajasAbiertas().length && !cobroIncierto(pedido()!.pedidoId)) {
                      <p class="rounded-xl bg-peligro/10 p-3 text-sm font-semibold text-peligro">No hay caja abierta en esta sucursal. Abre un turno para cobrar.</p>
                    }
                    @if (pedido()!.pagos.length) {
                      <div class="border-t border-borde pt-2 text-xs text-suave">
                        @for (pago of pedido()!.pagos; track pago.pagoId) {
                          <div class="py-1">
                            <p class="font-semibold">{{ pago.medio }} · {{ pago.monto | currency:'PEN':'symbol':'1.2-2' }}@if (pago.referencia) { · {{ pago.referencia }} }@if (pago.vuelto) { · vuelto {{ pago.vuelto | currency:'PEN':'symbol':'1.2-2' }} }</p>
                            @for (a of pago.aplicaciones ?? []; track a.pedidoItemId) { <p class="pl-3 text-tenue">{{ a.cantidad }} × {{ a.producto }} · {{ a.monto | currency:'PEN':'symbol':'1.2-2' }}</p> }
                          </div>
                        }
                      </div>
                    }
              </div>
            </div>
          </div>
        </div>
      }

      @if (vista() === 'cocina') {
        <!-- ─────────── Cocina (KDS) ─────────── -->
        <div class="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-borde bg-superficie p-3">
          <p class="text-sm text-suave">La cola conserva cada comanda y su estado de impresión. Se actualiza sola cada 5 segundos mientras esta pantalla está visible.</p>
          <div class="flex items-center gap-2">
            <div class="flex gap-1 rounded-xl border border-borde bg-elevada p-1">
              <button type="button" class="min-h-toque rounded-lg px-3 text-sm font-bold" [class.bg-marino]="formatoImpresion === '80MM'" [class.text-white]="formatoImpresion === '80MM'" (click)="formatoImpresion = '80MM'">80 mm</button>
              <button type="button" class="min-h-toque rounded-lg px-3 text-sm font-bold" [class.bg-marino]="formatoImpresion === 'A4'" [class.text-white]="formatoImpresion === 'A4'" (click)="formatoImpresion = 'A4'">A4</button>
            </div>
            <button class="btn btn-secundario" (click)="cargarCocina()"><vf-icono nombre="refrescar" [tam]="18" /> Actualizar</button>
          </div>
        </div>

        <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          @for (c of comandas(); track c.comandaId) {
            <article class="tarjeta flex flex-col p-4"
                     [class.border-alerta]="c.estado === 'EN_PREPARACION'" [class.border-exito]="c.estado === 'LISTA'">
              <div class="flex items-start justify-between gap-2">
                <div>
                  <p class="text-xs font-bold uppercase tracking-wide text-naranja">{{ c.area }} · Pedido #{{ c.pedidoId }}</p>
                  <h2 class="mt-0.5 text-xl font-extrabold">{{ c.mesa || etiquetaCanal(c.canal) }}</h2>
                </div>
                <span class="chip" [class.chip-alerta]="c.estado !== 'LISTA'" [class.chip-exito]="c.estado === 'LISTA'">{{ c.estado }}</span>
              </div>

              <div class="mt-3 flex-1 divide-y divide-borde">
                @for (i of c.items; track i.comandaItemId ?? i.pedidoItemId) {
                  <div class="py-2.5">
                    <span class="text-[17px] font-bold">{{ i.cantidad }} × {{ i.nombre }}</span>
                    <!-- Cocina necesita saberlo antes de emplatar: va en táper o en bolsa. -->
                    @if (i.paraLlevar) {
                      <span class="ml-2 align-middle chip-naranja">Para llevar@if (i.empaque) { · {{ i.empaque === 'TAPER' ? 'táper' : 'bolsa' }} }</span>
                    }
                    @if (i.resumenSeleccion) { <p class="text-sm text-suave">{{ i.resumenSeleccion }}</p> }
                    @if (i.nota) { <p class="mt-0.5 text-sm font-semibold text-naranja">{{ i.nota }}</p> }
                  </div>
                }
              </div>

              @if (c.impresion) {
                <div class="mt-3 rounded-xl border border-borde p-3 text-xs">
                  <div class="flex items-center justify-between gap-2">
                    <p class="font-bold">Impresión: {{ c.impresion.estado }} · intentos {{ c.impresion.intentos }}</p>
                    <button class="btn btn-sm btn-secundario" (click)="cargarHistorialImpresion(c.impresion!)">Historial</button>
                  </div>
                  @if (c.impresion.ultimoError) { <p class="mt-1 font-medium text-peligro">{{ c.impresion.ultimoError }}</p> }
                  @for (evento of historialImpresion()[c.impresion.trabajoImpresionId] ?? []; track evento.registradoEn + evento.tipo) {
                    <p class="mt-1 text-tenue">{{ evento.tipo }} · usuario #{{ evento.registradoPor ?? '—' }} · {{ evento.registradoEn | date:'short' }}@if (evento.detalle) { · {{ evento.detalle }} }</p>
                  }
                  @if (c.impresion.estado === 'PENDIENTE' || c.impresion.estado === 'ERROR') {
                    <button class="btn mt-2 w-full bg-marino text-white" [disabled]="ocupada()" (click)="solicitarImpresion(c.impresion)">
                      {{ solicitudImpresionIncierta(c.impresion.trabajoImpresionId) ? 'Reintentar solicitud guardada' : c.impresion.estado === 'ERROR' ? 'Reintentar impresión' : 'Imprimir comanda' }} · {{ formatoImpresion }}
                    </button>
                  }
                  @if (c.impresion.estado === 'SOLICITADA') {
                    @if (resultadoImpresionIncierto(c.impresion.trabajoImpresionId)) {
                      <div class="mt-2 space-y-2 rounded-xl border border-alerta/40 bg-alerta/10 p-3 text-sm text-alerta">
                        <p>No se confirmó el resultado. Reintenta con la misma clave para conciliarlo.</p>
                        <button class="btn btn-sm w-full bg-alerta text-white" [disabled]="ocupada()" (click)="reintentarResultadoImpresion(c.impresion)">Reintentar resultado guardado</button>
                      </div>
                    } @else {
                      <div class="mt-2 grid grid-cols-2 gap-2">
                        <button class="btn btn-sm bg-exito text-white" [disabled]="ocupada()" (click)="registrarResultadoImpresion(c.impresion, true)">Sí imprimió</button>
                        <button class="btn btn-sm border border-peligro/40 text-peligro" [disabled]="ocupada()" (click)="registrarResultadoImpresion(c.impresion, false)">Falló</button>
                      </div>
                    }
                  }
                  @if (c.impresion.estado === 'IMPRESA') { <p class="mt-2 font-bold text-exito">Impresión confirmada por el operador.</p> }
                </div>
              }

              @if (hayLineasActivas(c)) {
                <div class="mt-4 flex gap-2">
                  @if (c.estado === 'PENDIENTE') {
                    <button class="btn-grande-borde flex-1" [disabled]="ocupada()" (click)="estadoComanda(c, 'EN_PREPARACION')">Iniciar</button>
                  }
                  @if (c.estado !== 'LISTA') {
                    <button class="btn-grande-marino flex-1" [disabled]="ocupada()" (click)="estadoComanda(c, 'LISTA')">Lista</button>
                  } @else {
                    <button class="btn-grande-exito flex-1" [disabled]="ocupada()" (click)="estadoComanda(c, 'ENTREGADA')">Entregada</button>
                  }
                </div>
              } @else {
                <p class="mt-4 rounded-xl bg-peligro/10 p-3 text-sm font-semibold text-peligro">Líneas anuladas con motivo; conserva este aviso en cocina.</p>
              }
            </article>
          }
          @if (!comandas().length) {
            <div class="col-span-full flex flex-col items-center gap-3 rounded-2xl border border-dashed border-borde p-10 text-center">
              <vf-icono nombre="chef" [tam]="40" class="text-borde" />
              <p class="text-sm text-tenue">No hay comandas pendientes.</p>
            </div>
          }
        </section>
      }
    </section>`
})
export class OperacionPagina {
  private http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);
  readonly sesion = inject(SesionService);
  readonly mesas = signal<Mesa[]>([]); readonly pedido = signal<Pedido | null>(null); readonly mesaSeleccionada = signal<Mesa | null>(null);
  readonly carta = signal<Categoria[]>([]); readonly categoriaActiva = signal(0); readonly comandas = signal<Comanda[]>([]); readonly cajasAbiertas = signal<CajaCobro[]>([]);
  readonly cargando = signal(false); readonly ocupada = signal(false); readonly error = signal(''); readonly mensaje = signal(''); readonly vista = signal<'salon'|'cocina'>(this.sesion.tienePermiso('SALON_VER') ? 'salon' : 'cocina');
  readonly historialImpresion = signal<Partial<Record<number, PrintEvent[]>>>({});
  private cocinaActualizando = false;
  private kitchenPollHandle: ReturnType<typeof setInterval> | null = null;
  readonly productoConfigurando = signal<Producto | null>(null); readonly varianteElegida = signal<number | null>(null);
  readonly modificadoresElegidos = signal<Record<number, number[]>>({}); readonly combosElegidos = signal<Record<number, (number | null)[]>>({});
  readonly variantesCombo = signal<Record<string, number | null>>({}); readonly modificadoresCombo = signal<Record<string, Record<number, number[]>>>({});
  readonly notaProducto = signal(''); readonly errorConfiguracion = signal(''); readonly reintentoPendiente = signal(false);
  private readonly intentosPedido = new IntentosIdempotentes<PedidoNuevo>(this.claveAlmacenamiento('pedido'));
  private readonly intentosItem = new IntentosIdempotentes<Record<string, unknown>>(this.claveAlmacenamiento('item'));
  private readonly intentosSolicitudImpresion = new IntentosIdempotentes<{ claveIdempotencia: string }>(this.claveAlmacenamiento('impresion-solicitud'));
  private readonly intentosResultadoImpresion = new IntentosIdempotentes<ResultadoImpresionPendiente>(this.claveAlmacenamiento('impresion-resultado'));
  private readonly intentosCobro = new IntentosIdempotentes<Record<string, unknown>>(this.claveAlmacenamiento('cobro'));
  private readonly intentosDescuento = new IntentosIdempotentes<Record<string, unknown>>(this.claveAlmacenamiento('descuento'));
  private readonly intentosDevolucion = new IntentosIdempotentes<Record<string, unknown>>(this.claveAlmacenamiento('devolucion'));
  private readonly intentosAnulacion = new IntentosIdempotentes<Record<string, unknown>>(this.claveAlmacenamiento('anulacion'));
  medio = 'EFECTIVO'; recibido: number | null = null; montoAplicar: number | null = null; sesionCajaId = 0; formatoImpresion: '80MM'|'A4' = '80MM';
  dividirPorLineas = false; cantidadesCuenta: Record<number, number> = {}; referenciaCuenta = '';
  cantidadCuenta(id: number): number { return this.cantidadesCuenta[id] ?? 0; }

  // ─────────────────────────────────────────────────────────────────────────
  // Capa táctil del cobro. Nada de esto cambia cómo se cobra: solo cómo se
  // escribe el importe con el dedo, sin teclado del sistema.
  // ─────────────────────────────────────────────────────────────────────────
  /**
   * Logo de marca donde la marca importa —el cliente reconoce el morado de Yape
   * y el celeste de Plin de un vistazo— e ícono del sistema donde no la hay.
   * Los logos van sobre una pastilla blanca, como en la puerta del local.
   */
  readonly MEDIOS = [
    { codigo: 'EFECTIVO', nombre: 'Efectivo', icono: 'billete', logo: null },
    { codigo: 'YAPE', nombre: 'Yape', icono: 'telefono', logo: 'pago-yape.png' },
    { codigo: 'PLIN', nombre: 'Plin', icono: 'telefono', logo: 'pago-plin.png' },
    { codigo: 'TARJETA', nombre: 'Tarjeta', icono: 'tarjeta', logo: 'pago-tarjeta.png' },
    { codigo: 'TRANSFERENCIA', nombre: 'Transfer.', icono: 'empresa', logo: null },
  ] as const;
  readonly TECLAS = ['1','2','3','4','5','6','7','8','9','.'] as const;
  readonly BILLETES = [10, 20, 50, 100] as const;

  /**
   * Mostrador y Para llevar los atiende quien lleva la caja. El mesero trabaja
   * mesas: lo que se lleva o sale a reparto lo despacha otro, y no tiene por
   * qué ensuciarle la pantalla.
   */
  readonly atiendeMostrador = computed(() =>
    this.sesion.tienePermiso('PEDIDO_TOMAR') && this.sesion.tienePermiso('CAJA_ABRIR_CERRAR'));

  /** Destino y empaque del plato que se está agregando. */
  readonly itemParaLlevar = signal(false);
  readonly itemEmpaque = signal<'TAPER' | 'BOLSA'>('TAPER');
  /** Lo que el negocio cobra por empacar. Se lee una vez al abrir la pantalla. */
  readonly empaque = signal<EmpaqueConfig>({ taperPrecio: 1, bolsaPrecio: 0 });

  /** En el celular el teclado se abre a pedido; en tablet siempre esta a la vista. */
  readonly tecladoAbierto = signal(false);

  /** El cobro ocupa su propia pantalla flotante. */
  readonly cobrando = signal(false);

  /**
   * Se puede seguir agregando mientras la cuenta no esté cobrada ni anulada: lo
   * que la cierra es el cobro, no el primer envío a cocina.
   */
  readonly puedeAgregar = computed(() => {
    const p = this.pedido();
    return !!p && p.estado !== 'PAGADO' && p.estado !== 'ANULADO' && this.sesion.tienePermiso('PEDIDO_TOMAR');
  });

  /** Líneas que todavía no salieron: son las que viajan en el próximo envío. */
  readonly sinEnviar = computed(() =>
    (this.pedido()?.items ?? []).filter(i => !i.enviado && i.estado !== 'ANULADO').length);

  /** De esas, las que de verdad va a preparar alguien. El táper y la bolsa
      viajan en el mismo envío, pero nadie los cocina: contarlos haría que el
      botón prometiera a cocina un plato que no existe. */
  readonly aPreparacion = computed(() =>
    (this.pedido()?.items ?? []).filter(i => !i.enviado && i.estado !== 'ANULADO' && i.areaId !== null).length);

  /** Lo que cocina dejó listo y todavía está en el pase, esperando que alguien
      lo lleve. El táper no cuenta: está LISTO desde que se envió y nadie lo
      "sirve", así que sumarlo pondría un botón de entregar en mesas vacías. */
  readonly porEntregar = computed(() =>
    (this.pedido()?.items ?? []).filter(i => i.estado === 'LISTO' && i.areaId !== null).length);

  puedeEntregar(i: Item): boolean {
    return i.estado === 'LISTO' && i.areaId !== null && this.sesion.tienePermiso('PEDIDO_ENTREGAR');
  }

  /** Qué importe está editando el teclado. */
  readonly campoMonto = signal<'aplicar' | 'recibido'>('aplicar');
  /** Texto en curso de cada importe: un número no distingue "10" de "10.". */
  private readonly textoMonto = signal<{ aplicar: string; recibido: string }>({ aplicar: '', recibido: '' });

  elegirMedio(codigo: string): void {
    this.medio = codigo;
    if (codigo === 'EFECTIVO') { this.campoMonto.set('recibido'); return; }
    // Los medios digitales deben coincidir exacto con lo aplicado: no hay vuelto.
    this.recibido = null;
    this.textoMonto.update(t => ({ ...t, recibido: '' }));
    this.campoMonto.set('aplicar');
  }

  teclear(tecla: string): void {
    const campo = this.campoMonto();
    let texto = this.textoMonto()[campo];
    if (tecla === 'borrar') texto = texto.slice(0, -1);
    else if (tecla === 'limpiar') texto = '';
    else if (tecla === '.') { if (texto.includes('.')) return; texto = (texto || '0') + '.'; }
    else {
      const decimales = texto.split('.')[1];
      if (decimales !== undefined && decimales.length >= 2) return;   // céntimos, no milésimas
      if (texto.replace('.', '').length >= 7) return;                 // tope razonable
      texto = texto === '0' ? tecla : texto + tecla;
    }
    this.textoMonto.update(t => ({ ...t, [campo]: texto }));
    const valor = texto === '' || texto === '.' ? null : Number(texto);
    if (campo === 'aplicar') this.montoAplicar = valor; else this.recibido = valor;
  }

  fijarMonto(campo: 'aplicar' | 'recibido', valor: number): void {
    this.textoMonto.update(t => ({ ...t, [campo]: valor.toFixed(2) }));
    if (campo === 'aplicar') this.montoAplicar = valor; else this.recibido = valor;
    this.campoMonto.set(campo);
  }

  /** Deja el teclado y los importes como al abrir el cobro. */
  private limpiarTeclado(): void {
    this.textoMonto.set({ aplicar: '', recibido: '' });
    this.campoMonto.set(this.medio === 'EFECTIVO' ? 'recibido' : 'aplicar');
  }

  importeACobrar(): number {
    const p = this.pedido(); if (!p) return 0;
    return this.dividirPorLineas ? this.montoLineasSeleccionadas() : (this.montoAplicar ?? p.saldoPendiente);
  }

  vueltoPrevisto(): number {
    if (this.medio !== 'EFECTIVO') return 0;
    const recibido = this.recibido ?? this.importeACobrar();
    return Math.max(0, Math.round((recibido - this.importeACobrar()) * 100) / 100);
  }

  alternarDivision(): void {
    this.dividirPorLineas = !this.dividirPorLineas;
    this.montoAplicar = null;
    this.limpiarTeclado();
  }

  /** +1 / −1 unidad de una línea en la cuenta que se está cobrando. */
  ajustarCuenta(item: Item, delta: number): void {
    const maximo = item.cantidad - item.cantidadPagada;
    const actual = this.cantidadesCuenta[item.pedidoItemId] ?? 0;
    this.cantidadesCuenta = { ...this.cantidadesCuenta, [item.pedidoItemId]: Math.min(maximo, Math.max(0, actual + delta)) };
  }

  /** Color de la mesa según en qué va el servicio. */
  claseMesa(m: Mesa): string {
    if (!m.pedidoId) return 'mesa-libre';
    if (m.sinEnviar > 0) return 'mesa-por-mandar';
    if (m.estadoPedido === 'EN_PREPARACION') return 'mesa-cocina';
    if (m.estadoPedido === 'LISTO') return 'mesa-lista';
    return 'mesa-abierta';
  }
  etiquetaEstadoMesa(m: Mesa): string {
    if (!m.pedidoId) return 'Libre';
    // Lo que falta mandar manda sobre lo demás: una mesa "lista para servir" con
    // un plato sin enviar es la mesa que va a reclamar.
    if (m.sinEnviar > 0) return m.sinEnviar === 1 ? '1 sin enviar' : `${m.sinEnviar} sin enviar`;
    return this.etiquetaEstadoPedido(m.estadoPedido ?? '');
  }
  etiquetaEstadoPedido(estado: string): string {
    return ({ ABIERTO: 'Atendiendo', EN_PREPARACION: 'En cocina', LISTO: 'Lista para servir',
              PAGADO: 'Pagado', ANULADO: 'Anulado' } as Record<string, string>)[estado] ?? estado;
  }
  private claveAlmacenamiento(operacion: string): string {
    const usuario = this.sesion.usuario();
    return `vf_${operacion}_pendientes:${usuario?.tenantId ?? 0}:${this.sesion.sucursalActivaId() ?? 0}:${usuario?.usuarioId ?? 0}`;
  }
  cobroIncierto(pedidoId: number): boolean { return this.intentosCobro.esIncierto(pedidoId); }
  descuentoIncierto(pedidoId: number): boolean { return this.intentosDescuento.esIncierto(pedidoId); }
  devolucionIncierta(pagoId: number): boolean { return this.intentosDevolucion.esIncierto(pagoId); }
  pedidoCreacionIncierta(): boolean { return this.intentosPedido.esIncierto(1); }
  solicitudImpresionIncierta(trabajoId: number): boolean { return this.intentosSolicitudImpresion.esIncierto(trabajoId); }
  resultadoImpresionIncierto(trabajoId: number): boolean { return this.intentosResultadoImpresion.esIncierto(trabajoId); }
  etiquetaCanal(canal: string | null | undefined): string {
    return canal === 'SALON' ? 'Salón' : canal === 'MOSTRADOR' ? 'Mostrador' : canal === 'PARA_LLEVAR' ? 'Para llevar' : 'Pedido';
  }
  pedidoTieneDevolucionIncierta(pagos: Pago[]): boolean { return pagos.some(pago => this.devolucionIncierta(pago.pagoId)); }
  anulacionIncierta(itemId: number): boolean { return this.intentosAnulacion.esIncierto(itemId); }
  itemIncierto(pedidoId: number): boolean { return this.intentosItem.esIncierto(pedidoId); }
  private ajusteFinancieroInciertoEnPedido(pedidoId: number): boolean {
    const pedido = this.pedido();
    return pedido?.pedidoId === pedidoId && (this.descuentoIncierto(pedidoId)
      || pedido.items.some(item => this.anulacionIncierta(item.pedidoItemId))
      || pedido.pagos.some(pago => this.devolucionIncierta(pago.pagoId)));
  }
  ajusteInciertoEnPedido(pedidoId: number): boolean {
    return this.itemIncierto(pedidoId) || this.ajusteFinancieroInciertoEnPedido(pedidoId);
  }
  botonCobroBloqueado(pedidoId: number, saldo: number): boolean {
    if (this.ocupada()) return true;
    if (this.cobroIncierto(pedidoId)) return false;
    if (this.ajusteInciertoEnPedido(pedidoId)) return true;
    return saldo <= 0 || !this.sesionCajaId
      || (this.dividirPorLineas && (!this.montoLineasSeleccionadas() || !this.referenciaCuenta.trim()));
  }
  readonly sucursal = () => this.sesion.sucursales().find(s => s.sucursalId === this.sesion.sucursalActivaId())?.nombre ?? 'Sucursal activa';
  readonly productosCategoria = () => this.carta().find(c => c.categoriaId === this.categoriaActiva())?.productos ?? [];

  constructor() {
    // La ruta /cocina abre esta misma pantalla directo en la vista de cocina.
    if (inject(ActivatedRoute).snapshot.data['vista'] === 'cocina' && this.sesion.tieneAlguno('COCINA_VER')) {
      this.vista.set('cocina');
    }
    if (this.vista() === 'salon' && this.sesion.tienePermiso('SALON_VER')) {
      void this.cargarMesas(); void this.cargarCarta(); void this.cargarEmpaque();
      // 'Admin solo admin' desde el plan Profesional: si no cobra, no se le piden las cajas.
      if (this.sesion.tienePermiso('COBRAR')) void this.cargarCajas();
    }
    else void this.cargarCocina();
    if (this.sesion.tieneAlguno('COCINA_VER')) {
      this.kitchenPollHandle = setInterval(() => {
        if (this.vista() === 'cocina' && !this.ocupada() && !document.hidden) void this.cargarCocina(true);
      }, 5000);
      this.destroyRef.onDestroy(() => {
        if (this.kitchenPollHandle !== null) clearInterval(this.kitchenPollHandle);
        this.kitchenPollHandle = null;
      });
    }
  }
  private async request<T>(method: 'get'|'post', path: string, body?: unknown): Promise<T> {
    return firstValueFrom(method === 'get' ? this.http.get<T>(`${environment.api}${path}`) : this.http.post<T>(`${environment.api}${path}`, body ?? {}));
  }
  async cargarMesas() { try { this.cargando.set(true); this.mesas.set(await this.request<Mesa[]>('get','/operacion/mesas')); } catch(e) { this.mostrarError(e); } finally { this.cargando.set(false); } }
  /** Si no se puede leer, quedan los precios por defecto: táper S/1, bolsa gratis. */
  async cargarEmpaque() {
    try { this.empaque.set(await this.request<EmpaqueConfig>('get','/operacion/empaque')); } catch { /* valores por defecto */ }
  }
  async cargarCarta() { try { const m = await this.request<{ categorias: Categoria[] }>('get','/carta/menu'); this.carta.set(m.categorias); this.categoriaActiva.set(m.categorias[0]?.categoriaId ?? 0); } catch(e) { this.mostrarError(e); } }
  async cargarCajas() { try { const abiertas=await this.request<CajaCobro[]>('get','/caja/abiertas-cobro'); this.cajasAbiertas.set(abiertas); if (!abiertas.some(c=>c.sesionCajaId===this.sesionCajaId)) this.sesionCajaId=abiertas[0]?.sesionCajaId ?? 0; } catch(e) { this.mostrarError(e); } }
  async seleccionarMesa(m: Mesa) {
    this.error.set(''); this.mensaje.set(''); this.dividirPorLineas = false; this.cantidadesCuenta = {}; this.referenciaCuenta = ''; this.mesaSeleccionada.set(m);
    if (m.pedidoId) {
      try {
        const pedido = await this.request<Pedido>('get', `/operacion/pedidos/${m.pedidoId}`);
        const pendiente = this.intentosPedido.leer(1);
        if (this.pedidoCreacionIncierta() && pendiente?.mesaId === m.mesaId && pendiente.canal === 'SALON') this.intentosPedido.completar(1);
        this.pedido.set(pedido);
      } catch (e) { this.mostrarError(e); }
      return;
    }
    await this.crearPedidoConIntento(m.mesaId, 'SALON');
  }
  async crearPedidoRapido(canal: 'MOSTRADOR' | 'PARA_LLEVAR') {
    if (this.pedido()) { this.error.set('Cierra el pedido actual antes de iniciar otra venta.'); return; }
    await this.crearPedidoConIntento(null, canal);
  }
  async reintentarPedidoPendiente() {
    const payload = this.intentosPedido.leer(1);
    if (!payload || !this.pedidoCreacionIncierta()) return;
    await this.enviarPedidoNuevo(payload);
  }
  private async crearPedidoConIntento(mesaId: number | null, canal: PedidoNuevo['canal']) {
    if (this.ocupada()) return;
    if (this.pedidoCreacionIncierta()) {
      this.error.set('Conciliar primero la creación de pedido pendiente antes de iniciar otra venta.'); return;
    }
    const payload = this.intentosPedido.obtener(1, () => ({ mesaId, canal, nota: null, claveIdempotencia: crypto.randomUUID() }));
    await this.enviarPedidoNuevo(payload);
  }
  private async enviarPedidoNuevo(payload: PedidoNuevo) {
    this.ocupada.set(true); this.error.set(''); this.mensaje.set('');
    try {
      const pedido = await this.request<Pedido>('post', '/operacion/pedidos', payload);
      this.intentosPedido.completar(1); this.pedido.set(pedido);
      this.mesaSeleccionada.set(payload.mesaId == null ? null : this.mesas().find(m => m.mesaId === payload.mesaId) ?? null);
      this.mensaje.set(`Pedido ${this.etiquetaCanal(pedido.canal).toLowerCase()} iniciado.`);
      await this.cargarMesas();
    } catch (e) {
      const status = (e as { status?: number }).status ?? 0;
      if (respuestaOperacionIncierta(status)) {
        this.intentosPedido.marcarIncierto(1);
        this.error.set('No se confirmó la respuesta. Conciliar conserva el mismo canal, mesa y clave para no duplicar la venta.');
        if (payload.canal === 'SALON') await this.cargarMesas();
      } else {
        this.intentosPedido.completar(1); this.mostrarError(e);
      }
    } finally { this.ocupada.set(false); }
  }
  async agregarMesa() { const n = prompt('Nombre de la mesa (ej. Mesa 8)'); if (!n?.trim()) return; try { await this.request<Mesa>('post','/operacion/mesas',{nombre:n.trim(),capacidad:4}); await this.cargarMesas(); } catch(e) { this.mostrarError(e); } }
  configurarProducto(p: Producto) {
    if (this.pedido() && this.itemIncierto(this.pedido()!.pedidoId)) return;
    this.productoConfigurando.set(p); this.varianteElegida.set(null); this.modificadoresElegidos.set({}); this.combosElegidos.set({});
    this.variantesCombo.set({}); this.modificadoresCombo.set({}); this.notaProducto.set(''); this.errorConfiguracion.set(''); this.reintentoPendiente.set(false);
    // Lo normal es comer en la mesa: ese es el valor con el que abre.
    this.itemParaLlevar.set(false); this.itemEmpaque.set('TAPER');
  }

  /** En la mesa o para llevar. Al volver a la mesa, el empaque deja de aplicar. */
  fijarDestino(paraLlevar: boolean): void {
    this.itemParaLlevar.set(paraLlevar);
    if (!paraLlevar) this.itemEmpaque.set('TAPER');
  }
  cancelarConfiguracion() {
    if (this.reintentoPendiente()) return;
    this.productoConfigurando.set(null); this.errorConfiguracion.set(''); this.notaProducto.set('');
  }
  comboSlots(g: ComboGrupo): number[] { return Array.from({ length: g.cantidad }, (_, i) => i); }
  comboElegido(grupoId: number, slot: number): number { return this.combosElegidos()[grupoId]?.[slot] ?? 0; }
  comboOpcionRepetida(grupoId: number, slot: number, productoId: number): boolean {
    return (this.combosElegidos()[grupoId] ?? []).some((seleccion, indice) => indice !== slot && seleccion === productoId);
  }
  comboOpcionElegida(g: ComboGrupo, slot: number): ComboOpcion | undefined {
    const id = this.comboElegido(g.comboGrupoId, slot);
    return g.opciones.find(o => o.productoId === id);
  }
  elegirCombo(g: ComboGrupo, slot: number, productoId: number) {
    const grupos = { ...this.combosElegidos() }; const slots = [...(grupos[g.comboGrupoId] ?? Array(g.cantidad).fill(null))];
    slots[slot] = productoId > 0 ? productoId : null; grupos[g.comboGrupoId] = slots; this.combosElegidos.set(grupos);
    const clave = `${g.comboGrupoId}:${slot}`; const vars = { ...this.variantesCombo() }; const mods = { ...this.modificadoresCombo() };
    delete vars[clave]; delete mods[clave]; this.variantesCombo.set(vars); this.modificadoresCombo.set(mods);
  }
  comboVariante(grupoId: number, slot: number): number { return this.variantesCombo()[`${grupoId}:${slot}`] ?? 0; }
  elegirComboVariante(grupoId: number, slot: number, varianteId: number) {
    this.variantesCombo.update(x => ({ ...x, [`${grupoId}:${slot}`]: varianteId > 0 ? varianteId : null }));
  }
  modificadorElegido(grupoId: number, opcionId: number): boolean { return (this.modificadoresElegidos()[grupoId] ?? []).includes(opcionId); }
  alternarModificador(grupoId: number, opcionId: number) {
    const actual = this.modificadoresElegidos()[grupoId] ?? [];
    this.modificadoresElegidos.update(x => ({ ...x, [grupoId]: actual.includes(opcionId) ? actual.filter(id => id !== opcionId) : [...actual, opcionId] }));
  }
  comboModificadorElegido(comboGrupoId: number, slot: number, grupoId: number, opcionId: number): boolean {
    return (this.modificadoresCombo()[`${comboGrupoId}:${slot}`]?.[grupoId] ?? []).includes(opcionId);
  }
  alternarComboModificador(comboGrupoId: number, slot: number, grupoId: number, opcionId: number) {
    const clave = `${comboGrupoId}:${slot}`; const grupos = this.modificadoresCombo()[clave] ?? {}; const actual = grupos[grupoId] ?? [];
    this.modificadoresCombo.update(x => ({ ...x, [clave]: { ...grupos, [grupoId]: actual.includes(opcionId) ? actual.filter(id => id !== opcionId) : [...actual, opcionId] } }));
  }
  reglaGrupo(g: ModificadorGrupo): string { return g.minimo === g.maximo ? `elige ${g.minimo}` : `elige entre ${g.minimo} y ${g.maximo}`; }
  grupoLleno(g: ModificadorGrupo, grupoId: number): boolean { return (this.modificadoresElegidos()[grupoId]?.length ?? 0) >= g.maximo; }
  comboGrupoLleno(comboGrupoId: number, slot: number, g: ModificadorGrupo, grupoId: number): boolean {
    return (this.modificadoresCombo()[`${comboGrupoId}:${slot}`]?.[grupoId]?.length ?? 0) >= g.maximo;
  }
  configuracionValida(p: Producto): boolean {
    if (p.variantes.length && !p.variantes.some(v => v.varianteId === this.varianteElegida())) return false;
    for (const g of p.grupos) { const n = this.modificadoresElegidos()[g.grupoId]?.length ?? 0; if (n < g.minimo || n > g.maximo) return false; }
    for (const g of p.combo) {
      const slots = this.combosElegidos()[g.comboGrupoId] ?? [];
      if (!comboSeleccionValida(g.cantidad, slots)) return false;
      for (let i = 0; i < g.cantidad; i++) {
        const o = g.opciones.find(x => x.productoId === slots[i]); if (!o || o.agotado) return false;
        if (o.variantes.length && !o.variantes.some(v => v.varianteId === this.variantesCombo()[`${g.comboGrupoId}:${i}`])) return false;
        for (const cg of o.grupos) { const n = this.modificadoresCombo()[`${g.comboGrupoId}:${i}`]?.[cg.grupoId]?.length ?? 0; if (n < cg.minimo || n > cg.maximo) return false; }
      }
    }
    return true;
  }
  precioConfigurado(p: Producto): number {
    return calcularPrecioConfiguradoPos(p, {
      varianteId: this.varianteElegida(),
      modificadores: this.modificadoresElegidos(),
      combos: this.combosElegidos(),
      variantesCombo: this.variantesCombo(),
      modificadoresCombo: this.modificadoresCombo(),
    });
  }
  tienePrecioVariable(p: Producto): boolean {
    return p.variantes.length > 0 || p.combo.length > 0
      || p.grupos.some(g => g.opciones.some(o => o.precioExtra > 0));
  }
  precioDesde(p: Producto): number { return precioDesdeConfiguracionPos(p); }
  async confirmarProducto() {
    const pedido = this.pedido(); const producto = this.productoConfigurando(); if (!pedido || !producto) return;
    if (this.ajusteFinancieroInciertoEnPedido(pedido.pedidoId)
      || (this.itemIncierto(pedido.pedidoId) && !this.reintentoPendiente())) {
      this.errorConfiguracion.set('Conciliar primero la operación pendiente de este pedido.'); return;
    }
    if (!this.configuracionValida(producto)) { this.errorConfiguracion.set('Completa las opciones obligatorias antes de agregar el producto.'); return; }
    const body = this.intentosItem.obtener(pedido.pedidoId, () => ({
      productoId: producto.productoId, cantidad: 1, nota: this.notaProducto().trim() || null, claveIdempotencia: crypto.randomUUID(),
      paraLlevar: this.itemParaLlevar(),
      empaque: this.itemParaLlevar() ? this.itemEmpaque() : null,
      varianteId: producto.variantes.length ? this.varianteElegida() : null,
      modificadores: producto.grupos.map(g => ({ grupoId: g.grupoId, opcionIds: this.modificadoresElegidos()[g.grupoId] ?? [] })),
      combo: producto.combo.map(g => ({ comboGrupoId: g.comboGrupoId, opciones: this.comboSlots(g).map(slot => {
        const opcion = this.comboOpcionElegida(g, slot)!;
        return { productoId: opcion.productoId, varianteId: opcion.variantes.length ? this.variantesCombo()[`${g.comboGrupoId}:${slot}`] : null,
          modificadores: opcion.grupos.map(cg => ({ grupoId: cg.grupoId, opcionIds: this.modificadoresCombo()[`${g.comboGrupoId}:${slot}`]?.[cg.grupoId] ?? [] })) };
      }) }))
    }));
    await this.enviarItemIdempotente(pedido, body, producto.nombre);
  }
  async reintentarItemPendiente() {
    const pedido = this.pedido();
    if (!pedido || !this.itemIncierto(pedido.pedidoId) || this.ajusteFinancieroInciertoEnPedido(pedido.pedidoId)) return;
    const body = this.intentosItem.leer(pedido.pedidoId); if (!body) return;
    await this.enviarItemIdempotente(pedido, body, null);
  }
  private async enviarItemIdempotente(pedido: Pedido, body: Record<string, unknown>, nombre: string | null) {
    this.ocupada.set(true); this.errorConfiguracion.set(''); this.error.set('');
    try {
      this.pedido.set(await this.request<Pedido>('post', `/operacion/pedidos/${pedido.pedidoId}/items`, body));
      this.intentosItem.completar(pedido.pedidoId); this.productoConfigurando.set(null); this.reintentoPendiente.set(false);
      this.mensaje.set(nombre ? `${nombre} agregado al pedido.` : 'Se confirmó la línea pendiente; el pedido ya está actualizado.');
      await this.cargarMesas();
    } catch (e) {
      const status = (e as { status?: number }).status ?? 0;
      if (respuestaOperacionIncierta(status)) {
        this.intentosItem.marcarIncierto(pedido.pedidoId); this.reintentoPendiente.set(true);
        const mensaje = 'No se confirmó la respuesta. Reintenta con la misma clave para evitar duplicar la línea.';
        if (this.productoConfigurando()) this.errorConfiguracion.set(mensaje); else this.error.set(mensaje);
      } else {
        this.intentosItem.completar(pedido.pedidoId); this.reintentoPendiente.set(false); this.errorConfiguracion.set(this.mensajeError(e));
      }
    } finally { this.ocupada.set(false); }
  }
  async enviar() {
    const p = this.pedido(); if (!p) return;
    if (this.ajusteInciertoEnPedido(p.pedidoId)) { this.error.set('Conciliar primero la operación financiera pendiente de este pedido.'); return; }
    try { this.ocupada.set(true); this.pedido.set(await this.request<Pedido>('post', `/operacion/pedidos/${p.pedidoId}/enviar`)); this.mensaje.set('Comanda enviada a las áreas de preparación.'); await this.cargarMesas(); }
    catch (e) { this.mostrarError(e); } finally { this.ocupada.set(false); }
  }

  /** Sin ítem, entrega todo lo que esté listo. Con ítem, solo ese plato: de
      cuatro, casi nunca salen los cuatro juntos. */
  async entregar(item?: Item) {
    const p = this.pedido(); if (!p) return;
    const cuerpo = item ? { itemIds: [item.pedidoItemId] } : {};
    try {
      this.ocupada.set(true);
      this.pedido.set(await this.request<Pedido>('post', `/operacion/pedidos/${p.pedidoId}/entregar`, cuerpo));
      this.mensaje.set(item ? `${item.nombre} entregado a la mesa.` : 'Entregado a la mesa.');
      await this.cargarMesas();
    } catch (e) { this.mostrarError(e); } finally { this.ocupada.set(false); }
  }
  async anularBorrador() { const p=this.pedido(); if (!p) return; if (this.ajusteInciertoEnPedido(p.pedidoId)) { this.error.set('Conciliar primero la operación pendiente de este pedido.'); return; } try { this.ocupada.set(true); await this.request<Pedido>('post',`/operacion/pedidos/${p.pedidoId}/anular-borrador`); this.pedido.set(null); this.mesaSeleccionada.set(null); this.mensaje.set('Borrador vacío anulado; mesa liberada.'); await this.cargarMesas(); } catch(e) { this.mostrarError(e); } finally { this.ocupada.set(false); } }
  montoLineasSeleccionadas(): number { const p=this.pedido(); if (!p) return 0; return Math.round(p.items.reduce((s,i)=>s+Math.max(0,Math.min(i.cantidad-i.cantidadPagada,Number(this.cantidadesCuenta[i.pedidoItemId])||0))*i.precioUnitario,0)*100)/100; }
  devueltoPago(pagoId: number): number { return this.pedido()?.ajustes.filter(a=>a.tipo==='DEVOLUCION'&&a.pagoId===pagoId).reduce((s,a)=>s+a.monto,0) ?? 0; }
  hayLineasActivas(comanda: Comanda): boolean { return comanda.items.some(i=>i.estado!=='ANULADO'); }
  async anularItem(item: Item) {
    const p = this.pedido();
    const inciertaEstaAnulacion = this.intentosAnulacion.esIncierto(item.pedidoItemId);
    if (!p || !this.sesion.tienePermiso('PEDIDO_ANULAR_ITEM')
      || (this.ajusteInciertoEnPedido(p.pedidoId) && !inciertaEstaAnulacion)
      || (p.pagos.length && !inciertaEstaAnulacion)) return;
    let body = this.intentosAnulacion.leer(item.pedidoItemId);
    if (!body) {
      const motivo = window.prompt(`Motivo obligatorio para anular ${item.nombre} (mínimo 5 caracteres)`)?.trim();
      if (!motivo || motivo.length < 5) return;
      body = this.intentosAnulacion.guardar(item.pedidoItemId, { monto: item.total, motivo, claveIdempotencia: crypto.randomUUID() });
    }
    const ok = await this.ejecutarAjusteReintentable(this.intentosAnulacion, item.pedidoItemId, p.pedidoId,
      `/operacion/pedidos/${p.pedidoId}/items/${item.pedidoItemId}/anulacion`, body);
    if (ok) this.mensaje.set('Línea anulada con motivo y evento de auditoría. El detalle histórico se conserva.');
  }
  async aplicarDescuento() {
    const p = this.pedido();
    if (!p || !this.sesion.tienePermiso('DESCUENTO_APLICAR')
      || (this.ajusteInciertoEnPedido(p.pedidoId) && !this.descuentoIncierto(p.pedidoId))) return;
    let body = this.intentosDescuento.leer(p.pedidoId);
    if (!body) {
      const monto = Number(window.prompt('Monto del descuento en S/ (sujeto al límite configurado)'));
      if (!Number.isFinite(monto) || monto <= 0 || Math.round(monto * 100) !== monto * 100) return;
      const motivo = window.prompt('Motivo obligatorio del descuento (mínimo 5 caracteres)')?.trim();
      if (!motivo || motivo.length < 5) return;
      body = this.intentosDescuento.guardar(p.pedidoId, { monto, motivo, claveIdempotencia: crypto.randomUUID() });
    }
    const ok = await this.ejecutarAjusteReintentable(this.intentosDescuento, p.pedidoId, p.pedidoId,
      `/operacion/pedidos/${p.pedidoId}/descuentos`, body);
    if (ok) { this.dividirPorLineas = false; this.montoAplicar = null; this.mensaje.set('Descuento aplicado y auditado. El total actualizado se cobrará como una sola cuenta.'); }
  }
  async devolverPago(p: Pago) {
    const pedido = this.pedido();
    const incierto = this.intentosDevolucion.esIncierto(p.pagoId);
    if (!pedido || !this.sesion.tienePermiso('PAGO_DEVOLVER')
      || (this.ajusteInciertoEnPedido(pedido.pedidoId) && !incierto)
      || (!this.cajasAbiertas().length && !incierto)) return;
    let body = this.intentosDevolucion.leer(p.pagoId);
    if (!body) {
      const max = Math.round((p.monto - this.devueltoPago(p.pagoId)) * 100) / 100;
      const monto = Number(window.prompt(`Monto a devolver por ${p.medio} (máximo S/ ${max.toFixed(2)})`));
      if (!Number.isFinite(monto) || monto <= 0 || monto > max || Math.round(monto * 100) !== monto * 100) return;
      const motivo = window.prompt('Motivo obligatorio de la devolución (mínimo 5 caracteres)')?.trim();
      if (!motivo || motivo.length < 5) return;
      body = this.intentosDevolucion.guardar(p.pagoId, {
        monto, motivo, sesionCajaId: this.cajasAbiertas()[0].sesionCajaId, claveIdempotencia: crypto.randomUUID(),
      });
    }
    const ok = await this.ejecutarAjusteReintentable(this.intentosDevolucion, p.pagoId, pedido.pedidoId,
      `/operacion/pagos/${p.pagoId}/devoluciones`, body);
    if (ok) this.mensaje.set('Devolución registrada como movimiento compensatorio vinculado al pago original.');
  }
  private async ejecutarAjusteReintentable(
    intentos: IntentosIdempotentes<Record<string, unknown>>,
    id: number,
    pedidoId: number,
    path: string,
    body: Record<string, unknown>,
  ): Promise<boolean> {
    let confirmado = false;
    try {
      this.ocupada.set(true); this.error.set('');
      await this.request('post', path, body); confirmado = true;
      this.pedido.set(await this.request<Pedido>('get', `/operacion/pedidos/${pedidoId}`));
      intentos.completar(id); await this.cargarMesas();
      return true;
    } catch (e) {
      const status = (e as { status?: number }).status ?? 0;
      if (respuestaOperacionIncierta(status) || confirmado) {
        intentos.marcarIncierto(id);
        this.error.set(confirmado
          ? 'La operación fue aceptada; no se pudo actualizar el pedido. Reintenta para conciliarla con la misma clave, sin duplicarla.'
          : 'No se confirmó la respuesta. Reintenta la misma operación; se conservaron su clave y datos para evitar duplicarla.');
      } else {
        intentos.completar(id); this.mostrarError(e);
      }
      return false;
    } finally { this.ocupada.set(false); }
  }
  abrirCobro(): void {
    this.error.set('');
    this.tecladoAbierto.set(false);
    this.cobrando.set(true);
  }

  cerrarCobro(): void {
    // Un cobro a medio confirmar no se cierra: hay que conciliarlo primero o se
    // pierde de vista una venta que quizá sí entró.
    if (this.cobroIncierto(this.pedido()?.pedidoId ?? 0)) return;
    this.cobrando.set(false);
  }

  async cobrar() {
    const p = this.pedido(); if (!p || (!this.sesionCajaId && !this.intentosCobro.esIncierto(p.pedidoId))) return;
    const body = this.intentosCobro.obtener(p.pedidoId, () => {
      const aplicaciones = this.dividirPorLineas
        ? p.items.map(i => ({ pedidoItemId: i.pedidoItemId, cantidad: Math.max(0, Math.trunc(Number(this.cantidadesCuenta[i.pedidoItemId]) || 0)) })).filter(a => a.cantidad > 0)
        : [];
      const aplicar = this.dividirPorLineas ? this.montoLineasSeleccionadas() : (this.montoAplicar ?? p.saldoPendiente);
      return {
        sesionCajaId: this.sesionCajaId,
        medio: this.medio,
        recibido: this.medio === 'EFECTIVO' ? (this.recibido ?? aplicar) : aplicar,
        montoAplicar: aplicar,
        claveIdempotencia: crypto.randomUUID(),
        aplicaciones,
        referencia: this.dividirPorLineas ? this.referenciaCuenta.trim() : null,
      };
    });
    let cobroAceptadoPorApi = false;
    try {
      this.ocupada.set(true);
      await this.request('post', `/operacion/pedidos/${p.pedidoId}/cobrar`, body);
      cobroAceptadoPorApi = true;
      this.pedido.set(await this.request<Pedido>('get', `/operacion/pedidos/${p.pedidoId}`));
      this.intentosCobro.completar(p.pedidoId);
      this.mensaje.set(this.pedido()?.estado === 'PAGADO' ? 'Pedido pagado. Se registró el cierre del saldo.' : 'Abono registrado. Puedes continuar con otro medio de pago.');
      this.recibido = null; this.montoAplicar = null; this.cantidadesCuenta = {}; this.referenciaCuenta = ''; this.limpiarTeclado();
      // Saldada la cuenta, la hoja se va sola: el mesero vuelve a sus mesas.
      // Si fue un abono parcial se queda, que es lo que sigue cobrando.
      if (this.pedido()?.estado === 'PAGADO') this.cobrando.set(false);
      await this.cargarMesas();
    } catch (e) {
      const status = (e as { status?: number }).status ?? 0;
      if (respuestaOperacionIncierta(status) || cobroAceptadoPorApi) {
        this.intentosCobro.marcarIncierto(p.pedidoId);
        this.error.set(cobroAceptadoPorApi
          ? 'El cobro fue aceptado; no se pudo actualizar el pedido. Reintenta para conciliarlo con la misma clave, sin duplicarlo.'
          : 'No se confirmó la respuesta del cobro. Reintenta el mismo pago; se conservaron su clave y datos para evitar duplicarlo.');
      } else {
        this.intentosCobro.completar(p.pedidoId);
        this.mostrarError(e);
      }
    } finally { this.ocupada.set(false); }
  }
  async cargarCocina(silenciosa = false) {
    if (this.cocinaActualizando) return;
    this.cocinaActualizando = true;
    try {
      const comandas = await this.request<Comanda[]>('get', '/operacion/cocina');
      this.comandas.set(comandas);
      const conciliarTrabajo = (trabajo: PrintJob) => {
        const id = trabajo.trabajoImpresionId;
        if (['SOLICITADA', 'IMPRESA', 'ERROR'].includes(trabajo.estado)) this.intentosSolicitudImpresion.completar(id);
        if (this.intentosResultadoImpresion.leer(id) && trabajo.estado !== 'SOLICITADA') this.intentosResultadoImpresion.completar(id);
      };
      for (const comanda of comandas) {
        const trabajo = comanda.impresion; if (!trabajo) continue;
        conciliarTrabajo(trabajo);
      }
      // Las comandas entregadas salen de cocina, pero sus trabajos siguen en la cola durable.
      try { for (const trabajo of await this.request<PrintJob[]>('get', '/operacion/impresiones')) conciliarTrabajo(trabajo); }
      catch { /* La cola puede fallar sin ocultar las comandas que sí cargaron. */ }
    } catch (e) { if (!silenciosa) this.mostrarError(e); }
    finally { this.cocinaActualizando = false; }
  }
  private escapePrint(text: unknown): string { return String(text ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!)); }
  async cargarHistorialImpresion(job: PrintJob) { const id=job.trabajoImpresionId; if (this.historialImpresion()[id]) { this.historialImpresion.update(h=>{ const next={...h}; delete next[id]; return next; }); return; }
    try { const eventos=await this.request<PrintEvent[]>('get',`/operacion/impresiones/${id}/eventos`); this.historialImpresion.update(h=>({...h,[id]:eventos})); } catch(e) { this.mostrarError(e); }
  }
  async solicitarImpresion(job: PrintJob) {
    const popup=window.open('', '_blank', 'width=420,height=720');
    if (!popup) { this.error.set('El navegador bloqueó la ventana de impresión. Permite ventanas emergentes y vuelve a intentar.'); return; }
    const id=job.trabajoImpresionId;
    const solicitud=this.intentosSolicitudImpresion.obtener(id,()=>({claveIdempotencia:crypto.randomUUID()}));
    try {
      this.ocupada.set(true);
      const solicitado=await this.request<PrintJob>('post',`/operacion/impresiones/${id}/solicitar`,solicitud);
      const p=solicitado.payload; const width=this.formatoImpresion==='80MM'?'72mm':'190mm';
      const lineas=[...p.lineas,...p.componentes].map(i=>`<article><strong>${i.cantidad} × ${this.escapePrint(i.nombre)}</strong>${i.paraLlevar?`<p><strong>PARA LLEVAR${i.empaque?` · ${i.empaque==='TAPER'?'TÁPER':'BOLSA'}`:''}</strong></p>`:''}${i.nota?`<p>${this.escapePrint(i.nota)}</p>`:''}</article>`).join('');
      popup.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Comanda ${p.comandaId}</title><style>@page{size:${this.formatoImpresion==='80MM'?'80mm auto':'A4'};margin:${this.formatoImpresion==='80MM'?'4mm':'10mm'}}body{font:14px Arial,sans-serif;width:${width};margin:0;color:#111}h1{font-size:20px;margin:0 0 8px}p{margin:4px 0}article{border-bottom:1px dashed #777;padding:8px 0}small{color:#444}@media print{body{width:${width}}}</style></head><body><h1>${this.escapePrint(p.area)} · Comanda #${p.comandaId}</h1><p>Pedido #${p.pedidoId} · ${this.escapePrint(p.mesaId ? `Mesa ${p.mesaId}` : this.etiquetaCanal(p.canal))}</p><small>${this.escapePrint(new Date(p.enviadaEn).toLocaleString('es-PE'))}</small>${lineas}<script>window.onload=()=>window.print()<\/script></body></html>`);
      popup.document.close(); popup.focus();
      this.intentosSolicitudImpresion.completar(id);
      this.mensaje.set(`Comanda enviada al diálogo de impresión en ${this.formatoImpresion}. Confirma el resultado en la cola.`);
      await this.cargarCocina();
    } catch(e) {
      popup.close();
      const status=(e as {status?:number}).status??0;
      if(respuestaOperacionIncierta(status)) {
        this.intentosSolicitudImpresion.marcarIncierto(id);
        this.error.set('No se confirmó la solicitud de impresión. Puedes reintentar con la misma clave o conciliar la comanda en la cola.');
        await this.cargarCocina();
      } else { this.intentosSolicitudImpresion.completar(id); this.mostrarError(e); }
    } finally { this.ocupada.set(false); }
  }
  async registrarResultadoImpresion(job: PrintJob, impresa: boolean) {
    const id=job.trabajoImpresionId;
    const existente=this.intentosResultadoImpresion.leer(id);
    if(this.resultadoImpresionIncierto(id) && existente) { await this.enviarResultadoImpresion(id,existente); return; }
    const detalle=impresa?null:window.prompt('Motivo del fallo de impresión (obligatorio):')?.trim()??null;
    if (!impresa && !detalle) return;
    const resultado=this.intentosResultadoImpresion.obtener(id,()=>({impresa,detalle,claveIdempotencia:crypto.randomUUID()}));
    await this.enviarResultadoImpresion(id,resultado);
  }
  async reintentarResultadoImpresion(job: PrintJob) {
    const resultado=this.intentosResultadoImpresion.leer(job.trabajoImpresionId);
    if(!resultado || !this.resultadoImpresionIncierto(job.trabajoImpresionId)) return;
    await this.enviarResultadoImpresion(job.trabajoImpresionId,resultado);
  }
  private async enviarResultadoImpresion(id:number,resultado:ResultadoImpresionPendiente) {
    try {
      this.ocupada.set(true);
      await this.request<PrintJob>('post',`/operacion/impresiones/${id}/resultado`,resultado);
      this.intentosResultadoImpresion.completar(id); this.intentosSolicitudImpresion.completar(id);
      this.mensaje.set(resultado.impresa?'Impresión confirmada y registrada.':'Fallo de impresión registrado; el trabajo queda disponible para reintentar.');
      await this.cargarCocina();
    } catch(e) {
      const status=(e as {status?:number}).status??0;
      if(respuestaOperacionIncierta(status)) {
        this.intentosResultadoImpresion.marcarIncierto(id);
        this.error.set('No se confirmó el resultado de impresión. Reintentar conserva el mismo resultado y la misma clave.');
        await this.cargarCocina();
      } else { this.intentosResultadoImpresion.completar(id); this.mostrarError(e); }
    } finally { this.ocupada.set(false); }
  }
  async estadoComanda(c: Comanda, estado: string) { try { this.ocupada.set(true); this.comandas.set(await this.request<Comanda[]>('post',`/operacion/comandas/${c.comandaId}/estado`,{estado})); } catch(e) { this.mostrarError(e); } finally { this.ocupada.set(false); } }
  cerrarDetalle() { this.pedido.set(null); this.mesaSeleccionada.set(null); this.mensaje.set(''); this.dividirPorLineas=false; this.cantidadesCuenta={}; this.referenciaCuenta=''; this.limpiarTeclado(); }
  private mensajeError(e: unknown) { const x=e as {error?:{mensaje?:string}}; return x.error?.mensaje ?? 'No se pudo completar la operación.'; }
  private mostrarError(e: unknown) { this.error.set(this.mensajeError(e)); }
}
