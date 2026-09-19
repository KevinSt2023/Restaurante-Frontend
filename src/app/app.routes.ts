import { inject } from '@angular/core';
import { Routes } from '@angular/router';
import { autenticadoGuard, cambioPasswordGuard, empresaGuard, invitadoGuard, permisoGuard, superAdminGuard } from './core/guards';
import { SesionService } from './core/sesion';

export const routes: Routes = [
  { path: 'login', canActivate: [invitadoGuard], loadComponent: () => import('./paginas/login').then(m => m.Login), title: 'Ingresar · ValexaFood' },
  { path: 'cambiar-password', canActivate: [cambioPasswordGuard], loadComponent: () => import('./paginas/cambiar-password').then(m => m.CambiarPassword), title: 'Nueva contraseña · ValexaFood' },
  {
    path: '',
    canActivate: [autenticadoGuard],
    loadComponent: () => import('./layout/shell').then(m => m.Shell),
    children: [
      {
        path: 'sa',
        canActivate: [superAdminGuard],
        children: [
          { path: 'tablero', loadComponent: () => import('./paginas/sa/tablero').then(m => m.Tablero), title: 'Tablero · ValexaFood' },
          { path: 'empresas', loadComponent: () => import('./paginas/sa/empresas').then(m => m.Empresas), title: 'Empresas · ValexaFood' },
          { path: 'empresas/nueva', loadComponent: () => import('./paginas/sa/empresa-nueva').then(m => m.EmpresaNueva), title: 'Nueva empresa · ValexaFood' },
          { path: 'empresas/:id', loadComponent: () => import('./paginas/sa/empresa-ficha').then(m => m.EmpresaFicha), title: 'Empresa · ValexaFood' },
          { path: 'cobros', loadComponent: () => import('./paginas/sa/cobros').then(m => m.Cobros), title: 'Cobros · ValexaFood' },
          { path: 'salud', loadComponent: () => import('./paginas/sa/salud').then(m => m.Salud), title: 'Salud · ValexaFood' },
          { path: 'planes', loadComponent: () => import('./paginas/sa/planes').then(m => m.Planes), title: 'Planes · ValexaFood' },
          { path: 'roles', loadComponent: () => import('./paginas/sa/roles').then(m => m.Roles), title: 'Roles y permisos · ValexaFood' },
          { path: 'bitacora', loadComponent: () => import('./paginas/sa/bitacora').then(m => m.BitacoraPagina), title: 'Bitácora · ValexaFood' },
          { path: 'configuracion', loadComponent: () => import('./paginas/sa/configuracion').then(m => m.Configuracion), title: 'Configuración · ValexaFood' },
          { path: '', pathMatch: 'full', redirectTo: 'tablero' },
        ],
      },
      { path: 'inicio', canActivate: [empresaGuard], loadComponent: () => import('./paginas/inicio').then(m => m.Inicio), title: 'Inicio · ValexaFood' },
      {
        path: 'carta',
        canActivate: [empresaGuard],
        children: [
          { path: '', canActivate: [permisoGuard('CARTA_GESTIONAR')], loadComponent: () => import('./paginas/carta/carta').then(m => m.Carta), title: 'Carta · ValexaFood' },
          { path: 'disponibilidad', canActivate: [permisoGuard('CARTA_DISPONIBILIDAD')], loadComponent: () => import('./paginas/carta/disponibilidad').then(m => m.DisponibilidadPagina), title: 'Disponibilidad · ValexaFood' },
          { path: 'platos/nuevo', canActivate: [permisoGuard('CARTA_GESTIONAR')], loadComponent: () => import('./paginas/carta/producto-editor').then(m => m.ProductoEditor), title: 'Nuevo plato · ValexaFood' },
          { path: 'platos/:id', canActivate: [permisoGuard('CARTA_GESTIONAR')], loadComponent: () => import('./paginas/carta/producto-editor').then(m => m.ProductoEditor), title: 'Plato · ValexaFood' },
        ],
      },
      { path: '', pathMatch: 'full', redirectTo: () => inject(SesionService).rutaInicio() },
    ],
  },
  { path: '**', redirectTo: '' },
];
