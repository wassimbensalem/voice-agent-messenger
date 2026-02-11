FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for Piper
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY piper_requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r piper_requirements.txt

# Copy application
COPY piper_server.py .

# Create models directory
RUN mkdir -p /models

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:5000/health || exit 1

# Start the server
CMD ["python", "piper_server.py"]
