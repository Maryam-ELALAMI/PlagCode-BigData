FROM python:3.9-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

# Copy code
COPY . .

# Create uploads directory (kept for backward compatibility; runtime storage is MinIO)
RUN mkdir -p uploads

# Expose port (internal)
EXPOSE 8000

# Run the application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
