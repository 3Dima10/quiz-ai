// ==UserScript==
// @name         QuizAI Solver
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  Автоматически решает вопросы в Moodle-квизах через AI-сервер (поддержка ngrok)
// @author       QuizAI
// @match        *://*/*
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @connect      *
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  // ============================================================
  // НАСТРОЙ СЕЛЕКТОРЫ ПОД СВОЙ САЙТ
  // ============================================================
  const CONFIG = {
    questionSelector: '.qtext',
    answersSelector: '.answer > div[class*="r"]',
    nextButtonSelector: 'input[value="Next page"], input[value="Наступна сторінка"], button[value="next"]',
    delay: 1500,
    autoMode: false,
  };
  // ============================================================

  // URL сохраняется между сессиями через GM_setValue
  let serverUrl = GM_getValue('quizai_server_url', '');
  let isProcessing = false;

  // ─── Styles ──────────────────────────────────────────────────
  GM_addStyle(`
    #quizai-panel {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 999999;
      font-family: 'Segoe UI', sans-serif;
      width: 230px;
    }
    #quizai-panel .panel-inner {
      background: #0f172a;
      border: 1px solid #1e293b;
      border-radius: 14px;
      padding: 14px 16px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.5);
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    #quizai-panel .panel-title {
      color: #7c3aed;
      font-size: 13px;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 6px;
      user-select: none;
    }
    #quizai-panel .url-row {
      display: flex;
      gap: 5px;
      align-items: center;
    }
    #quizai-panel .url-input {
      flex: 1;
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 6px;
      color: #f1f5f9;
      font-size: 11px;
      padding: 5px 8px;
      outline: none;
      min-width: 0;
    }
    #quizai-panel .url-input::placeholder { color: #475569; }
    #quizai-panel .url-input:focus { border-color: #7c3aed; }
    #quizai-panel .btn-save-url {
      background: #334155;
      color: #94a3b8;
      border: none;
      border-radius: 6px;
      padding: 5px 8px;
      cursor: pointer;
      font-size: 11px;
      white-space: nowrap;
      transition: background 0.15s;
    }
    #quizai-panel .btn-save-url:hover { background: #475569; }
    #quizai-panel .url-status {
      font-size: 10px;
      text-align: right;
      min-height: 12px;
    }
    #quizai-panel .url-status.ok  { color: #34d399; }
    #quizai-panel .url-status.err { color: #f87171; }
    #quizai-panel .divider {
      border: none;
      border-top: 1px solid #1e293b;
      margin: 2px 0;
    }
    #quizai-panel .btn {
      width: 100%;
      padding: 9px 0;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 600;
      transition: background 0.15s, transform 0.1s;
    }
    #quizai-panel .btn-solve { background: #7c3aed; color: #fff; }
    #quizai-panel .btn-solve:hover { background: #6d28d9; }
    #quizai-panel .btn-solve:active { transform: scale(0.97); }
    #quizai-panel .btn-solve:disabled {
      background: #3b1f7a;
      color: #a78bfa;
      cursor: not-allowed;
    }
    #quizai-panel .btn-auto {
      background: #1e293b;
      color: #94a3b8;
      font-size: 11px;
      padding: 6px 0;
    }
    #quizai-panel .btn-auto.active { background: #134e4a; color: #34d399; }
    #quizai-panel .btn-auto:hover { background: #263349; }
    #quizai-panel .status {
      font-size: 11px;
      color: #64748b;
      text-align: center;
      min-height: 16px;
    }
    #quizai-overlay {
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 999998;
      background: #1e293b;
      color: #f1f5f9;
      padding: 12px 18px;
      border-radius: 10px;
      font-size: 14px;
      font-family: 'Segoe UI', sans-serif;
      box-shadow: 0 4px 20px rgba(0,0,0,0.4);
      max-width: 300px;
      line-height: 1.5;
    }
    #quizai-overlay.error { background: #ef4444; }
  `);

  // ─── Build Panel ──────────────────────────────────────────────
  function buildPanel() {
    const panel = document.createElement('div');
    panel.id = 'quizai-panel';

    // Показываем только base URL без /ask в поле ввода
    const displayUrl = serverUrl ? serverUrl.replace(/\/ask$/, '') : '';

    panel.innerHTML = `
      <div class="panel-inner">
        <div class="panel-title">🤖 QuizAI Solver</div>

        <div class="url-row">
          <input class="url-input" id="quizai-url-input"
            placeholder="https://xxxx.ngrok-free.app"
            value="${displayUrl}" />
          <button class="btn-save-url" id="quizai-save-url">Сохр.</button>
        </div>
        <div class="url-status ${serverUrl ? 'ok' : 'err'}" id="quizai-url-status">
          ${serverUrl ? '✓ URL сохранён' : '⚠ Введи ngrok URL'}
        </div>

        <hr class="divider">

        <button class="btn btn-solve" id="quizai-solve-btn">Ответить на вопрос</button>
        <button class="btn btn-auto" id="quizai-auto-btn">Авто: ВЫКЛ 🔴</button>
        <div class="status" id="quizai-status">Готов к работе</div>
      </div>
    `;
    document.body.appendChild(panel);

    const urlInput  = document.getElementById('quizai-url-input');
    const saveBtn   = document.getElementById('quizai-save-url');
    const urlStatus = document.getElementById('quizai-url-status');

    // Сохранить URL
    saveBtn.addEventListener('click', () => {
      const raw = urlInput.value.trim().replace(/\/+$/, '');
      if (!raw) {
        urlStatus.textContent = '⚠ URL не может быть пустым';
        urlStatus.className = 'url-status err';
        return;
      }
      serverUrl = raw + '/ask';
      GM_setValue('quizai_server_url', serverUrl);
      urlStatus.textContent = '✓ URL сохранён';
      urlStatus.className = 'url-status ok';
      setStatus('Сервер обновлён');
    });

    // Кнопка «Ответить»
    document.getElementById('quizai-solve-btn').addEventListener('click', () => {
      if (!serverUrl) {
        setStatus('⚠ Сначала введи ngrok URL');
        return;
      }
      solveCurrentQuestion();
    });

    // Авто-режим
    document.getElementById('quizai-auto-btn').addEventListener('click', () => {
      CONFIG.autoMode = !CONFIG.autoMode;
      const btn = document.getElementById('quizai-auto-btn');
      btn.textContent = `Авто: ${CONFIG.autoMode ? 'ВКЛ 🟢' : 'ВЫКЛ 🔴'}`;
      btn.classList.toggle('active', CONFIG.autoMode);
      setStatus(CONFIG.autoMode ? 'Авто-режим включён' : 'Авто-режим выключен');
    });
  }

  function setStatus(text) {
    const el = document.getElementById('quizai-status');
    if (el) el.textContent = text;
  }

  // ─── Question Parsing ─────────────────────────────────────────
  function getQuestionData() {
    const questionEl = document.querySelector(CONFIG.questionSelector);
    if (!questionEl) return null;

    const question = questionEl.innerText.trim();
    const answerEls = document.querySelectorAll(CONFIG.answersSelector);
    if (!answerEls.length) return null;

    const answers = Array.from(answerEls).map((el, i) => ({
      index: i,
      text: el.querySelector('.flex-fill')?.innerText.trim() || el.innerText.trim(),
      element: el,
    }));

    return { question, answers };
  }

  // ─── AI Request ───────────────────────────────────────────────
  // GM_xmlhttpRequest обходит CORS.
  // Заголовок ngrok-skip-browser-warning убирает страницу-предупреждение ngrok.
  function askAI(question, answers) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'POST',
        url: serverUrl,
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
        data: JSON.stringify({
          question,
          answers: answers.map(a => ({ index: a.index, text: a.text })),
        }),
        timeout: 15000,
        onload(res) {
          if (res.status < 200 || res.status >= 300) {
            reject(new Error('HTTP ' + res.status + '. Проверь URL сервера'));
            return;
          }
          try {
            resolve(JSON.parse(res.responseText));
          } catch {
            reject(new Error('Некорректный JSON от сервера'));
          }
        },
        onerror()   { reject(new Error('Сервер недоступен. Проверь ngrok URL')); },
        ontimeout() { reject(new Error('Таймаут 15с. Сервер не отвечает')); },
      });
    });
  }

  // ─── DOM Actions ──────────────────────────────────────────────
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
    if (nextBtn) nextBtn.click();
    else console.warn('[QuizAI] Кнопка "Далее" не найдена');
  }

  // ─── Overlay ──────────────────────────────────────────────────
  function showOverlay(text, isError = false) {
    let overlay = document.getElementById('quizai-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'quizai-overlay';
      document.body.appendChild(overlay);
    }
    overlay.className = isError ? 'error' : '';
    overlay.textContent = '🤖 QuizAI: ' + text;
  }

  function hideOverlay() {
    const el = document.getElementById('quizai-overlay');
    if (el) el.remove();
  }

  function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  // ─── Core Logic ───────────────────────────────────────────────
  async function solveCurrentQuestion() {
    if (isProcessing) return;
    isProcessing = true;

    const solveBtn = document.getElementById('quizai-solve-btn');
    if (solveBtn) solveBtn.disabled = true;
    setStatus('Анализирую вопрос...');

    try {
      const data = getQuestionData();
      if (!data) {
        setStatus('Вопрос не найден');
        isProcessing = false;
        if (solveBtn) solveBtn.disabled = false;
        return;
      }

      showOverlay('Думаю...');
      setStatus('Жду ответ от AI...');

      const result = await askAI(data.question, data.answers);
      const answerIndex = result.answer_index;

      if (answerIndex === undefined || !data.answers[answerIndex]) {
        showOverlay('Некорректный ответ от сервера', true);
        setStatus('Ошибка ответа');
        await sleep(2000);
        hideOverlay();
        isProcessing = false;
        if (solveBtn) solveBtn.disabled = false;
        return;
      }

      const chosenText = data.answers[answerIndex].text;
      showOverlay(`Ответ: ${chosenText}`);
      setStatus(`✅ ${chosenText}`);

      await sleep(CONFIG.delay);
      clickAnswer(data.answers[answerIndex].element);
      await sleep(800);
      clickNext();
      await sleep(1000);

      hideOverlay();
      setStatus('Готов к работе');

    } catch (err) {
      console.error('[QuizAI]', err);
      showOverlay('Ошибка: ' + err.message, true);
      setStatus('⚠ ' + err.message);
      await sleep(3000);
      hideOverlay();
      setStatus('Готов к работе');
    }

    isProcessing = false;
    const btn = document.getElementById('quizai-solve-btn');
    if (btn) btn.disabled = false;
  }

  // ─── Auto Mode Observer ───────────────────────────────────────
  const observer = new MutationObserver(() => {
    if (CONFIG.autoMode && !isProcessing && document.querySelector(CONFIG.questionSelector)) {
      setTimeout(solveCurrentQuestion, 500);
    }
  });

  // ─── Init ─────────────────────────────────────────────────────
  function init() {
    buildPanel();
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.body) init();
  else document.addEventListener('DOMContentLoaded', init);

})();
