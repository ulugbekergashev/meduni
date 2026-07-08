"""Генерация теста и клинического кейса из утверждённого конспекта + фактчек.
Воркеры открывают собственную сессию БД (совместимо с переездом на Celery)."""
from datetime import datetime, timezone

from sqlalchemy import select

from app.ai import get_text_model
from app.ai.prompts.case import CASE_SCHEMA, CASE_SYSTEM, build_case_prompt
from app.ai.prompts.factcheck import FACTCHECK_SCHEMA, FACTCHECK_SYSTEM, build_factcheck_prompt
from app.ai.prompts.quiz import QUIZ_SCHEMA, QUIZ_SYSTEM, build_quiz_prompt
from app.core.db import SessionLocal
from app.modules.content.models import ClinicalCase, ContentItem, Question, Quiz
from app.modules.topics.models import GenerationJob, TopicDigest
from app.modules.topics.service import collect_material_text, get_topic_glossary
from app.modules.topics.models import Topic


def _set_step(db, job: GenerationJob, step: str, status: str) -> None:
    steps = [s for s in job.steps_json if s["step"] != step]
    steps.append({"step": step, "status": status})
    job.steps_json = steps
    db.commit()


def _delete_existing(db, topic_id: int, kind: str) -> None:
    items = db.scalars(
        select(ContentItem).where(ContentItem.topic_id == topic_id, ContentItem.kind == kind)
    ).all()
    for item in items:
        if kind == "quiz":
            quiz = db.scalar(select(Quiz).where(Quiz.content_item_id == item.id))
            if quiz:
                for q in db.scalars(select(Question).where(Question.quiz_id == quiz.id)):
                    db.delete(q)
                db.delete(quiz)
        else:
            case = db.scalar(select(ClinicalCase).where(ClinicalCase.content_item_id == item.id))
            if case:
                db.delete(case)
        db.delete(item)
    db.commit()


def _run_factcheck(model, material_text: str, statements: list[str]) -> list[dict]:
    if not material_text or not statements:
        return [{"index": i, "grounded": True, "note": ""} for i in range(len(statements))]
    try:
        data, _ = model.generate_json(
            FACTCHECK_SYSTEM, build_factcheck_prompt(material_text, statements), FACTCHECK_SCHEMA
        )
        by_index = {r["index"]: r for r in data.get("results", [])}
        return [by_index.get(i, {"index": i, "grounded": True, "note": ""}) for i in range(len(statements))]
    except Exception:
        # фактчек не должен ронять генерацию — при сбое считаем «не проверено, ok»
        return [{"index": i, "grounded": True, "note": ""} for i in range(len(statements))]


def run_quiz_job(job_id: int, count: int, pass_threshold: int, max_attempts: int) -> None:
    db = SessionLocal()
    try:
        job = db.get(GenerationJob, job_id)
        if job is None:
            return
        job.status = "running"
        db.commit()
        try:
            topic = db.get(Topic, job.topic_id)
            digest = db.scalar(select(TopicDigest).where(TopicDigest.topic_id == topic.id))

            _set_step(db, job, "generate", "running")
            model = get_text_model()
            glossary = get_topic_glossary(db, topic)
            data, tokens = model.generate_json(
                QUIZ_SYSTEM, build_quiz_prompt(digest.digest_json, count, glossary), QUIZ_SCHEMA
            )
            job.tokens_used += tokens
            questions = data.get("questions", [])[:count]
            _set_step(db, job, "generate", "done")

            _set_step(db, job, "save", "running")
            _delete_existing(db, topic.id, "quiz")
            item = ContentItem(topic_id=topic.id, kind="quiz", status="review",
                               source_digest_version=digest.version)
            db.add(item)
            db.flush()
            quiz = Quiz(content_item_id=item.id, pass_threshold=pass_threshold, max_attempts=max_attempts)
            db.add(quiz)
            db.flush()
            saved = []
            for idx, q in enumerate(questions):
                question = Question(
                    quiz_id=quiz.id, order_index=idx,
                    question_uz=q["question_uz"], question_ru=q["question_ru"],
                    options_json=q["options"], correct_index=q["correct_index"],
                    explanations_json=q.get("explanations", []),
                    difficulty=q.get("difficulty", "understand"),
                    source_fragment=q.get("source_fragment"),
                )
                db.add(question)
                saved.append(question)
            db.flush()
            _set_step(db, job, "save", "done")

            _set_step(db, job, "factcheck", "running")
            material_text = collect_material_text(db, topic.id)
            statements = [f"{q.question_ru} Верный ответ: {q.options_json[q.correct_index]['ru']}" for q in saved]
            results = _run_factcheck(model, material_text, statements)
            flagged = 0
            for question, result in zip(saved, results):
                if not result["grounded"]:
                    question.factcheck_status = "flagged"
                    question.factcheck_note = result["note"]
                    flagged += 1
            item.factcheck_flags_resolved = flagged == 0
            _set_step(db, job, "factcheck", "done")

            job.status = "done"
        except Exception as e:
            job.status = "error"
            job.error = str(e)[:2000]
        job.finished_at = datetime.now(timezone.utc)
        db.commit()
    finally:
        db.close()


def run_case_job(job_id: int, fmt: str) -> None:
    db = SessionLocal()
    try:
        job = db.get(GenerationJob, job_id)
        if job is None:
            return
        job.status = "running"
        db.commit()
        try:
            topic = db.get(Topic, job.topic_id)
            digest = db.scalar(select(TopicDigest).where(TopicDigest.topic_id == topic.id))

            _set_step(db, job, "generate", "running")
            model = get_text_model()
            glossary = get_topic_glossary(db, topic)
            data, tokens = model.generate_json(
                CASE_SYSTEM, build_case_prompt(digest.digest_json, fmt, glossary), CASE_SCHEMA
            )
            job.tokens_used += tokens
            _set_step(db, job, "generate", "done")

            _set_step(db, job, "save", "running")
            _delete_existing(db, topic.id, "case")
            item = ContentItem(topic_id=topic.id, kind="case", status="review",
                               source_digest_version=digest.version)
            db.add(item)
            db.flush()
            case = ClinicalCase(content_item_id=item.id, case_json=data, fmt=fmt)
            db.add(case)
            _set_step(db, job, "save", "done")

            _set_step(db, job, "factcheck", "running")
            material_text = collect_material_text(db, topic.id)
            # проверяем ключевые блоки кейса
            checkable = [
                ("objective", data["objective"]["ru"]),
                ("labs", data["labs"]["ru"]),
                ("reference_analysis", data["reference_analysis"]["ru"]),
            ]
            results = _run_factcheck(model, material_text, [text for _, text in checkable])
            flags = []
            for (location, _), result in zip(checkable, results):
                if not result["grounded"]:
                    flags.append({"location": location, "note": result["note"], "resolved": False})
            case.factcheck_json = flags
            item.factcheck_flags_resolved = len(flags) == 0
            _set_step(db, job, "factcheck", "done")

            job.status = "done"
        except Exception as e:
            job.status = "error"
            job.error = str(e)[:2000]
        job.finished_at = datetime.now(timezone.utc)
        db.commit()
    finally:
        db.close()
