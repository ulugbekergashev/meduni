from pydantic import BaseModel, ConfigDict, EmailStr


class NamedIn(BaseModel):
    name_uz: str
    name_ru: str


class FacultyOut(NamedIn):
    model_config = ConfigDict(from_attributes=True)
    id: int


class DepartmentIn(NamedIn):
    faculty_id: int


class DepartmentOut(DepartmentIn):
    model_config = ConfigDict(from_attributes=True)
    id: int


class SubjectIn(NamedIn):
    department_id: int
    description: str | None = None


class SubjectOut(SubjectIn):
    model_config = ConfigDict(from_attributes=True)
    id: int


class GroupIn(BaseModel):
    faculty_id: int
    name: str
    year_of_study: int


class GroupOut(GroupIn):
    model_config = ConfigDict(from_attributes=True)
    id: int


class UserCreate(BaseModel):
    role: str
    full_name: str
    email: EmailStr
    password: str
    phone: str | None = None
    locale: str = "uz"
    group_id: int | None = None  # для студентов
    department_id: int | None = None  # для преподавателей


class UserUpdate(BaseModel):
    full_name: str | None = None
    phone: str | None = None
    locale: str | None = None
    is_active: bool | None = None
    group_id: int | None = None
    password: str | None = None  # сброс пароля админом


class ImportReport(BaseModel):
    created: int
    errors: list[str]
