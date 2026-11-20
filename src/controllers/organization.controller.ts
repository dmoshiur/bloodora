import type { Request, Response } from "express";
import { organizationService } from "../services/organization.service.js";
import type { OrganizationKind } from "../repos/organization.repo.js";
import { ApiError } from "../utils/errors.js";
function actor(req: Request) {
  if (!req.user) throw ApiError.unauthorized();
  return req.user;
}
export function organizationController(kind: OrganizationKind) {
  return {
    async requests(req: Request, res: Response) {
      res.json({
        success: true,
        requests: await organizationService.requests(actor(req), req.params.id, kind, req.query),
      });
    },
    async submitRequest(req: Request, res: Response) {
      res
        .status(201)
        .json({
          success: true,
          ...(await organizationService.submitRequest(actor(req), req.params.id, kind, req.body)),
        });
    },
    async list(req: Request, res: Response) {
      res.json({ success: true, ...(await organizationService.list(kind, req.query)) });
    },
    async mine(req: Request, res: Response) {
      res.json({ success: true, ...(await organizationService.list(kind, req.query, actor(req), "mine")) });
    },
    async adminList(req: Request, res: Response) {
      res.json({ success: true, ...(await organizationService.list(kind, req.query, actor(req), "admin")) });
    },
    async get(req: Request, res: Response) {
      res.json({ success: true, institution: await organizationService.get(req.params.id, kind, req.user) });
    },
    async create(req: Request, res: Response) {
      const r = await organizationService.create(actor(req), kind, req.body);
      res.status(r.created ? 201 : 200).json({ success: true, ...r });
    },
    async update(req: Request, res: Response) {
      res.json({
        success: true,
        institution: await organizationService.update(actor(req), req.params.id, kind, req.body),
      });
    },
    async review(req: Request, res: Response) {
      res.json({
        success: true,
        institution: await organizationService.review(actor(req), req.params.id, kind, req.body),
      });
    },
    async members(req: Request, res: Response) {
      res.json({
        success: true,
        members: await organizationService.members(actor(req), req.params.id, kind, req.query),
      });
    },
    async setMember(req: Request, res: Response) {
      res.json({
        success: true,
        membership: await organizationService.setMember(actor(req), req.params.id, kind, req.body),
      });
    },
  };
}
