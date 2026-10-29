@echo off
chcp 65001 > nul
title 101 電子電路家教系統 (SHAPE Micro-Tutor)

echo ======================================================================
echo    ⚡ 101 電子電路家教系統 - 啟動精靈
echo    ✨ 預設模型：Gemini 3.1 Flash-Lite
echo    🪜 教學模式：題意確認 + SHAPE 碎步鷹架引導
echo ======================================================================
echo.

:: 檢查 Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [錯誤] 找不到 Python 環境，請先安裝 Python 3.10+ 並加入 PATH！
    pause
    exit /b
)

echo [1/2] 檢查並安裝必要套件...
python -m pip install -r requirements.txt --quiet

echo.
echo [2/2] 正在啟動伺服器並自動開啟瀏覽器...
echo 伺服器網址：http://127.0.0.1:8000
echo 按 Ctrl + C 可隨時停止伺服器。
echo ======================================================================
echo.

python server.py

pause
