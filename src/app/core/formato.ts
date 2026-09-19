import { Pipe, PipeTransform } from '@angular/core';
import { EstadoCobranza, Nivel } from './modelos';

const ZONA = 'America/Lima';
const soles = new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fechaCorta = new Intl.DateTimeFormat('es-PE', { day: '2-digit', month: 'short', year: 'numeric', timeZone: ZONA });
const fechaHora = new Intl.DateTimeFormat('es-PE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: ZONA });

// "2026-10-18" es un día calendario: se lee tal cual, sin zona horaria.
function deFecha(v: string): Date {
  const [a, m, d] = v.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d, 12));
}

export const fmt = {
  soles: (v: number | null | undefined) => (v == null ? '—' : `S/ ${soles.format(v)}`),
  fecha: (v: string | null | undefined) => (v ? fechaCorta.format(v.length <= 10 ? deFecha(v) : new Date(v)) : '—'),
  fechaHora: (v: string | null | undefined) => (v ? fechaHora.format(new Date(v)) : '—'),
  relativo(v: string | null | undefined): string {
    if (!v) return 'nunca';
    const min = Math.round((Date.now() - new Date(v).getTime()) / 60000);
    if (min < 1) return 'hace un momento';
    if (min < 60) return `hace ${min} min`;
    const h = Math.round(min / 60);
    if (h < 24) return `hace ${h} h`;
    const d = Math.round(h / 24);
    if (d < 30) return `hace ${d} día${d === 1 ? '' : 's'}`;
    const mes = Math.round(d / 30);
    return `hace ${mes} mes${mes === 1 ? '' : 'es'}`;
  },
  hoyLima(): string {
    return new Intl.DateTimeFormat('en-CA', { timeZone: ZONA }).format(new Date());
  },
  mes(v: string): string {
    return new Intl.DateTimeFormat('es-PE', { month: 'short', timeZone: 'UTC' }).format(deFecha(`${v}-01`)).replace('.', '');
  },
};

@Pipe({ name: 'soles' }) export class SolesPipe implements PipeTransform { transform(v: number | null | undefined) { return fmt.soles(v); } }
@Pipe({ name: 'fecha' }) export class FechaPipe implements PipeTransform { transform(v: string | null | undefined) { return fmt.fecha(v); } }
@Pipe({ name: 'fechaHora' }) export class FechaHoraPipe implements PipeTransform { transform(v: string | null | undefined) { return fmt.fechaHora(v); } }
@Pipe({ name: 'relativo' }) export class RelativoPipe implements PipeTransform { transform(v: string | null | undefined) { return fmt.relativo(v); } }

export const ESTADOS: Record<EstadoCobranza, { texto: string; chip: string }> = {
  AL_DIA: { texto: 'Al día', chip: 'chip-exito' },
  POR_VENCER: { texto: 'Por vencer', chip: 'chip-alerta' },
  VENCIDA: { texto: 'Vencida', chip: 'chip-peligro' },
  SUSPENDIDA: { texto: 'Suspendida', chip: 'chip-neutro' },
  SIN_PLAN: { texto: 'Sin plan', chip: 'chip-peligro' },
  SIN_VENCIMIENTO: { texto: 'Sin vencimiento', chip: 'chip-info' },
};

export const NIVELES: Record<Nivel, { texto: string; chip: string; punto: string }> = {
  CRITICO: { texto: 'Crítico', chip: 'chip-peligro', punto: 'bg-peligro' },
  ATENCION: { texto: 'Atención', chip: 'chip-alerta', punto: 'bg-alerta' },
  INFO: { texto: 'Info', chip: 'chip-info', punto: 'bg-info' },
  OK: { texto: 'Bien', chip: 'chip-exito', punto: 'bg-exito' },
};

// Enlace wa.me con el mensaje ya escrito (celular peruano de 9 dígitos).
export function enlaceWhatsapp(celular: string, mensaje: string): string {
  return `https://wa.me/51${celular}?text=${encodeURIComponent(mensaje)}`;
}
