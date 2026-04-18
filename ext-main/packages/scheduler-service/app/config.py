"""
Конфигурация микросервиса.
Все значения — через переменные окружения, с разумными дефолтами.
"""

import os

HOST = os.getenv("SCHEDULER_HOST", "0.0.0.0")
PORT = int(os.getenv("SCHEDULER_PORT", "8000"))
LOG_LEVEL = os.getenv("SCHEDULER_LOG_LEVEL", "info")
