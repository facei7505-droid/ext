"""
Детерминированный алгоритм генерации расписания.

Стратегия (жадная, O(P × S), где P — сеансы, S — слоты):
  1. Генерируем сетку доступности на 9 рабочих дней.
  2. Для каждой процедуры сортируем её сеансы по порядковому номеру.
  3. Ищем первый свободный слот подходящего специалиста, начиная
     с даты start_date + procedure.start_after_days.
  4. Слот «резервируется» (статус → BOOKED), и последующие сеансы
     той же процедуры стремятся к тому же времени дня (стабильность
     расписания для пациента).
  5. Если стабильное время занято — ищем ближайшее свободное в тот же день,
     затем — в следующий рабочий день.
  6. Неразмещённые сеансы попадают в warnings.

Алгоритм НЕ использует LLM и гарантированно завершается за <100 мс
на реалистичных данных (≤6 процедур × ≤10 сеансов × ≤9 дней × ~60 слотов/день).
"""

from __future__ import annotations

from datetime import date, time, timedelta
from typing import Sequence

from .availability import generate_availability_grid
from .models import (
    ProcedureKind,
    ProcedureRequest,
    ScheduleGenerateRequest,
    ScheduleGenerateResponse,
    SlotInfo,
    SlotStatus,
    SpecialistSlot,
)


def generate_schedule(req: ScheduleGenerateRequest) -> ScheduleGenerateResponse:
    """
    Точка входа: запрос → расписание на 9 рабочих дней.
    """
    # 1. Сетка доступности (10-минутная гранулярность).
    grid = generate_availability_grid(
        start_date=req.start_date,
        num_working_days=9,
        include_saturday=req.include_saturday,
    )

    # Копия для мутации (статусы FREE → BOOKED).
    free = list(grid)  # мутируем на месте
    slots_result: list[SlotInfo] = []
    warnings: list[str] = []
    # Занятость пациента: { date: [(start_min, end_min), ...] }.
    # Один пациент не может быть в двух местах одновременно.
    patient_busy: dict[date, list[tuple[int, int]]] = {}

    # 2. Для каждой процедуры размещаем сеансы.
    for proc in req.procedures:
        # Дата, с которой разрешён первый сеанс данной процедуры.
        earliest = req.start_date + timedelta(days=proc.start_after_days)

        # Предпочитаемое время (если задано) — стремимся к нему для всех сеансов.
        preferred = proc.preferred_time

        for session_num in range(1, proc.sessions + 1):
            slot = _find_slot(
                free=free,
                specialty=proc.kind,
                duration_min=proc.duration_min,
                earliest_date=earliest,
                preferred_time=preferred,
                patient_busy=patient_busy,
            )

            if slot is None:
                warnings.append(
                    f"Не удалось разместить сеанс {session_num}/{proc.sessions} "
                    f"процедуры «{proc.name}» ({proc.kind.value})"
                )
                continue

            # Резервируем: помечаем затронутые 10-минутные слоты.
            _reserve_slots(free, slot, proc.duration_min)

            # Вычисляем время начала/конца сеанса.
            start_t = slot.start
            end_t = _add_minutes(start_t, proc.duration_min)

            # Регистрируем занятость пациента в этот день.
            patient_busy.setdefault(slot.date, []).append(
                (_to_min(start_t), _to_min(end_t))
            )

            slots_result.append(SlotInfo(
                date=slot.date,
                start=start_t,
                end=end_t,
                procedure_name=proc.name,
                procedure_kind=proc.kind,
                specialist=slot.specialist,
                room=slot.room,
                session_number=session_num,
                total_sessions=proc.sessions,
                status=SlotStatus.BOOKED,
            ))

            # Стабилизация: следующие сеансы стремятся к этому же времени.
            if preferred is None:
                preferred = start_t

    # 3. Сортируем итоговые слоты по дате/времени.
    slots_result.sort(key=lambda s: (s.date, s.start))

    # 4. Определяем диапазон дат.
    all_dates = [s.date for s in slots_result] if slots_result else [req.start_date]

    return ScheduleGenerateResponse(
        patient_id=req.patient_id,
        start_date=min(all_dates),
        end_date=max(all_dates),
        total_days=len(set(all_dates)),
        slots=slots_result,
        warnings=warnings,
    )


# ─────────────────────── Внутренние функции ───────────────────────


def _find_slot(
    free: list[SpecialistSlot],
    specialty: ProcedureKind,
    duration_min: int,
    earliest_date: date,
    preferred_time: time | None,
    patient_busy: dict[date, list[tuple[int, int]]],
) -> SpecialistSlot | None:
    """
    Ищет первый свободный слот нужной специальности, начиная с earliest_date,
    с непрерывной цепочкой длиной duration_min минут.
    Учитывает занятость пациента (нельзя поставить два сеанса в одно время).
    """
    candidates = [
        s for s in free
        if s.specialty == specialty
        and s.date >= earliest_date
        and s.status == SlotStatus.FREE
    ]

    if not candidates:
        return None

    candidates.sort(key=lambda s: (s.date, s.start))

    if preferred_time is not None:
        best = _find_contiguous(candidates, duration_min, preferred_time, patient_busy)
        if best:
            return best

    return _find_contiguous(candidates, duration_min, None, patient_busy)


def _find_contiguous(
    candidates: list[SpecialistSlot],
    duration_min: int,
    preferred_time: time | None,
    patient_busy: dict[date, list[tuple[int, int]]],
) -> SpecialistSlot | None:
    """
    Ищет непрерывный блок слотов общей длительностью ≥ duration_min.
    Один и тот же специалист, одна дата.
    Если preferred_time задано — ищем блок, начинающийся ближе всего к нему.
    """
    # Группируем по (specialist, date).
    from itertools import groupby as _gb
    candidates.sort(key=lambda s: (s.specialist, s.date, s.start))

    for (_spec, _dt), group_iter in _gb(candidates, key=lambda s: (s.specialist, s.date)):
        slots = list(group_iter)
        chain: list[SpecialistSlot] = []
        for s in slots:
            if chain and (s.start != chain[-1].end or s.specialist != chain[-1].specialist):
                chain = []
            chain.append(s)

            total = _minutes_between(chain[0].start, chain[-1].end)
            if total < duration_min:
                continue

            # Кандидаты на стартовый слот внутри цепочки.
            ranked: list[tuple[int, SpecialistSlot]] = []
            for i, cs in enumerate(chain):
                remaining = _minutes_between(cs.start, chain[-1].end)
                if remaining < duration_min:
                    continue
                # Исключаем пересечение с занятостью пациента в этот день.
                start_min = _to_min(cs.start)
                end_min = start_min + duration_min
                if _patient_overlaps(patient_busy.get(cs.date, []), start_min, end_min):
                    continue
                if preferred_time is not None:
                    dist = abs(_minutes_between(cs.start, preferred_time))
                else:
                    dist = i  # стабильно: чем раньше в цепочке, тем лучше
                ranked.append((dist, cs))

            if ranked:
                ranked.sort(key=lambda r: r[0])
                return ranked[0][1]

    return None


def _patient_overlaps(busy: list[tuple[int, int]], start: int, end: int) -> bool:
    """True, если [start, end) пересекается хотя бы с одним занятым интервалом."""
    for b_start, b_end in busy:
        if start < b_end and end > b_start:
            return True
    return False


def _to_min(t: time) -> int:
    return t.hour * 60 + t.minute


def _reserve_slots(free: list[SpecialistSlot], start_slot: SpecialistSlot, duration_min: int) -> None:
    """Помечает слоты как BOOKED на duration_min начиная с start_slot.start."""
    end_time = _add_minutes(start_slot.start, duration_min)
    for s in free:
        if (
            s.specialist == start_slot.specialist
            and s.date == start_slot.date
            and s.start >= start_slot.start
            and s.start < end_time
            and s.status == SlotStatus.FREE
        ):
            s.status = SlotStatus.BOOKED


def _add_minutes(t: time, minutes: int) -> time:
    dt = timedelta(hours=t.hour, minutes=t.minute) + timedelta(minutes=minutes)
    total_sec = int(dt.total_seconds())
    h, rem = divmod(total_sec, 3600)
    m, _ = divmod(rem, 60)
    return time(min(h, 23), min(m, 59))


def _minutes_between(a: time, b: time) -> int:
    return (b.hour * 60 + b.minute) - (a.hour * 60 + a.minute)
