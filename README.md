# 🤖 QuizAI — Автоматический решатель тестов Moodle

> Расширение для браузера + локальный AI сервер на Ollama, который автоматически читает вопросы теста, отправляет их в языковую модель и кликает правильный ответ.

---

## Как это работает

```
Сайт с тестом  →  Content Script  →  Python сервер  →  Ollama (AI)
                                                              ↓
Автоклик на ответ  ←  Background.js  ←─────────────────────────
```

1. **Content Script** парсит вопрос и варианты ответов со страницы
2. **Python сервер** получает данные и передаёт их в Ollama
3. **Ollama** (локальная языковая модель) выбирает правильный ответ
4. **Расширение** кликает на правильный вариант и нажимает "Далее"

---

## Требования

- Google Chrome / Chromium
- Python 3.8+
- [Ollama](https://ollama.com/) — установленный и запущенный локально

---

## Установка

### 1. Клонируй репозиторий

```bash
git clone https://github.com/твой-юзернейм/quiz-ai.git
cd quiz-ai
```

### 2. Установи и запусти Ollama

Скачай с [ollama.com](https://ollama.com/) и установи, затем:

```bash
# Запусти сервер Ollama
ollama serve

# Скачай модель (выбери одну)
ollama pull llama3.1       # рекомендуется
ollama pull mistral
ollama pull qwen2.5
```

### 3. Установи Python зависимости

```bash
cd server
pip install -r requirements.txt
```

### 4. Запусти сервер

```bash
python server.py
```

Сервер запустится на `http://localhost:5000`

### 5. Установи расширение в Chrome

1. Открой `chrome://extensions/`
2. Включи **"Режим разработчика"** (переключатель вверху справа)
3. Нажми **"Загрузить распакованное расширение"**
4. Выбери папку `extension/`

---

## Структура проекта

```
quiz-ai/
├── extension/
│   ├── manifest.json       # конфиг расширения
│   ├── content.js          # парсит страницу и кликает ответы
│   ├── background.js       # сервис-воркер расширения
│   └── popup.html          # UI кнопка расширения
└── server/
    ├── server.py           # Flask сервер + интеграция с Ollama
    └── requirements.txt    # Python зависимости
```

---

## Настройка под свой сайт

Открой `extension/content.js` и найди блок `CONFIG`:

```javascript
const CONFIG = {
  questionSelector: '.qtext',         // CSS селектор вопроса
  answersSelector: '.answer > div[class*="r"]', // CSS селектор вариантов
  nextButtonSelector: 'input[value="Next page"]', // кнопка "Далее"
  delay: 1500,                        // задержка перед кликом (мс)
  serverUrl: 'http://localhost:5000/ask',
};
```

### Как найти селекторы

1. Открой сайт с тестом
2. Нажми **F12** → вкладка **Elements**
3. Нажми иконку курсора и кликни на нужный элемент
4. Посмотри атрибут `class` или `id` — это и есть селектор

| Атрибут | Селектор | Пример |
|---------|----------|--------|
| `class="qtext"` | `.qtext` | `.qtext` |
| `id="question"` | `#question` | `#question` |
| тег `<h2>` | `h2` | `h2` |

### Готовые конфиги

**Moodle** (уже настроен по умолчанию):
```javascript
questionSelector: '.qtext',
answersSelector: '.answer > div[class*="r"]',
nextButtonSelector: 'input[value="Next page"], input[value="Наступна сторінка"]',
```

---

## Выбор модели

В `server/server.py` поменяй строку:

```python
OLLAMA_MODEL = "llama3.1"  # ← сюда название модели
```

| Модель | Размер | Качество | Скорость |
|--------|--------|----------|----------|
| `llama3.1` | ~5 GB | ⭐⭐⭐⭐ | средняя |
| `mistral` | ~4 GB | ⭐⭐⭐⭐ | быстрая |
| `qwen2.5` | ~5 GB | ⭐⭐⭐⭐⭐ | средняя |
| `gemma2` | ~6 GB | ⭐⭐⭐⭐⭐ | медленная |

---

## Зависимости

**Python (`requirements.txt`):**
```
flask
flask-cors
requests
```

**Расширение:** чистый JavaScript, без зависимостей.

---

## Частые проблемы

**Сервер не отвечает**
```bash
# Проверь что Ollama запущена
ollama list

# Проверь что сервер запущен
curl http://localhost:5000/ask
```

**Расширение не находит вопрос**
- Открой F12 → Console и посмотри логи `[QuizAI]`
- Убедись что селектор в CONFIG правильный для твоего сайта

**Модель отвечает неправильно**
- Попробуй другую модель (qwen2.5 лучше всего справляется с тестами)
- Увеличь `num_predict` в `server.py` до 100

**CORS ошибка в консоли**
- Убедись что Flask сервер запущен
- Проверь что в `server.py` есть `CORS(app)`

---

## Лицензия

MIT — делай что хочешь.
