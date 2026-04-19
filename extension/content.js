// ============================================================
// НАСТРОЙ ЭТИ СЕЛЕКТОРЫ ПОД СВОЙ САЙТ
// ============================================================
const CONFIG = {
  questionSelector: '.qtext',
  answersSelector: '.answer .r0, .answer .r1, .answer .r2, .answer .r3, .answer .r4',
  nextButtonSelector: 'input[value="Next page"], input[value="Наступна сторінка"], button[value="next"]',
  answerTextAttr: null,
  delay: 1500,
  serverUrl: 'http://localhost:5000/ask',
};
// ============================================================

let isProcessing = false;

function getQuestionData() {
  const questionEl = document.querySelector(CONFIG.questionSelector);
  if (!questionEl) return null;

  const question = questionEl.innerText.trim();

  // В Moodle варианты ответов в .answer > div.r0, r1, r2...
  const answerEls = document.querySelectorAll('.answer > div[class*="r"]');
  if (!answerEls.length) return null;

  const answers = Array.from(answerEls).map((el, i) => ({
    index: i,
    text: el.querySelector('.flex-fill')?.innerText.trim() || el.innerText.trim(),
    element: el
  }));

  return { question, answers };
}

async function askAI(question, answers) {
  const response = await fetch(CONFIG.serverUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      question,
      answers: answers.map(a => ({ index: a.index, text: a.text }))
    })
  });

  if (!response.ok) throw new Error('Server error: ' + response.status);
  return await response.json(); // { answer_index: 2 }
}

function clickAnswer(answerEl) {
  // В Moodle ищем radio input внутри блока ответа
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

async function solveCurrentQuestion() {
  if (isProcessing) return;
  isProcessing = true;

  try {
    const data = getQuestionData();
    if (!data) {
      console.log('[QuizAI] Вопрос не найден на странице');
      isProcessing = false;
      return;
    }

    console.log('[QuizAI] Вопрос:', data.question);
    console.log('[QuizAI] Варианты:', data.answers.map(a => `${a.index}: ${a.text}`));

    // Показываем индикатор загрузки
    showOverlay('Думаю...');

    const result = await askAI(data.question, data.answers);
    const answerIndex = result.answer_index;

    console.log('[QuizAI] AI выбрал ответ #' + answerIndex + ':', data.answers[answerIndex]?.text);

    if (answerIndex === undefined || !data.answers[answerIndex]) {
      console.error('[QuizAI] Некорректный индекс ответа');
      hideOverlay();
      isProcessing = false;
      return;
    }

    showOverlay(`Ответ: ${data.answers[answerIndex].text}`);

    // Ждём перед кликом (выглядит естественнее)
    await sleep(CONFIG.delay);

    clickAnswer(data.answers[answerIndex].element);
    
    await sleep(800);
    clickNext();

    await sleep(1000);
    hideOverlay();

  } catch (err) {
    console.error('[QuizAI] Ошибка:', err);
    showOverlay('Ошибка: ' + err.message, true);
    await sleep(2000);
    hideOverlay();
  }

  isProcessing = false;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// UI оверлей
function showOverlay(text, isError = false) {
  let overlay = document.getElementById('quiz-ai-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'quiz-ai-overlay';
    overlay.style.cssText = `
      position: fixed; top: 20px; right: 20px; z-index: 999999;
      background: ${isError ? '#ef4444' : '#1e293b'}; color: white;
      padding: 12px 18px; border-radius: 10px; font-size: 14px;
      font-family: sans-serif; box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      max-width: 300px; line-height: 1.4;
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

// Слушаем команду из popup
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === 'solve') {
    solveCurrentQuestion();
  }
});

// Автоматический режим — наблюдаем за изменением страницы
const observer = new MutationObserver(() => {
  if (!isProcessing && document.querySelector(CONFIG.questionSelector)) {
    setTimeout(solveCurrentQuestion, 500);
  }
});

observer.observe(document.body, { childList: true, subtree: true });

// Первый запуск при загрузке
setTimeout(solveCurrentQuestion, 1000);