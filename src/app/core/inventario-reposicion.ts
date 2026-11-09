/** Cantidad para alcanzar el objetivo en unidad de compra y precisión admitida. */
export function cantidadCompraParaObjetivo(stockActualBase:number,stockObjetivoBase:number,factorCompraABase:number,cantidadEntranteBase=0):number|null{
  if(!Number.isFinite(stockActualBase)||!Number.isFinite(stockObjetivoBase)||!Number.isFinite(factorCompraABase)
    ||!Number.isFinite(cantidadEntranteBase)||stockObjetivoBase<0||factorCompraABase<=0||cantidadEntranteBase<0)return null;
  const faltanteBase=Math.max(0,stockObjetivoBase-stockActualBase-cantidadEntranteBase);
  if(faltanteBase===0)return 0;
  const cantidad=Math.ceil((faltanteBase/factorCompraABase)*10_000-1e-8)/10_000;
  return Number.isFinite(cantidad)&&cantidad>0&&cantidad<=1_000_000?cantidad:null;
}

/** El faltante queda cubierto por el traslado, pero todavía no está físicamente disponible. */
export function trasladoEntranteCubreObjetivo(stockActualBase:number,stockObjetivoBase:number,cantidadEntranteBase:number):boolean{
  return Number.isFinite(stockActualBase)&&Number.isFinite(stockObjetivoBase)&&Number.isFinite(cantidadEntranteBase)
    &&stockObjetivoBase>=0&&cantidadEntranteBase>0&&stockActualBase<stockObjetivoBase
    &&stockActualBase+cantidadEntranteBase>=stockObjetivoBase;
}
