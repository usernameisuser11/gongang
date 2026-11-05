export const ROOM_CAPACITY = 8;
export const MAX_STATE_BYTES = 1024;

const poses = new Set(['idle', 'walk', 'sit', 'lie']);
const encoder = new TextEncoder();

export function parsePresenceState(message) {
  if (typeof message !== 'string' || message.length > MAX_STATE_BYTES
    || encoder.encode(message).byteLength > MAX_STATE_BYTES) return null;

  let input;
  try { input = JSON.parse(message); } catch { return null; }
  if (input?.type !== 'state' || !poses.has(input.pose)) return null;

  const { x, z, yaw, pose, gesture = 0, signal = 0 } = input;
  if (![x, z, yaw].every(Number.isFinite) || Math.abs(x) > 10000 || Math.abs(z) > 10000) return null;
  if (![gesture, signal].every(value => Number.isSafeInteger(value) && value >= 0)) return null;
  return { x, z, yaw: yaw % (2 * Math.PI), pose, gesture, signal };
}
