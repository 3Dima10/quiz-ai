// ==UserScript==
// @name         QuizAI Solver 2.0
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  Автоматически отвечает на вопросы квиза через AI (Moodle и другие платформы)
// @author       QuizAI
// @match        *://*/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @connect      localhost
// @connect      *
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  // ============================================================
  // НАСТРОЙ ЭТИ СЕЛЕКТОРЫ ПОД СВОЙ САЙТ
  // ============================================================
  const CONFIG = {
    questionSelector: '.qtext',
    answersSelector: '.answer .r0, .answer .r1, .answer .r2, .answer .r3, .answer .r4',
    nextButtonSelector: 'input[value="Next page"], input[value="Наступна сторінка"], button[value="next"]',
    answerTextAttr: null,
    delay: 1500,
    serverUrl: GM_getValue('serverUrl', 'http://localhost:5000/ask'),
  };
  // ============================================================

  let isProcessing = false;

  // ─── UI Panel ───────────────────────────────────────────────

  function createPanel() {
    if (document.getElementById('quizai-panel')) return;

    const panel = document.createElement('div');
    panel.id = 'quizai-panel';
    panel.innerHTML = `
      <div id="quizai-header">🤖 QuizAI Solver</div>
      <div id="quizai-url-row">
        <label id="quizai-url-label">Сервер URL</label>
        <input id="quizai-url-input" type="text" placeholder="https://xxxx.ngrok-free.app/ask" value="${CONFIG.serverUrl}" spellcheck="false" />
        <button id="quizai-url-save">Сохранить</button>
        <div id="quizai-url-hint">Вставь ngrok ссылку сюда</div>
      </div>
      <button id="quizai-solve-btn">Ответить на вопрос</button>
      <div id="quizai-status">Готов к работе</div>
    `;
    panel.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 2147483647;
      background: #0f172a;
      color: #f1f5f9;
      padding: 14px 16px;
      border-radius: 12px;
      font-family: sans-serif;
      font-size: 13px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.45);
      width: 260px;
      user-select: none;
    `;

    const style = document.createElement('style');
    style.textContent = `
      #quizai-header {
        font-size: 14px;
        font-weight: 700;
        color: #a78bfa;
        margin-bottom: 10px;
      }
      #quizai-url-row {
        margin-bottom: 10px;
      }
      #quizai-url-label {
        display: block;
        font-size: 10px;
        color: #64748b;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        margin-bottom: 4px;
      }
      #quizai-url-input {
        width: 100%;
        box-sizing: border-box;
        padding: 7px 8px;
        border-radius: 6px;
        border: 1px solid #334155;
        background: #1e293b;
        color: #e2e8f0;
        font-size: 11px;
        font-family: monospace;
        outline: none;
        margin-bottom: 5px;
        transition: border 0.2s;
      }
      #quizai-url-input:focus {
        border-color: #7c3aed;
      }
      #quizai-url-save {
        width: 100%;
        padding: 6px;
        border: none;
        border-radius: 6px;
        background: #1e293b;
        color: #a78bfa;
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
        border: 1px solid #334155;
        transition: background 0.2s, border-color 0.2s;
        margin-bottom: 4px;
      }
      #quizai-url-save:hover {
        background: #273549;
        border-color: #7c3aed;
      }
      #quizai-url-hint {
        font-size: 10px;
        color: #475569;
        text-align: center;
      }
      #quizai-solve-btn {
        width: 100%;
        padding: 9px;
        border: none;
        border-radius: 8px;
        background: #7c3aed;
        color: white;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        margin-bottom: 8px;
        transition: background 0.2s;
      }
      #quizai-solve-btn:hover { background: #6d28d9; }
      #quizai-solve-btn:disabled { background: #4c1d95; cursor: not-allowed; opacity: 0.7; }
      #quizai-status {
        font-size: 11px;
        color: #94a3b8;
        text-align: center;
        min-height: 16px;
      }
    `;

    document.head.appendChild(style);
    document.body.appendChild(panel);

    // Кнопка сохранения URL
    document.getElementById('quizai-url-save').addEventListener('click', () => {
      const inputVal = document.getElementById('quizai-url-input').value.trim();
      if (!inputVal) {
        setStatus('Введи URL сервера!', true);
        return;
      }
      CONFIG.serverUrl = inputVal;
      GM_setValue('serverUrl', inputVal);
      setStatus('✓ URL сохранён');
      const hint = document.getElementById('quizai-url-hint');
      if (hint) hint.textContent = '✓ Сохранено';
      setTimeout(() => {
        if (hint) hint.textContent = 'Вставь ngrok ссылку сюда';
        setStatus('Готов к работе');
      }, 2000);
    });

    document.getElementById('quizai-solve-btn').addEventListener('click', () => {
      solveCurrentQuestion();
    });
  }

  function setStatus(text, isError = false) {
    const el = document.getElementById('quizai-status');
    if (el) {
      el.textContent = text;
      el.style.color = isError ? '#f87171' : '#94a3b8';
    }
  }

  function setButtonDisabled(disabled) {
    const btn = document.getElementById('quizai-solve-btn');
    if (btn) btn.disabled = disabled;
  }

  // ─── Overlay ─────────────────────────────────────────────────

  function showOverlay(text, isError = false) {
    let overlay = document.getElementById('quiz-ai-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'quiz-ai-overlay';
      overlay.style.cssText = `
        position: fixed; top: 20px; right: 20px; z-index: 999999;
        color: white; padding: 12px 18px; border-radius: 10px; font-size: 14px;
        font-family: sans-serif; box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        max-width: 300px; line-height: 1.4; transition: background 0.3s;
      `;
      document.body.appendChild(overlay);
    }
    overlay.style.background = isError ? '#ef4444' : '#1e293b';
    overlay.textContent = '🤖 QuizAI: ' + text;
  }

  function hideOverlay() {
    const overlay = document.getElementById('quiz-ai-overlay');
    if (overlay) overlay.remove();
  }

  // ─── Core logic ───────────────────────────────────────────────

  function getQuestionData() {
    const questionEl = document.querySelector(CONFIG.questionSelector);
    if (!questionEl) return null;

    const question = questionEl.innerText.trim();

    const answerEls = document.querySelectorAll('.answer > div[class*="r"]');
    if (!answerEls.length) return null;

    const answers = Array.from(answerEls).map((el, i) => ({
      index: i,
      text: el.querySelector('.flex-fill')?.innerText.trim() || el.innerText.trim(),
      element: el
    }));

    return { question, answers };
  }

  function askAI(question, answers) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'POST',
        url: CONFIG.serverUrl,
        headers: { 'Content-Type': 'application/json' },
        data: JSON.stringify({
          question,
          answers: answers.map(a => ({ index: a.index, text: a.text }))
        }),
        onload(response) {
          if (response.status < 200 || response.status >= 300) {
            reject(new Error('Server error: ' + response.status));
            return;
          }
          try {
            resolve(JSON.parse(response.responseText));
          } catch (e) {
            reject(new Error('Invalid JSON from server'));
          }
        },
        onerror(err) {
          reject(new Error('Network error: ' + (err.statusText || 'unknown')));
        }
      });
    });
  }

  function clickAnswer(answerEl) {
    const radio = answerEl.querySelector('input[type="radio"]');
    if (radio) {
      radio.checked = true;
      radio.dispatchEvent(new Event('change', { bubbles: true }));
      radio.click();
    } else {
      answerEl.click();
    }
  }

  function clickNext() {
    const nextBtn = document.querySelector(CONFIG.nextButtonSelector);
    if (nextBtn) {
      nextBtn.click();
      console.log('[QuizAI] Нажата кнопка "Далее"');
    } else {
      console.warn('[QuizAI] Кнопка "Далее" не найдена');
    }
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async function solveCurrentQuestion() {
    if (isProcessing) return;
    isProcessing = true;
    setButtonDisabled(true);

    try {
      const data = getQuestionData();
      if (!data) {
        console.log('[QuizAI] Вопрос не найден на странице');
        setStatus('Вопрос не найден', true);
        isProcessing = false;
        setButtonDisabled(false);
        return;
      }

      console.log('[QuizAI] Вопрос:', data.question);
      console.log('[QuizAI] Варианты:', data.answers.map(a => `${a.index}: ${a.text}`));

      setStatus('Думаю...');
      showOverlay('Думаю...');

      const result = await askAI(data.question, data.answers);
      const answerIndex = result.answer_index;

      console.log('[QuizAI] AI выбрал ответ #' + answerIndex + ':', data.answers[answerIndex]?.text);

      if (answerIndex === undefined || !data.answers[answerIndex]) {
        console.error('[QuizAI] Некорректный индекс ответа');
        setStatus('Некорректный ответ от AI', true);
        hideOverlay();
        isProcessing = false;
        setButtonDisabled(false);
        return;
      }

      const chosenText = data.answers[answerIndex].text;
      showOverlay(`Ответ: ${chosenText}`);
      setStatus(`✓ ${chosenText}`);

      await sleep(CONFIG.delay);

      clickAnswer(data.answers[answerIndex].element);

      await sleep(800);
      clickNext();

      await sleep(1000);
      hideOverlay();
      setStatus('Готов к работе');

    } catch (err) {
      console.error('[QuizAI] Ошибка:', err);
      showOverlay('Ошибка: ' + err.message, true);
      setStatus('Ошибка: ' + err.message, true);
      await sleep(2000);
      hideOverlay();
    }

    isProcessing = false;
    setButtonDisabled(false);
  }

  // ─── Init ─────────────────────────────────────────────────────

  function init() {
    createPanel();

    const observer = new MutationObserver(() => {
      if (!isProcessing && document.querySelector(CONFIG.questionSelector)) {
        setTimeout(solveCurrentQuestion, 500);
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    setTimeout(solveCurrentQuestion, 1000);
  }

  if (document.body) {
    init();
  } else {
    document.addEventListener('DOMContentLoaded', init);
  }

})();