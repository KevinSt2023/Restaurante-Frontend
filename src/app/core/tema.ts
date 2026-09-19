import { Injectable, signal } from '@angular/core';

export type Tema = 'claro' | 'oscuro' | 'sistema';

@Injectable({ providedIn: 'root' })
export class TemaService {
  readonly tema = signal<Tema>(this.leer());
  private media = window.matchMedia('(prefers-color-scheme: dark)');
  readonly oscuroEfectivo = signal(this.calcular());

  constructor() {
    this.aplicar();
    this.media.addEventListener('change', () => this.oscuroEfectivo.set(this.calcular()));
  }

  alternar(): void {
    this.fijar(this.oscuroEfectivo() ? 'claro' : 'oscuro');
  }

  fijar(t: Tema): void {
    this.tema.set(t);
    try { t === 'sistema' ? localStorage.removeItem('vf_tema') : localStorage.setItem('vf_tema', t); } catch { /* sin almacenamiento */ }
    this.aplicar();
  }

  private aplicar(): void {
    const t = this.tema();
    if (t === 'sistema') delete document.documentElement.dataset['theme'];
    else document.documentElement.dataset['theme'] = t;
    this.oscuroEfectivo.set(this.calcular());
  }

  private calcular(): boolean {
    const t = this.tema();
    return t === 'oscuro' || (t === 'sistema' && this.media.matches);
  }

  private leer(): Tema {
    try {
      const v = localStorage.getItem('vf_tema');
      return v === 'claro' || v === 'oscuro' ? v : 'sistema';
    } catch {
      return 'sistema';
    }
  }
}
