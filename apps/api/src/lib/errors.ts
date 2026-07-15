export class ApiError extends Error {
  status: number;
  code: string;
  messageUz: string;
  messageRu: string;

  constructor(status: number, code: string, messageUz: string, messageRu: string) {
    super(messageUz);
    this.status = status;
    this.code = code;
    this.messageUz = messageUz;
    this.messageRu = messageRu;
  }
}

export function notFound(entity = "Ma'lumot"): ApiError {
  return new ApiError(404, "not_found", `${entity} topilmadi`, "Не найдено");
}

export function forbidden(messageUz = "Ruxsat yoʻq", messageRu = "Нет доступа"): ApiError {
  return new ApiError(403, "forbidden", messageUz, messageRu);
}

export function unauthorized(): ApiError {
  return new ApiError(401, "unauthorized", "Tizimga kiring", "Требуется вход в систему");
}

export function badRequest(messageUz: string, messageRu: string): ApiError {
  return new ApiError(400, "bad_request", messageUz, messageRu);
}

export function conflict(code: string, messageUz: string, messageRu: string): ApiError {
  return new ApiError(409, code, messageUz, messageRu);
}

export function duplicate(): ApiError {
  return new ApiError(409, "DUPLICATE", "Bu nom allaqachon mavjud", "Это название уже существует");
}
