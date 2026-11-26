FROM python:3.13-slim
RUN apt-get update && apt-get install -y --no-install-recommends git && rm -rf /var/lib/apt/lists/*
COPY git_server.py /app/git_server.py
COPY repo.git /git/repo.git
EXPOSE 8080
CMD ["python", "/app/git_server.py"]
