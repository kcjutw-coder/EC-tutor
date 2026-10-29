import base64
import re
from typing import AsyncGenerator, List, Dict, Any, Optional
from google import genai
from google.genai import types
from google.genai.errors import APIError

from app.config import DEFAULT_MODEL, get_default_api_key
from app.prompts import CIRCUIT_TUTOR_SYSTEM_INSTRUCTION

def parse_image_data_url(data_url: str):
    """
    解析 data:image/png;base64,... 格式的字串，傳回 (bytes, mime_type)
    """
    match = re.match(r"^data:(image\/[a-zA-Z0-9.+_-]+);base64,(.+)$", data_url)
    if match:
        mime_type = match.group(1)
        raw_b64 = match.group(2)
        image_bytes = base64.b64decode(raw_b64)
        return image_bytes, mime_type
    
    # 若為純 base64
    image_bytes = base64.b64decode(data_url)
    return image_bytes, "image/jpeg"

def build_gemini_contents(messages: List[Dict[str, Any]]) -> List[types.Content]:
    """
    將前端傳入的對話紀錄轉為 google.genai 的 types.Content 串列
    """
    contents = []
    
    for msg in messages:
        role = "user" if msg.get("role") in ["user", "student"] else "model"
        parts = []
        
        # 檢查是否有附帶圖片 (僅限使用者訊息)
        image_data = msg.get("image")
        if image_data and role == "user":
            try:
                img_bytes, mime_type = parse_image_data_url(image_data)
                parts.append(types.Part.from_bytes(data=img_bytes, mime_type=mime_type))
            except Exception as e:
                print(f"[Warn] 無法解析圖片: {e}")
        
        # 加上文字內容
        text_content = msg.get("content", "").strip()
        if text_content:
            parts.append(types.Part.from_text(text=text_content))
            
        if parts:
            contents.append(types.Content(role=role, parts=parts))
            
    return contents

async def stream_gemini_response(
    messages: List[Dict[str, Any]],
    model_name: Optional[str] = None,
    api_key: Optional[str] = None
) -> AsyncGenerator[str, None]:
    """
    串流產生 Gemini 家教的回覆內容 (非同步產生器)
    """
    resolved_key = (api_key or "").strip() or get_default_api_key()
    if not resolved_key:
        yield "【系統提示】尚未設定 Gemini API Key。請點選右上角「API Key 設定」輸入您的金鑰後即可開始對話！"
        return
        
    resolved_model = (model_name or "").strip() or DEFAULT_MODEL
    
    try:
        client = genai.Client(api_key=resolved_key)
        contents = build_gemini_contents(messages)
        
        if not contents:
            yield "請輸入訊息或上傳電路圖以開始提問。"
            return

        config = types.GenerateContentConfig(
            system_instruction=CIRCUIT_TUTOR_SYSTEM_INSTRUCTION,
            temperature=0.3,
        )

        response_stream = client.models.generate_content_stream(
            model=resolved_model,
            contents=contents,
            config=config
        )
        
        for chunk in response_stream:
            if chunk.text:
                yield chunk.text
                
    except APIError as e:
        error_msg = str(e)
        if "404" in error_msg or "not found" in error_msg.lower():
            yield f"【模型提示】目前 API Key 帳號尚未啟用模型 `{resolved_model}`（可能尚未開放或名稱差異）。建議切換為 `gemini-2.5-flash` 或其他可用模型測試！\n\n錯誤詳情：{error_msg}"
        elif "API_KEY_INVALID" in error_msg or "400" in error_msg:
            yield f"【認證錯誤】您的 Gemini API Key 無效或未被授權。請檢查右上角設定中的 API Key。\n\n詳細訊息：{error_msg}"
        else:
            yield f"【連線異常】Gemini API 回傳錯誤：{error_msg}"
    except Exception as e:
        yield f"【系統錯誤】處理訊息時發生未預期狀況：{str(e)}"
