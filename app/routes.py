import json
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from google import genai

from app.config import SUPPORTED_MODELS, DEFAULT_MODEL, get_default_api_key
from app.gemini_service import stream_gemini_response

router = APIRouter()

class ChatRequest(BaseModel):
    messages: List[Dict[str, Any]]
    model: Optional[str] = DEFAULT_MODEL
    api_key: Optional[str] = None

class VerifyKeyRequest(BaseModel):
    api_key: str

@router.get("/api/models")
async def get_models():
    """
    取得所有支援的 Gemini 模型清單（預設為 Gemini 3.1 Flash-Lite）
    """
    return {
        "default": DEFAULT_MODEL,
        "models": SUPPORTED_MODELS,
        "has_env_key": bool(get_default_api_key())
    }

@router.post("/api/chat")
async def chat_endpoint(req: ChatRequest):
    """
    對話端點：以 Server-Sent Events (SSE) 串流傳回模型回應
    """
    async def sse_event_generator():
        try:
            async for chunk in stream_gemini_response(
                messages=req.messages,
                model_name=req.model,
                api_key=req.api_key
            ):
                payload = json.dumps({"text": chunk}, ensure_ascii=False)
                yield f"data: {payload}\n\n"
        except Exception as e:
            err_payload = json.dumps({"error": str(e)}, ensure_ascii=False)
            yield f"data: {err_payload}\n\n"
        finally:
            yield "data: [DONE]\n\n"

    return StreamingResponse(
        sse_event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )

@router.post("/api/verify-key")
async def verify_key(req: VerifyKeyRequest):
    """
    驗證使用者輸入的 Gemini API Key 是否有效
    """
    key = req.api_key.strip()
    if not key:
        raise HTTPException(status_code=400, detail="API Key 不能為空")
        
    try:
        client = genai.Client(api_key=key)
        # 進行輕量快速 probe
        probe_model = "gemini-2.5-flash"
        res = client.models.generate_content(
            model=probe_model,
            contents="Ping"
        )
        return {"valid": True, "message": "API Key 驗證成功！"}
    except Exception as e:
        return {"valid": False, "message": f"驗證失敗：{str(e)}"}

@router.get("/api/status")
async def status():
    return {
        "status": "online",
        "system": "101 電子電路家教系統 (SHAPE Micro-Tutor)",
        "version": "1.0.0"
    }
