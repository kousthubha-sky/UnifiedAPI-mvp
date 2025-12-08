# OneRouter Backend - FastAPI
# Multi-stage build for optimized production image

# ============================================
# Build stage
# ============================================
FROM python:3.11-slim AS builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install uv for fast package management
RUN pip install --no-cache-dir uv

# Copy dependency files
COPY pyproject.toml ./

# Create virtual environment and install dependencies
RUN uv venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
RUN uv pip install --no-cache .

# ============================================
# Production stage
# ============================================
FROM python:3.11-slim AS production

WORKDIR /app

# Create non-root user for security
RUN groupadd --gid 1000 appgroup \
    && useradd --uid 1000 --gid appgroup --shell /bin/bash --create-home appuser

# Copy virtual environment from builder
COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Copy application code
COPY app/ ./app/

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    NODE_ENV=production \
    PORT=3001 \
    HOST=0.0.0.0

# Change ownership to non-root user
RUN chown -R appuser:appgroup /app

# Switch to non-root user
USER appuser

# Expose port (matches existing backend)
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import httpx; httpx.get('http://localhost:3001/health').raise_for_status()"

# Run the application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "3001"]

# ============================================
# Development stage
# ============================================
FROM production AS development

# Switch to root to install dev dependencies
USER root

# Install development dependencies
RUN /opt/venv/bin/pip install --no-cache-dir pytest pytest-asyncio pytest-cov httpx ruff mypy

# Switch back to non-root user
USER appuser

# Run with hot reload in development
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "3001", "--reload"]
