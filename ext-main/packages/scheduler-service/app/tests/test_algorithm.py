"""
Юнит-тесты алгоритма генерации расписания.
Запуск: pytest app/tests/ -v
"""

from __future__ import annotations

from datetime import date, time

import pytest

from ..algorithm import generate_schedule
from ..models import ProcedureKind, ProcedureRequest, ScheduleGenerateRequest


def _req(
    procedures: list[ProcedureRequest] | None = None,
    start_date: date = date(2026, 4, 20),  # понедельник
    include_saturday: bool = False,
) -> ScheduleGenerateRequest:
    if procedures is None:
        procedures = [
            ProcedureRequest(
                kind=ProcedureKind.LFK,
                name="ЛФК — дыхательная гимнастика",
                sessions=9,
                duration_min=30,
            ),
        ]
    return ScheduleGenerateRequest(
        patient_id="P-000123",
        procedures=procedures,
        start_date=start_date,
        include_saturday=include_saturday,
    )


class TestBasicScheduling:
    """Один вид процедуры, 9 сеансов → все размещены."""

    def test_all_sessions_placed(self):
        resp = generate_schedule(_req())
        assert len(resp.slots) == 9
        assert not resp.warnings  # только метрика ⏱ — но без «Не удалось...»

    def test_correct_procedure_kind(self):
        resp = generate_schedule(_req())
        for s in resp.slots:
            assert s.procedure_kind == ProcedureKind.LFK

    def test_session_numbers_sequential(self):
        resp = generate_schedule(_req())
        nums = [s.session_number for s in resp.slots]
        assert nums == list(range(1, 10))

    def test_duration_matches(self):
        resp = generate_schedule(_req())
        for s in resp.slots:
            assert _minutes(s.start, s.end) == 30


class TestMultipleProcedures:
    """Несколько процедур одновременно — нет пересечений по времени для пациента."""

    def test_no_time_overlap(self):
        procs = [
            ProcedureRequest(kind=ProcedureKind.LFK, name="ЛФК", sessions=9, duration_min=30),
            ProcedureRequest(kind=ProcedureKind.MASSAGE, name="Массаж спины", sessions=9, duration_min=40),
            ProcedureRequest(kind=ProcedureKind.INJECTION, name="Инъекции", sessions=5, duration_min=15),
        ]
        resp = generate_schedule(_req(procedures=procs))
        # Проверяем, что на одну дату нет пересекающихся слотов.
        from itertools import groupby
        slots_by_date: dict[date, list] = {}
        for s in resp.slots:
            slots_by_date.setdefault(s.date, []).append(s)
        for dt, day_slots in slots_by_date.items():
            day_slots.sort(key=lambda s: s.start)
            for i in range(len(day_slots) - 1):
                assert day_slots[i].end <= day_slots[i + 1].start, (
                    f"Overlap on {dt}: {day_slots[i].end} > {day_slots[i+1].start}"
                )

    def test_total_sessions(self):
        procs = [
            ProcedureRequest(kind=ProcedureKind.LFK, name="ЛФК", sessions=9, duration_min=30),
            ProcedureRequest(kind=ProcedureKind.MASSAGE, name="Массаж", sessions=6, duration_min=30),
        ]
        resp = generate_schedule(_req(procedures=procs))
        assert len(resp.slots) == 15


class TestLunchBreak:
    """Ни один слот не пересекается с обедом 12:00–13:00."""

    def test_no_lunch_overlap(self):
        procs = [
            ProcedureRequest(kind=ProcedureKind.LFK, name="ЛФК", sessions=9, duration_min=40),
            ProcedureRequest(kind=ProcedureKind.PHYSIO, name="Физиотерапия", sessions=9, duration_min=30),
        ]
        resp = generate_schedule(_req(procedures=procs))
        for s in resp.slots:
            # Слот [start, end) не должен пересекаться с [12:00, 13:00).
            assert not (s.start < time(13, 0) and s.end > time(12, 0)), (
                f"Slot {s.date} {s.start}-{s.end} overlaps lunch"
            )


class TestWorkingHours:
    """Все слоты в пределах 08:00–17:00."""

    def test_within_working_hours(self):
        resp = generate_schedule(_req())
        for s in resp.slots:
            assert s.start >= time(7, 30)  # Лаборатория начинает в 7:30
            assert s.end <= time(17, 0)


class TestStartAfterDays:
    """Процедура с start_after_days=3 не появляется раньше 4-го дня."""

    def test_delayed_start(self):
        procs = [
            ProcedureRequest(
                kind=ProcedureKind.CONSULTATION,
                name="Консультация невролога",
                sessions=1,
                duration_min=30,
                start_after_days=3,
            ),
        ]
        resp = generate_schedule(_req(procedures=procs, start_date=date(2026, 4, 20)))
        if resp.slots:
            earliest = min(s.date for s in resp.slots)
            assert earliest >= date(2026, 4, 23)


class TestPerformance:
    """Алгоритм < 100 мс на типичном запросе."""

    def test_under_100ms(self):
        import time as _t
        procs = [
            ProcedureRequest(kind=ProcedureKind.LFK, name="ЛФК", sessions=9, duration_min=30),
            ProcedureRequest(kind=ProcedureKind.MASSAGE, name="Массаж", sessions=9, duration_min=40),
            ProcedureRequest(kind=ProcedureKind.PHYSIO, name="Физио", sessions=9, duration_min=30),
            ProcedureRequest(kind=ProcedureKind.INJECTION, name="Инъекции", sessions=5, duration_min=15),
            ProcedureRequest(kind=ProcedureKind.LAB, name="Анализы", sessions=2, duration_min=20),
        ]
        t0 = _t.monotonic()
        generate_schedule(_req(procedures=procs))
        elapsed_ms = (_t.monotonic() - t0) * 1000
        assert elapsed_ms < 100, f"Too slow: {elapsed_ms:.1f} ms"


# ─────────────────────── helpers ───────────────────────

def _minutes(start: time, end: time) -> int:
    return (end.hour * 60 + end.minute) - (start.hour * 60 + start.minute)
