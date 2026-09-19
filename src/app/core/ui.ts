import { HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import Swal from 'sweetalert2';

// Escapa texto de usuario antes de meterlo en HTML de SweetAlert.
export function esc(v: unknown): string {
  return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

// Mensaje legible de cualquier error HTTP: la API siempre responde { mensaje }.
export function mensajeError(e: unknown): string {
  if (e instanceof HttpErrorResponse) {
    if (e.status === 0) return 'No hay conexión con el servidor. Revisa tu internet e intenta de nuevo.';
    const m = (e.error as { mensaje?: string } | null)?.mensaje;
    if (m) return m;
    if (e.status === 403) return 'No tienes permiso para esta acción.';
    if (e.status === 404) return 'No se encontró lo que buscabas.';
    if (e.status === 429) return 'Demasiados intentos seguidos. Espera un minuto.';
    return 'Ocurrió un error inesperado. Intenta de nuevo.';
  }
  return 'Ocurrió un error inesperado.';
}

@Injectable({ providedIn: 'root' })
export class Ui {
  private toast = Swal.mixin({
    toast: true, position: 'top-end', showConfirmButton: false, timer: 3200, timerProgressBar: true,
  });

  exito(texto: string): void { this.toast.fire({ icon: 'success', titleText: texto }); }
  aviso(texto: string): void { this.toast.fire({ icon: 'warning', titleText: texto, timer: 6000 }); }

  error(e: unknown, titulo = 'No se pudo completar'): void {
    Swal.fire({ icon: 'error', titleText: titulo, text: typeof e === 'string' ? e : mensajeError(e), confirmButtonText: 'Entendido' });
  }

  async confirmar(titulo: string, texto: string, boton = 'Sí, continuar', peligro = false): Promise<boolean> {
    const r = await Swal.fire({
      icon: peligro ? 'warning' : 'question', titleText: titulo, html: texto, showCancelButton: true,
      confirmButtonText: boton, cancelButtonText: 'Cancelar', reverseButtons: true, focusCancel: peligro,
      customClass: peligro ? { confirmButton: '!bg-peligro' } : undefined,
    });
    return r.isConfirmed;
  }

  // Pide un texto obligatorio (motivo de suspensión, anulación...). null si cancela.
  async pedirTexto(titulo: string, etiqueta: string, boton: string, minimo = 5, peligro = false): Promise<string | null> {
    const r = await Swal.fire({
      titleText: titulo, input: 'textarea', inputLabel: etiqueta, inputAttributes: { maxlength: '300' },
      showCancelButton: true, confirmButtonText: boton, cancelButtonText: 'Cancelar', reverseButtons: true,
      customClass: peligro ? { confirmButton: '!bg-peligro' } : undefined,
      inputValidator: v => (!v || v.trim().length < minimo ? `Escribe al menos ${minimo} caracteres.` : null),
    });
    return r.isConfirmed ? (r.value as string).trim() : null;
  }

  // "html" en confirmar(): el llamador escapa con esc() todo dato de usuario.

  // Muestra una contraseña temporal UNA vez, con botón para copiar.
  async mostrarClave(nombre: string, clave: string, detalle: string): Promise<void> {
    await Swal.fire({
      icon: 'info', titleText: `Acceso de ${nombre}`,
      html: `<p style="margin-bottom:.75rem">${esc(detalle)}</p>
             <div style="font:700 1.6rem/1.2 ui-monospace,monospace;letter-spacing:.08em;padding:.9rem;border-radius:.75rem;background:rgb(var(--vf-elevada));border:1px dashed rgb(var(--vf-oro))">${esc(clave)}</div>`,
      showCancelButton: true, confirmButtonText: 'Copiar y cerrar', cancelButtonText: 'Cerrar',
      preConfirm: () => navigator.clipboard?.writeText(clave).catch(() => undefined),
    });
  }
}
