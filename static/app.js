/**
 * 101 電子電路家教系統 - 前端核心互動邏輯
 * 支援多模態圖片上傳、SSE 即時串流、Gemini 3.1/3.5/3.7 系列模型切換
 */

document.addEventListener('DOMContentLoaded', () => {
  // DOM 元素引用
  const chatMessages = document.getElementById('chatMessages');
  const welcomeCard = document.getElementById('welcomeCard');
  const messageInput = document.getElementById('messageInput');
  const sendBtn = document.getElementById('sendBtn');
  const iconSend = sendBtn.querySelector('.icon-send');
  const iconStop = sendBtn.querySelector('.icon-stop');
  const uploadImageBtn = document.getElementById('uploadImageBtn');
  const fileInput = document.getElementById('fileInput');
  const imagePreviewContainer = document.getElementById('imagePreviewContainer');
  const imagePreview = document.getElementById('imagePreview');
  const removeImageBtn = document.getElementById('removeImageBtn');
  const modelSelect = document.getElementById('modelSelect');
  const customModelWrapper = document.getElementById('customModelWrapper');
  const customModelInput = document.getElementById('customModelInput');
  const currentModelBadge = document.getElementById('currentModelBadge');
  const apiKeyBtn = document.getElementById('apiKeyBtn');
  const apiKeyModal = document.getElementById('apiKeyModal');
  const closeModalBtn = document.getElementById('closeModalBtn');
  const apiKeyInput = document.getElementById('apiKeyInput');
  const toggleKeyVisibilityBtn = document.getElementById('toggleKeyVisibilityBtn');
  const testKeyBtn = document.getElementById('testKeyBtn');
  const saveKeyBtn = document.getElementById('saveKeyBtn');
  const keyVerificationMsg = document.getElementById('keyVerificationMsg');
  const keyStatusDot = document.getElementById('keyStatusDot');
  const newChatBtn = document.getElementById('newChatBtn');
  const themeToggleBtn = document.getElementById('themeToggleBtn');
  const iconMoon = themeToggleBtn.querySelector('.icon-moon');
  const iconSun = themeToggleBtn.querySelector('.icon-sun');
  const imageLightboxModal = document.getElementById('imageLightboxModal');
  const lightboxImg = document.getElementById('lightboxImg');
  const closeLightboxBtn = document.getElementById('closeLightboxBtn');

  // 階段指示元素
  const stageStep0 = document.getElementById('stageStep0');
  const stageStep1 = document.getElementById('stageStep1');
  const stageStep2 = document.getElementById('stageStep2');

  // 應用狀態
  let messages = []; // 對話紀錄
  let stagedImageBase64 = null; // 待送出圖片
  let isStreaming = false;
  let abortController = null;
  let userApiKey = localStorage.getItem('gemini_api_key') || '';

  // 1. 初始化模型設定與 API Key 狀態
  initApp();

  function initApp() {
    // 檢查 API Key 狀態
    updateApiKeyStatus();

    // 載入主題偏好
    const savedTheme = localStorage.getItem('app_theme') || 'dark';
    setTheme(savedTheme);

    // 綁定事件監聽
    setupEventListeners();

    // 載入模型清單
    fetchModels();
  }

  function updateApiKeyStatus() {
    if (userApiKey.trim()) {
      keyStatusDot.className = 'status-dot dot-success';
      keyStatusDot.title = '已設定自訂 API Key';
    } else {
      keyStatusDot.className = 'status-dot dot-warn';
      keyStatusDot.title = '未設定 API Key (將嘗試使用系統環境變數)';
    }
  }

  function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('app_theme', theme);
    if (theme === 'dark') {
      iconMoon.classList.remove('hidden');
      iconSun.classList.add('hidden');
    } else {
      iconMoon.classList.add('hidden');
      iconSun.classList.remove('hidden');
    }
  }

  function updateTutorStage(stageIndex) {
    const steps = [stageStep0, stageStep1, stageStep2];
    steps.forEach((step, idx) => {
      if (!step) return;
      if (idx === stageIndex) {
        step.classList.add('active');
      } else {
        step.classList.remove('active');
      }
    });
  }

  // 取得後端模型資訊
  async function fetchModels() {
    try {
      const res = await fetch('/api/models');
      if (res.ok) {
        const data = await res.json();
        if (data.default) {
          modelSelect.value = data.default;
          updateModelBadge();
        }
      }
    } catch (e) {
      console.log('使用預設模型選單');
    }
  }

  function getSelectedModelId() {
    const val = modelSelect.value;
    if (val === 'custom') {
      return customModelInput.value.trim() || 'gemini-3.1-flash-lite';
    }
    return val;
  }

  function updateModelBadge() {
    const modelId = getSelectedModelId();
    const opt = modelSelect.options[modelSelect.selectedIndex];
    currentModelBadge.textContent = opt ? opt.text.split(' (')[0] : modelId;
  }

  // 事件綁定
  function setupEventListeners() {
    // 模型變更
    modelSelect.addEventListener('change', () => {
      if (modelSelect.value === 'custom') {
        customModelWrapper.classList.remove('hidden');
        customModelInput.focus();
      } else {
        customModelWrapper.classList.add('hidden');
      }
      updateModelBadge();
    });

    customModelInput.addEventListener('input', updateModelBadge);

    // 主題切換
    themeToggleBtn.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') || 'dark';
      setTheme(current === 'dark' ? 'light' : 'dark');
    });

    // 新對話
    newChatBtn.addEventListener('click', resetChatSession);

    // 圖片上傳按鈕
    uploadImageBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleFileSelect);

    // 移除圖片
    removeImageBtn.addEventListener('click', clearStagedImage);

    // 輸入框自適應高度
    messageInput.addEventListener('input', autoResizeTextarea);

    // 快捷鍵發送 (Enter 送出, Shift+Enter 換行)
    messageInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (isStreaming) {
          stopStreaming();
        } else {
          sendMessage();
        }
      }
    });

    // 發送 / 停止按鈕
    sendBtn.addEventListener('click', () => {
      if (isStreaming) {
        stopStreaming();
      } else {
        sendMessage();
      }
    });

    // 快捷晶片點擊 (提問導航與範例題)
    document.querySelectorAll('.chip-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const text = btn.getAttribute('data-text');
        if (text) {
          messageInput.value = text;
          autoResizeTextarea();
          messageInput.focus();
        }
      });
    });

    document.querySelectorAll('.example-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        const question = btn.getAttribute('data-question');
        if (question) {
          messageInput.value = question;
          autoResizeTextarea();
          sendMessage();
        }
      });
    });

    // 剪貼簿貼上圖片 (Ctrl+V)
    window.addEventListener('paste', (e) => {
      const items = (e.clipboardData || e.originalEvent.clipboardData).items;
      for (const item of items) {
        if (item.kind === 'file' && item.type.startsWith('image/')) {
          const blob = item.getAsFile();
          readImageFile(blob);
          e.preventDefault();
          break;
        }
      }
    });

    // 拖曳上傳
    window.addEventListener('dragover', (e) => e.preventDefault());
    window.addEventListener('drop', (e) => {
      e.preventDefault();
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];
        if (file.type.startsWith('image/')) {
          readImageFile(file);
        }
      }
    });

    // API Key Modal 邏輯
    apiKeyBtn.addEventListener('click', () => {
      apiKeyInput.value = userApiKey;
      keyVerificationMsg.className = 'verification-msg hidden';
      apiKeyModal.classList.remove('hidden');
    });

    closeModalBtn.addEventListener('click', () => apiKeyModal.classList.add('hidden'));

    toggleKeyVisibilityBtn.addEventListener('click', () => {
      apiKeyInput.type = apiKeyInput.type === 'password' ? 'text' : 'password';
    });

    testKeyBtn.addEventListener('click', verifyApiKey);

    saveKeyBtn.addEventListener('click', () => {
      userApiKey = apiKeyInput.value.trim();
      localStorage.setItem('gemini_api_key', userApiKey);
      updateApiKeyStatus();
      apiKeyModal.classList.add('hidden');
      appendSystemNotification('Gemini API Key 設定已更新！');
    });

    // Lightbox 放大圖片
    closeLightboxBtn.addEventListener('click', () => imageLightboxModal.classList.add('hidden'));
    imageLightboxModal.addEventListener('click', (e) => {
      if (e.target === imageLightboxModal) {
        imageLightboxModal.classList.add('hidden');
      }
    });
  }

  function autoResizeTextarea() {
    messageInput.style.height = 'auto';
    messageInput.style.height = Math.min(messageInput.scrollHeight, 160) + 'px';
  }

  // 處理上傳檔案
  function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
      readImageFile(file);
    }
    fileInput.value = '';
  }

  function readImageFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      stagedImageBase64 = e.target.result;
      imagePreview.src = stagedImageBase64;
      imagePreviewContainer.classList.remove('hidden');
      messageInput.focus();
    };
    reader.readAsDataURL(file);
  }

  function clearStagedImage() {
    stagedImageBase64 = null;
    imagePreview.src = '';
    imagePreviewContainer.classList.add('hidden');
  }

  // 重置對話
  function resetChatSession() {
    if (isStreaming) stopStreaming();
    messages = [];
    clearStagedImage();
    chatMessages.innerHTML = '';
    if (welcomeCard) {
      chatMessages.appendChild(welcomeCard);
      welcomeCard.classList.remove('hidden');
    }
    updateTutorStage(0);
    messageInput.value = '';
    autoResizeTextarea();
  }

  // 測試 API Key 連線
  async function verifyApiKey() {
    const key = apiKeyInput.value.trim();
    if (!key) {
      showKeyMsg('請先輸入 API Key', 'error');
      return;
    }

    testKeyBtn.disabled = true;
    testKeyBtn.textContent = '連線測試中...';

    try {
      const res = await fetch('/api/verify-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: key })
      });
      const data = await res.json();
      if (data.valid) {
        showKeyMsg(data.message, 'success');
      } else {
        showKeyMsg(data.message, 'error');
      }
    } catch (e) {
      showKeyMsg(`無法連接後端伺服器: ${e.message}`, 'error');
    } finally {
      testKeyBtn.disabled = false;
      testKeyBtn.textContent = '測試連線';
    }
  }

  function showKeyMsg(msg, type) {
    keyVerificationMsg.textContent = msg;
    keyVerificationMsg.className = `verification-msg ${type}`;
  }

  // 發送訊息核心流程
  async function sendMessage() {
    const text = messageInput.value.trim();
    const image = stagedImageBase64;

    if (!text && !image) return;

    // 隱藏歡迎卡片
    if (welcomeCard && !welcomeCard.classList.contains('hidden')) {
      welcomeCard.classList.add('hidden');
    }

    // 建立使用者訊息物件
    const userMsgObj = {
      role: 'user',
      content: text,
      image: image
    };

    // 加入訊息紀錄並渲染於 UI
    messages.push(userMsgObj);
    appendUserMessageToUI(userMsgObj);

    // 清空輸入框與待上傳圖片
    messageInput.value = '';
    clearStagedImage();
    autoResizeTextarea();

    // 建立 AI 回應占位氣泡
    const tutorBubbleElement = appendTutorMessagePlaceholder();

    // 啟動串流狀態
    setStreamingState(true);
    abortController = new AbortController();

    const selectedModel = getSelectedModelId();
    let accumulatedText = '';

    // 若有圖片或為第一則訊息，更新進度條為「第零階段：題意確認」
    if (image || messages.length <= 2) {
      updateTutorStage(0);
    } else {
      updateTutorStage(1);
    }

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messages: messages,
          model: selectedModel,
          api_key: userApiKey || null
        }),
        signal: abortController.signal
      });

      if (!res.ok) {
        throw new Error(`伺服器回應錯誤 (狀態碼 ${res.status})`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop(); // 保留最後不完整的 chunk

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data:')) {
            const dataStr = trimmed.slice(5).trim();
            if (dataStr === '[DONE]') {
              break;
            }
            try {
              const data = JSON.parse(dataStr);
              if (data.text) {
                accumulatedText += data.text;
                renderTutorBubbleContent(tutorBubbleElement, accumulatedText, true);
                chatMessages.scrollTop = chatMessages.scrollHeight;
              } else if (data.error) {
                accumulatedText += `\n\n【錯誤】${data.error}`;
                renderTutorBubbleContent(tutorBubbleElement, accumulatedText, false);
              }
            } catch (err) {
              console.warn('解析 SSE 訊息異常:', err);
            }
          }
        }
      }

      // 串流完成
      renderTutorBubbleContent(tutorBubbleElement, accumulatedText, false);
      messages.push({
        role: 'model',
        content: accumulatedText
      });

      // 檢查是否已抵達觀念統整收斂階段
      if (accumulatedText.includes('恭喜') || accumulatedText.includes('解題重點統整') || accumulatedText.includes('特性曲線圖')) {
        updateTutorStage(2);
      }

    } catch (err) {
      if (err.name === 'AbortError') {
        accumulatedText += '\n\n*(對話已由學生暫停)*';
      } else {
        accumulatedText += `\n\n*(無法取得家教回應: ${err.message})*`;
      }
      renderTutorBubbleContent(tutorBubbleElement, accumulatedText, false);
      messages.push({
        role: 'model',
        content: accumulatedText
      });
    } finally {
      setStreamingState(false);
      abortController = null;
    }
  }

  function stopStreaming() {
    if (abortController) {
      abortController.abort();
    }
    setStreamingState(false);
  }

  function setStreamingState(streaming) {
    isStreaming = streaming;
    if (streaming) {
      iconSend.classList.add('hidden');
      iconStop.classList.remove('hidden');
      sendBtn.title = '停止產生';
    } else {
      iconSend.classList.remove('hidden');
      iconStop.classList.add('hidden');
      sendBtn.title = '送出 (Enter)';
    }
  }

  // UI 渲染輔助
  function appendUserMessageToUI(msg) {
    const row = document.createElement('div');
    row.className = 'message-row user-row';

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = '學';

    const wrapper = document.createElement('div');
    wrapper.className = 'message-bubble-wrapper';

    const bubble = document.createElement('div');
    bubble.className = 'message-bubble user-bubble';

    // 若有附加圖片
    if (msg.image) {
      const img = document.createElement('img');
      img.className = 'message-attached-image';
      img.src = msg.image;
      img.alt = '題目圖片';
      img.addEventListener('click', () => {
        lightboxImg.src = msg.image;
        imageLightboxModal.classList.remove('hidden');
      });
      bubble.appendChild(img);
    }

    if (msg.content) {
      const p = document.createElement('div');
      p.textContent = msg.content;
      bubble.appendChild(p);
    }

    wrapper.appendChild(bubble);
    row.appendChild(avatar);
    row.appendChild(wrapper);
    chatMessages.appendChild(row);

    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function appendTutorMessagePlaceholder() {
    const row = document.createElement('div');
    row.className = 'message-row tutor-row';

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = '⚡';

    const wrapper = document.createElement('div');
    wrapper.className = 'message-bubble-wrapper';

    const bubble = document.createElement('div');
    bubble.className = 'message-bubble tutor-bubble typing-cursor';
    bubble.textContent = '思考中...';

    wrapper.appendChild(bubble);
    row.appendChild(avatar);
    row.appendChild(wrapper);
    chatMessages.appendChild(row);

    chatMessages.scrollTop = chatMessages.scrollHeight;
    return bubble;
  }

  function renderTutorBubbleContent(bubbleElement, rawText, isTyping) {
    if (isTyping) {
      bubbleElement.classList.add('typing-cursor');
    } else {
      bubbleElement.classList.remove('typing-cursor');
    }

    // 將純文字轉為優雅排版，支援 ASCII 特性圖、導航區塊美化
    bubbleElement.innerHTML = formatTutorText(rawText);
  }

  function formatTutorText(text) {
    if (!text) return '';

    // 處理 ASCII / 程式碼區塊 ```text ... ```
    let formatted = text.replace(/```([\s\S]*?)```/g, (match, p1) => {
      return `<pre style="background: rgba(0,0,0,0.3); padding: 12px; border-radius: 8px; font-family: var(--font-mono); font-size: 0.85rem; overflow-x: auto; margin: 10px 0; border: 1px solid var(--border-subtle);">${escapeHtml(p1)}</pre>`;
    });

    // 轉換粗體 **text**
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    // 轉換斜體 *text*
    formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');

    // 轉換換行
    formatted = formatted.replace(/\n/g, '<br>');

    return formatted;
  }

  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;');
  }

  function appendSystemNotification(text) {
    const div = document.createElement('div');
    div.style.textAlign = 'center';
    div.style.fontSize = '0.75rem';
    div.style.color = 'var(--accent-emerald)';
    div.style.margin = '8px 0';
    div.textContent = `✓ ${text}`;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
});
