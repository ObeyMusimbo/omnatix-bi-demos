/*
  ask.js is shared, byte for byte, with the four warehouse demos, which take esc from their
  chart library. The hub's own charts are a plain script, so esc is supplied here.
*/
export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
