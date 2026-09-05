# syntax=docker/dockerfile:1
# ── Stage 1: Builder ───────────────────────────────────────────────────────────
FROM python:3.12-slim AS builder
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY apps/quant-engine/requirements.txt ./
RUN pip install --no-cache-dir --user -r requirements.txt

# ── Stage 2: Production Runner ────────────────────────────────────────────────
FROM python:3.12-slim AS runner
WORKDIR /app

RUN groupadd -g 1001 quant && \
    useradd -u 1001 -g quant -s /bin/bash -m quant

COPY --from=builder --chown=quant:quant /root/.local /home/quant/.local
COPY --chown=quant:quant apps/quant-engine/src ./src
COPY --chown=quant:quant apps/quant-engine/pyproject.toml ./

ENV PATH=/home/quant/.local/bin:$PATH
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

USER quant
EXPOSE 8001

ENTRYPOINT ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8001"]
