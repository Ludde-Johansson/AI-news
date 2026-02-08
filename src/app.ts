import express from "express";
import { pipelineRouter } from "./api/routes/pipeline.js";
import { articlesRouter } from "./api/routes/articles.js";

export const app = express();
app.use(express.json());

app.get("/", (_req, res) => {
  res.json({
    name: "AI News Newsletter",
    status: "running",
    uptime: Math.floor(process.uptime()),
  });
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/api/pipeline", pipelineRouter);
app.use("/api/articles", articlesRouter);
