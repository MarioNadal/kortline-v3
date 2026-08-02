# Poner en marcha la base de datos compartida de Kortline v3

Esto solo hace falta hacerlo **una vez**. Son ~10 minutos, gratis, sin tarjeta de crédito.

## 1. Crear el proyecto de Firebase

1. Entra en https://console.firebase.google.com con tu cuenta de Google.
2. **Agregar proyecto** → nombre `kortline-v3` (o el que prefieras) → puedes desactivar Google Analytics, no hace falta para esto.
3. Espera a que termine de crearse.

## 2. Activar Firestore (la base de datos)

1. Menú izquierdo → **Compilación → Firestore Database** → **Crear base de datos**.
2. Modo **producción** (no "modo de prueba" — las reglas de seguridad las pones tú en el paso 4).
3. Región: `eur3 (europe-west)` está bien para España.
4. Crear.

## 3. Activar el acceso por código de club

1. Menú izquierdo → **Compilación → Authentication** → **Comenzar**.
2. Pestaña **Sign-in method** → habilita **Correo electrónico/contraseña** (el proveedor de más arriba, no el "sin contraseña").
3. Pestaña **Users** → **Add user**:
   - Email: `club-cbjaca@kortline.app` (exactamente así, no hace falta que sea un email real, es solo un identificador)
   - Contraseña: **el código que quieras que usen los 5 entrenadores para entrar** (mínimo 6 caracteres). Este es literalmente el PIN del club.
4. Guarda ese código en algún sitio seguro y compártelo con los 5 entrenadores por el canal que uses habitualmente (no hace falta que sea súper secreto, pero mejor no ponerlo en un grupo público).

## 4. Pegar las reglas de seguridad

1. Vuelve a **Firestore Database** → pestaña **Reglas**.
2. Borra lo que haya y pega el contenido del archivo [`firestore.rules`](firestore.rules) de este mismo repositorio.
3. **Publicar**.

Estas reglas hacen que solo se pueda leer/escribir si has iniciado sesión con el código del club — nada es público, y esto es lo que de verdad protege los datos (nombres de menores, lesiones, incidencias), no el código en sí.

## 5. Registrar la app web y conseguir la configuración

1. Icono de engranaje (arriba izquierda, junto a "Resumen del proyecto") → **Configuración del proyecto**.
2. Baja hasta **Tus apps** → icono `</>` (Web).
3. Nombre: `kortline-v3-web` → **NO** marques "Configurar también Firebase Hosting" (usamos GitHub Pages, como hasta ahora).
4. **Registrar app**. Te muestra un bloque `const firebaseConfig = {...}` con `apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, `appId`.
5. **Pégame ese bloque completo aquí en el chat.** No es información secreta (es la misma que usan todas las apps web de Firebase), así que no pasa nada por compartirla — la seguridad real la ponen las reglas del paso 4.

## Qué hago yo con eso

En cuanto me pases la configuración:
1. La pego en `FIREBASE_CONFIG` dentro de `index.html` (sustituyendo los `"PENDIENTE"`).
2. Despliego a GitHub Pages.
3. A partir de ese momento, cualquiera que abra la app verá la pantalla de "código del club" — con el código que pusiste en el paso 3, entra y ya está sincronizado con todos.
4. Migro tu backup actual de kortline-v2 (equipos, jugadores, partidos reales) a la nueva base de datos compartida, como acordamos.

## Preguntas frecuentes

**¿Cuesta dinero?** No, para 5 entrenadores y unos pocos equipos os quedáis muy por debajo de los límites gratuitos de Firebase (50.000 lecturas/día, 20.000 escrituras/día). Si algún día el club creciera mucho, avisaría antes de que hubiera riesgo de coste.

**¿Y si me olvido el código?** Puedes cambiarlo en cualquier momento desde Authentication → Users → (los tres puntos junto al usuario) → Restablecer contraseña.

**¿Puedo tener un código distinto por entrenador?** Se puede hacer más adelante si lo preferís (cada uno con su email), pero elegiste el código compartido por ser más simple de gestionar. Si cambias de opinión, es un cambio pequeño.
