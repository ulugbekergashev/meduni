from pydantic import BaseModel, ConfigDict

from app.modules.org.schemas import GroupOut


class CourseIn(BaseModel):
    subject_id: int
    teacher_id: int
    semester: int
    academic_year: str
    group_ids: list[int] = []


class CourseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    subject_id: int
    teacher_id: int
    semester: int
    academic_year: str
    groups: list[GroupOut] = []


class MyCourseOut(CourseOut):
    subject_name_uz: str = ""
    subject_name_ru: str = ""
    teacher_name: str = ""
