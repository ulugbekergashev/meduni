"""Генерация сценария, озвучка и сборка видео через ffmpeg (M5).
Пайплайн идемпотентен по шагам; частичный результат не теряется (план §13)."""
import json
import subprocess
import tempfile
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import select

from app.ai import get_text_model, get_tts_model
from app.ai.prompts.script import SCRIPT_SCHEMA, build_script_prompt, script_system
from app.core import storage
from app.core.config import settings
from app.core.db import SessionLocal
from app.modules.content.models import ContentItem, Presentation, PresentationTemplate, Video
from app.modules.content.slide_image import render_slide_png
from app.modules.topics.models import GenerationJob, Topic, TopicDigest


def _set_step(db, job: GenerationJob, step: str, status: str) -> None:
    steps = [s for s in job.steps_json if s["step"] != step]
    steps.append({"step": step, "status": status})
    job.steps_json = steps
    db.commit()


def _ffprobe_path() -> str:
    ff = settings.ffmpeg_path
    probe = ff.replace("ffmpeg", "ffprobe")
    return probe if Path(probe).exists() or probe == "ffprobe" else "ffprobe"


def _audio_duration(path: Path) -> float:
    out = subprocess.run(
        [_ffprobe_path(), "-v", "error", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", str(path)],
        capture_output=True, text=True, timeout=60,
    )
    try:
        return float(out.stdout.strip())
    except ValueError:
        return 3.0


def _srt_time(seconds: float) -> str:
    ms = int(seconds * 1000)
    h, ms = divmod(ms, 3600000)
    m, ms = divmod(ms, 60000)
    s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def run_script_job(job_id: int, language: str) -> None:
    """Генерация сценария озвучки из слайдов утверждённой презентации."""
    db = SessionLocal()
    try:
        job = db.get(GenerationJob, job_id)
        if job is None:
            return
        job.status = "running"
        db.commit()
        try:
            topic = db.get(Topic, job.topic_id)
            pres_item = db.scalar(select(ContentItem).where(
                ContentItem.topic_id == topic.id, ContentItem.kind == "presentation"
            ))
            if pres_item is None:
                raise ValueError("Нет презентации — сначала сгенерируйте слайды")
            pres = db.scalar(select(Presentation).where(Presentation.content_item_id == pres_item.id))

            _set_step(db, job, "script", "running")
            model = get_text_model()
            data, tokens = model.generate_json(
                script_system(language), build_script_prompt(pres.slides_json, language), SCRIPT_SCHEMA
            )
            job.tokens_used += tokens
            script = data.get("script", [])
            _set_step(db, job, "script", "done")

            _set_step(db, job, "save", "running")
            digest = db.scalar(select(TopicDigest).where(TopicDigest.topic_id == topic.id))
            for item in db.scalars(select(ContentItem).where(
                ContentItem.topic_id == topic.id, ContentItem.kind == "video"
            )).all():
                v = db.scalar(select(Video).where(Video.content_item_id == item.id))
                if v:
                    for url in (v.mp4_url, v.srt_url):
                        if url:
                            storage.delete(url)
                    db.delete(v)
                db.delete(item)
            db.flush()
            item = ContentItem(topic_id=topic.id, kind="video", status="review",
                               source_digest_version=digest.version if digest else None)
            db.add(item)
            db.flush()
            voice = settings.tts_voice_uz if language == "uz" else settings.tts_voice_ru
            db.add(Video(content_item_id=item.id, language=language, script_json=script,
                         voice_id=voice, video_stale=True))
            _set_step(db, job, "save", "done")
            job.status = "done"
        except Exception as e:
            job.status = "error"
            job.error = str(e)[:2000]
        job.finished_at = datetime.now(timezone.utc)
        db.commit()
    finally:
        db.close()


def run_build_video(job_id: int) -> None:
    """Озвучка + рендер слайдов + сборка MP4 + SRT."""
    db = SessionLocal()
    try:
        job = db.get(GenerationJob, job_id)
        if job is None:
            return
        job.status = "running"
        db.commit()
        try:
            video_item = db.scalar(select(ContentItem).where(
                ContentItem.topic_id == job.topic_id, ContentItem.kind == "video"
            ))
            video = db.scalar(select(Video).where(Video.content_item_id == video_item.id))
            pres_item = db.scalar(select(ContentItem).where(
                ContentItem.topic_id == job.topic_id, ContentItem.kind == "presentation"
            ))
            pres = db.scalar(select(Presentation).where(Presentation.content_item_id == pres_item.id))
            template = None
            if pres.template_id:
                tpl = db.get(PresentationTemplate, pres.template_id)
                if tpl:
                    template = {"primary_color": tpl.primary_color, "accent_color": tpl.accent_color}

            slides = pres.slides_json
            script = video.script_json
            lang = video.language
            voice = video.voice_id
            content_id = video_item.id

            _set_step(db, job, "tts", "running")
            tts = get_tts_model()
            with tempfile.TemporaryDirectory() as tmp:
                tmp_path = Path(tmp)
                segments, durations = [], []
                text_by_index = {s["slide_index"]: s["text"] for s in script}

                for i, slide in enumerate(slides):
                    png = render_slide_png(slide, template, lang, i)
                    img_path = tmp_path / f"slide_{i}.png"
                    img_path.write_bytes(png)
                    text = text_by_index.get(i, "").strip() or slide.get(f"title_{lang}", "") or " "
                    audio_bytes = tts.synthesize(text, voice)
                    audio_path = tmp_path / f"audio_{i}.mp3"
                    audio_path.write_bytes(audio_bytes)
                    dur = _audio_duration(audio_path)
                    durations.append(dur)

                    seg_path = tmp_path / f"seg_{i}.mp4"
                    subprocess.run([
                        settings.ffmpeg_path, "-y", "-loop", "1", "-i", str(img_path),
                        "-i", str(audio_path), "-c:v", "libx264", "-tune", "stillimage",
                        "-c:a", "aac", "-b:a", "128k", "-pix_fmt", "yuv420p",
                        "-vf", "scale=1280:720", "-shortest", str(seg_path),
                    ], capture_output=True, timeout=180, check=True)
                    segments.append(seg_path)
                _set_step(db, job, "tts", "done")

                _set_step(db, job, "ffmpeg", "running")
                concat_file = tmp_path / "list.txt"
                concat_file.write_text("\n".join(f"file '{p.as_posix()}'" for p in segments), encoding="utf-8")
                out_mp4 = tmp_path / "out.mp4"
                subprocess.run([
                    settings.ffmpeg_path, "-y", "-f", "concat", "-safe", "0",
                    "-i", str(concat_file), "-c", "copy", str(out_mp4),
                ], capture_output=True, timeout=300, check=True)
                _set_step(db, job, "ffmpeg", "done")

                # SRT
                srt_lines, t0 = [], 0.0
                for i, dur in enumerate(durations):
                    text = text_by_index.get(i, "").strip()
                    if text:
                        srt_lines.append(f"{i + 1}\n{_srt_time(t0)} --> {_srt_time(t0 + dur)}\n{text}\n")
                    t0 += dur
                srt_content = "\n".join(srt_lines)

                if video.mp4_url:
                    storage.delete(video.mp4_url)
                if video.srt_url:
                    storage.delete(video.srt_url)
                video.mp4_url = storage.save_bytes(f"topics/{content_id}/video", "video.mp4", out_mp4.read_bytes())
                video.srt_url = storage.save_text(f"topics/{content_id}/video", "video.srt", srt_content)
                video.duration_sec = int(sum(durations))
                video.video_stale = False

            job.status = "done"
        except subprocess.CalledProcessError as e:
            job.status = "error"
            job.error = f"ffmpeg: {(e.stderr or b'')[:1500].decode('utf-8', 'ignore')}"
        except Exception as e:
            job.status = "error"
            job.error = str(e)[:2000]
        job.finished_at = datetime.now(timezone.utc)
        db.commit()
    finally:
        db.close()
