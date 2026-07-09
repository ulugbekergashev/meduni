from sqlalchemy import ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class AIQuota(Base):
    """Месячная квота токенов на кафедру (план §4.5, §9.4). 0/нет = без лимита."""

    __tablename__ = "ai_quotas"

    id: Mapped[int] = mapped_column(primary_key=True)
    department_id: Mapped[int] = mapped_column(ForeignKey("departments.id"), unique=True, index=True)
    monthly_tokens: Mapped[int] = mapped_column(Integer, default=0)
