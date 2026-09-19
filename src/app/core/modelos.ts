// Tipos de la API. Espejo de los DTO de ValexaFood.Application (camelCase).

export interface UsuarioSesion {
  usuarioId: number; nombre: string; email: string; rolId: number; rolNombre: string;
  tenantId: number | null; empresa: string | null; sucursalId: number | null; sucursal: string | null;
  debeCambiarPassword: boolean;
}
export interface PlanSesion { planId: number; nombre: string; vencimiento: string | null; diasParaVencer: number | null; }
export interface Sesion {
  token: string; refreshToken: string; usuario: UsuarioSesion; permisos: string[]; funciones: string[];
  rolesQueOpera: number[]; plan: PlanSesion | null;
}

export interface Cupo { rolId: number; rolNombre: string; maximo: number; }
export interface Plan {
  planId: number; nombre: string; descripcion: string; precioMensual: number; precioAnual: number | null;
  maxSucursales: number; maxUsuarios: number; adminAcumula: number[]; cupos: Cupo[]; funciones: string[];
  destacado: boolean; orden: number; activo: boolean; empresas: number; empresasActivas: number;
}
export interface PlanGuardar {
  nombre: string; descripcion: string; precioMensual: number; precioAnual: number | null;
  maxSucursales: number; maxUsuarios: number; adminAcumula: number[]; cupos: { rolId: number; maximo: number }[];
  funciones: string[]; destacado: boolean; orden: number; activo: boolean; confirmarExcedidas?: boolean;
}
export interface EmpresaExcedida { tenantId: number; nombre: string; problemas: string[]; }

export type EstadoCobranza = 'AL_DIA' | 'POR_VENCER' | 'VENCIDA' | 'SUSPENDIDA' | 'SIN_PLAN' | 'SIN_VENCIMIENTO';

export interface EmpresaLista {
  tenantId: number; nombreComercial: string; razonSocial: string | null; ruc: string | null; tipoServicio: string;
  telefono: string | null; planId: number | null; planNombre: string | null; activo: boolean; vencimiento: string | null;
  diasParaVencer: number | null; estadoCobranza: EstadoCobranza; sucursales: number; maxSucursales: number;
  usuarios: number; maxUsuarios: number; excede: boolean; ultimoAcceso: string | null; createdAt: string;
}
export interface UsoRol { rolId: number; rol: string; usados: number; maximo: number | null; permitido: boolean; }
export interface Sucursal {
  sucursalId: number; nombre: string; direccion: string | null; telefono: string | null; esPrincipal: boolean;
  activo: boolean; usuarios: number; createdAt: string;
}
export interface UsuarioEmpresa {
  usuarioId: number; nombre: string; email: string; dni: string | null; telefono: string | null; rolId: number;
  rol: string; sucursalId: number | null; sucursal: string | null; activo: boolean; bloqueado: boolean;
  bloqueadoHasta: string | null; debeCambiarPassword: boolean; ultimoLogin: string | null; createdAt: string;
}
export interface EmpresaDetalle {
  tenantId: number; nombreComercial: string; razonSocial: string | null; ruc: string | null; rucValido: boolean;
  direccion: string | null; telefono: string | null; email: string | null; contactoNombre: string | null;
  tipoServicio: string; activo: boolean; motivoSuspension: string | null; fechaSuspension: string | null;
  notasInternas: string | null; createdAt: string; plan: Plan | null; planFechaInicio: string | null;
  vencimiento: string | null; diasParaVencer: number | null; estadoCobranza: EstadoCobranza;
  sucursalesActivas: number; usuariosOperativos: number; usoPorRol: UsoRol[]; excesos: string[];
  sucursalesLista: Sucursal[]; usuariosLista: UsuarioEmpresa[]; ultimoAcceso: string | null; celularPeru: boolean;
}
export interface EmpresaDatos {
  nombreComercial: string; razonSocial: string | null; ruc: string | null; direccion: string | null;
  telefono: string | null; email: string | null; contactoNombre: string | null; tipoServicio: string;
}
export interface RegistrarMovimiento {
  tipo: 'PAGO' | 'CORTESIA'; meses: number; monto: number; metodoPago: string | null; numeroOperacion: string | null;
  fechaPago: string | null; comprobante: string | null; observacion: string | null;
}
export interface EmpresaCrear extends EmpresaDatos {
  planId: number; sucursalNombre: string; sucursalDireccion: string | null;
  admin: { nombre: string; email: string; dni: string | null; telefono: string | null; password: string | null };
  primerCobro: RegistrarMovimiento;
}
export interface PasswordTemporal { passwordTemporal: string; mensaje: string; }
export interface UsuarioGuardar {
  nombre: string; email: string; dni: string | null; telefono: string | null; rolId: number; sucursalId: number | null;
  password: string | null;
}
export interface Acceso { accesoId: number; email: string; usuario: string | null; exito: boolean; motivo: string | null; ip: string | null; fecha: string; }

export interface Movimiento {
  movimientoId: number; tenantId: number; empresa: string; tipo: 'PAGO' | 'CORTESIA'; planId: number; planNombre: string;
  precioReferencial: number; meses: number; monto: number; montoSinIgv: number; descuentoPct: number;
  metodoPago: string | null; numeroOperacion: string | null; fechaPago: string; comprobante: string | null;
  observacion: string | null; venceAntes: string | null; venceDespues: string; registradoPor: string; fechaRegistro: string;
  estado: 'VIGENTE' | 'ANULADO'; motivoAnulacion: string | null; anuladoPor: string | null; fechaAnulacion: string | null;
  anulable: boolean;
}
export interface SugerenciaCobro {
  tenantId: number; empresa: string; planNombre: string | null; precioMensual: number; precioAnual: number | null;
  meses: number; precioLista: number; bienvenidaDisponible: boolean; descuentoBienvenidaPct: number;
  montoSugerido: number; venceActual: string | null; venceraHasta: string;
}
export interface Cobranza {
  tenantId: number; nombre: string; ruc: string | null; telefono: string | null; email: string | null; activo: boolean;
  planId: number | null; planNombre: string | null; precioMensual: number | null; precioAnual: number | null;
  vencimiento: string | null; diasParaVencer: number | null; estado: EstadoCobranza; ultimoPagoFecha: string | null;
  ultimoPagoMonto: number | null; pagado12Meses: number; celularPeru: boolean; bienvenidaDisponible: boolean;
}
export interface TableroAlerta { tenantId: number; empresa: string; plan: string | null; vencimiento: string | null; dias: number | null; detalle: string; }
export interface Tablero {
  hoy: string; ingresoRecurrente: number; ingresoRecurrenteSinIgv: number; ticketPromedio: number;
  cobradoMes: number; cobradoMesSinIgv: number; cobradoMesAnterior: number; variacionPct: number | null;
  descuentosMes: number; empresas: number; alDia: number; porVencer: number; vencidas: number; suspendidas: number;
  sinPlan: number; altasMes: number; bajasMes: number; usuariosActivos: number; sucursalesActivas: number;
  serie: { mes: string; cobrado: number; altas: number }[];
  porPlan: { planId: number; plan: string; empresas: number; ingresoMensual: number }[];
  porVencerLista: TableroAlerta[]; vencidasLista: TableroAlerta[]; excedidas: TableroAlerta[];
}

export interface Hallazgo { area: 'USO' | 'DATOS'; severidad: Nivel; titulo: string; detalle: string; queHacer: string; }
export type Nivel = 'CRITICO' | 'ATENCION' | 'INFO' | 'OK';
export interface SaludEmpresa {
  tenantId: number; empresa: string; plan: string | null; activo: boolean; estadoCobranza: EstadoCobranza;
  nivelUso: Nivel; nivelDatos: Nivel; nivelGeneral: Nivel; ultimoAcceso: string | null; diasSinAcceso: number | null;
  accesos7Dias: number; fallidos24h: number; usuariosActivos: number; celularPeru: boolean; telefono: string | null;
  hallazgos: Hallazgo[];
}

export interface Bitacora {
  bitacoraId: number; tenantId: number | null; empresa: string | null; usuarioId: number | null; usuarioNombre: string;
  rolId: number | null; accion: string; entidad: string; entidadId: string | null; detalle: string; ip: string | null; fecha: string;
}
export interface Pagina<T> { items: T[]; total: number; pagina: number; tamanoPagina: number; }

export interface Rol { rolId: number; nombre: string; descripcion: string; veDinero: boolean; ocupaCupo: boolean; orden: number; usuariosActivos: number; }
export interface Funcion { codigo: string; nombre: string; descripcion: string; grupo: string; orden: number; planesIds: number[]; }
export interface Permiso {
  permisoId: number; codigo: string; nombre: string; modulo: string; descripcion: string;
  funcionRequerida: string | null; funcionNombre: string | null; roles: number[];
}
export interface MatrizPermisos { roles: Rol[]; permisos: Permiso[]; }
export interface ConfiguracionSaas { whatsappVentas: string | null; emailSoporte: string | null; descuentoBienvenidaPct: number; diasPorVencer: number; }

export const ROLES = { SUPERADMIN: 0, ADMIN: 1, CAJERO: 2, COCINERO: 3, MESERO: 4, DELIVERY: 5 } as const;

export const METODOS_PAGO: { valor: string; texto: string }[] = [
  { valor: 'YAPE_PLIN', texto: 'Yape / Plin' },
  { valor: 'TRANSFERENCIA', texto: 'Transferencia' },
  { valor: 'DEPOSITO', texto: 'Depósito' },
  { valor: 'TARJETA', texto: 'Tarjeta' },
  { valor: 'EFECTIVO', texto: 'Efectivo' },
];

export const TIPOS_SERVICIO: { valor: string; texto: string }[] = [
  { valor: 'RESTAURANTE', texto: 'Restaurante' }, { valor: 'CEVICHERIA', texto: 'Cevichería' },
  { valor: 'POLLERIA', texto: 'Pollería' }, { valor: 'CHIFA', texto: 'Chifa' },
  { valor: 'CAFETERIA', texto: 'Cafetería' }, { valor: 'FAST_FOOD', texto: 'Comida rápida' },
  { valor: 'PIZZERIA', texto: 'Pizzería' }, { valor: 'BAR', texto: 'Bar' }, { valor: 'OTRO', texto: 'Otro' },
];
