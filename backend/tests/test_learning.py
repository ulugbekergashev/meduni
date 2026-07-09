"""M6: последовательное открытие тем, прохождение теста/кейса, unlock-правила, проверка кейсов."""
import app.modules.content.service as content_service
import app.modules.topics.service as topics_service
from tests.conftest import login
from tests.test_content import QuizCaseModel
from tests.test_topics_digest import FakeTextModel


def _bootstrap(client, monkeypatch):
    """Админ создаёт структуру, курс с группой, студента в группе; преподаватель ведёт курс."""
    monkeypatch.setattr(topics_service, "get_text_model", lambda: FakeTextModel())
    monkeypatch.setattr(content_service, "get_text_model", lambda: QuizCaseModel())
    admin = login(client, "admin")
    fac = client.post("/api/v1/faculties", headers=admin, json={"name_uz": "F", "name_ru": "Ф"}).json()
    dep = client.post("/api/v1/departments", headers=admin,
                      json={"faculty_id": fac["id"], "name_uz": "K", "name_ru": "К"}).json()
    sub = client.post("/api/v1/subjects", headers=admin,
                      json={"department_id": dep["id"], "name_uz": "Fan", "name_ru": "Предмет"}).json()
    grp = client.post("/api/v1/groups", headers=admin,
                      json={"faculty_id": fac["id"], "name": "101", "year_of_study": 1}).json()
    teacher_id = client.get("/api/v1/users?role=teacher", headers=admin).json()[0]["id"]
    student_id = client.get("/api/v1/users?role=student", headers=admin).json()[0]["id"]
    # студента — в группу
    client.patch(f"/api/v1/users/{student_id}", headers=admin, json={"group_id": grp["id"]})
    course = client.post("/api/v1/courses", headers=admin, json={
        "subject_id": sub["id"], "teacher_id": teacher_id, "semester": 1,
        "academic_year": "2026/2027", "group_ids": [grp["id"]]}).json()
    return admin, course


def _make_topic_with_quiz(client, teacher, course_id, title, threshold=70):
    topic_id = client.post(f"/api/v1/courses/{course_id}/topics", headers=teacher,
                           json={"title_uz": title, "title_ru": title}).json()["id"]
    client.post(f"/api/v1/topics/{topic_id}/materials", headers=teacher,
                files={"file": ("m.txt", "Сердце имеет 4 камеры.".encode(), "text/plain")})
    job = client.post(f"/api/v1/topics/{topic_id}/digest/generate", headers=teacher).json()
    assert client.get(f"/api/v1/jobs/{job['id']}", headers=teacher).json()["status"] == "done"
    client.post(f"/api/v1/topics/{topic_id}/digest/approve", headers=teacher)
    # тест
    qjob = client.post(f"/api/v1/topics/{topic_id}/quiz/generate", headers=teacher, json={"count": 1}).json()
    assert client.get(f"/api/v1/jobs/{qjob['job_id']}", headers=teacher).json()["status"] == "done"
    quiz_content = client.get(f"/api/v1/topics/{topic_id}/content", headers=teacher).json()["quiz"]
    client.get(f"/api/v1/quizzes/{quiz_content['id']}", headers=teacher)  # reviewed
    # порог сдачи
    quiz = client.get(f"/api/v1/quizzes/{quiz_content['id']}", headers=teacher).json()
    client.put(f"/api/v1/quizzes/{quiz_content['id']}", headers=teacher, json={
        "pass_threshold": threshold, "max_attempts": 3,
        "questions": [{"question_uz": q["question_uz"], "question_ru": q["question_ru"],
                       "options_json": q["options_json"], "correct_index": q["correct_index"],
                       "explanations_json": q["explanations_json"], "difficulty": q["difficulty"]}
                      for q in quiz["questions"]]})
    client.post(f"/api/v1/content/{quiz_content['id']}/approve", headers=teacher)
    client.post(f"/api/v1/content/{quiz_content['id']}/publish", headers=teacher)
    client.post(f"/api/v1/topics/{topic_id}/publish", headers=teacher)
    return topic_id, quiz_content["id"]


def test_sequential_unlock_via_quiz(client, monkeypatch):
    admin, course = _bootstrap(client, monkeypatch)
    teacher = login(client, "teacher")
    student = login(client, "student")
    course_id = course["id"]

    t1, quiz1 = _make_topic_with_quiz(client, teacher, course_id, "Тема 1")
    t2, quiz2 = _make_topic_with_quiz(client, teacher, course_id, "Тема 2")

    # карта курса: первая available, вторая locked
    cmap = client.get(f"/api/v1/me/learn/courses/{course_id}", headers=student).json()
    states = {n["id"]: n["state"] for n in cmap["topics"]}
    assert states[t1] == "available", cmap
    assert states[t2] == "locked"

    # вторая тема заблокирована для входа
    assert client.get(f"/api/v1/me/learn/topics/{t2}", headers=student).status_code == 423

    # проходим тест темы 1 на 100%
    start = client.post(f"/api/v1/me/learn/quizzes/{quiz1}/start", headers=student).json()
    answers = {}
    # правильный ответ известен из FAKE_QUIZ (correct_index=2)
    for q in start["questions"]:
        answers[str(q["id"])] = 2
    result = client.post(f"/api/v1/me/learn/attempts/{start['attempt_id']}/submit", headers=student,
                         json={"answers": answers}).json()
    assert result["passed"] is True
    assert result["score_pct"] == 100.0
    assert result["show_review"] is True  # прошёл → показываем разбор
    assert result["review"][0]["is_correct"] is True

    # теперь тема 2 открылась
    cmap = client.get(f"/api/v1/me/learn/courses/{course_id}", headers=student).json()
    states = {n["id"]: n["state"] for n in cmap["topics"]}
    assert states[t1] == "completed", cmap
    assert states[t2] == "available"
    assert client.get(f"/api/v1/me/learn/topics/{t2}", headers=student).status_code == 200


def test_quiz_fail_keeps_locked(client, monkeypatch):
    admin, course = _bootstrap(client, monkeypatch)
    teacher = login(client, "teacher")
    student = login(client, "student")
    course_id = course["id"]
    t1, quiz1 = _make_topic_with_quiz(client, teacher, course_id, "Тема 1")
    t2, _ = _make_topic_with_quiz(client, teacher, course_id, "Тема 2")

    # проваливаем тест (неверный ответ)
    start = client.post(f"/api/v1/me/learn/quizzes/{quiz1}/start", headers=student).json()
    answers = {str(q["id"]): 0 for q in start["questions"]}  # correct=2
    result = client.post(f"/api/v1/me/learn/attempts/{start['attempt_id']}/submit", headers=student,
                         json={"answers": answers}).json()
    assert result["passed"] is False
    assert result["attempts_left"] == 2
    assert result["show_review"] is False  # не прошёл и есть попытки → разбор скрыт

    cmap = client.get(f"/api/v1/me/learn/courses/{course_id}", headers=student).json()
    states = {n["id"]: n["state"] for n in cmap["topics"]}
    assert states[t1] == "in_progress"  # активность есть, но не завершено
    assert states[t2] == "locked"


def test_video_progress_tracking(client, monkeypatch):
    admin, course = _bootstrap(client, monkeypatch)
    teacher = login(client, "teacher")
    student = login(client, "student")
    t1, _ = _make_topic_with_quiz(client, teacher, course["id"], "Тема 1")

    r = client.post(f"/api/v1/me/learn/topics/{t1}/video-progress", headers=student, json={"pct": 45})
    assert r.json()["video_watched_pct"] == 45
    # прогресс не уменьшается
    r = client.post(f"/api/v1/me/learn/topics/{t1}/video-progress", headers=student, json={"pct": 30})
    assert r.json()["video_watched_pct"] == 45


def test_case_submit_and_review(client, monkeypatch):
    admin, course = _bootstrap(client, monkeypatch)
    teacher = login(client, "teacher")
    student = login(client, "student")
    course_id = course["id"]

    # тема с кейсом
    topic_id = client.post(f"/api/v1/courses/{course_id}/topics", headers=teacher,
                           json={"title_uz": "К", "title_ru": "К"}).json()["id"]
    client.post(f"/api/v1/topics/{topic_id}/materials", headers=teacher,
                files={"file": ("m.txt", "Сердце имеет 4 камеры.".encode(), "text/plain")})
    job = client.post(f"/api/v1/topics/{topic_id}/digest/generate", headers=teacher).json()
    client.get(f"/api/v1/jobs/{job['id']}", headers=teacher)
    client.post(f"/api/v1/topics/{topic_id}/digest/approve", headers=teacher)
    cjob = client.post(f"/api/v1/topics/{topic_id}/case/generate", headers=teacher, json={"fmt": "short"}).json()
    client.get(f"/api/v1/jobs/{cjob['job_id']}", headers=teacher)
    case_content = client.get(f"/api/v1/topics/{topic_id}/content", headers=teacher).json()["case"]
    client.get(f"/api/v1/cases/{case_content['id']}", headers=teacher)
    client.post(f"/api/v1/content/{case_content['id']}/approve", headers=teacher)
    client.post(f"/api/v1/content/{case_content['id']}/publish", headers=teacher)
    client.post(f"/api/v1/topics/{topic_id}/publish", headers=teacher)

    # студент открывает урок — эталонный разбор скрыт
    lesson = client.get(f"/api/v1/me/learn/topics/{topic_id}", headers=student).json()
    assert "reference_analysis" not in lesson["case"]["case_json"]

    # отправляет ответ — получает эталон
    submit = client.post(f"/api/v1/me/learn/cases/{case_content['id']}/submit", headers=student,
                        json={"answers": ["Мой ответ"]})
    assert submit.status_code == 200
    assert submit.json()["reference_analysis"]

    # повторная отправка запрещена
    assert client.post(f"/api/v1/me/learn/cases/{case_content['id']}/submit", headers=student,
                       json={"answers": ["x"]}).status_code == 409

    # преподаватель видит в очереди и проверяет
    queue = client.get("/api/v1/teach/case-review", headers=teacher).json()
    assert len(queue) == 1
    attempt_id = queue[0]["id"]
    client.post(f"/api/v1/teach/case-attempts/{attempt_id}/review", headers=teacher,
                json={"feedback": "Хорошо", "score": 85})
    lesson = client.get(f"/api/v1/me/learn/topics/{topic_id}", headers=student).json()
    assert lesson["case"]["reviewed"] is True
    assert lesson["case"]["score"] == 85


def test_non_enrolled_student_denied(client, monkeypatch):
    admin, course = _bootstrap(client, monkeypatch)
    teacher = login(client, "teacher")
    t1, _ = _make_topic_with_quiz(client, teacher, course["id"], "Тема 1")
    # создаём второго студента вне группы
    client.post("/api/v1/users", headers=admin, json={
        "role": "student", "full_name": "Outsider", "email": "out@test.uz", "password": "pass1234"})
    outsider = login(client, "out")
    assert client.get(f"/api/v1/me/learn/courses/{course['id']}", headers=outsider).status_code == 403
    assert client.get(f"/api/v1/me/learn/topics/{t1}", headers=outsider).status_code == 403


def test_public_pages(client, monkeypatch):
    admin, course = _bootstrap(client, monkeypatch)
    student = login(client, "student")
    subject_id = client.get("/api/v1/subjects", headers=admin).json()[0]["id"]
    teacher_id = client.get("/api/v1/users?role=teacher", headers=admin).json()[0]["id"]

    sp = client.get(f"/api/v1/public/subjects/{subject_id}", headers=student)
    assert sp.status_code == 200 and len(sp.json()["courses"]) >= 1
    tp = client.get(f"/api/v1/public/teachers/{teacher_id}", headers=student)
    assert tp.status_code == 200 and len(tp.json()["courses"]) >= 1
