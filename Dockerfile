FROM python:3.13-slim
WORKDIR /app
COPY pyproject.toml .
COPY src/ src/
RUN pip install --no-cache-dir .
EXPOSE 5002
CMD ["uvicorn", "spring_statement_data.api:app", "--host", "0.0.0.0", "--port", "5002"]
