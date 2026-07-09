"""Движок правил открытия тем (план §6.1–6.2).

unlock_rule_json (условия завершения темы, конструктор И/ИЛИ):
{
  "logic": "and" | "or",       # как объединять video/quiz/case
  "video_min_pct": 80,          # 0 = видео не требуется
  "quiz_min_score": 70,         # 0 = тест не требуется
  "quiz_max_attempts": 3,
  "case_required": false,
  "case_require_reviewed": false,
  "available_from": null        # ISO-дата: тема не раньше этой даты (гейт доступности)
}
Тема доступна, если предыдущая завершена (первая — всегда) и наступила
available_from, либо ручное открытие. Тема завершена, когда выполнены её
условия (video/quiz/case). Условие по отсутствующему опубликованному контенту
пропускается (нельзя требовать несуществующее).
"""
from datetime import date

DEFAULT_RULE = {
    "logic": "and",
    "video_min_pct": 80,
    "quiz_min_score": 70,
    "quiz_max_attempts": 3,
    "case_required": False,
    "case_require_reviewed": False,
    "available_from": None,
}


def resolve_rule(topic_rule: dict | None, course_settings: dict | None) -> dict:
    rule = dict(DEFAULT_RULE)
    default = (course_settings or {}).get("default_unlock_rule")
    if default:
        rule.update({k: v for k, v in default.items() if v is not None})
    if topic_rule:
        rule.update({k: v for k, v in topic_rule.items() if v is not None})
    return rule


def date_gate_open(rule: dict) -> bool:
    av = rule.get("available_from")
    if not av:
        return True
    try:
        return date.today() >= date.fromisoformat(av)
    except ValueError:
        return True


def evaluate_completion(rule: dict, facts: dict) -> bool:
    """facts: {has_video, video_pct, has_quiz, quiz_best_score, quiz_passed,
              has_case, case_submitted, case_reviewed}."""
    conditions: list[bool] = []

    if rule.get("video_min_pct", 0) > 0 and facts.get("has_video"):
        conditions.append(facts.get("video_pct", 0) >= rule["video_min_pct"])
    if rule.get("quiz_min_score", 0) > 0 and facts.get("has_quiz"):
        conditions.append(facts.get("quiz_best_score", 0) >= rule["quiz_min_score"])
    if rule.get("case_required") and facts.get("has_case"):
        if rule.get("case_require_reviewed"):
            conditions.append(bool(facts.get("case_reviewed")))
        else:
            conditions.append(bool(facts.get("case_submitted")))

    if not conditions:
        # нет применимых условий (нет требований или нет контента) — тема считается
        # завершаемой по факту любой активности; здесь возвращаем True только если
        # была хоть какая-то активность, иначе тему нельзя «случайно» закрыть
        return facts.get("any_activity", False)

    return all(conditions) if rule.get("logic", "and") == "and" else any(conditions)
