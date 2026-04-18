"""
Захардкоженная матрица доступности специалистов.

Каждый специалист имеет фиксированный недельный шаблон (день → слоты).
Алгоритм генерации расписания раскрывает этот шаблон на 9 рабочих дней,
учитывая обед (12:00–13:00) и рабочие часы (08:00–17:00).

Чтобы добавить нового специалиста — просто расширь SPECIALISTS.
"""

from __future__ import annotations

from datetime import date, time, timedelta
from typing import Sequence

from .models import ProcedureKind, SpecialistSlot, SlotStatus

# ─────────────────────── Константы рабочего дня ───────────────────────

WORK_START = time(8, 0)
WORK_END = time(17, 0)
LUNCH_START = time(12, 0)
LUNCH_END = time(13, 0)
SLOT_STEP_MIN = 10  # Гранулярность сетки — 10 мин (алгоритм объединяет в 30-40 мин слоты)

# ─────────────────────── Шаблоны специалистов ───────────────────────

_WEEKDAY_NAMES = ("mon", "tue", "wed", "thu", "fri", "sat", "sun")


class _DaySchedule(list):
    """Список (start_hour, start_min, end_hour, end_min) на один день."""
    pass


# Каждый специалист: (ФИО, специальность, кабинет, {день_недели: слоты})
# Слоты — рабочие интервалы ДО обеда и ПОСЛЕ обеда.
_SPECIALIST_TEMPLATES: list[tuple[str, ProcedureKind, str, dict[str, list[tuple[int, int, int, int]]]]] = [
    (
        "Смирнова Е.А.",
        ProcedureKind.LFK,
        "Каб. 301",
        {
            "mon": [(8, 0, 12, 0), (13, 0, 16, 30)],
            "tue": [(8, 0, 12, 0), (13, 0, 17, 0)],
            "wed": [(8, 0, 11, 30), (13, 0, 16, 0)],
            "thu": [(8, 0, 12, 0), (13, 0, 17, 0)],
            "fri": [(8, 0, 12, 0), (13, 0, 15, 30)],
        },
    ),
    (
        "Козлова И.С.",
        ProcedureKind.MASSAGE,
        "Каб. 210",
        {
            "mon": [(8, 0, 12, 0), (13, 0, 17, 0)],
            "tue": [(8, 0, 12, 0), (13, 0, 17, 0)],
            "wed": [(8, 30, 12, 0), (13, 0, 16, 30)],
            "thu": [(8, 0, 12, 0), (13, 0, 17, 0)],
            "fri": [(8, 0, 11, 0), (13, 0, 16, 0)],
        },
    ),
    (
        "Новиков Д.В.",
        ProcedureKind.PHYSIO,
        "Каб. 405",
        {
            "mon": [(8, 0, 12, 0), (13, 0, 17, 0)],
            "tue": [(8, 0, 12, 0)],
            "wed": [(8, 0, 12, 0), (13, 0, 17, 0)],
            "thu": [(8, 0, 12, 0), (13, 0, 17, 0)],
            "fri": [(8, 0, 12, 0), (13, 0, 15, 0)],
        },
    ),
    (
        "Федорова Н.П.",
        ProcedureKind.INJECTION,
        "Каб. 108 (процедурный)",
        {
            "mon": [(8, 0, 12, 0), (13, 0, 17, 0)],
            "tue": [(8, 0, 12, 0), (13, 0, 17, 0)],
            "wed": [(8, 0, 12, 0), (13, 0, 17, 0)],
            "thu": [(8, 0, 12, 0), (13, 0, 17, 0)],
            "fri": [(8, 0, 12, 0), (13, 0, 17, 0)],
        },
    ),
    (
        "Беляков А.М.",
        ProcedureKind.CONSULTATION,
        "Каб. 215",
        {
            "mon": [(9, 0, 12, 0), (13, 0, 16, 0)],
            "tue": [(9, 0, 12, 0), (13, 0, 15, 30)],
            "wed": [(9, 0, 12, 0)],
            "thu": [(9, 0, 12, 0), (13, 0, 16, 0)],
            "fri": [(9, 0, 12, 0), (13, 0, 14, 0)],
        },
    ),
    (
        "Лаборатория",
        ProcedureKind.LAB,
        "Лаб. (этаж 1)",
        {
            "mon": [(7, 30, 12, 0), (13, 0, 16, 0)],
            "tue": [(7, 30, 12, 0), (13, 0, 16, 0)],
            "wed": [(7, 30, 12, 0), (13, 0, 16, 0)],
            "thu": [(7, 30, 12, 0), (13, 0, 16, 0)],
            "fri": [(7, 30, 12, 0), (13, 0, 15, 0)],
        },
    ),
]


def _is_working_day(d: date, include_saturday: bool) -> bool:
    """Пн–Пт всегда рабочие; Сб — опционально; Вс — выходной."""
    wd = d.weekday()  # 0=Mon … 6=Sun
    if wd < 5:
        return True
    if wd == 5 and include_saturday:
        return True
    return False


def _weekday_key(d: date) -> str:
    return _WEEKDAY_NAMES[d.weekday()]


def generate_availability_grid(
    start_date: date,
    num_working_days: int = 9,
    include_saturday: bool = False,
) -> list[SpecialistSlot]:
    """
    Разворачивает шаблоны специалистов на `num_working_days` рабочих дней,
    начиная с `start_date`. Возвращает плоский список SpecialistSlot
    с гранулярностью SLOT_STEP_MIN (10 мин).
    """
    slots: list[SpecialistSlot] = []
    current = start_date
    days_counted = 0

    while days_counted < num_working_days:
        if not _is_working_day(current, include_saturday):
            current += timedelta(days=1)
            continue

        day_key = _weekday_key(current)

        for name, specialty, room, schedule in _SPECIALIST_TEMPLATES:
            intervals = schedule.get(day_key, [])
            for (sh, sm, eh, em) in intervals:
                t = time(sh, sm)
                end_t = time(eh, em)
                # Нарезаем на SLOT_STEP_MIN-слоты.
                while t < end_t:
                    next_t = _add_minutes(t, SLOT_STEP_MIN)
                    if next_t > end_t:
                        next_t = end_t
                    # Пропускаем слоты, пересекающиеся с обедом.
                    if _overlaps_lunch(t, next_t):
                        t = max(t, LUNCH_END) if t < LUNCH_END else next_t
                        continue
                    slots.append(SpecialistSlot(
                        specialist=name,
                        specialty=specialty,
                        room=room,
                        date=current,
                        start=t,
                        end=next_t,
                        status=SlotStatus.FREE,
                    ))
                    t = next_t

        days_counted += 1
        current += timedelta(days=1)

    return slots


def _add_minutes(t: time, minutes: int) -> time:
    """Безопасное сложение time + минуты (переход через полночь невозможен в рабочем дне)."""
    dt = timedelta(hours=t.hour, minutes=t.minute) + timedelta(minutes=minutes)
    total_sec = int(dt.total_seconds())
    h, rem = divmod(total_sec, 3600)
    m, _ = divmod(rem, 60)
    return time(min(h, 23), min(m, 59))


def _overlaps_lunch(start: time, end: time) -> bool:
    """True, если интервал [start, end) пересекается с обедом [12:00, 13:00)."""
    return start < LUNCH_END and end > LUNCH_START
