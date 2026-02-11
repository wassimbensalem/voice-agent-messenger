FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY whisper_requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r whisper_requirements.txt

# Copy application
COPY whisper_server.py .

# Create models directory
RUN mkdir -p /models

# Expose port
EXPOSE 8001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:8001/health || exit 1

# Start the server
CMD ["python", "whisper_server.py"]
