"""API endpoints for UK Spring Statement 2026 dashboard (DRAFT).

TODO: Implement UK Spring Statement API endpoints.
"""

from flask import Flask

app = Flask(__name__)


@app.route("/api/health")
def health():
    return {"status": "ok"}
