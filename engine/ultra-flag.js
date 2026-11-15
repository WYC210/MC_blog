// 超清模式 / Ultra mode: an opt-in look for fast desktop GPUs (planar water
// reflections, HDR post-processing, ambient occlusion, light shafts, bloom).
// It is off unless the URL carries ?ultra (?ultra=0 forces it off). Every module
// reads this one constant, so normal mode compiles exactly as before.
function read() {
  try {
    const query = new URLSearchParams(location.search);
    if (query.has('ultra')) return query.get('ultra') !== '0';
    return false;
  } catch { return false; }
}

export const ULTRA = read();

export function switchUltra(on, failed = false) {
  const url = new URL(location.href);
  url.searchParams.delete('ultra');
  url.searchParams.delete('quality-fallback');
  if (on) url.searchParams.set('ultra', '1');
  if (failed) url.searchParams.set('quality-fallback', '1');
  location.replace(url.href);
}

export function supportsUltra(renderer) {
  const context = renderer.getContext();
  return typeof context.texImage3D === 'function' && !!context.getExtension('EXT_color_buffer_float');
}
