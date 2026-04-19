import re
import threading
import requests
from flask import Flask, request, jsonify
from flask_cors import CORS
import pystray
from pystray import MenuItem as item
from PIL import Image, ImageDraw

app = Flask(__name__)
CORS(app)

OLLAMA_URL = "http://localhost:11434/api/generate"
OLLAMA_MODEL = "llama3.1"

def ask_ollama(prompt):
    response = requests.post(OLLAMA_URL, json={
        "model": OLLAMA_MODEL,
        "prompt": prompt,
        "stream": False,
        "options": {"temperature": 0, "num_predict": 50}
    })
    response.raise_for_status()
    return response.json()["response"].strip()

def parse_answer(raw, answers):
    raw_lower = raw.lower().strip()

    match = re.search(r'\b([0-9]+)\b', raw)
    if match:
        idx = int(match.group(1))
        if idx < len(answers):
            return idx

    letter_map_en = {'a': 0, 'b': 1, 'c': 2, 'd': 3, 'e': 4}
    letter_map_ru = {'а': 0, 'б': 1, 'в': 2, 'г': 3, 'д': 4}
    match = re.search(r'\b([a-eа-д])\b', raw_lower)
    if match:
        letter = match.group(1)
        idx = letter_map_en.get(letter) or letter_map_ru.get(letter)
        if idx is not None and idx < len(answers):
            return idx

    for ans in answers:
        if ans['text'].lower() in raw_lower:
            return ans['index']

    return None

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
    index = parse_answer(raw, answers)

    if index is None:
        return jsonify({'error': f'Не смог распарсить: {raw}'}), 500

    return jsonify({'answer_index': index})


def run_flask():
    app.run(host='0.0.0.0', port=5000, debug=False, use_reloader=False)

def create_icon():
    # Рисуем простую иконку
    img = Image.new('RGB', (64, 64), color='#1e293b')
    draw = ImageDraw.Draw(img)
    draw.ellipse([8, 8, 56, 56], fill='#7c3aed')
    draw.text((20, 18), "AI", fill='white')
    return img

def quit_app(icon, item):
    icon.stop()
    import os
    os.kill(os.getpid(), 9)

def main():
    # Запускаем Flask в фоновом потоке
    flask_thread = threading.Thread(target=run_flask, daemon=True)
    flask_thread.start()

    # Иконка в трее
    icon = pystray.Icon(
        "QuizAI",
        create_icon(),
        "QuizAI Server — работает",
        menu=pystray.Menu(
            item('QuizAI Server — работает', lambda: None, enabled=False),
            item('Остановить', quit_app)
        )
    )
    icon.run()

if __name__ == '__main__':
    main()