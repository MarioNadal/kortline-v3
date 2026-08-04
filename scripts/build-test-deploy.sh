#!/usr/bin/env bash
# Regenera la copia de pruebas en /test/ a partir de los archivos de
# producción (index.html, sw.js, manifest.json, icon-*.png, assets/).
#
# La copia de pruebas es un club de Firestore totalmente distinto y aislado
# (clubs/cbjaca-test en vez de clubs/cbjaca) pero usa el MISMO PIN real
# (la autenticación es una única cuenta de Firebase Auth compartida, no
# depende del club). Así que entrando con tu PIN de siempre en
# https://<tu-usuario>.github.io/kortline-v3/test/ tienes una app real,
# instalable en el móvil, con datos 100% separados del club de verdad.
#
# Ejecutar SIEMPRE después de cualquier cambio en index.html/sw.js que se
# despliegue a producción, para que /test/ no se quede desactualizado:
#   bash scripts/build-test-deploy.sh
#
set -euo pipefail
cd "$(dirname "$0")/.."

mkdir -p test
cp index.html test/index.html
cp sw.js test/sw.js
cp manifest.json test/manifest.json
cp icon-192.png test/icon-192.png 2>/dev/null || true
cp icon-512.png test/icon-512.png 2>/dev/null || true
rm -rf test/assets
cp -r assets test/assets 2>/dev/null || true

# 1) Club de Firestore aislado (mismo login/PIN, datos separados)
sed -i 's/const CLUB_ID = "cbjaca";/const CLUB_ID = "cbjaca-test";/' test/index.html

# 2) Cache del Service Worker con nombre propio, para que activar/limpiar
#    cachés en /test/ nunca borre las cachés de la app de producción en el
#    mismo navegador/móvil (Cache Storage es por origen, no por carpeta).
CUR_VER=$(grep -o 'kortline-v3\.0\.0-dev\.[0-9]*' sw.js | head -1)
sed -i "s/const CACHE_VERSION = \"${CUR_VER}\";/const CACHE_VERSION = \"kortline-v3-test-${CUR_VER#kortline-v3.0.0-}\";/" test/sw.js
sed -i 's/k\.startsWith("kortline-") \&\& k !== CACHE_VERSION/k.startsWith("kortline-v3-test-") \&\& k !== CACHE_VERSION/' test/sw.js

# 3) Nombre distinto en el manifest para que el icono instalado en el móvil
#    no se confunda con el de producción.
python3 - <<'PYEOF'
import json
with open("test/manifest.json", encoding="utf-8") as f:
    m = json.load(f)
m["name"] = "Kortline · PRUEBAS"
m["short_name"] = "Kortline TEST"
m["description"] = "Copia de pruebas -- datos separados del club real"
with open("test/manifest.json", "w", encoding="utf-8") as f:
    json.dump(m, f, ensure_ascii=False, indent=2)
PYEOF

echo "listo: test/ regenerado a partir de index.html/sw.js/manifest.json"
