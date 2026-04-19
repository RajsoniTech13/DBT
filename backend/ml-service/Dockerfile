FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py .

# This is a worker, not a web server — run the script directly
CMD ["python", "-u", "app.py"]
