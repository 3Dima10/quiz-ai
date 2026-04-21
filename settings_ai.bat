@echo off
chcp 65001 >nul
setlocal

set MODEL_NAME=gemma4:31b-cloud

echo ============================================
echo   Перевірка та встановлення Ollama
echo ============================================
echo.

:: ── 1. Перевірка Ollama ──────────────────────────────────────────────────────
where ollama >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [OK] Ollama вже встановлена.
    goto CHECK_MODEL
)

echo [INFO] Ollama не знайдена. Починаємо завантаження...
echo.

:: Завантаження інсталятора через PowerShell
powershell -Command "Invoke-WebRequest -Uri 'https://ollama.com/download/OllamaSetup.exe' -OutFile '%TEMP%\OllamaSetup.exe' -UseBasicParsing"
if %ERRORLEVEL% NEQ 0 (
    echo [ПОМИЛКА] Не вдалося завантажити інсталятор Ollama.
    echo Перевірте підключення до інтернету та спробуйте ще раз.
    pause
    exit /b 1
)

echo [INFO] Запускаємо встановлення Ollama...
"%TEMP%\OllamaSetup.exe" /silent
if %ERRORLEVEL% NEQ 0 (
    echo [ПОМИЛКА] Встановлення Ollama завершилось з помилкою.
    pause
    exit /b 1
)

:: Оновлення PATH для поточної сесії
set "PATH=%PATH%;%LOCALAPPDATA%\Programs\Ollama"

:: Чекаємо поки Ollama стане доступна
echo [INFO] Очікуємо запуску Ollama...
timeout /t 5 /nobreak >nul

where ollama >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ПОМИЛКА] Ollama не знайдена після встановлення.
    echo Спробуйте перезапустити командний рядок або перезавантажити ПК.
    pause
    exit /b 1
)

echo [OK] Ollama успішно встановлена!
echo.

:: ── 2. Перевірка моделі ───────────────────────────────────────────────────────
:CHECK_MODEL
echo ============================================
echo   Перевірка моделі: %MODEL_NAME%
echo ============================================
echo.

:: Запускаємо ollama serve у фоні якщо ще не запущено
tasklist /FI "IMAGENAME eq ollama.exe" 2>nul | find /I "ollama.exe" >nul
if %ERRORLEVEL% NEQ 0 (
    echo [INFO] Запускаємо Ollama сервер у фоновому режимі...
    start /B "" ollama serve >nul 2>&1
    timeout /t 3 /nobreak >nul
)

:: Перевіряємо чи модель вже завантажена
ollama list 2>nul | find /I "%MODEL_NAME%" >nul
if %ERRORLEVEL% EQU 0 (
    echo [OK] Модель "%MODEL_NAME%" вже встановлена.
    goto DONE
)

echo [INFO] Модель "%MODEL_NAME%" не знайдена. Починаємо завантаження...
echo [INFO] Це може зайняти деякий час залежно від швидкості інтернету.
echo.

ollama pull %MODEL_NAME%
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ПОМИЛКА] Не вдалося завантажити модель "%MODEL_NAME%".
    echo Перевірте назву моделі на https://ollama.com/library
    pause
    exit /b 1
)

echo.
echo [OK] Модель "%MODEL_NAME%" успішно встановлена!

:: ── 3. Готово ─────────────────────────────────────────────────────────────────
:DONE
echo.
echo ============================================
echo   Все готово! Можна запускати модель:
echo   ollama run %MODEL_NAME%
echo ============================================
echo.
pause
exit /b 0
