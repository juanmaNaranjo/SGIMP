# 🚀 SGIMP — Guía de instalación en otra máquina

Esta guía explica cómo poner el sistema a funcionar desde cero en un computador nuevo.
Hay dos caminos: **A) Docker** (recomendado, 5 comandos) y **B) Sin Docker** (para desarrollar).

---

## 1. ¿Qué necesita la máquina?

### Camino A — Docker (recomendado)

| Requisito | Detalle |
|---|---|
| Docker | **Docker Desktop** (Windows/Mac) o **Docker Engine + Compose v2** (Linux) |
| Git | Para clonar el repositorio |
| RAM | Mínimo 4 GB, recomendado 8 GB |
| Disco libre | 5–10 GB (las imágenes con pandas/scikit-learn son pesadas) |
| Puertos libres | `3000` (web), `8000` (API), `5432` (PostgreSQL) |
| Internet | Para descargar imágenes y dependencias en el primer build |

**Windows:** Docker Desktop requiere **WSL 2** activado y la virtualización habilitada en la BIOS.
Verificar la instalación:

```bash
docker --version
docker compose version
git --version
```

### Camino B — Sin Docker

| Requisito | Versión |
|---|---|
| Python | 3.11 |
| Node.js | 20 LTS (incluye npm) |
| PostgreSQL | 16 |
| Git | cualquiera reciente |

### Opcional (en ambos caminos)

- **API key de Anthropic** para el asistente IA y la búsqueda web de proveedores. Sin ella el sistema funciona completo; solo el chatbot muestra un aviso. Cada persona debe crear **su propia clave** en <https://console.anthropic.com>.

---

## 2. Camino A — Instalación con Docker

### Paso 1. Clonar el repositorio

```bash
git clone <URL-DEL-REPOSITORIO> sgimp
cd sgimp
```

### Paso 2. Crear el archivo `.env`

El `.env` **no viene en el repositorio** (contiene secretos). Se crea a partir de la plantilla:

```bash
# Linux / Mac / Git Bash
cp .env.example .env

# Windows PowerShell
Copy-Item .env.example .env
```

Abrir `.env` y completar:

| Variable | Qué poner |
|---|---|
| `POSTGRES_PASSWORD` | Una clave cualquiera, **solo letras y números** (los símbolos `@ / :` rompen la URL de conexión) |
| `SECRET_KEY` | Valor aleatorio largo. Generarlo con `openssl rand -hex 32` (o cualquier cadena aleatoria de 32+ caracteres) |
| `ANTHROPIC_API_KEY` | Su API key (opcional, se puede dejar vacía) |
| `ALLOWED_ORIGINS` | Dejar `http://localhost:3000` en local |

> Si falta `POSTGRES_PASSWORD` o `SECRET_KEY`, Docker Compose se detiene con un mensaje claro indicando cuál falta.

### Paso 3. Construir y levantar

```bash
docker compose build
docker compose up -d
```

El primer `build` tarda entre 5 y 10 minutos (descarga dependencias de Python y Node). Los siguientes son rápidos.

### Paso 4. Cargar los datos iniciales (solo la primera vez)

```bash
docker compose exec backend python -m app.db.seed
```

Esto crea los usuarios, categorías, bodegas y materias primas de ejemplo.

### Paso 5. Abrir el sistema

| Servicio | URL |
|---|---|
| Aplicación web | <http://localhost:3000> |
| Documentación de la API | <http://localhost:8000/api/docs> |
| Estado del backend | <http://localhost:8000/health> |

**Usuarios de ejemplo** (creados por el seed):

| Usuario | Contraseña | Rol |
|---|---|---|
| `admin` | `Admin1234` | Administrador |
| `calidad` | `Calidad1234` | Analista de calidad |
| `almacen` | `Almacen1234` | Almacenista |

> ⚠️ Son credenciales de demostración. **Cambiarlas** antes de usar el sistema con datos reales.

### Verificar que todo está sano

```bash
docker compose ps
```

Los tres servicios (`db`, `backend`, `frontend`) deben aparecer como `running`/`healthy`.

---

## 3. Camino B — Instalación sin Docker (desarrollo)

### Paso 1. Base de datos

```bash
# Crear la base (ajustar usuario/clave a su instalación de PostgreSQL)
psql -U postgres -c "CREATE DATABASE sgimp_db;"
```

### Paso 2. Backend

```bash
cd backend

python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate

pip install -r requirements.txt

cp .env.example .env              # Windows: Copy-Item .env.example .env
```

Editar `backend/.env` y ajustar como mínimo:

```env
DATABASE_URL=postgresql+asyncpg://postgres:TU_CLAVE@localhost:5432/sgimp_db
DATABASE_URL_SYNC=postgresql://postgres:TU_CLAVE@localhost:5432/sgimp_db
SECRET_KEY=un-valor-aleatorio-de-32-caracteres-o-mas
ANTHROPIC_API_KEY=           # opcional
```

Cargar datos iniciales y arrancar (desde la carpeta `backend/`):

```bash
python -m app.db.seed
uvicorn app.main:app --reload --port 8000
```

> Las tablas se crean automáticamente al arrancar el backend.

### Paso 3. Frontend (otra terminal)

```bash
cd frontend
npm install
npm run dev
```

Abrir <http://localhost:3000>. El servidor de desarrollo redirige `/api` al backend en el puerto 8000.

---

## 4. Comandos del día a día (Docker)

```bash
docker compose up -d              # iniciar
docker compose down               # detener (conserva los datos)
docker compose down -v            # detener Y BORRAR la base de datos y los documentos
docker compose logs -f backend    # ver logs del backend
docker compose restart backend    # reiniciar tras un cambio
docker compose build --no-cache   # reconstruir desde cero
```

---

## 5. Qué NO viaja con el repositorio

El `.gitignore` excluye a propósito estos archivos. La otra persona debe **crearlos o generarlos**, no pedirlos:

| No está en Git | Cómo se obtiene en la otra máquina |
|---|---|
| `.env` y `backend/.env` | Se crean desde `.env.example` (ver Paso 2) |
| Base de datos (datos reales) | Se genera vacía + `seed`. Para llevar datos reales, ver sección 6 |
| `uploads/` (documentos PDF cargados) | Se genera al usar el sistema. Para llevar los existentes, ver sección 6 |
| `node_modules/`, `__pycache__/`, `venv/` | Se regeneran con `npm install` / `pip install` / `docker compose build` |
| API key de Anthropic | Cada persona crea la suya |

**Buenas prácticas al compartir:**

- Enviar solo la URL del repositorio. **No** compartir `.env` ni la API key por chat o correo.
- Cada persona genera su propio `SECRET_KEY` y su propia `ANTHROPIC_API_KEY`.

---

## 6. Llevar los datos reales a otra máquina (opcional)

Si no se quiere empezar con datos de ejemplo sino con los datos actuales:

```bash
# En la máquina ORIGEN: exportar base de datos y documentos
docker compose exec -T db pg_dump -U postgres sgimp_db | gzip > sgimp_db.sql.gz
docker run --rm -v sgimp_uploads_data:/source:ro -v "$(pwd)":/backup alpine \
  tar czf /backup/uploads.tar.gz -C /source .

# En la máquina DESTINO (con el sistema ya levantado, SIN correr el seed):
gunzip -c sgimp_db.sql.gz | docker compose exec -T db psql -U postgres sgimp_db
docker run --rm -v sgimp_uploads_data:/dest -v "$(pwd)":/backup:ro alpine \
  sh -c "cd /dest && tar xzf /backup/uploads.tar.gz"
```

> El nombre del volumen (`sgimp_uploads_data`) depende del nombre de la carpeta del proyecto. Verificarlo con `docker volume ls`.

---

## 7. Subir el proyecto a Git

```bash
cd sgimp
git init -b main
git add .
git status          # REVISAR: no debe aparecer ningún .env, uploads/ ni node_modules/
git commit -m "SGIMP: versión inicial"
git remote add origin <URL-DEL-REPOSITORIO>
git push -u origin main
```

> **Si un `.env` ya fue subido alguna vez**, agregarlo al `.gitignore` no lo quita del historial. Hay que ejecutar `git rm --cached .env` y, sobre todo, **rotar** (cambiar) todas las claves que contenía, porque ya quedaron expuestas.

---

## 8. Problemas comunes

| Síntoma | Causa y solución |
|---|---|
| `Falta POSTGRES_PASSWORD en el archivo .env` | No se creó el `.env` en la raíz del proyecto. Ejecutar `cp .env.example .env` y completarlo |
| `port is already allocated` (3000, 8000 o 5432) | Otro programa usa ese puerto. Cerrarlo, o cambiar el puerto izquierdo en `docker-compose.yml` (ej. `"3001:80"`) |
| `password authentication failed for user "postgres"` | Se cambió `POSTGRES_PASSWORD` después del primer arranque. La BD conserva la clave vieja. Solución: `docker compose down -v` y volver a levantar (borra datos) |
| Error `password cannot be longer than 72 bytes` / `bcrypt` | Versión incompatible de bcrypt. El `requirements.txt` ya fija `bcrypt==4.0.1`; reconstruir con `docker compose build --no-cache backend` |
| El backend reinicia o dice `connection refused` | La BD tarda 15–30 s en estar lista. Esperar y revisar `docker compose logs backend` |
| Pantalla en blanco en el navegador | Abrir la consola (F12). Verificar que el backend responda en <http://localhost:8000/health> |
| El asistente IA dice que no está configurado | Falta `ANTHROPIC_API_KEY` en el `.env`. Después de editarlo: `docker compose up -d` (recrea el backend con la nueva variable) |
| Error 413 al subir un documento | El archivo supera 50 MB (límite del sistema) |
| `docker compose` no se reconoce | Versión antigua de Docker. Instalar Compose v2 o usar `docker-compose` (con guion) |

---

## 9. Checklist de entrega

- [ ] El repositorio no contiene ningún `.env` (verificar con `git ls-files | grep .env` → solo debe salir `.env.example`)
- [ ] La otra persona tiene Docker (o Python 3.11 + Node 20 + PostgreSQL 16)
- [ ] Creó su `.env` con su propio `SECRET_KEY` y, si quiere el asistente IA, su `ANTHROPIC_API_KEY`
- [ ] Ejecutó `docker compose up -d` y el `seed`
- [ ] Ingresó a <http://localhost:3000> con `admin` / `Admin1234`
- [ ] Cambió las contraseñas de ejemplo
