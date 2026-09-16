/** 下厨统计路由 */
const express = require('express');
const { FILES, readJson } = require('../lib/store');
const { ok, asyncHandler } = require('../lib/respond');
const { daysAgoStr } = require('../lib/dates');

const router = express.Router();

/**
 * 从已完成订单聚合近 30 天下厨统计
 */
router.get('/stats/summary', asyncHandler(async (req, res) => {
  const orders = await readJson(FILES.orders, []);
  const completed = orders.filter(o => o.status === 'completed');

  // H3：窗口边界用本地日期
  const cutoff = daysAgoStr(30);
  const recent = completed.filter(o => {
    const d = new Date(o.createdAt);
    if (Number.isNaN(d.getTime())) return false;
    return d >= new Date(`${cutoff}T00:00:00`);
  });

  const dishCount = {};
  const guestCount = {};
  let totalDishes = 0;

  for (const order of recent) {
    guestCount[order.guestName] = (guestCount[order.guestName] || 0) + 1;
    for (const item of order.items || []) {
      dishCount[item.name] = (dishCount[item.name] || 0) + (item.quantity || 1);
      totalDishes += item.quantity || 1;
    }
  }

  const topDishes = Object.entries(dishCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));

  return ok(res, {
    data: {
      completedOrders: recent.length,
      totalDishes,
      topDishes,
      byGuest: guestCount,
    },
  });
}));

module.exports = router;
