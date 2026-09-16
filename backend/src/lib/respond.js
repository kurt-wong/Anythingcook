/**
 * 统一响应与路由辅助。
 * - ok / fail：信封格式 { success, data?, message?, error?, total? }
 * - asyncHandler：捕获 async 路由异常
 * - guardAdmin：可选 ADMIN_TOKEN 保护维护类接口（M6）
 */

const IS_PROD = process.env.NODE_ENV === 'production';

function ok(res, { data, message, total, lastUpdated, extra } = {}) {
  const body = { success: true };
  if (data !== undefined) body.data = data;
  if (total !== undefined) body.total = total;
  if (message !== undefined) body.message = message;
  if (lastUpdated !== undefined) body.lastUpdated = lastUpdated;
  if (extra) Object.assign(body, extra);
  return res.json(body);
}

function fail(res, status, message, error) {
  // 生产环境不向客户端泄露内部错误细节（L2）
  const body = { success: false, message };
  if (error && !IS_PROD) body.error = error.message || String(error);
  if (error) console.error(`[error] ${message}:`, error);
  return res.status(status).json(body);
}

/** 包装 async 路由，异常统一 500 */
function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

/** Express 全局错误中间件 */
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  fail(res, 500, '服务器内部错误', err);
}

/**
 * 可选令牌保护：配置了 ADMIN_TOKEN 时要求 Authorization: Bearer <token>
 * 或 X-Admin-Token 头；未配置则保持开放（家庭局域网向后兼容）。
 */
function guardAdmin(req, res, next) {
  const token = process.env.ADMIN_TOKEN;
  if (!token) return next();
  const provided =
    (req.headers.authorization || '').replace(/^Bearer\s+/i, '') ||
    req.headers['x-admin-token'] ||
    '';
  if (provided === token) return next();
  return fail(res, 401, '未授权：维护接口需要有效令牌');
}

/** 安全解析正整数，非法时返回 fallback，并钳制在 [min, max] */
function parseIntClamped(value, fallback, min, max) {
  const n = parseInt(value, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/** 菜谱数组字段的空值保护（M1） */
function arr(field) {
  return Array.isArray(field) ? field : [];
}

module.exports = { ok, fail, asyncHandler, errorHandler, guardAdmin, parseIntClamped, arr };
