/**
 * 本地时区日期工具。
 *
 * 禁止用 toISOString().slice(0,10) 取"今天"——那是 UTC 日期，
 * 在 UTC+8 的 00:00–07:59 会得到昨天（早餐时段写错日志的根源）。
 */

/** Date -> 本地 YYYY-MM-DD */
function localDateStr(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 本地时区的"今天" */
function todayStr() {
  return localDateStr(new Date());
}

/**
 * 本周一的本地日期（YYYY-MM-DD）。
 * 周日(0)归入上一周的周日，即回退 6 天。
 */
function getWeekStart(date = new Date()) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay(); // 0=周日
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return localDateStr(d);
}

/** 按本地小时推断餐次： <10 早餐, <14 午餐, <21 晚餐, 其余加餐 */
function inferMealType(date = new Date()) {
  const hour = date.getHours();
  if (hour < 10) return 'breakfast';
  if (hour < 14) return 'lunch';
  if (hour < 21) return 'dinner';
  return 'snack';
}

/** 距今 N 天前的本地日期（用于汇总窗口） */
function daysAgoStr(days, from = new Date()) {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  d.setDate(d.getDate() - days);
  return localDateStr(d);
}

module.exports = { localDateStr, todayStr, getWeekStart, inferMealType, daysAgoStr };
