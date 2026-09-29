import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { requireRole } from "../middleware/requireRole";
import { inviteMember, listMembers, removeMemberRole } from "./tenantController";

export const tenantRoutes = Router();

tenantRoutes.use(requireAuth);

tenantRoutes.get("/members", listMembers);
tenantRoutes.post("/members", requireRole("owner", "admin"), inviteMember);
tenantRoutes.delete("/members/:userId/roles", requireRole("owner", "admin"), removeMemberRole);
