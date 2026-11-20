import type { Request, Response } from "express";
import { donationService } from "../services/donation.service.js";
import { ApiError } from "../utils/errors.js";
export async function history(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  res.json({ success: true, donations: await donationService.history(req.user, req.query.limit, req.query.offset) });
}
export async function record(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  res.json({ success: true, donation: await donationService.record(req.user, req.body) });
}

export async function adminList(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  res.json({ success: true, ...(await donationService.adminList(req.user, req.query)) });
}
