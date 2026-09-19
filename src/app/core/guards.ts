import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SesionService } from './sesion';

export const autenticadoGuard: CanActivateFn = () => {
  const s = inject(SesionService);
  const router = inject(Router);
  if (!s.autenticado()) return router.parseUrl('/login');
  if (s.debeCambiarPassword()) return router.parseUrl('/cambiar-password');
  return true;
};

export const superAdminGuard: CanActivateFn = () => {
  const s = inject(SesionService);
  return s.esSuperAdmin() ? true : inject(Router).parseUrl(s.rutaInicio());
};

export const empresaGuard: CanActivateFn = () => {
  const s = inject(SesionService);
  return !s.esSuperAdmin() ? true : inject(Router).parseUrl('/sa/tablero');
};

export const invitadoGuard: CanActivateFn = () => {
  const s = inject(SesionService);
  return s.autenticado() ? inject(Router).parseUrl(s.rutaInicio()) : true;
};

export const cambioPasswordGuard: CanActivateFn = () => {
  const s = inject(SesionService);
  return s.autenticado() ? true : inject(Router).parseUrl('/login');
};

// La ruta exige al menos uno de los permisos (ya recortados por el plan).
export const permisoGuard = (...codigos: string[]): CanActivateFn => () => {
  const s = inject(SesionService);
  return s.tieneAlguno(...codigos) ? true : inject(Router).parseUrl('/inicio');
};
