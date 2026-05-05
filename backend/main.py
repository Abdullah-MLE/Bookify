import os
import json
import tempfile

from dotenv import load_dotenv

load_dotenv(override=True)

# Handle GCP_KEY_JSON → temp file (for ECS/container deployment)
if os.getenv("GCP_KEY_JSON"):
    try:
        gcp_data = json.loads(os.environ["GCP_KEY_JSON"])
        tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".json", dir="/tmp")
        with open(tmp.name, "w") as f:
            json.dump(gcp_data, f)
        os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = tmp.name
    except Exception as e:
        print(f"[WARN] Could not parse GCP_KEY_JSON: {e}")

# Set Vertex AI env vars if credentials are present
gcp_creds = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "")
if gcp_creds and os.path.exists(gcp_creds):
    os.environ["GOOGLE_GENAI_USE_VERTEXAI"] = "1"
    os.environ["GOOGLE_CLOUD_LOCATION"] = os.getenv("GCP_LOCATION", "us-central1")
    os.environ["GOOGLE_CLOUD_PROJECT"] = os.getenv("GCP_PROJECT_ID", "")

from api.server import app
from api.routes.process import router as process_router

app.include_router(process_router, prefix="/api")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
