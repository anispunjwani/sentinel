FROM python:3.11-slim

# Stream stdout/stderr immediately so Railway/Docker logs are not buffered.
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Run the application. Use `sh -c` so ${PORT} (injected by Railway) is expanded
# by a shell; falls back to 8000 locally. An exec-form array without a shell
# would pass "${PORT}" to uvicorn literally and fail with an invalid-port error.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
