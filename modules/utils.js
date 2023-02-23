/**
 * Get human-readable 12-hour time from unix time
 * @param {Number} time
 * @param {boolean} showSecs
 */
export function simpleTime(time, showSecs = false) {
  const minutes = ('0' + time.getMinutes()).slice(-2);
  const hours = time.getHours() - (time.getHours() > 12 ? 12 : 0);
  const seconds = showSecs ? `:${('0' + time.getSeconds()).slice(-2)}` : '';
  return `${hours}:${minutes}${seconds}`;
}
