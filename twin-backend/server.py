import os
import json
import tempfile
import uuid
from pathlib import Path
from typing import Optional, List, Dict
from datetime import datetime
import boto3
from botocore.exceptions import ClientError

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

from context import prompt

# ── Load environment variables ──────────────────────────────────────────────
load_dotenv(override=True)

# Handle GCP_KEY_JSON → temp file (for Cloud Function / Lambda deployment)
if os.getenv("GCP_KEY_JSON"):
    try:
        gcp_data = json.loads(os.environ["GCP_KEY_JSON"])
        tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".json")
        with open(tmp.name, "w") as f:
            json.dump(gcp_data, f)
        os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = tmp.name
    except Exception as e:
        print(f"[WARN] Could not parse GCP_KEY_JSON: {e}")

# Fix path for GOOGLE_APPLICATION_CREDENTIALS (works locally and on Lambda)
gcp_creds = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "")
twin_root = os.path.dirname(os.path.abspath(__file__))
packaged_key_path = os.path.join(twin_root, "etc", "secrets", "gcp-key.json")

# If the file exists in our packaged /etc/secrets directory, force use it 
# (This magically solves the issue on Lambda without needing AWS env vars)
if os.path.exists(packaged_key_path) and not os.getenv("GCP_KEY_JSON"):
    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = packaged_key_path
elif gcp_creds.startswith("/etc/secrets/") or gcp_creds.startswith("etc/secrets/"):
    if os.path.exists(packaged_key_path):
        os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = packaged_key_path

# Set Vertex AI env vars if credentials are present
if os.getenv("GOOGLE_APPLICATION_CREDENTIALS") and os.path.exists(
    os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "")
):
    os.environ["GOOGLE_GENAI_USE_VERTEXAI"] = "1"
    os.environ["GOOGLE_CLOUD_LOCATION"] = os.getenv("GCP_LOCATION", "us-central1")
    os.environ["GOOGLE_CLOUD_PROJECT"] = os.getenv(
        "GCP_PROJECT_ID", "project-d3cc105c-93d6-42fa-abc"
    )

# ── AWS Bedrock Client ───────────────────────────────────────────────────────
DEFAULT_AWS_REGION = os.getenv("DEFAULT_AWS_REGION", "us-east-1")
BEDROCK_MODEL_ID = os.getenv("BEDROCK_MODEL_ID", "global.amazon.nova-2-lite-v1:0")

bedrock_client = boto3.client(
    service_name="bedrock-runtime",
    region_name=DEFAULT_AWS_REGION,
)

# ── FastAPI App ──────────────────────────────────────────────────────────────
app = FastAPI(title="AI Digital Twin API")

# ── Memory Configuration (AWS S3 or Local) ───────────────────────────────────
USE_S3 = os.getenv("USE_S3", "false").lower() == "true"
S3_BUCKET = os.getenv("S3_BUCKET", "")
MEMORY_DIR = os.getenv("MEMORY_DIR", "memory")

if USE_S3:
    s3_client = boto3.client("s3")


def get_memory_path(session_id: str) -> str:
    return f"{session_id}.json"


def load_conversation(session_id: str) -> List[Dict]:
    """Load conversation history from storage (S3 or local)"""
    if USE_S3:
        try:
            response = s3_client.get_object(Bucket=S3_BUCKET, Key=get_memory_path(session_id))
            return json.loads(response["Body"].read().decode("utf-8"))
        except ClientError as e:
            if e.response["Error"]["Code"] == "NoSuchKey":
                return []
            raise
    else:
        # Local file storage
        file_path = os.path.join(MEMORY_DIR, get_memory_path(session_id))
        if os.path.exists(file_path):
            with open(file_path, "r", encoding="utf-8") as f:
                return json.load(f)
        return []


def save_conversation(session_id: str, messages: List[Dict]):
    """Save conversation history to storage (S3 or local)"""
    if USE_S3:
        s3_client.put_object(
            Bucket=S3_BUCKET,
            Key=get_memory_path(session_id),
            Body=json.dumps(messages, indent=2, ensure_ascii=False),
            ContentType="application/json",
        )
    else:
        # Local file storage
        os.makedirs(MEMORY_DIR, exist_ok=True)
        file_path = os.path.join(MEMORY_DIR, get_memory_path(session_id))
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(messages, f, indent=2, ensure_ascii=False)


# ── Models ────────────────────────────────────────────────────────────────────
class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None


class ChatResponse(BaseModel):
    response: str
    session_id: str


# ── Routes ────────────────────────────────────────────────────────────────────


def call_bedrock(conversation: list, user_message: str) -> str:
    """Call AWS Bedrock with conversation history - optimized for quota limits"""
    messages = []

    # Summarize: only use the most recent 3 messages
    recent_msgs = conversation[-3:] if len(conversation) > 0 else []
    
    for msg in recent_msgs:
        messages.append({
            "role": msg["role"],
            "content": [{"text": msg["content"]}],
        })

    messages.append({
        "role": "user",
        "content": [{"text": user_message}],
    })

    try:
        response = bedrock_client.converse(
            modelId=BEDROCK_MODEL_ID,
            messages=messages,
            inferenceConfig={
                "maxTokens": 500,  # Reduced from 1000
                "temperature": 0.5,  # Reduced from 0.7
            },
        )
    except ClientError as e:
        error_msg = str(e)
        # Return a friendly error message instead of crashing
        if "ThrottlingException" in error_msg or "Too many tokens" in error_msg:
            return "أعتذر، الخدمة مشغولة جداً الآن. يرجى المحاولة لاحقاً."
        raise HTTPException(status_code=500, detail=f"Bedrock error: {error_msg}")

    output = response.get("output", {}).get("message", {}).get("content")
    if not output or not isinstance(output, list):
        raise HTTPException(status_code=500, detail="Invalid Bedrock response format")

    return output[0].get("text", "").strip()


@app.get("/")
async def root():
    return {
        "message": "AI Digital Twin API (powered by AWS Bedrock)",
        "memory_enabled": True,
        "storage": "S3" if USE_S3 else "local",
        "bedrock_model": BEDROCK_MODEL_ID,
        "region": DEFAULT_AWS_REGION,
    }


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "use_s3": USE_S3,
        "bedrock_model": BEDROCK_MODEL_ID,
        "region": DEFAULT_AWS_REGION,
    }


@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    try:
        session_id = request.session_id or str(uuid.uuid4())
        conversation = load_conversation(session_id)

        assistant_response = call_bedrock(conversation, request.message)

        # Save to memory
        conversation.append(
            {"role": "user", "content": request.message, "timestamp": datetime.now().isoformat()}
        )
        conversation.append(
            {"role": "assistant", "content": assistant_response, "timestamp": datetime.now().isoformat()}
        )
        save_conversation(session_id, conversation)

        return ChatResponse(response=assistant_response, session_id=session_id)

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in chat endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/conversation/{session_id}")
async def get_conversation(session_id: str):
    """Retrieve conversation history"""
    try:
        conversation = load_conversation(session_id)
        return {"session_id": session_id, "messages": conversation}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
