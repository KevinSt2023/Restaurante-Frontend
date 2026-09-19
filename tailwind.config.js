/** @type {import('tailwindcss').Config} */
const token = (v) => `rgb(var(--vf-${v}) / <alpha-value>)`;
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  theme: {
    extend: {
      colors: {
        fondo: token('fondo'),
        superficie: token('superficie'),
        elevada: token('elevada'),
        borde: token('borde'),
        texto: token('texto'),
        suave: token('suave'),
        tenue: token('tenue'),
        vino: { DEFAULT: token('vino'), claro: token('vino-claro'), oscuro: token('vino-oscuro') },
        oro: { DEFAULT: token('oro'), claro: token('oro-claro'), oscuro: token('oro-oscuro') },
        tinta: token('tinta'),
        exito: token('exito'),
        alerta: token('alerta'),
        peligro: token('peligro'),
        info: token('info'),
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans Variable"', 'system-ui', 'sans-serif'],
        marca: ['Cinzel', 'Georgia', 'serif'],
      },
      minHeight: { toque: '3rem' },
      minWidth: { toque: '3rem' },
      boxShadow: {
        tarjeta: '0 1px 2px rgb(0 0 0 / 0.04), 0 4px 16px rgb(0 0 0 / 0.06)',
        flotante: '0 12px 40px rgb(0 0 0 / 0.18)',
      },
    },
  },
  plugins: [],
};
