#!/bin/bash
# Roda dentro do emulador de tablet (job teste-app do apk.yml): instala o app do tablet e roda o teste de verdade
# (testes/teste-app-apk.mjs): abre com internet, entra na conta, liga o modo avião e joga sem internet.
set -u
SAIDA=${SAIDA:-$PWD/saida-app}; mkdir -p "$SAIDA"
APK=${APK:-pradaria-teste.apk}
falhou=0
adb wait-for-device
adb shell getprop ro.build.version.release | tee "$SAIDA/android.txt"
adb shell dumpsys package com.google.android.webview | grep -m1 versionName | tee -a "$SAIDA/android.txt"
adb shell wm size | tee -a "$SAIDA/android.txt"
adb install -r "$APK" || exit 1
adb logcat -c
SAIDA="$SAIDA" node testes/teste-app-apk.mjs || falhou=1
adb shell cmd connectivity airplane-mode disable >/dev/null 2>&1
adb logcat -d > "$SAIDA/logcat.txt"
grep -E "PradariaPacote|chromium.*(Uncaught|Error)|AndroidRuntime" "$SAIDA/logcat.txt" | tail -60
exit $falhou
