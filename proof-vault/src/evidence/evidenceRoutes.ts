import { NextFunction, Request, Response, Router } from "express";
import multer from "multer";
import { env } from "../config/env";
import { requireAuth } from "../middleware/requireAuth";
import { requireRole } from "../middleware/requireRole";
import {
  createEvidence,
  deleteEvidence,
  downloadEvidence,
  getEvidence,
  getEvidenceAuditLog,
  listEvidence,
  verifyEvidence,
} from "./evidenceController";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: env.maxUploadBytes } });

// multer reports oversized/malformed uploads via next(err), not a thrown
// exception -- left to the app's generic error handler, a MulterError has
// no `httpStatus`/`error` field and would surface as a bare 500. Translate
// it here instead, at the one place it can occur.
function uploadSingleFile(req: Request, res: Response, next: NextFunction) {
  upload.single("file")(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) {
      return res.status(413).json({ error: "upload_rejected", code: err.code, limitBytes: env.maxUploadBytes });
    }
    if (err) return next(err);
    next();
  });
}

export const evidenceRoutes = Router();

evidenceRoutes.use(requireAuth);

evidenceRoutes.post("/", requireRole("owner", "admin", "analyst"), uploadSingleFile, createEvidence);
evidenceRoutes.get("/", listEvidence);
evidenceRoutes.get("/:id", getEvidence);
evidenceRoutes.get("/:id/download", downloadEvidence);
evidenceRoutes.get("/:id/verify", verifyEvidence);
evidenceRoutes.get("/:id/audit-log", requireRole("owner", "admin", "auditor"), getEvidenceAuditLog);
evidenceRoutes.delete("/:id", requireRole("owner", "admin"), deleteEvidence);
