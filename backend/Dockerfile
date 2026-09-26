# syntax=docker/dockerfile:1
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

# Runtime image only: every dependency ships a manylinux wheel, so no compiler
# or libpq headers are installed. Fonts cover Cyrillic in PDF reports.
RUN apt-get update && apt-get install -y --no-install-recommends fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --gid 1001 radar \
    && useradd --uid 1001 --gid 1001 --no-create-home --shell /usr/sbin/nologin radar \
    && mkdir -p /data/storage /data/model-cache \
    && chown 1001:1001 /data/storage /data/model-cache

WORKDIR /app

# Hash-pinned dependencies (see the header of requirements.lock to regenerate):
# a compromised or re-published upstream release cannot slip into a build.
# Sandbox/CI networking to PyPI has been flaky, hence the timeout/retries.
COPY requirements.lock ./
RUN pip install --timeout 120 --retries 10 --require-hashes --no-deps -r requirements.lock

# The application runs from source in WORKDIR; tests and dev tooling stay out
# of the production image.
COPY alembic.ini ./
COPY alembic ./alembic
COPY app ./app

USER 1001:1001
EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
