"""
Pydantic-модели для валидации входящих/исходящих данных эндпоинта расписания.
Имена полей согласованы с ScheduleForm из crm-mock (Модуль 1) и StructuredVisit
из ai/types.ts (Модуль 3), чтобы end-to-end поток данных был бесшовным.
"""

from __future__ import annotations

from datetime import date, time
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field, field_validator


# ─────────────────────────── Enums ───────────────────────────


class ProcedureKind(str, Enum):
    """Тип процедуры. Расширяемый — новые виды добавляются сюда."""
    LFK = "lfk"            # Лечебная физкультура
    MASSAGE = "massage"     # Массаж
    PHYSIO = "physio"       # Физиотерапия
    INJECTION = "injection" # Инъекции
    CONSULTATION = "consultation"  # Консультация специалиста
    LAB = "lab"             # Лабораторные исследования


class SlotStatus(str, Enum):
    FREE = "free"
    BOOKED = "booked"
    BREAK = "break"         # Обед / тех. перерыв


# ─────────────────────────── Входящие ───────────────────────────


class ProcedureRequest(BaseModel):
    """Одна назначенная процедура, которую нужно распределить по слотам."""
    kind: ProcedureKind
    name: str = Field(..., min_length=1, max_length=200,
                      description="Название, напр. 'Массаж воротниковой зоны'")
    sessions: int = Field(1, ge=1, le=20,
                          description="Количество сеансов (обычно 9–10)")
    duration_min: int = Field(30, ge=15, le=60,
                              description="Длительность одного сеанса, мин")
    preferred_time: Optional[time] = Field(
        None, description="Предпочитаемое время начала (если есть)")
    # Доп. ограничение: через сколько дней от начала курса разрешён первый сеанс.
    start_after_days: int = Field(0, ge=0, le=8)


class ScheduleGenerateRequest(BaseModel):
    """Тело POST /api/v1/schedule/generate."""
    patient_id: str = Field(..., pattern=r"^P-\d{6}$",
                            description="ID пациента из КМИС")
    procedures: list[ProcedureRequest] = Field(..., min_length=1)
    start_date: date = Field(..., description="Дата начала курса")
    # Если True — суббота считается рабочим днём (некоторые стационары).
    include_saturday: bool = False

    @field_validator("procedures")
    @classmethod
    def _at_least_one(cls, v: list[ProcedureRequest]) -> list[ProcedureRequest]:
        if not v:
            raise ValueError("At least one procedure is required")
        return v


# ─────────────────────────── Исходящие ───────────────────────────


class SlotInfo(BaseModel):
    """Один слот в итоговом расписании."""
    date: date
    start: time
    end: time
    procedure_name: str
    procedure_kind: ProcedureKind
    specialist: str
    room: str
    session_number: int        # Порядковый номер сеанса данной процедуры
    total_sessions: int
    status: SlotStatus = SlotStatus.BOOKED


class ScheduleGenerateResponse(BaseModel):
    patient_id: str
    start_date: date
    end_date: date
    total_days: int
    slots: list[SlotInfo]
    warnings: list[str] = Field(default_factory=list,
        description="Неразрешённые конфликты или пропуски, если алгоритм не смог разместить все сеансы")


# ─────────────────────────── Внутренние ───────────────────────────


class SpecialistSlot(BaseModel):
    """Сырой слот доступности специалиста (из хардкода)."""
    specialist: str
    specialty: ProcedureKind
    room: str
    date: date
    start: time
    end: time
    status: SlotStatus = SlotStatus.FREE
