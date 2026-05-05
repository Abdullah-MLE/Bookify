import asyncio
import base64
import os
from typing import List
from pydantic import BaseModel
from api.models.process import (
    ProcessRequest, ProcessResponse, VideoSummary, SummaryOption, 
    GenerateRequest, GenerateResponse, StyleRequest, StyleResponse, 
    ChatRequest, ChatResponse, MarkdownFile, CoverRequest, CoverResponse, CoverChatResponse
)
from core.dummy_data import (
    DUMMY_PLAYLIST_VIDEOS, DUMMY_SINGLE_VIDEO, DUMMY_SUMMARY_OPTIONS, 
    DUMMY_MARKDOWN_TEMPLATE
)
from libs.GeminiWrapper.GeminiWrapper import GeminiWrapper
from libs.GeminiWrapper.models import InputParams, TextParams

# --- GEMINI MODELS ---

class VideoInfo(BaseModel):
    title: str
    duration: str
    summary: str

class PlaylistAnalysis(BaseModel):
    videos: List[VideoInfo]
    total_duration: str

# --- UTILS ---

DUMMY_PDF_PATH = os.path.join(os.path.dirname(__file__), "..", "core", "dumy_pdf.pdf")
DUMMY_COVER_PATH = os.path.join(os.path.dirname(__file__), "..", "core", "dummy_cover.png")

def get_file_base64(path: str) -> str:
    """Reads a local file and returns its base64 string."""
    try:
        if os.path.exists(path):
            with open(path, "rb") as f:
                return base64.b64encode(f.read()).decode("utf-8")
    except Exception as e:
        print(f"Error reading file {path}: {e}")
    return ""

# --- SERVICES ---

async def process_media(request: ProcessRequest) -> ProcessResponse:
    """
    Real processing service using Gemini.
    Analyzes YouTube videos/playlists or files.
    """
    wrapper = GeminiWrapper()
    
    if request.source_type in ["yt-video", "yt-playlist"]:
        # Prepare the prompt for Gemini
        prompt = (
            f"Analyze this YouTube {request.source_type.replace('yt-', '')}: {request.url}\n"
            "Tell me the title, duration (in MM:SS or HH:MM:SS), and a 2-sentence summary for each video."
        )
        
        # Determine schema based on type
        response_schema = PlaylistAnalysis if request.source_type == "yt-playlist" else VideoInfo
        
        result = wrapper.generate_text(
            input_params=InputParams(
                prompt=prompt,
                media=None  # Removed media to avoid Vertex AI crash without mime_type
            ),
            text_params=TextParams(
                response_schema=response_schema,
                response_mime_type="application/json"  # Required by Vertex AI when using response_schema
            )
        )
        
        if result["success"]:
            data = result["content"]
            if request.source_type == "yt-playlist":
                videos = [VideoSummary(title=v.title, duration=v.duration, summary=v.summary) for v in data.videos]
                total_duration = data.total_duration
            else:
                videos = [VideoSummary(title=data.title, duration=data.duration, summary=data.summary)]
                total_duration = data.duration
        else:
            # Fallback if Gemini fails (for safety during dev)
            print(f"Gemini Error: {result['error']}")
            videos = DUMMY_SINGLE_VIDEO if request.source_type == "yt-video" else DUMMY_PLAYLIST_VIDEOS
            total_duration = "00:00"
            
    elif request.source_type == "file" and request.file_names:
        # For files, we still use dummy for now but structured
        videos = [VideoSummary(title=name, duration=f"{(i + 1) * 5}:00", summary=f"Summary for uploaded file '{name}'.") for i, name in enumerate(request.file_names)]
        total_duration = f"{len(videos) * 5}:00"
    else:
        videos = DUMMY_SINGLE_VIDEO
        total_duration = "18:30"

    return ProcessResponse(
        source_type=request.source_type,
        videos=videos,
        total_duration=total_duration,
        summary_options=DUMMY_SUMMARY_OPTIONS
    )

async def generate_markdown(request: GenerateRequest) -> GenerateResponse:
    """Simulates final book generation. Returns dummy markdown after 1 second."""
    await asyncio.sleep(1)
    title_suffix = request.option_id.replace('-', ' ').title()
    files = []
    if request.separate_chapters:
        for i, video in enumerate(DUMMY_PLAYLIST_VIDEOS):
            content = DUMMY_MARKDOWN_TEMPLATE.format(title=f"{video.title} ({title_suffix})", style=request.option_id, mode='Separate Chapter')
            files.append(MarkdownFile(content=content, filename=f"Chapter_{i+1}_{request.option_id}.md"))
    else:
        content = DUMMY_MARKDOWN_TEMPLATE.format(title=f"Complete Summary ({title_suffix})", style=request.option_id, mode='Consolidated AI-Optimized')
        files.append(MarkdownFile(content=content, filename=f"AI_Summary_{request.option_id}.md"))
    return GenerateResponse(files=files)

async def generate_style_pdf(request: StyleRequest) -> StyleResponse:
    """Simulates styling a PDF. Returns dummy base64 after 1 second."""
    await asyncio.sleep(1)
    pdf_b64 = get_file_base64(DUMMY_PDF_PATH)
    return StyleResponse(pdf_base64=pdf_b64, cost=1.50)

async def update_style_pdf(request: ChatRequest) -> ChatResponse:
    """Simulates updating a PDF via chat. Returns dummy base64 after 1 second."""
    await asyncio.sleep(1)
    pdf_b64 = get_file_base64(DUMMY_PDF_PATH)
    return ChatResponse(pdf_base64=pdf_b64, ai_message="Done! I have applied the styling changes based on your request.")

async def generate_book_cover(request: CoverRequest) -> CoverResponse:
    """Simulates cover generation. Returns dummy image base64 after 1 second."""
    await asyncio.sleep(1)
    img_b64 = get_file_base64(DUMMY_COVER_PATH)
    return CoverResponse(image_base64=img_b64, cost=2.00)

async def update_book_cover(request: ChatRequest) -> CoverChatResponse:
    """Simulates updating a cover via chat. Returns dummy image base64 after 1 second."""
    await asyncio.sleep(1)
    img_b64 = get_file_base64(DUMMY_COVER_PATH)
    return CoverChatResponse(image_base64=img_b64, ai_message="Done!")
