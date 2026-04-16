/**
 * Calendar boundary alignment and stepping for X-axis tick generation.
 *
 * Provides functions to align timestamps to calendar boundaries (year,
 * quarter, month, week, day, hour) and step forward to the next boundary.
 *
 * @module calendarBoundaries
 */

const MS_PER_HOUR = 3_600_000;
const MS_PER_DAY = 86_400_000;
const MS_PER_WEEK = 7 * MS_PER_DAY;

export const WEEK_START_DAY = 0; // Sunday for forex

export function nextYear(d)    { return new Date(Date.UTC(d.getUTCFullYear() + 1, 0, 1)); }
export function nextQuarter(d) { return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 3, 1)); }
export function nextMonth(d)   { return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)); }
export function nextWeek(d)    { return new Date(d.getTime() + MS_PER_WEEK); }
export function nextDay(d)     { return new Date(d.getTime() + MS_PER_DAY); }
export function nextHour(d)    { return new Date(d.getTime() + MS_PER_HOUR); }

export const BOUNDARY_STEP = {
  YEAR: nextYear, QUARTER: nextQuarter, MONTH: nextMonth,
  WEEK: nextWeek, DAY: nextDay, HOUR: nextHour,
};

export function alignToBoundary(fromTs, boundaryType) {
  const d = new Date(fromTs);
  switch (boundaryType) {
    case 'YEAR':    return new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    case 'QUARTER': {
      const qMonth = Math.floor(d.getUTCMonth() / 3) * 3;
      return new Date(Date.UTC(d.getUTCFullYear(), qMonth, 1));
    }
    case 'MONTH':   return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
    case 'WEEK': {
      d.setUTCHours(0, 0, 0, 0);
      const dow = d.getUTCDay();
      const daysToSunday = (WEEK_START_DAY - dow + 7) % 7;
      d.setUTCDate(d.getUTCDate() + daysToSunday);
      return d;
    }
    case 'DAY': {
      d.setUTCHours(0, 0, 0, 0);
      return d;
    }
    case 'HOUR': {
      d.setUTCMinutes(0, 0, 0);
      return d;
    }
    default: return d;
  }
}

export const RANK = { YEAR: 1, QUARTER: 2, MONTH: 3, WEEK: 4, DAY: 5, HOUR: 6 };

export function formatBoundaryLabel(ts, rank, prevTs) {
  const SHORT_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const d = new Date(ts);
  const prev = prevTs != null ? new Date(prevTs) : null;
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth();
  const day = d.getUTCDate();
  const hours = String(d.getUTCHours()).padStart(2, '0');
  const mins = String(d.getUTCMinutes()).padStart(2, '0');
  const pad2 = n => String(n).padStart(2, '0');

  switch (rank) {
    case RANK.YEAR:
      return String(year);
    case RANK.QUARTER: {
      const q = Math.floor(month / 3) + 1;
      const label = `Q${q}`;
      if (!prev || prev.getUTCFullYear() !== year) return `${label} ${year}`;
      return label;
    }
    case RANK.MONTH: {
      const label = SHORT_MONTHS[month];
      if (!prev || prev.getUTCFullYear() !== year) return `${label} ${year}`;
      return label;
    }
    case RANK.WEEK: {
      const dayLabel = pad2(day);
      const monthLabel = `${dayLabel} ${SHORT_MONTHS[month]}`;
      if (!prev || prev.getUTCFullYear() !== year) return `${monthLabel} ${year}`;
      if (prev.getUTCMonth() !== month) return monthLabel;
      return dayLabel;
    }
    case RANK.DAY: {
      const label = pad2(day);
      if (!prev || prev.getUTCMonth() !== month || prev.getUTCFullYear() !== year) {
        return `${label} ${SHORT_MONTHS[month]}`;
      }
      return label;
    }
    case RANK.HOUR: {
      const timeLabel = `${hours}:${mins}`;
      if (!prev || prev.getUTCFullYear() !== year || prev.getUTCMonth() !== month || prev.getUTCDate() !== day) {
        return `${pad2(day)} ${timeLabel}`;
      }
      return timeLabel;
    }
    default:
      return '';
  }
}
