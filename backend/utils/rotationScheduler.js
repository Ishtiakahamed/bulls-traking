/**
 * Bulls Traking — Deterministic 24-Hour UTC Rotation Scheduler
 * 
 * Provides synchronized, deterministic rotation for banners and promoted tokens.
 * Business Rules:
 * - Timezone: Strictly UTC based (independent of client/browser local timezone)
 * - 1 active item: 24h duration (Index 0)
 * - 2 active items: 12h duration each (00:00-12:00 UTC, 12:00-24:00 UTC)
 * - 3 active items: 8h duration each (00:00-08:00 UTC, 08:00-16:00 UTC, 16:00-24:00 UTC)
 * - N active items: (24 / N) hours nominal duration with minSlotMinutes protection
 * - Reloading does not reset the schedule; current UTC wall-clock time determines the active slot
 */

function getRotationSlot(options = {}) {
  const {
    items = [],
    nowUtc = new Date(),
    cycleHours = 24,
    minSlotMinutes = 0
  } = options;

  const validItems = Array.isArray(items) ? items : [];
  const N = validItems.length;

  if (N === 0) {
    return {
      activeItem: null,
      activeSlotIndex: -1,
      slotDurationMinutes: 0,
      slotDurationHours: 0,
      slotStart: null,
      slotEnd: null,
      cycleHours,
      totalItems: 0,
      timezone: 'UTC'
    };
  }

  const date = nowUtc instanceof Date ? nowUtc : new Date(nowUtc);
  const validTimestamp = isNaN(date.getTime()) ? new Date() : date;

  const year = validTimestamp.getUTCFullYear();
  const month = validTimestamp.getUTCMonth();
  const day = validTimestamp.getUTCDate();
  const utcMidnight = Date.UTC(year, month, day);

  const secondsSinceMidnight = 
    validTimestamp.getUTCHours() * 3600 +
    validTimestamp.getUTCMinutes() * 60 +
    validTimestamp.getUTCSeconds();

  if (N === 1) {
    const totalSeconds = cycleHours * 3600;
    const slotStartDate = new Date(utcMidnight);
    const slotEndDate = new Date(utcMidnight + totalSeconds * 1000);

    return {
      activeItem: validItems[0],
      activeSlotIndex: 0,
      slotDurationMinutes: cycleHours * 60,
      slotDurationHours: cycleHours,
      slotStart: slotStartDate.toISOString(),
      slotEnd: slotEndDate.toISOString(),
      cycleHours,
      totalItems: 1,
      timezone: 'UTC'
    };
  }

  const rawSlotSeconds = Math.floor((cycleHours * 3600) / N);
  const minRequiredSeconds = minSlotMinutes * 60;
  const slotDurationSeconds = Math.max(minRequiredSeconds, rawSlotSeconds);

  const activeSlotIndex = Math.floor(secondsSinceMidnight / slotDurationSeconds) % N;
  const slotStartSec = activeSlotIndex * slotDurationSeconds;
  const slotEndSec = (activeSlotIndex + 1) * slotDurationSeconds;

  const slotStartDate = new Date(utcMidnight + slotStartSec * 1000);
  const slotEndDate = new Date(utcMidnight + slotEndSec * 1000);

  return {
    activeItem: validItems[activeSlotIndex] || null,
    activeSlotIndex,
    slotDurationMinutes: Math.floor(slotDurationSeconds / 60),
    slotDurationHours: Number((slotDurationSeconds / 3600).toFixed(2)),
    slotStart: slotStartDate.toISOString(),
    slotEnd: slotEndDate.toISOString(),
    cycleHours,
    totalItems: N,
    timezone: 'UTC'
  };
}

module.exports = {
  getRotationSlot
};
