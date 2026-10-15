-- Kafedra o'z Gemini kalitini kiritadi (shifrlangan). Additive.
CREATE TABLE "department_ai_keys" (
    "departmentId" INTEGER NOT NULL,
    "keyEnc" TEXT NOT NULL,
    "last4" TEXT NOT NULL,
    "setById" INTEGER,
    "setAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkedAt" TIMESTAMP(3),

    CONSTRAINT "department_ai_keys_pkey" PRIMARY KEY ("departmentId")
);

ALTER TABLE "department_ai_keys" ADD CONSTRAINT "department_ai_keys_departmentId_fkey"
    FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
