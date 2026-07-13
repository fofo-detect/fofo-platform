FROM python:3.11-slim

WORKDIR /app

# Runtime deps for opencv-python-headless / TensorFlow.
# Deliberately no libxcb / X11 / GL / display libraries - this runs headless.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 \
    libgomp1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
# deepface pulls in opencv-python (GUI build) as a transitive dependency, which can
# silently overwrite opencv-python-headless depending on resolver order. Force the
# headless build back on top so `import cv2` never needs libGL / X11 at runtime.
RUN pip install --no-cache-dir --force-reinstall --no-deps opencv-python-headless==4.10.0.84

COPY . .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
