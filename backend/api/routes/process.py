from fastapi import APIRouter
from api.models.process import (
    ProcessRequest, ProcessResponse, GenerateRequest, GenerateResponse,
    StyleRequest, StyleResponse, ChatRequest, ChatResponse,
    CoverRequest, CoverResponse, CoverChatResponse
)
from services.process_service import (
    process_media, generate_markdown, generate_style_pdf, update_style_pdf,
    generate_book_cover, update_book_cover
)

router = APIRouter(tags=["process"])


@router.post("/process", response_model=ProcessResponse)
async def process_endpoint(request: ProcessRequest) -> ProcessResponse:
    return await process_media(request)


@router.post("/generate", response_model=GenerateResponse)
async def generate_endpoint(request: GenerateRequest) -> GenerateResponse:
    return await generate_markdown(request)


@router.post("/style", response_model=StyleResponse)
async def style_endpoint(request: StyleRequest) -> StyleResponse:
    """
    Initial PDF styling based on a prompt.
    """
    return await generate_style_pdf(request)


@router.post("/style/chat", response_model=ChatResponse)
async def style_chat_endpoint(request: ChatRequest) -> ChatResponse:
    """
    Update PDF styling via interactive chat.
    """
    return await update_style_pdf(request)


@router.post("/cover", response_model=CoverResponse)
async def cover_endpoint(request: CoverRequest) -> CoverResponse:
    """
    Generate a book cover.
    """
    return await generate_book_cover(request)


@router.post("/cover/chat", response_model=CoverChatResponse)
async def cover_chat_endpoint(request: ChatRequest) -> CoverChatResponse:
    """
    Update book cover via chat.
    """
    return await update_book_cover(request)
