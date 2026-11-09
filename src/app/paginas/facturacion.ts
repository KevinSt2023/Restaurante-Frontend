import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { IntentosIdempotentes, respuestaOperacionIncierta } from '../core/idempotencia-operaciones';
import { SesionService } from '../core/sesion';
import { Icono } from '../shared/icono';

interface Linea { descripcion:string; cantidad:number; precioUnitario:number; afectacionIgv:string; baseImponible:number; igv:number; total:number; }
interface Pendiente { pedidoId:number; pagadoEn:string; total:number; canal:string; items:Linea[]; }
interface Comprobante { comprobanteId:number; pedidoId:number; tipo:string; serie:string; numero:number; estado:string; clienteNombre:string;
  clienteTipoDocumento:string|null; clienteNumeroDocumento:string|null; subtotalGravado:number; subtotalExonerado:number; subtotalInafecto:number;
  igv:number; total:number; moneda:string; emitidoEn:string; enviadoEn:string|null; mensajeRespuesta:string|null; pdfUrl:string|null; xmlUrl:string|null; cdrUrl:string|null; hashCpe:string|null; qrContenido:string|null; items:Linea[]; }
interface Config { rutaApi:string|null; token:string|null; modo:string; igvTasa:number; configurada:boolean; }
interface CuadreObservado { comprobanteId:number; pedidoId:number; tipo:string; numero:string; estado:string;
  totalComprobante:number; sumaLineas:number; cobradoDelPedido:number; motivos:string[]; }
interface CuadreFiscal { comprobantes:number; totalEmitido:number; observados:number; detalle:CuadreObservado[]; }

@Component({selector:'vf-facturacion-pagina',imports:[CommonModule,FormsModule,CurrencyPipe,DatePipe,Icono],changeDetection:ChangeDetectionStrategy.OnPush,
  styles:[`@media print { body * { visibility:hidden!important } #comprobante-print,#comprobante-print * { visibility:visible!important } #comprobante-print { position:absolute;left:0;top:0;color:#111;background:#fff } .solo-pantalla {display:none!important} #comprobante-print.ticket{page:ticket;width:76mm;padding:2mm;font:10px/1.35 Arial,sans-serif} #comprobante-print.a4{page:a4;width:190mm;padding:12mm;font:12px/1.45 Arial,sans-serif} @page ticket { size:80mm auto; margin:0 } @page a4 { size:A4; margin:4mm } }`],
  template:`
  <main class="mx-auto max-w-6xl space-y-5">
    <header class="solo-pantalla flex flex-wrap items-center justify-between gap-3">
      <div>
        <p class="text-xs font-bold uppercase tracking-[0.16em] text-naranja">{{sucursal()}}</p>
        <h1 class="titulo-pagina mt-0.5">Comprobantes</h1>
        <p class="subtitulo mt-1.5">Notas internas, boletas y facturas desde ventas ya cobradas.</p>
      </div>
      <button class="btn btn-secundario" (click)="cargar()"><vf-icono nombre="refrescar" [tam]="18" /> Actualizar</button>
    </header>

    @if(error()){<div role="alert" class="solo-pantalla flex items-start gap-3 rounded-2xl border border-peligro/40 bg-peligro/10 px-4 py-3 text-sm font-medium text-peligro"><vf-icono nombre="alerta" class="mt-0.5 shrink-0" />{{error()}}</div>}
    @if(mensaje()){<div role="status" class="solo-pantalla flex items-start gap-3 rounded-2xl border border-exito/40 bg-exito/10 px-4 py-3 text-sm font-medium text-exito"><vf-icono nombre="check" class="mt-0.5 shrink-0" />{{mensaje()}}</div>}

    <!-- ─────────── Cuadre fiscal: cada comprobante contra su venta ─────────── -->
    @if(cuadre();as q){
      <section class="solo-pantalla tarjeta p-4" [class.border-peligro]="q.observados > 0">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="flex items-center gap-3">
            <span class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl" [class.bg-exito]="q.observados === 0" [class.bg-peligro]="q.observados > 0">
              <vf-icono [nombre]="q.observados === 0 ? 'check' : 'alerta'" [tam]="24" class="text-white" />
            </span>
            <div>
              <h2 class="font-bold">{{ q.observados === 0 ? 'Todo calza' : 'Hay comprobantes que no calzan' }}</h2>
              <p class="text-sm text-suave">
                {{ q.comprobantes }} comprobante(s) · {{ q.totalEmitido | currency:'PEN':'symbol':'1.2-2' }} emitidos
                @if(q.observados === 0){ · líneas, impuestos y cobros coinciden al céntimo }
                @else { · <span class="font-bold text-peligro">{{ q.observados }} con diferencia</span> }
              </p>
            </div>
          </div>
          <button class="btn btn-sm btn-secundario" [disabled]="ocupada()" (click)="revisarCuadre()">Revisar de nuevo</button>
        </div>
        @if(q.observados > 0){
          <ul class="mt-3 space-y-2">
            @for(o of q.detalle; track o.comprobanteId){
              <li class="rounded-xl border border-peligro/40 bg-peligro/5 p-3 text-sm">
                <p class="font-bold">{{ o.tipo.replace('_',' ') }} {{ o.numero }} · pedido #{{ o.pedidoId }}</p>
                <p class="text-xs text-suave">Comprobante {{ o.totalComprobante | currency:'PEN':'symbol':'1.2-2' }} · líneas {{ o.sumaLineas | currency:'PEN':'symbol':'1.2-2' }} · cobrado {{ o.cobradoDelPedido | currency:'PEN':'symbol':'1.2-2' }}</p>
                @for(m of o.motivos; track m){ <p class="mt-1 font-medium text-peligro">{{ m }}</p> }
              </li>
            }
          </ul>
        }
      </section>
    }

    <!-- ─────────── CPE que necesitan revisión manual ─────────── -->
    @if(conciliacion().length){
      <section class="solo-pantalla rounded-2xl border border-alerta/40 bg-alerta/10 p-4">
        <h2 class="font-bold text-alerta">Revisión requerida antes de continuar</h2>
        <p class="mt-1 text-sm text-alerta">Verifica cada CPE en Nubefact: Monitoreo → Consistencia. Si falta, pide a soporte que habilite la emisión con fecha anterior. No reenvíes sin esa autorización.</p>
        <div class="mt-3 space-y-3">
          @for(c of conciliacion();track c.comprobanteId){
            <article class="rounded-xl border border-alerta/40 bg-superficie p-3">
              <button class="w-full text-left" (click)="seleccionar(c)">
                <span class="flex justify-between gap-2 font-bold"><span>{{c.tipo.replace('_',' ')}} {{c.serie}}-{{c.numero.toString().padStart(8,'0')}}</span><span class="chip-alerta">{{etiquetaEstado(c.estado)}}</span></span>
                <span class="mt-1 block text-sm text-suave">Pedido #{{c.pedidoId}} · {{c.total|currency:'PEN':'symbol':'1.2-2'}} · {{c.emitidoEn|date:'dd/MM/yyyy HH:mm'}}</span>
                <span class="mt-1 block text-xs text-tenue">{{c.mensajeRespuesta??'Confirma el estado con el proveedor antes de cualquier operación.'}}</span>
              </button>
              @if(sesion.tienePermiso('CONFIGURACION')){
                <div class="mt-3 border-t border-borde pt-3">
                  <h3 class="text-sm font-bold">Reenvío excepcional del mismo comprobante</h3>
                  <p class="mt-1 text-xs text-tenue">Exige confirmar que no aparece en Nubefact y registrar el ticket donde soporte autorizó la fecha anterior. Conserva serie, número y detalle originales.</p>
                  @if(c.estado==='PENDIENTE'&&!puedeReenviar(c)){<p class="mt-1 text-xs font-bold text-alerta">El envío puede seguir procesándose. Espera cinco minutos y vuelve a consultar.</p>}
                  <label class="mt-2 flex min-h-toque items-center gap-2 text-sm"><input type="checkbox" class="h-5 w-5 accent-naranja" [name]="'ausencia-'+c.comprobanteId" [(ngModel)]="ausenciaConfirmada[c.comprobanteId]"/><span>Confirmo que revisé Consistencia y Nubefact no registra este CPE.</span></label>
                  <div class="mt-2 grid gap-2 md:grid-cols-2">
                    <input class="campo" [name]="'ticket-'+c.comprobanteId" [(ngModel)]="ticketSoporte[c.comprobanteId]" placeholder="Ticket de autorización de Nubefact"/>
                    <input class="campo" [name]="'motivo-'+c.comprobanteId" [(ngModel)]="motivoReenvio[c.comprobanteId]" placeholder="Motivo operativo del reenvío"/>
                  </div>
                  <button class="btn mt-2 w-full bg-alerta text-white" [disabled]="ocupada()||!puedeReenviar(c)||!ausenciaConfirmada[c.comprobanteId]||!ticketSoporte[c.comprobanteId]?.trim()||!motivoReenvio[c.comprobanteId]?.trim()" (click)="reenviar(c)">Reenviar mismo CPE</button>
                </div>
              }
            </article>
          }
        </div>
      </section>
    }

    <!-- ─────────── Configuración del emisor ─────────── -->
    @if(sesion.tienePermiso('CONFIGURACION')){
      <details class="solo-pantalla tarjeta p-4">
        <summary class="min-h-toque cursor-pointer select-none pt-2 font-bold">Configuración del emisor electrónico</summary>
        <p class="mt-3 text-sm text-suave">Registra la ruta API y el token del emisor Nubefact del RUC de esta empresa. El token se cifra en el servidor y no vuelve a mostrarse.</p>
        <p role="note" class="mt-3 rounded-xl border border-alerta/40 bg-alerta/10 p-3 text-sm text-alerta">El modo es una referencia operativa: no activa por sí solo un sandbox. Nubefact determina el entorno con la ruta y el token de esa cuenta; confírmalos en su panel antes de emitir.</p>
        <form class="mt-4 grid gap-3 md:grid-cols-2" (ngSubmit)="guardarConfig()">
          <label class="block"><span class="etiqueta">Ruta API Nubefact</span><input class="campo" name="ruta" [(ngModel)]="rutaApi" placeholder="https://api.nubefact.com/api/v1/..." /></label>
          <label class="block"><span class="etiqueta">Token {{config()?.configurada?'(vacío conserva el actual)':''}}</span><input class="campo" name="token" type="password" autocomplete="new-password" [(ngModel)]="token" /></label>
          <div><span class="etiqueta">Modo de referencia</span>
            <div class="grid grid-cols-2 gap-2">
              <button type="button" class="opcion" [class.opcion-activa]="modo==='DEMO'" (click)="modo='DEMO'">Pruebas</button>
              <button type="button" class="opcion" [class.opcion-activa]="modo==='PRODUCCION'" (click)="modo='PRODUCCION'">Producción</button>
            </div>
          </div>
          <label class="block"><span class="etiqueta">Tasa total IGV</span><input class="campo" name="igv" type="number" min="0" max="0.25" step="0.0001" [(ngModel)]="igvTasa" /></label>
          @if(modo==='PRODUCCION'){<label class="block md:col-span-2"><span class="etiqueta text-peligro">Confirmación requerida para guardar producción</span><input class="campo uppercase" name="confirmacionProduccion" [(ngModel)]="confirmacionProduccion" autocomplete="off" placeholder="Escribe CONFIRMO PRODUCCION" /></label>}
          <button class="btn-grande-marino md:col-span-2" [disabled]="ocupada()||(modo==='PRODUCCION'&&!produccionConfirmada())">Guardar configuración</button>
        </form>
      </details>
    }

    <section class="solo-pantalla grid gap-5 xl:grid-cols-[1.05fr_.95fr]">
      <!-- ─────────── Ventas por emitir ─────────── -->
      <div class="space-y-3">
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-bold">Ventas pagadas por emitir</h2>
          <span class="chip-neutro">{{pendientes().length}} pendiente(s)</span>
        </div>
        @for(v of pendientes();track v.pedidoId){
          <article class="tarjeta p-4">
            <div class="flex items-start justify-between gap-3">
              <div>
                <div class="text-[15px] font-bold">Pedido #{{v.pedidoId}} · {{v.canal.replace('_',' ')}}</div>
                <div class="text-xs text-tenue">{{v.pagadoEn|date:'dd/MM/yyyy HH:mm'}}</div>
              </div>
              <strong class="cifra text-xl">{{v.total|currency:'PEN':'symbol':'1.2-2'}}</strong>
            </div>
            <p class="mt-2 text-sm text-suave">{{resumen(v.items)}}</p>

            @if(emisionIncierta(v)){
              <div role="alert" class="mt-3 rounded-xl border border-alerta/40 bg-alerta/10 p-3 text-sm text-alerta">
                <p>No se confirmó el resultado de la emisión. Se conservaron los mismos datos y la misma clave para conciliar sin duplicar.</p>
                <button class="btn btn-sm mt-2 w-full bg-alerta text-white" [disabled]="ocupada()||!puedeEmitir(v)" (click)="emitir(v)">Conciliar emisión</button>
              </div>
            } @else {
              <p class="etiqueta mt-3">Tipo de comprobante</p>
              <div class="grid grid-cols-3 gap-2">
                @for(t of TIPOS; track t.codigo){
                  <button type="button" class="medio-pago" [class.medio-pago-activo]="(tipos[v.pedidoId]??'BOLETA')===t.codigo" (click)="tipos[v.pedidoId]=t.codigo">
                    <vf-icono [nombre]="t.icono" [tam]="24" />
                    <span class="leading-none">{{t.nombre}}</span>
                  </button>
                }
              </div>

              @if(tipos[v.pedidoId]==='FACTURA'){
                <div class="mt-2 grid gap-2 sm:grid-cols-2">
                  <input class="campo" [name]="'ruc-'+v.pedidoId" inputmode="numeric" [(ngModel)]="clienteDoc[v.pedidoId]" placeholder="RUC (11 dígitos)"/>
                  <input class="campo" [name]="'razon-'+v.pedidoId" [(ngModel)]="clienteNombre[v.pedidoId]" placeholder="Razón social"/>
                </div>
              }
              @if(tipos[v.pedidoId]==='BOLETA'&&v.total>700){
                <p class="mt-2 text-xs font-semibold text-alerta">Boleta mayor a S/ 700: la identificación del comprador es obligatoria.</p>
                <div class="mt-1 grid gap-2 sm:grid-cols-[.8fr_1fr]">
                  <select class="campo" [name]="'tipo-doc-'+v.pedidoId" [(ngModel)]="clienteTipo[v.pedidoId]">
                    <option value="DNI">DNI</option><option value="RUC">RUC</option><option value="CE">Carné de extranjería</option><option value="PASAPORTE">Pasaporte</option>
                  </select>
                  <input class="campo" [name]="'doc-'+v.pedidoId" [(ngModel)]="clienteDoc[v.pedidoId]" placeholder="Documento del cliente"/>
                </div>
              }
              <button class="btn-grande-naranja mt-3 w-full" [disabled]="ocupada()||!puedeEmitir(v)" (click)="emitir(v)">
                <vf-icono nombre="nota" [tam]="22" /> Emitir {{ etiquetaTipo(tipos[v.pedidoId]??'BOLETA') }}
              </button>
              @if(!puedeEmitir(v)){<p class="mt-1 text-xs text-tenue">Tu rol no puede emitir este tipo de comprobante.</p>}
            }
          </article>
        }
        @if(!pendientes().length){
          <div class="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-borde p-10 text-center">
            <vf-icono nombre="check" [tam]="36" class="text-exito" />
            <p class="text-sm text-tenue">No hay ventas pagadas pendientes de comprobante.</p>
          </div>
        }
      </div>

      <!-- ─────────── Emitidos ─────────── -->
      <div>
        <h2 class="mb-3 text-lg font-bold">Emitidos recientemente</h2>
        <div class="space-y-2">
          @for(c of comprobantes();track c.comprobanteId){
            <button class="tarjeta w-full p-4 text-left transition-colors hover:border-naranja"
                    [class.border-naranja]="seleccionado()?.comprobanteId === c.comprobanteId" (click)="seleccionar(c)">
              <span class="flex items-center justify-between gap-2">
                <span class="font-bold">{{c.tipo.replace('_',' ')}} {{c.serie}}-{{c.numero.toString().padStart(8,'0')}}</span>
                <span class="chip" [class.chip-exito]="c.estado==='ACEPTADO'||c.estado==='INTERNO'" [class.chip-alerta]="c.estado==='PENDIENTE'||c.estado==='INCIERTO'" [class.chip-peligro]="c.estado==='RECHAZADO'||c.estado==='ERROR'">{{etiquetaEstado(c.estado)}}</span>
              </span>
              <span class="mt-1 block text-sm text-suave">{{c.clienteNombre}} · {{c.emitidoEn|date:'dd/MM/yyyy HH:mm'}}</span>
              <span class="cifra mt-1 block text-lg">{{c.total|currency:'PEN':'symbol':'1.2-2'}}</span>
            </button>
          }
          @if(!comprobantes().length){<div class="rounded-2xl border border-dashed border-borde p-8 text-center text-sm text-tenue">Aún no se emitió ningún comprobante en esta sucursal.</div>}
        </div>
      </div>
    </section>

    <!-- ─────────── Vista de impresión ─────────── -->
    @if(seleccionado();as c){
      <section class="solo-pantalla flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-elevada p-3">
        <div><strong>Impresión {{c.serie}}-{{c.numero.toString().padStart(8,'0')}}</strong></div>
        <div class="flex flex-wrap items-center gap-2">
          <div class="flex gap-1 rounded-xl border border-borde bg-superficie p-1">
            <button type="button" class="min-h-toque rounded-lg px-3 text-sm font-bold" [class.bg-marino]="formato==='ticket'" [class.text-white]="formato==='ticket'" (click)="formato='ticket'">80 mm</button>
            <button type="button" class="min-h-toque rounded-lg px-3 text-sm font-bold" [class.bg-marino]="formato==='a4'" [class.text-white]="formato==='a4'" (click)="formato='a4'">A4</button>
          </div>
          @if(c.pdfUrl){<a class="btn btn-secundario" [href]="c.pdfUrl" target="_blank" rel="noopener">PDF oficial</a>}
          @if(c.cdrUrl){<a class="btn btn-secundario" [href]="c.cdrUrl" target="_blank" rel="noopener">CDR</a>}
          <button class="btn-grande-marino" (click)="imprimir()"><vf-icono nombre="nota" [tam]="20" /> Imprimir</button>
        </div>
      </section>

      <article id="comprobante-print" [class.ticket]="formato==='ticket'" [class.a4]="formato==='a4'" class="tarjeta mx-auto bg-white p-6 text-slate-900">
        <header class="border-b pb-4 text-center">
          <h2 class="text-xl font-black">{{c.tipo==='NOTA_VENTA'?'NOTA DE VENTA':c.tipo==='BOLETA'?'BOLETA DE VENTA ELECTRÓNICA':'FACTURA ELECTRÓNICA'}}</h2>
          <p class="font-bold">{{c.serie}}-{{c.numero.toString().padStart(8,'0')}}</p>
          <p class="mt-1">{{sucursal()}}</p>
          <p>{{c.emitidoEn|date:'dd/MM/yyyy HH:mm'}}</p>
        </header>
        <div class="border-b py-3 text-sm">
          <p><b>Cliente:</b> {{c.clienteNombre}}</p>
          @if(c.clienteNumeroDocumento){<p><b>{{c.clienteTipoDocumento}}:</b> {{c.clienteNumeroDocumento}}</p>}
        </div>
        <div class="border-b py-3">
          @for(i of c.items; track i.descripcion + i.precioUnitario){
            <div class="grid grid-cols-[1fr_auto] gap-2 py-0.5 text-sm"><span>{{i.cantidad}} × {{i.descripcion}}</span><span>{{i.total|currency:'PEN':'symbol':'1.2-2'}}</span></div>
          }
        </div>
        <div class="ml-auto mt-3 max-w-xs space-y-1 text-right text-sm">
          <p>Op. gravada: {{c.subtotalGravado|currency:'PEN':'symbol':'1.2-2'}}</p>
          <p>Op. exonerada: {{c.subtotalExonerado|currency:'PEN':'symbol':'1.2-2'}}</p>
          <p>Op. inafecta: {{c.subtotalInafecto|currency:'PEN':'symbol':'1.2-2'}}</p>
          <p>IGV: {{c.igv|currency:'PEN':'symbol':'1.2-2'}}</p>
          <p class="text-lg font-black">TOTAL: {{c.total|currency:'PEN':'symbol':'1.2-2'}}</p>
        </div>
        @if(c.tipo==='NOTA_VENTA'){
          <p class="mt-4 border-t pt-3 text-center text-xs font-black">DOCUMENTO INTERNO — NO ES COMPROBANTE DE PAGO NI TIENE VALOR TRIBUTARIO</p>
        } @else {
          <p class="mt-4 border-t pt-3 text-center text-xs">Resumen operativo del CPE · {{etiquetaEstado(c.estado)}} · Entregar el PDF oficial de Nubefact.</p>
          @if(c.hashCpe){<p class="text-center text-[10px]">Hash: {{c.hashCpe}}</p>}
          @if(c.estado==='ACEPTADO'&&!c.pdfUrl){<p class="mt-2 text-center text-xs font-bold">El PDF oficial de Nubefact con la representación tributaria y el QR aún no está disponible.</p>}
        }
      </article>
    }
  </main>`})
export class FacturacionPagina {
  private readonly http=inject(HttpClient); readonly sesion=inject(SesionService);
  readonly pendientes=signal<Pendiente[]>([]); readonly comprobantes=signal<Comprobante[]>([]); readonly conciliacion=signal<Comprobante[]>([]); readonly config=signal<Config|null>(null);
  readonly seleccionado=signal<Comprobante|null>(null); readonly error=signal(''); readonly mensaje=signal(''); readonly ocupada=signal(false);
  tipos:Record<number,string>={}; clienteTipo:Record<number,string>={}; clienteDoc:Record<number,string>={}; clienteNombre:Record<number,string>={};
  ausenciaConfirmada:Record<number,boolean|undefined>={}; ticketSoporte:Record<number,string|undefined>={}; motivoReenvio:Record<number,string|undefined>={};
  private intentosEmision:IntentosIdempotentes<Record<string,unknown>>|null=null; private scopeIntentos='';
  rutaApi='';token='';modo='DEMO';igvTasa=.18;formato='ticket';confirmacionProduccion='';
  readonly TIPOS=[
    {codigo:'BOLETA',nombre:'Boleta',icono:'nota'},
    {codigo:'FACTURA',nombre:'Factura',icono:'empresa'},
    {codigo:'NOTA_VENTA',nombre:'Nota interna',icono:'etiqueta'},
  ] as const;
  readonly cuadre=signal<CuadreFiscal|null>(null);
  etiquetaTipo(t:string){return ({BOLETA:'boleta',FACTURA:'factura',NOTA_VENTA:'nota de venta'} as Record<string,string>)[t]??t;}
  /** Vuelve a auditar que cada comprobante calce con su venta. */
  async revisarCuadre(){try{this.cuadre.set(await this.get<CuadreFiscal>('/facturacion/cuadre'));}catch(e){this.mostrarError(e);}}
  readonly sucursal=()=>this.sesion.sucursales().find(s=>s.sucursalId===this.sesion.sucursalActivaId())?.nombre??'Sucursal activa';
  constructor(){void this.cargar();}
  async cargar(){try{this.error.set('');const [p,c,r]=await Promise.all([this.get<Pendiente[]>('/facturacion/pendientes'),this.get<Comprobante[]>('/facturacion/comprobantes'),this.get<Comprobante[]>('/facturacion/conciliacion')]);const intentos=this.asegurarIntentosEmision();for(const v of p){this.tipos[v.pedidoId]??='BOLETA';const solicitud=intentos.leer(v.pedidoId);if(solicitud){this.tipos[v.pedidoId]=String(solicitud['tipo']??this.tipos[v.pedidoId]);this.clienteTipo[v.pedidoId]=String(solicitud['clienteTipoDocumento']??'');this.clienteDoc[v.pedidoId]=String(solicitud['clienteNumeroDocumento']??'');this.clienteNombre[v.pedidoId]=String(solicitud['clienteNombre']??'');}}this.pendientes.set(p);this.comprobantes.set(c);this.conciliacion.set(r);void this.revisarCuadre();if(this.sesion.tienePermiso('CONFIGURACION')){const cfg=await this.get<Config>('/facturacion/configuracion');this.config.set(cfg);this.rutaApi=cfg.rutaApi??'';this.modo=cfg.modo;this.igvTasa=cfg.igvTasa;}}catch(e){this.mostrarError(e);}}
  private get<T>(p:string){return firstValueFrom(this.http.get<T>(`${environment.api}${p}`));}
  private post<T>(p:string,b:unknown){return firstValueFrom(this.http.post<T>(`${environment.api}${p}`,b));}
  produccionConfirmada(){return this.confirmacionProduccion.trim().toUpperCase()==='CONFIRMO PRODUCCION';}
  async guardarConfig(){if(this.modo==='PRODUCCION'&&!this.produccionConfirmada()){this.error.set('Escribe CONFIRMO PRODUCCION y verifica que la ruta y token pertenezcan al entorno productivo.');return;}await this.ejecutar(async()=>{this.config.set(await firstValueFrom(this.http.put<Config>(`${environment.api}/facturacion/configuracion`,{rutaApi:this.rutaApi,token:this.token||null,modo:this.modo,igvTasa:Number(this.igvTasa),configurada:false,confirmacionProduccion:this.confirmacionProduccion})));this.token='';this.confirmacionProduccion='';this.mensaje.set('Configuración fiscal guardada de forma cifrada. Verifica siempre ruta y token en la cuenta Nubefact correspondiente.');});}
  puedeEmitir(v:Pendiente){const t=this.tipos[v.pedidoId]??'BOLETA';return t==='NOTA_VENTA'?this.sesion.tienePermiso('NOTA_VENTA_EMITIR'):this.sesion.tienePermiso('FACTURA_EMITIR');}
  private asegurarIntentosEmision(){const usuario=this.sesion.usuario();const scope=`${usuario?.tenantId??0}:${this.sesion.sucursalActivaId()??0}:${usuario?.usuarioId??0}`;if(!this.intentosEmision||this.scopeIntentos!==scope){this.scopeIntentos=scope;this.intentosEmision=new IntentosIdempotentes(`vf_facturacion_emitir_${scope}`);}return this.intentosEmision;}
  emisionIncierta(v:Pendiente){return this.asegurarIntentosEmision().esIncierto(v.pedidoId);}
  async emitir(v:Pendiente){const intentos=this.asegurarIntentosEmision();const pendiente=intentos.leer(v.pedidoId);const tipo=String(pendiente?.['tipo']??this.tipos[v.pedidoId]??'BOLETA');if(!pendiente&&tipo==='FACTURA'&&(!/^\d{11}$/.test(this.clienteDoc[v.pedidoId]??'')||!(this.clienteNombre[v.pedidoId]??'').trim())){this.error.set('Para emitir factura ingresa RUC y razón social.');return;}
    const body=intentos.obtener(v.pedidoId,()=>({tipo,clienteTipoDocumento:tipo==='FACTURA'?'RUC':this.clienteTipo[v.pedidoId]??null,clienteNumeroDocumento:this.clienteDoc[v.pedidoId]??null,clienteNombre:this.clienteNombre[v.pedidoId]??null,claveIdempotencia:crypto.randomUUID()}));
    await this.ejecutar(async()=>{const tipoSolicitud=String(body['tipo']);const path=tipoSolicitud==='NOTA_VENTA'?`/facturacion/pedidos/${v.pedidoId}/nota-venta`:`/facturacion/pedidos/${v.pedidoId}/electronico`;try{const c=await this.post<Comprobante>(path,body);intentos.completar(v.pedidoId);this.seleccionado.set(c);this.mensaje.set(c.estado==='ACEPTADO'?'Comprobante aceptado por SUNAT.':c.estado==='INTERNO'?'Nota de venta interna emitida.':`Documento ${this.etiquetaEstado(c.estado)}. ${c.mensajeRespuesta??''}`);await this.cargar();}catch(e){const status=(e as HttpErrorResponse).status;if(respuestaOperacionIncierta(status))intentos.marcarIncierto(v.pedidoId);else intentos.completar(v.pedidoId);throw e;}});}
  puedeReenviar(c:Comprobante){return c.estado==='INCIERTO'||c.estado==='ERROR'||(c.estado==='PENDIENTE'&&!!c.enviadoEn&&Date.now()-Date.parse(c.enviadoEn)>=5*60*1000);}
  async reenviar(c:Comprobante){await this.ejecutar(async()=>{const actual=await this.post<Comprobante>(`/facturacion/comprobantes/${c.comprobanteId}/reenviar`,{confirmoAusenciaEnProveedor:!!this.ausenciaConfirmada[c.comprobanteId],ticketSoporte:this.ticketSoporte[c.comprobanteId],motivo:this.motivoReenvio[c.comprobanteId]});this.seleccionado.set(actual);this.mensaje.set(`Reenvío del mismo CPE ${actual.serie}-${actual.numero.toString().padStart(8,'0')}: ${this.etiquetaEstado(actual.estado)}. ${actual.mensajeRespuesta??''}`);await this.cargar();});}
  seleccionar(c:Comprobante){this.seleccionado.set(c);}
  imprimir(){window.print();}
  resumen(items:Linea[]){return items.map(x=>`${x.cantidad} × ${x.descripcion}`).join(' · ');}
  etiquetaEstado(s:string){return ({INTERNO:'INTERNO · NO TRIBUTARIO',PENDIENTE:'PENDIENTE · CONCILIAR',ACEPTADO:'ACEPTADO SUNAT',RECHAZADO:'RECHAZADO',ERROR:'ERROR · VALIDAR',INCIERTO:'RESULTADO INCIERTO · VALIDAR'} as Record<string,string>)[s]??s;}
  private async ejecutar(fn:()=>Promise<void>){this.ocupada.set(true);this.error.set('');this.mensaje.set('');try{await fn();}catch(e){this.mostrarError(e);}finally{this.ocupada.set(false);}}
  private mostrarError(e:unknown){const x=e as HttpErrorResponse;this.error.set(x.error?.mensaje??'No se pudo completar la operación de facturación.');}
}
