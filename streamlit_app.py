"""
101 電子電路家教系統 - Streamlit 專屬版本
支援 Gemini 3.1/3.5/3.7 系列模型切換、圖片上傳分析與 SHAPE 碎步鷹架引導
"""

import streamlit as st
import os
from PIL import Image
import io
from google import genai
from google.genai import types

from app.config import SUPPORTED_MODELS, DEFAULT_MODEL, get_default_api_key
from app.prompts import CIRCUIT_TUTOR_SYSTEM_INSTRUCTION

st.set_page_config(
    page_title="101 電子電路家教系統",
    page_icon="⚡",
    layout="wide",
    initial_sidebar_state="expanded"
)

# 樣式自訂
st.markdown("""
<style>
    .main-title {
        font-size: 2.2rem;
        font-weight: 700;
        background: linear-gradient(135deg, #6366f1, #06b6d4);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        margin-bottom: 0px;
    }
    .sub-title {
        color: #94a3b8;
        font-size: 1rem;
        margin-bottom: 20px;
    }
    .tutor-box {
        border-left: 4px solid #6366f1;
        padding-left: 12px;
    }
</style>
""", unsafe_allow_html=True)

# 側邊欄設定
with st.sidebar:
    st.title("⚡ 家教控制台")
    
    # API Key 輸入
    env_key = get_default_api_key()
    api_key_input = st.text_input(
        "Google Gemini API Key",
        value=env_key,
        type="password",
        help="輸入您的 Gemini API Key，或設定在 .env 檔案中。"
    )
    
    # 模型選擇
    model_options = [m["id"] for m in SUPPORTED_MODELS]
    model_labels = {m["id"]: f"{m['name']} ({m['badge']})" for m in SUPPORTED_MODELS}
    
    # 找出預設模型索引
    default_idx = 0
    for idx, m in enumerate(SUPPORTED_MODELS):
        if m["id"] == DEFAULT_MODEL:
            default_idx = idx
            break
            
    selected_model_id = st.selectbox(
        "選擇 Gemini 模型",
        options=model_options,
        index=default_idx,
        format_func=lambda x: model_labels.get(x, x),
        help="預設為極速輕量的 Gemini 3.1 Flash-Lite"
    )
    
    st.divider()
    
    # 教學模式進度
    st.markdown("### 🪜 SHAPE 鷹架進度")
    st.info("第 0 階段：題意轉錄確認 ➔ 第 1 階段：SHAPE 碎步引導 ➔ 第 2 階段：觀念統整")
    
    st.markdown("### 💡 快捷發問")
    if st.button("【What】觀念背後的原理是什麼？"):
        st.session_state["quick_prompt"] = "我不懂這一步的觀念，能用白話解釋背後的電學原理嗎？"
    if st.button("【How】上一步到這一步怎麼推導？"):
        st.session_state["quick_prompt"] = "從上一步到這一步，具體是怎麼推導或列式的？"
    if st.button("【Why】為什麼用這個定理比另一個好？"):
        st.session_state["quick_prompt"] = "為什麼這題用這個定理或迴路分析會比較好？"
        
    st.divider()
    if st.button("🔄 清空對話重設題目", use_container_width=True):
        st.session_state.messages = []
        st.session_state.uploaded_image = None
        st.rerun()

# 主畫面標題
st.markdown('<div class="main-title">101 電子電路家教系統</div>', unsafe_allow_html=True)
st.markdown('<div class="sub-title">SHAPE 微鷹架循序引導 ‧ 堅持不劇透答案 ‧ 一步一步帶你想通！</div>', unsafe_allow_html=True)

# 對話紀錄 Session State
if "messages" not in st.session_state:
    st.session_state.messages = []

# 顯示歷程訊息
for msg in st.session_state.messages:
    with st.chat_message(msg["role"]):
        if msg.get("image"):
            st.image(msg["image"], width=350, caption="題目圖片")
        st.markdown(msg["content"])

# 處理快捷發問預填
preset_prompt = st.session_state.pop("quick_prompt", None)

# 檔案上傳擴充器
with st.expander("📸 上傳電路題目圖片 (支援多模態辨識與題意確認)", expanded=False):
    uploaded_file = st.file_uploader("選擇電路題目圖檔 (PNG, JPG, WEBP)", type=["png", "jpg", "jpeg", "webp"])
    if uploaded_file is not None:
        image = Image.open(uploaded_file)
        st.image(image, width=300, caption="待分析電路圖")
        st.session_state.current_image = image
    else:
        st.session_state.current_image = None

# 使用者輸入列
user_input = st.chat_input("請輸入問題、算式，或確認題目條件...") or preset_prompt

if user_input:
    # 檢查 API Key
    active_key = api_key_input.strip() or env_key
    if not active_key:
        st.error("請在左側側邊欄輸入有效的 Google Gemini API Key 以開始對話！")
        st.stop()
        
    # 加入使用者訊息
    user_msg = {
        "role": "user",
        "content": user_input,
    }
    
    current_img = st.session_state.get("current_image")
    if current_img is not None:
        user_msg["image"] = current_img
        st.session_state.current_image = None # 消耗圖片
        
    st.session_state.messages.append(user_msg)
    
    with st.chat_message("user"):
        if user_msg.get("image"):
            st.image(user_msg["image"], width=350)
        st.markdown(user_input)
        
    # 呼叫 Gemini 進行串流回覆
    with st.chat_message("assistant"):
        message_placeholder = st.empty()
        full_response = ""
        
        try:
            client = genai.Client(api_key=active_key)
            
            # 建構 Contents
            gemini_contents = []
            for m in st.session_state.messages:
                role = "user" if m["role"] == "user" else "model"
                parts = []
                if m.get("image"):
                    img_byte_arr = io.BytesIO()
                    m["image"].save(img_byte_arr, format='PNG')
                    parts.append(types.Part.from_bytes(data=img_byte_arr.getvalue(), mime_type="image/png"))
                if m.get("content"):
                    parts.append(types.Part.from_text(text=m["content"]))
                gemini_contents.append(types.Content(role=role, parts=parts))
                
            config = types.GenerateContentConfig(
                system_instruction=CIRCUIT_TUTOR_SYSTEM_INSTRUCTION,
                temperature=0.3,
            )
            
            response_stream = client.models.generate_content_stream(
                model=selected_model_id,
                contents=gemini_contents,
                config=config
            )
            
            for chunk in response_stream:
                if chunk.text:
                    full_response += chunk.text
                    message_placeholder.markdown(full_response + "▌")
                    
            message_placeholder.markdown(full_response)
            
            # 存入紀錄
            st.session_state.messages.append({
                "role": "assistant",
                "content": full_response
            })
            
        except Exception as e:
            err_msg = f"呼叫 Gemini 失敗：{str(e)}"
            message_placeholder.error(err_msg)
            st.session_state.messages.append({
                "role": "assistant",
                "content": err_msg
            })
