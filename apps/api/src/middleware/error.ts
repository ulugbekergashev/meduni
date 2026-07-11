import type { ErrorRequestHandler } from "express";
import { ApiError } from "../lib/errors";

export const errorMiddleware: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ApiError) {
    res.status(err.status).json({
      error: { code: err.code, messageUz: err.messageUz, messageRu: err.messageRu },
    });
    return;
  }

  console.error(err);
  res.status(500).json({
    error: {
      code: "internal_error",
      messageUz: "Server xatosi",
      messageRu: "Ошибка сервера",
    },
  });
};
