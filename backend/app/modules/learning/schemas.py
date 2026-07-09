from datetime import datetime

from pydantic import BaseModel, ConfigDict


class TopicNode(BaseModel):
    """Узел карты-пути курса."""
    id: int
    title_uz: str
    title_ru: str
    order_index: int
    state: str  # locked / available / in_progress / completed
    video_pct: int


class CourseMapOut(BaseModel):
    course_id: int
    subject_name_uz: str
    subject_name_ru: str
    teacher_name: str
    topics: list[TopicNode]
    completed_count: int
    total_count: int


# --- Урок ---


class VideoView(BaseModel):
    content_id: int
    mp4_url: str | None
    srt_url: str | None
    duration_sec: int
    language: str


class PresentationView(BaseModel):
    content_id: int
    slides_json: list  # для просмотра в браузере (без служебных полей image_status не мешают)


class QuizView(BaseModel):
    content_id: int
    quiz_id: int
    question_count: int
    pass_threshold: int
    max_attempts: int
    attempts_used: int
    best_score: float
    passed: bool


class CaseView(BaseModel):
    content_id: int
    case_id: int
    case_json: dict  # эталонный разбор скрыт до отправки
    submitted: bool
    my_answers: list = []
    teacher_feedback: str | None = None
    score: int | None = None
    reviewed: bool = False


class LessonOut(BaseModel):
    topic_id: int
    course_id: int
    title_uz: str
    title_ru: str
    state: str
    video: VideoView | None = None
    presentation: PresentationView | None = None
    quiz: QuizView | None = None
    case: CaseView | None = None


class VideoProgressIn(BaseModel):
    pct: int


# --- Тест ---


class QuizQuestionPublic(BaseModel):
    id: int
    question_uz: str
    question_ru: str
    options_json: list


class QuizStartOut(BaseModel):
    attempt_id: int
    attempt_no: int
    max_attempts: int
    questions: list[QuizQuestionPublic]


class QuizSubmitIn(BaseModel):
    answers: dict[int, int]  # {question_id: chosen_index}


class QuestionReview(BaseModel):
    question_id: int
    chosen: int | None
    correct_index: int
    is_correct: bool
    explanations_json: list = []


class QuizResultOut(BaseModel):
    score_pct: float
    passed: bool
    attempt_no: int
    attempts_left: int
    show_review: bool
    review: list[QuestionReview] = []


# --- Кейс ---


class CaseSubmitIn(BaseModel):
    answers: list[str]


# --- Преподаватель: проверка кейсов ---


class CaseReviewItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    case_id: int
    student_id: int
    student_name: str = ""
    topic_title: str = ""
    answers_json: list
    status: str
    score: int | None = None
    submitted_at: datetime


class CaseReviewIn(BaseModel):
    feedback: str
    score: int


class UnlockRuleIn(BaseModel):
    unlock_rule_json: dict
