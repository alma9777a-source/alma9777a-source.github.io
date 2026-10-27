@echo off
chcp 65001 >nul
title 남은 조각 - 빠른 받아쓰기 모델 내려받기
rem 남은 조각(나눔스튜디오) Windows용 — 그래픽 카드가 없는 PC를 위한 빠른 받아쓰기 모델(약 570MB)을
rem 앱이 쓰는 폴더(%APPDATA%\설교쇼츠\모델)에 내려받습니다. 다른 것은 바꾸지 않습니다.
rem 받는 곳: Hugging Face의 whisper.cpp 공식 모델(ggml-large-v3-turbo-q5_0.bin)
setlocal
set "DIR=%APPDATA%\설교쇼츠\모델"
set "FILE=%DIR%\ggml-large-v3-turbo-q5_0.bin"
set "URL=https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo-q5_0.bin"
echo.
echo  ============================================================
echo    남은 조각 - 빠른 받아쓰기 모델 내려받기 (약 570MB)
echo  ============================================================
echo.
echo  받을 곳: %DIR%
echo.
where curl.exe >nul 2>nul
if errorlevel 1 (
  echo  이 PC에는 내려받기 도구(curl)가 없습니다. Windows 10 1803 이상이 필요합니다.
  echo  홈페이지 안내의 '방법 3 - 직접 받아 넣기'로 진행해 주세요.
  goto :end
)
if exist "%FILE%" (
  for %%A in ("%FILE%") do if %%~zA GEQ 550000000 (
    echo  이미 받아 두셨습니다. 남은 조각을 켜고 설정 - 받아쓰기 모델에서 '빠르게'를 고르세요.
    goto :end
  )
)
if not exist "%DIR%" mkdir "%DIR%"
echo  내려받는 중입니다. 인터넷 속도에 따라 몇 분 걸립니다. 이 창을 닫지 마세요.
echo  (중간에 끊기면 이 파일을 다시 실행하면 이어서 받습니다)
echo.
curl.exe -L --fail --retry 3 -C - -o "%FILE%.part" "%URL%"
if errorlevel 1 (
  echo.
  echo  내려받지 못했습니다. 인터넷 연결을 확인한 뒤 이 파일을 다시 실행해 주세요.
  goto :end
)
for %%A in ("%FILE%.part") do if %%~zA LSS 550000000 (
  echo.
  echo  받은 파일 크기가 모자랍니다. 이 파일을 다시 실행해 주세요.
  goto :end
)
move /y "%FILE%.part" "%FILE%" >nul
echo.
echo  다 받았습니다!
echo  1. 남은 조각이 켜져 있으면 껐다가 다시 켜세요.
echo  2. 설정 - 받아쓰기 모델에서 '빠르게'를 고르세요.
echo     (그래픽 카드가 없는 PC는 '자동'으로 두어도 빠른 모델을 씁니다)
:end
echo.
pause
endlocal
