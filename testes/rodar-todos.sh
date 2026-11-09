#!/usr/bin/env bash
# Roda todos os testes (testes/teste-*.mjs) contra os servidores locais e falha se algum falhar.
# Antes: npm run dev:sala (porta 8790), npm run dev (porta 8788) e (cd public && python3 -m http.server 8765).
# Falha quando o teste sai com erro ou escreve FALHA/FALHOU/PAGEERROR (erro na página do jogo).
# ESTADO=pasta do --persist-to do servidor local: antes de cada teste zera os limites por IP (criar conta, entrar...),
# senão os testes que criam contas pela tela passam do limite de 10 contas por hora e falham.
# Uso: bash testes/rodar-todos.sh            (todos)
#      bash testes/rodar-todos.sh agua mapa   (só os que têm esses nomes)
cd "$(dirname "$0")/.."
export PORTA="${PORTA:-8788}" BASE="${BASE:-http://localhost:8788}" SAIDA="${SAIDA:-$(mktemp -d)}"
mkdir -p "$SAIDA"
falhas=()
for f in testes/teste-*.mjs; do
  n=$(basename "$f" .mjs)
  if [ $# -gt 0 ]; then ok=0; for p in "$@"; do [[ "$n" == *"$p"* ]] && ok=1; done; [ $ok = 1 ] || continue; fi
  ini=$(date +%s)
  [ -n "$ESTADO" ] && npx wrangler d1 execute pradaria-db --local --persist-to "$ESTADO" --command "DELETE FROM tentativas" > /dev/null 2>&1
  if timeout 300 node "$f" > "$SAIDA/$n.log" 2>&1 && ! grep -qE '^FALHA|FALHOU|PAGEERROR|NÃO ENTROU' "$SAIDA/$n.log"; then
    echo "ok     $n ($(( $(date +%s) - ini ))s)"
  else
    echo "FALHOU $n ($(( $(date +%s) - ini ))s)"; tail -n 25 "$SAIDA/$n.log" | sed 's/^/       /'; falhas+=("$n")
  fi
done
echo "saídas em $SAIDA"
if [ ${#falhas[@]} -gt 0 ]; then echo "falharam: ${falhas[*]}"; exit 1; fi
echo "todos os testes passaram"
