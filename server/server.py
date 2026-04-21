import re
import requests
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

OLLAMA_URL = "http://localhost:11434/api/generate"
OLLAMA_MODEL = "gemma4:31b-cloud"

def ask_ollama(prompt):
    response = requests.post(OLLAMA_URL, json={
        "model": OLLAMA_MODEL,
        "prompt": prompt,
        "stream": False,
        "options": {
            "temperature": 0,
            "num_predict": 50,  # даём больше токенов, парсим сами
        }
    })
    response.raise_for_status()
    return response.json()["response"].strip()


def parse_answer(raw, answers):
    raw_lower = raw.lower().strip()
    print(f"[Parser] Парсим: '{raw}'")

    # 1. Ищем явный индекс: "0", "1", "2"...
    match = re.search(r'\b([0-9]+)\b', raw)
    if match:
        idx = int(match.group(1))
        if idx < len(answers):
            return idx

    # 2. Ищем букву: A/B/C/D или А/Б/В/Г (кириллица)
    letter_map_en = {'a': 0, 'b': 1, 'c': 2, 'd': 3, 'e': 4}
    letter_map_ru = {'а': 0, 'б': 1, 'в': 2, 'г': 3, 'д': 4}

    match = re.search(r'\b([a-eа-д])\b', raw_lower)
    if match:
        letter = match.group(1)
        idx = letter_map_en.get(letter) or letter_map_ru.get(letter)
        if idx is not None and idx < len(answers):
            return idx

    # 3. Ищем текст ответа прямо в ответе модели
    for ans in answers:
        if ans['text'].lower() in raw_lower:
            return ans['index']

    # 4. Ищем "первый/second/third" и т.д.
    ordinals_ru = ['первый', 'первая', 'первое', 'второй', 'вторая', 'третий', 'четвёртый']
    ordinals_en = ['first', 'second', 'third', 'fourth', 'fifth']
    for i, word in enumerate(ordinals_ru):
        if word in raw_lower and i < len(answers):
            return i
    for i, word in enumerate(ordinals_en):
        if word in raw_lower and i < len(answers):
            return i

    return None  # не смогли распарсить


@app.route('/ask', methods=['POST'])
def ask():
    data = request.json
    question = data.get('question', '')
    answers = data.get('answers', [])

    if not question or not answers:
        return jsonify({'error': 'Нет вопроса или ответов'}), 400

    answers_text = '\n'.join([f"{a['index']}. {a['text']}" for a in answers])

    prompt = f"""You are answering a test question. Choose the correct answer.

Question: {question}

Options:
{answers_text}

Reply with ONLY the number (0, 1, 2...) of the correct answer. No explanation."""

    raw = ask_ollama(prompt)
    print(f"[Ollama] Ответ: '{raw}'")

    index = parse_answer(raw, answers)

    if index is None:
        return jsonify({'error': f'Не смог распарсить ответ: {raw}'}), 500

    print(f"[Server] Выбран #{index}: {answers[index]['text']}")
    return jsonify({'answer_index': index})


if __name__ == '__main__':
    print(f"QuizAI Server (Ollama/{OLLAMA_MODEL}) запущен на http://localhost:5000")
    app.run(host='0.0.0.0', port=5000, debug=False)
