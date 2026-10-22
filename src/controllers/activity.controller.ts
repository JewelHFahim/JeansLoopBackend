import { Request, Response } from 'express';
import { queryActivityLogs } from '../services/activity.service';
import { asyncHandler } from '../utils/asyncHandler';
import { sendPaginated } from '../utils/apiResponse';

export const getActivityLogs = asyncHandler(async (req: Request, res: Response) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 20;
  const entityType = req.query.entityType ? String(req.query.entityType) : undefined;
  const entityId = req.query.entityId ? String(req.query.entityId) : undefined;
  const keyword = req.query.keyword ? String(req.query.keyword) : undefined;
  const userId = req.query.userId ? String(req.query.userId) : undefined;

  const result = await queryActivityLogs({
    page,
    limit,
    entityType,
    entityId,
    keyword,
    userId,
  });

  sendPaginated(res, result.logs, result.pagination);
});
