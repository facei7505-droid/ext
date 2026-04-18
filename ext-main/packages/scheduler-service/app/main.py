"""
FastAPI-микросервис: умное расписание процедур.

Запуск:
    uvicorn app.main:app --reload --port 8000

Эндпоинт:
    POST /api/v1/schedule/generate
"""

from __future__ import annotations

import time as _time

from fastapi import FastAPI, HTTPException

from .algorithm import generate_schedule
from .models import ScheduleGenerateRequest, ScheduleGenerateResponse

app = FastAPI(
    title="HealthTech RPA — Scheduler Service",
    version="0.1.0",
    description="Генерация оптимального расписания процедур на 9 рабочих дней.",
)


@app.post(
    "/api/v1/schedule/generate",
    response_model=ScheduleGenerateResponse,
    summary="Сгенерировать расписание процедур",
    responses={
        422: {"description": "Ошибка валидации входных данных"},
    },
)
def api_generate_schedule(req: ScheduleGenerateRequest) -> ScheduleGenerateResponse:
    """
    Принимает список назначенных процедур и возвращает оптимальное
    расписание на 9 рабочих дней. Детерминированный алгоритм (<100 мс).
    """
    t0 = _time.monotonic()
    result = generate_schedule(req)
    elapsed_ms = (_time.monotonic() - t0) * 1000

    # Добавляем метрику в warnings (не ломает контракт — клиент может игнорировать).
    # В проде — Structured Logging / Prometheus, но для хакатона — так.
    result.warnings.insert(
        0,
        f"⏱ Алгоритм выполнен за {elapsed_ms:.1f} мс",
    )

    return result


@app.get("/health", summary="Liveness probe")
def health() -> dict[str, str]:
    return {"status": "ok"}
