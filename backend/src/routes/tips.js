/** 厨艺技巧路由 */
const express = require('express');
const fs = require('fs-extra');
const path = require('path');
const { DIRS, FILES, readJson } = require('../lib/store');
const { ok, fail, asyncHandler } = require('../lib/respond');

const router = express.Router();

/**
 * 获取技巧文章列表
 */
router.get('/tips', asyncHandler(async (req, res) => {
  if (!(await fs.pathExists(FILES.tipsIndex))) {
    return ok(res, { data: [], message: '暂无技巧数据，请先运行 fetchTips 脚本' });
  }
  const index = await readJson(FILES.tipsIndex, { tips: [] });
  return ok(res, { data: index.tips || [] });
}));

/**
 * 获取单篇技巧 markdown 原文
 * M2：req.params.slug 由 Express 解码，不再二次 decodeURIComponent
 */
router.get('/tips/:slug', asyncHandler(async (req, res) => {
  const slug = req.params.slug;
  // 防目录穿越
  if (!slug || slug.includes('..') || slug.includes('/') || slug.includes('\\') || slug.includes('\0')) {
    return fail(res, 400, '无效的技巧标识');
  }
  const filePath = path.join(DIRS.tips, `${slug}.md`);
  if (!(await fs.pathExists(filePath))) {
    return fail(res, 404, '技巧文章不存在');
  }
  const content = await fs.readFile(filePath, 'utf8');
  return ok(res, { data: { slug, content } });
}));

module.exports = router;
