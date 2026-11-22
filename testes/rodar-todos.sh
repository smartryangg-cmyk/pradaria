#!/usr/bin/env bash
# Roda todos os testes (testes/teste-*.mjs) contra os servidores locais e falha se algum falhar.
# Antes: npm run dev:sala (porta 8790), npm run dev (porta 8788) e (cd public && python3 -m http.server 8765).
# Falha quando o teste sai com erro ou escreve FALHA/FALHOU/PAGEERROR (erro na página do jogo).
# ESTADO=pasta do --persist-to do servidor local: antes de cada teste zera os limites por IP (criar conta, entrar...),
# senão os testes que criam contas pela tela passam do limite de 10 contas por hora e falham.
# Uso: bash testes/rodar-todos.sh            (todos)
#      bash testes/rodar-todos.sh agua mapa   (só os que têm esses nomes)
#      PARTE=2/6 bash testes/rodar-todos.sh   (só a 2ª de 6 partes: o 2º, o 8º, o 14º... teste; o CI roda as 6 juntas)
cd "$(dirname "$0")/.."
export PORTA="${PORTA:-8788}" BASE="${BASE:-http://localhost:8788}" SAIDA="${SAIDA:-$(mktemp -d)}"
# ONLINE: os testes de blocos (fogo, lava, balde, cama...) também jogam a parte online (2 jogadores, sala conferindo) contra o site local.
# Sem isso a parte online, que confere as regras da sala contra aparelho modificado, nunca rodava. ONLINE= (vazio) desliga.
export ONLINE="${ONLINE-$BASE}"
mkdir -p "$SAIDA"
falhas=()
idx=0
# um teste: sai sem erro e não escreve FALHA/FALHOU/PAGEERROR (erro na página do jogo)
rodar() {
  [ -n "$ESTADO" ] && npx wrangler d1 execute pradaria-db --local --persist-to "$ESTADO" --command "DELETE FROM tentativas" > /dev/null 2>&1
  timeout 420 node "$1" > "$2" 2>&1 && ! grep -qE '^FALHA|FALHOU|PAGEERROR|NÃO ENTROU' "$2"
}
# o que falhou numa tentativa que não valeu: os logs ficam só na máquina do CI, então mostra aqui (para achar a causa)
antes() { grep -E '^FALHA|PAGEERROR|NÃO ENTROU|Error' "$SAIDA/$1.log" | head -n 5 | sed "s/^/       $2: /"; }
for f in testes/teste-*.mjs; do
  n=$(basename "$f" .mjs)
  # o app da TV precisa do emulador de Android TV: roda no apk.yml (testes/teste-tv-apk.sh), não aqui
  [ "$n" = teste-tv-apk ] && continue
  idx=$((idx + 1))
  if [ -n "$PARTE" ]; then [ $(( (idx - 1) % ${PARTE#*/} + 1 )) = "${PARTE%/*}" ] || continue; fi
  if [ $# -gt 0 ]; then ok=0; for p in "$@"; do [[ "$n" == *"$p"* ]] && ok=1; done; [ $ok = 1 ] || continue; fi
  ini=$(date +%s)
  if rodar "$f" "$SAIDA/$n.log"; then
    echo "ok     $n ($(( $(date +%s) - ini ))s)"
  elif mv "$SAIDA/$n.log" "$SAIDA/$n-1a-vez.log" && rodar "$f" "$SAIDA/$n.log"; then
    # os testes jogam de verdade (navegador, sala, dois jogadores): numa máquina carregada um tempo pode estourar.
    # Passou na 2ª vez: conta como ok, mas fica avisado (e a saída da 1ª vez fica guardada). Erro de verdade falha nas duas.
    echo "ok     $n ($(( $(date +%s) - ini ))s, passou na 2ª vez; 1ª vez em $n-1a-vez.log)"
    antes "$n-1a-vez" 1a
  elif mv "$SAIDA/$n.log" "$SAIDA/$n-2a-vez.log" && rodar "$f" "$SAIDA/$n.log"; then
    # a máquina do CI às vezes fica bem mais lenta por uns minutos (o mesmo teste leva 2-4x mais): 3ª chance
    echo "ok     $n ($(( $(date +%s) - ini ))s, passou na 3ª vez; antes em $n-1a-vez.log e $n-2a-vez.log)"
    antes "$n-1a-vez" 1a; antes "$n-2a-vez" 2a
  else
    echo "FALHOU $n ($(( $(date +%s) - ini ))s)"; { grep -E 'FALHA|PAGEERROR|NÃO ENTROU|Error' "$SAIDA/$n.log" | head -n 15; echo '       --- fim do log:'; tail -n 15 "$SAIDA/$n.log"; } | sed 's/^/       /'; falhas+=("$n")
  fi
done
echo "saídas em $SAIDA"
if [ ${#falhas[@]} -gt 0 ]; then echo "falharam: ${falhas[*]}"; exit 1; fi
echo "todos os testes passaram"
