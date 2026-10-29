import os
import sys
import socket
import webbrowser
import threading
import uvicorn
from pathlib import Path
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware

from app.routes import router

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"

app = FastAPI(
    title="101 電子電路家教系統",
    description="結合前台題意轉錄確認與 SHAPE 碎步鷹架引導的智慧電路解題家教",
    version="1.0.0"
)

# 啟用 CORS 以便彈性呼叫
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 掛載 API 路由
app.include_router(router)

# 掛載靜態資源
if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

@app.get("/")
async def serve_index():
    index_path = STATIC_DIR / "index.html"
    if index_path.exists():
        return FileResponse(str(index_path))
    return {"message": "靜態前端目錄尚未建立，請確認 static/index.html 存在。"}

def open_browser(url: str):
    try:
        webbrowser.open(url)
    except Exception as e:
        print(f"[Info] 請手動於瀏覽器開啟: {url}")

def get_local_ip() -> str:
    """取得本機在區域網路 (Wi-Fi/LAN) 中的 IP 位址"""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    host = os.environ.get("HOST", "0.0.0.0")
    local_ip = get_local_ip()
    local_url = f"http://127.0.0.1:{port}"
    lan_url = f"http://{local_ip}:{port}"
    
    print("=" * 65)
    print("  ⚡ 101 電子電路家教系統 (SHAPE Micro-Tutor)")
    print(f"  💻 本機瀏覽位址：{local_url}")
    print(f"  📱 區域網路分享（學生手機/電腦瀏覽）：{lan_url}")
    print("  ✨ 預設模型：Gemini 3.1 Flash-Lite")
    print("=" * 65)
    
    # 延遲 1.2 秒自動開啟本機瀏覽器（僅在本機環境執行，雲端環境略過）
    if not os.environ.get("RENDER"):
        threading.Timer(1.2, open_browser, args=[local_url]).start()
    
    uvicorn.run(app, host=host, port=port, log_level="info")

