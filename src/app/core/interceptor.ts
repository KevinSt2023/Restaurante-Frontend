import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { SesionService } from './sesion';

// La carta publica no lleva token ni sucursal: la abre un comensal, y el dueno
// que la mire desde su propia sesion no tiene por que mandar su JWT ahi.
const SIN_TOKEN = ['/auth/login', '/auth/refresh', '/auth/logout', '/publico/'];

const conToken = (req: HttpRequest<unknown>, token: string | null) =>
  token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

const conSucursal = (req: HttpRequest<unknown>, sucursalId: number | null) =>
  sucursalId == null ? req : req.clone({ setHeaders: { 'X-Sucursal-Id': String(sucursalId) } });

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const sesion = inject(SesionService);
  if (SIN_TOKEN.some(r => req.url.includes(r))) return next(req);

  return next(conSucursal(conToken(req, sesion.token()), sesion.sucursalActivaId())).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status !== 401 || !sesion.autenticado()) return throwError(() => error);

      const motivo = decodeURIComponent(error.headers?.get('X-Sesion-Motivo') ?? '');
      if (error.headers?.get('X-Plan-Vencido')) {
        sesion.cerrarSesion('El plan de tu empresa venció. Renueva para seguir usando Valexa.');
        return throwError(() => error);
      }
      if (motivo === 'Empresa suspendida' || motivo === 'Usuario inactivo') {
        sesion.cerrarSesion(motivo === 'Usuario inactivo' ? 'Tu usuario fue desactivado.' : 'El servicio de tu empresa está suspendido.');
        return throwError(() => error);
      }

      // Token vencido (o sesión cerrada): se intenta un refresh una sola vez.
      return from(sesion.refrescar()).pipe(
        switchMap(nuevo => {
          if (!nuevo) {
            sesion.cerrarSesion(motivo === 'Sesión cerrada' ? 'Tu sesión se cerró desde administración. Vuelve a ingresar.' : 'Tu sesión expiró. Vuelve a ingresar.');
            return throwError(() => error);
          }
          return next(conSucursal(conToken(req, nuevo), sesion.sucursalActivaId()));
        })
      );
    })
  );
};
