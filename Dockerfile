# Dockerfile for StructAgent
FROM python:3.12-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for caching
COPY environment.yml .
RUN pip install --no-cache-dir \
    flask==3.1.2 \
    httpx==0.28.1 \
    numpy \
    openseespy \
    pydantic==2.13.2 \
    pydantic-ai==1.5.0 \
    pydantic-settings==2.13.1 \
    python-dotenv==1.2.2 \
    pytest==8.3.4 \
    pytest-cov==6.0.0 \
    waitress==3.0.2

# Copy application code
COPY . .

# Create non-root user
RUN useradd --create-home appuser && chown -R appuser:appuser /app
USER appuser

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:5000/health')" || exit 1

# Run with waitress for production
CMD ["waitress-serve", "--listen=0.0.0.0:5000", "--threads=4", "app.main:app"]
