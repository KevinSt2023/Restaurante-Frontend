/** @type {import('tailwindcss').Config} */
const token = (v) => `rgb(var(--vf-${v}) / <alpha-value>)`;
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  darkMode: ['class', ":root[data-theme='oscuro'] &"],
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
        // Marca tomada del logotipo: marino #0D1C30 y naranja #FA6307 → ámbar #FEA202.
        marino: { DEFAULT: token('marino'), claro: token('marino-claro'), oscuro: token('marino-oscuro') },
        naranja: { DEFAULT: token('naranja'), claro: token('naranja-claro'), oscuro: token('naranja-oscuro') },
        tinta: token('tinta'),
        exito: token('exito'),
        alerta: token('alerta'),
        peligro: token('peligro'),
        info: token('info'),
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans Variable"', 'system-ui', 'sans-serif'],
      },
      // Escala táctil. `toque` (48 px) es el mínimo de cualquier control;
      // `mesa` y `pago` son para los mosaicos que se tocan de pie y con prisa.
      minHeight: { toque: '3rem', mesa: '7rem', pago: '5.5rem' },
      minWidth: { toque: '3rem' },
      boxShadow: {
        tarjeta: '0 1px 2px rgb(13 28 48 / 0.05), 0 4px 16px rgb(13 28 48 / 0.07)',
        flotante: '0 12px 40px rgb(8 17 29 / 0.22)',
        menu: '0 10px 38px rgb(8 17 29 / 0.16), 0 2px 8px rgb(8 17 29 / 0.08)',
      },
      keyframes: {
        'entrar-menu': {
          from: { opacity: '0', transform: 'translateY(-6px) scale(0.98)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
      },
      animation: { 'entrar-menu': 'entrar-menu .14s ease-out' },
    },
  },
  plugins: [],
};
