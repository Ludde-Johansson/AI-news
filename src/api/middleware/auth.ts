import type { Request, Response, NextFunction } from "express";

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const apiSecret = process.env.API_SECRET;

  if (!apiSecret) {
    next();
    return;
  }

  const auth = req.headers.authorization;
  if (auth === `Bearer ${apiSecret}`) {
    next();
    return;
  }

  res.status(401).json({ error: "Unauthorized" });
}
