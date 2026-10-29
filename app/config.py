import os
from pathlib import Path
from dotenv import load_dotenv

# 載入 .env 設定檔
BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

DEFAULT_MODEL = "gemini-3.1-flash-lite"

SUPPORTED_MODELS = [
    {
        "id": "gemini-3.1-flash-lite",
        "name": "Gemini 3.1 Flash-Lite",
        "badge": "預設 / 輕量極速",
        "description": "反應極快、最適合碎步引導與即時問答",
        "is_default": True
    },
    {
        "id": "gemini-3.1-flash",
        "name": "Gemini 3.1 Flash",
        "badge": "快速全能",
        "description": "平衡速度與強大多模態推理能力",
        "is_default": False
    },
    {
        "id": "gemini-3.5-flash-lite",
        "name": "Gemini 3.5 Flash-Lite",
        "badge": "次世代輕量",
        "description": "進一步優化的即時輕量模型",
        "is_default": False
    },
    {
        "id": "gemini-3.5-flash",
        "name": "Gemini 3.5 Flash",
        "badge": "次世代旗艦 Flash",
        "description": "強化的多模態圖形與電路拓樸辨識",
        "is_default": False
    },
    {
        "id": "gemini-3.7-flash-lite",
        "name": "Gemini 3.7 Flash-Lite",
        "badge": "3.7 超輕量",
        "description": "針對超低延遲微鷹架引導量身打造",
        "is_default": False
    },
    {
        "id": "gemini-3.7-flash",
        "name": "Gemini 3.7 Flash",
        "badge": "3.7 高階推理",
        "description": "支援深度思考與複雜多階段推導",
        "is_default": False
    },
    {
        "id": "gemini-2.5-flash",
        "name": "Gemini 2.5 Flash",
        "badge": "穩定相容",
        "description": "成熟穩定的現行通用模型",
        "is_default": False
    },
    {
        "id": "gemini-2.0-flash",
        "name": "Gemini 2.0 Flash",
        "badge": "通用標準",
        "description": "全方位標準多模態模型",
        "is_default": False
    }
]

def get_default_api_key() -> str:
    # 優先從 Streamlit secrets 讀取（適用於 Streamlit Cloud 部署）
    try:
        import streamlit as st
        if hasattr(st, "secrets") and "GEMINI_API_KEY" in st.secrets:
            return str(st.secrets["GEMINI_API_KEY"])
    except Exception:
        pass
    return os.getenv("GEMINI_API_KEY", "")
