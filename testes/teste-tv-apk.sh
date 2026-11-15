#!/bin/bash
# Roda dentro do emulador de Android TV (job teste-tv do apk.yml): instala o app da TV, confere que
# aparece no menu da TV, abre pelo menu e roda o teste de verdade (testes/teste-tv-apk.mjs).
set -u
SAIDA=${SAIDA:-$PWD/saida-tv}; mkdir -p "$SAIDA"
APK=${APK:-pradaria-tv-teste.apk}
falhou=0
adb wait-for-device
adb shell getprop ro.build.characteristics | tee "$SAIDA/caracteristicas.txt"
adb shell dumpsys package com.google.android.webview | grep -m1 versionName | tee "$SAIDA/webview.txt"
adb install -r "$APK" || exit 1
if adb shell cmd package query-activities --brief -a android.intent.action.MAIN -c android.intent.category.LEANBACK_LAUNCHER | grep -q dev.pradaria.tv; then
  echo "OK   aparece no menu da Android TV (LEANBACK_LAUNCHER)"
else
  echo "FALHOU não aparece no menu da Android TV"; falhou=1
fi
adb logcat -c
# abre como a TV abre pelo menu
adb shell monkey -p dev.pradaria.tv -c android.intent.category.LEANBACK_LAUNCHER 1
sleep 25
adb exec-out screencap -p > "$SAIDA/tv-apk-0-abriu.png"
adb shell wm size | tee -a "$SAIDA/caracteristicas.txt"
SAIDA="$SAIDA" node testes/teste-tv-apk.mjs || falhou=1
adb logcat -d > "$SAIDA/logcat.txt"
grep -E "chromium|dev.pradaria.tv|AndroidRuntime" "$SAIDA/logcat.txt" | tail -80
exit $falhou
