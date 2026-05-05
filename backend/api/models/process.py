from pydantic import BaseModel
from typing import Optional, List


class ProcessRequest(BaseModel):
    """Request body for the process endpoint."""
    source_type: str          # "yt-video" | "yt-playlist" | "file"
    url: Optional[str] = None
    file_names: Optional[List[str]] = None
    custom_prompt: Optional[str] = None


class SummaryOption(BaseModel):
    """Configuration option for the summary style."""
    id: str                   # "very-summarized" | "summarized" | "detailed"
    label: str
    description: str
    cost: float
    estimated_time: str
    estimated_pages: int


class VideoSummary(BaseModel):
    """Summary data for a single video or file."""
    title: str
    duration: str             # e.g. "12:34"
    summary: str


class ProcessResponse(BaseModel):
    """Response returned after processing."""
    source_type: str
    videos: List[VideoSummary]
    total_duration: str
    summary_options: List[SummaryOption]


class GenerateRequest(BaseModel):
    """Request to generate the final book/markdown."""
    option_id: str            # "very-summarized" | "summarized" | "detailed"
    separate_chapters: bool
    # In a real app, you'd also send the video data or a session ID here


class MarkdownFile(BaseModel):
    """A single markdown file content and its name."""
    content: str
    filename: str


class GenerateResponse(BaseModel):
    """Final response containing one or more markdown files."""
    files: List[MarkdownFile]


class StyleRequest(BaseModel):
    """Request to generate a styled PDF."""
    prompt: str


class StyleResponse(BaseModel):
    """Response with the styled PDF preview."""
    pdf_base64: str
    cost: float


class ChatMessage(BaseModel):
    role: str                 # "user" | "assistant"
    content: str


class ChatRequest(BaseModel):
    """Request to update style via chat."""
    prompt: str
    history: List[ChatMessage]


class ChatResponse(BaseModel):
    """Response from the styling chat."""
    pdf_base64: str
    ai_message: str


class CoverRequest(BaseModel):
    """Request to generate a book cover."""
    prompt: str


class CoverResponse(BaseModel):
    """Response with the generated cover image."""
    image_base64: str
    cost: float


class CoverChatResponse(BaseModel):
    """Response from the cover chat."""
    image_base64: str
    ai_message: str
