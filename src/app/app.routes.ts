import { inject } from '@angular/core';
import { Routes } from '@angular/router';
import { autenticadoGuard, cambioPasswordGuard, empresaGuard, invitadoGuard, permisoGuard, superAdminGuard } from './core/guards';
import { SesionService } from './core/sesion';

export const routes: Routes = [
  { path: 'login', canActivate: [invitadoGuard], loadComponent: () => import('./paginas/login').then(m => m.Login), title: 'Ingresar · Valexa' },
  { path: 'cambiar-password', canActivate: [cambioPasswordGuard], loadComponent: () => import('./paginas/cambiar-password').then(m => m.CambiarPassword), title: 'Nueva contraseña · Valexa' },
  {
    path: '',
    canActivate: [autenticadoGuard],
    loadComponent: () => import('./layout/shell').then(m => m.Shell),
    children: [
      {
        path: 'sa',
        canActivate: [superAdminGuard],
        children: [
          { path: 'tablero', loadComponent: () => import('./paginas/sa/tablero').then(m => m.Tablero), title: 'Tablero · Valexa' },
          { path: 'empresas', loadComponent: () => import('./paginas/sa/empresas').then(m => m.Empresas), title: 'Empresas · Valexa' },
          { path: 'empresas/nueva', loadComponent: () => import('./paginas/sa/empresa-nueva').then(m => m.EmpresaNueva), title: 'Nueva empresa · Valexa' },
          { path: 'empresas/:id', loadComponent: () => import('./paginas/sa/empresa-ficha').then(m => m.EmpresaFicha), title: 'Empresa · Valexa' },
          { path: 'cobros', loadComponent: () => import('./paginas/sa/cobros').then(m => m.Cobros), title: 'Cobros · Valexa' },
          { path: 'salud', loadComponent: () => import('./paginas/sa/salud').then(m => m.Salud), title: 'Salud · Valexa' },
          { path: 'planes', loadComponent: () => import('./paginas/sa/planes').then(m => m.Planes), title: 'Planes · Valexa' },
          { path: 'roles', loadComponent: () => import('./paginas/sa/roles').then(m => m.Roles), title: 'Roles y permisos · Valexa' },
          { path: 'bitacora', loadComponent: () => import('./paginas/sa/bitacora').then(m => m.BitacoraPagina), title: 'Bitácora · Valexa' },
          { path: 'configuracion', loadComponent: () => import('./paginas/sa/configuracion').then(m => m.Configuracion), title: 'Configuración · Valexa' },
          { path: '', pathMatch: 'full', redirectTo: 'tablero' },
        ],
      },
      { path: 'inicio', canActivate: [empresaGuard], loadComponent: () => import('./paginas/inicio').then(m => m.Inicio), title: 'Inicio · Valexa' },
      { path: 'caja', canActivate: [empresaGuard, permisoGuard('CAJA_ABRIR_CERRAR')], loadComponent: () => import('./paginas/caja').then(m => m.CajaPagina), title: 'Caja y turnos · Valexa' },
      { path: 'facturacion', canActivate: [empresaGuard, permisoGuard('NOTA_VENTA_EMITIR', 'FACTURA_EMITIR')], loadComponent: () => import('./paginas/facturacion').then(m => m.FacturacionPagina), title: 'Comprobantes · Valexa' },
      { path: 'operacion', canActivate: [empresaGuard, permisoGuard('SALON_VER', 'COCINA_VER')], loadComponent: () => import('./paginas/operacion').then(m => m.OperacionPagina), title: 'Salón y pedidos · Valexa' },
      // Cocina es la misma pantalla abierta directo en su vista: el cocinero entra
      // a lo suyo sin pasar por el salón, y la lógica sigue siendo una sola.
      { path: 'cocina', canActivate: [empresaGuard, permisoGuard('COCINA_VER')], data: { vista: 'cocina' }, loadComponent: () => import('./paginas/operacion').then(m => m.OperacionPagina), title: 'Cocina · Valexa' },
      { path: 'reportes/ventas', canActivate: [empresaGuard, permisoGuard('REPORTES_BASICOS')], loadComponent: () => import('./paginas/reportes-ventas').then(m => m.ReportesVentasPagina), title: 'Ventas del día · Valexa' },
      { path: 'equipo', canActivate: [empresaGuard, permisoGuard('USUARIOS_GESTIONAR')], loadComponent: () => import('./paginas/equipo').then(m => m.EquipoPagina), title: 'Tu equipo · Valexa' },
      {
        path: 'delivery',
        canActivate: [empresaGuard],
        children: [
          { path: 'despacho', canActivate: [permisoGuard('DELIVERY_ASIGNAR')], loadComponent: () => import('./paginas/delivery/despacho').then(m => m.DespachoPagina), title: 'Despacho · Valexa' },
          { path: 'mis-envios', canActivate: [permisoGuard('DELIVERY_REPARTIR')], loadComponent: () => import('./paginas/delivery/mis-envios').then(m => m.MisEnviosPagina), title: 'Mis envíos · Valexa' },
          { path: '', pathMatch: 'full', redirectTo: 'despacho' },
        ],
      },
      { path: 'inventario', canActivate: [empresaGuard, permisoGuard('INVENTARIO_VER', 'INVENTARIO_GESTIONAR')], loadComponent: () => import('./paginas/inventario').then(m => m.InventarioPagina), title: 'Inventario y recetas · Valexa' },
      {
        path: 'carta',
        canActivate: [empresaGuard],
        children: [
          { path: '', canActivate: [permisoGuard('CARTA_GESTIONAR')], loadComponent: () => import('./paginas/carta/carta').then(m => m.Carta), title: 'Carta · Valexa' },
          { path: 'disponibilidad', canActivate: [permisoGuard('CARTA_DISPONIBILIDAD')], loadComponent: () => import('./paginas/carta/disponibilidad').then(m => m.DisponibilidadPagina), title: 'Disponibilidad · Valexa' },
          { path: 'platos/nuevo', canActivate: [permisoGuard('CARTA_GESTIONAR')], loadComponent: () => import('./paginas/carta/producto-editor').then(m => m.ProductoEditor), title: 'Nuevo plato · Valexa' },
          { path: 'platos/:id', canActivate: [permisoGuard('CARTA_GESTIONAR')], loadComponent: () => import('./paginas/carta/producto-editor').then(m => m.ProductoEditor), title: 'Plato · Valexa' },
        ],
      },
      { path: '', pathMatch: 'full', redirectTo: () => inject(SesionService).rutaInicio() },
    ],
  },
  { path: '**', redirectTo: '' },
];
