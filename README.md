# ms-emergencias

> Microservicio de integración con organismos de emergencia chilenos. Orquesta el envío de alertas a Bomberos, CONAF, Carabineros, SENAPRED y otros, con trazabilidad completa, reintentos automáticos y seguridad Zero-Trust.

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![Node](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen)
![License](https://img.shields.io/badge/license-ISC-blue)

---

## Descripción

`ms-emergencias` es el cerebro de notificación del ecosistema FocoCero. Cuando se declara una emergencia, este microservicio:

- **Despacha** la alerta al organismo correspondiente mediante HTTP (Bomberos, CONAF, Carabineros, SENAPRED, SAMU, etc.).
- **Trazabiliza** cada intento en PostgreSQL con payload, respuesta, código HTTP, latencia y detalle de error — modelo de auditoría inmutable.
- **Reintenta** automáticamente los despachos fallidos con backoff exponencial + jitter y concurrencia controlada (3 en paralelo).
- **Valida idempotencia**: no se puede despachar el mismo evento al mismo organismo dos veces (unique constraint `(correlation_id, organismo)`).
- **Opera** dentro de la red interna de Docker, autenticado con token secreto compartido (`x-internal-token`) y registrado en Eureka.

---

## Stack

| Capa | Tecnología |
|------|-----------|
| Runtime | Node.js 20+ |
| Framework | Express 5.2 (TypeScript 5.9) |
| Base de datos | PostgreSQL 15 + PostGIS |
| Cliente HTTP | Axios 1.15 + axios-retry 4.5 |
| Validación | Zod 3.25 |
| Logging | Pino 10 |
| Métricas | prom-client 15 (`/metrics`) |
| Seguridad | helmet 8 |
| Service Discovery | eureka-js-client 4.5 |
| Testing | Jest 29 + Supertest 6 |

---

## Requisitos

- **Node.js** >= 20.0.0
- **npm** >= 9.0.0
- **PostgreSQL** 15+ (extensiones `uuid-ossp`, `pg_trgm`)
- **Docker** (para ejecutar con el ecosistema completo)
- Acceso a las APIs externas de los organismos de emergencia

---

## Variables de entorno

Todas son validadas al arranque con `env-var`. Son requeridas a menos que se indique un default.

| Variable | Tipo | Default | Descripción |
|----------|------|---------|-------------|
| `PORT` | `number` | — | Puerto del servidor |
| `NODE_ENV` | `string` | `development` | Entorno de ejecución |
| `DOCKER_ENV` | `string` | — | `true` si corre en Docker (cambia resolución DB_HOST) |
| `DB_USER` | `string` | — | Usuario PostgreSQL |
| `DB_PASSWORD` | `string` | — | Contraseña PostgreSQL |
| `DB_NAME` | `string` | — | Base de datos (`emergencias_db`) |
| `DB_HOST` | `string` | — | Host PostgreSQL (Docker: `db-fococero`) |
| `DB_HOST_LOCAL` | `string` | — | Host local (desarrollo fuera de Docker) |
| `DB_PORT` | `number` | — | Puerto PostgreSQL (Docker) |
| `DB_PORT_LOCAL` | `number` | — | Puerto local (desarrollo) |
| `EUREKA_HOST` | `string` | `localhost` | Host de Eureka Server |
| `INTERNAL_SECRET_TOKEN` | `string` | — | Token de autenticación entre microservicios |
| `API_GATEWAY_URL` | `string` | — | URL del API Gateway (CORS) |
| `BOMBEROS_API_URL` | `string` | — | Endpoint Bomberos de Chile |
| `BOMBEROS_API_KEY` | `string` | — | API Key Bomberos |
| `CONAF_API_URL` | `string` | — | Endpoint CONAF |
| `CONAF_API_KEY` | `string` | — | API Key CONAF |
| `CARABINEROS_API_URL` | `string` | — | Endpoint Carabineros |
| `CARABINEROS_API_KEY` | `string` | — | API Key Carabineros |
| `SENAPRED_API_URL` | `string` | — | Endpoint SENAPRED |
| `SENAPRED_API_KEY` | `string` | — | API Key SENAPRED |
| `MAX_RETRIES` | `number` | `3` | Reintentos máximos por despacho |
| `RETRY_DELAY_MS` | `number` | `2000` | Delay base entre reintentos (ms) |
| `AXIOS_TIMEOUT_MS` | `number` | `5000` | Timeout por petición HTTP externa (ms) |

---

## Instalación

### Desarrollo local

```bash
cd fococero-backend/ms-emergencias
npm install
cp .env.template .env   # Editar con valores locales
# Crear base de datos e inicializar schema
psql -U postgres -c "CREATE DATABASE emergencias_db;"
psql -U postgres -d emergencias_db -f database/init.sql
npm run dev
```

### Con Docker (recomendado)

```bash
docker compose up -d --build ms-emergencias
```

El servicio queda accesible a través del API Gateway en `http://localhost:3000/api/v1/emergencias`.

### Scripts

```bash
npm run dev      # Hot-reload (ts-node-dev)
npm run build    # Compilar TypeScript
npm run start    # Producción (compilado)
npm run test     # Jest
npm run lint     # ESLint
npm run format   # Prettier
```

---

## Endpoints

Todas las rutas bajo `/api/v1/emergencias` requieren header `x-internal-token` (excepto `/health` y `/metrics`).

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/health` | Health check con verificación de PostgreSQL |
| `GET` | `/metrics` | Métricas Prometheus |
| `POST` | `/api/v1/emergencias/despachos` | Registrar y ejecutar un despacho |
| `POST` | `/api/v1/emergencias/despachos/retry` | Reintentar despachos fallidos (background) |
| `GET` | `/api/v1/emergencias/despachos/:correlation_id` | Consultar estado por ID de correlación |
| `PATCH` | `/api/v1/emergencias/despachos/:id/estado` | Actualizar estado (webhooks/cancelaciones) |

### Ejemplo

```bash
curl -X POST http://localhost:3000/api/v1/emergencias/despachos \
  -H "Content-Type: application/json" \
  -H "x-internal-token: <token>" \
  -d '{
    "alerta_id": "a1b2c3d4-...",
    "correlation_id": "e5f6g7h8-...",
    "organismo": "BOMBEROS",
    "prioridad": "CRITICA",
    "endpoint_url": "https://api.bomberos.cl/v1/alertas",
    "request_payload": {
      "tipo_evento": "INCENDIO_ESTRUCTURAL",
      "direccion": "Av. Siempre Viva 742",
      "comuna": "Santiago"
    }
  }'
```

### Máquina de estados

```
PENDIENTE ──► PROCESANDO ──► EXITOSO
                  │
                  ▼
              FALLIDO ──► REINTENTANDO ──► PROCESANDO
                  │                            │
                  ▼                            ▼
              CANCELADO                    CANCELADO
```

Transiciones válidas definidas en `validators/despacho.validator.ts`. Transiciones inválidas devuelven `400`.

---

## Swagger

La especificación OpenAPI 3.0 está en `src/docs/swagger.json`. Incluye:

- **Security scheme**: `x-internal-token` (API Key en header).
- **Schemas**: `DespachoRequest`, `DespachoResponse`, `ErrorResponse`.
- **Endpoints**: Todos los endpoints documentados con ejemplos.

Para visualizarla, abre el archivo en [Swagger Editor](https://editor.swagger.io/) o monta Swagger UI desde `app.ts`.

---

## Seguridad

El modelo sigue un enfoque **Zero-Trust** para comunicación entre microservicios:

- **Rutas públicas**: solo `/health` y `/metrics` no requieren autenticación.
- **Rutas privadas**: protegidas por `internalAuthMiddleware`, que verifica el header `x-internal-token` contra `INTERNAL_SECRET_TOKEN`.
- **URL Allowlist**: los despachos solo pueden enviarse a dominios oficiales chilenos: `api.(bomberos|conaf|carabineros|senapred).cl`. Cualquier otra URL es rechazada con `400`.
- **Validación Zod**: todos los endpoints de escritura validan body, params y query con schemas tipados. Errores devuelven `400` con array de detalles.
- **Helmet**: cabeceras HTTP de seguridad (CSP restrictiva).
- **Timeout**: cada petición externa tiene timeout configurable (`AXIOS_TIMEOUT_MS`, default 5000ms).
- **Reintentos**: backoff exponencial con jitter para evitar thundering herd.

---

## Eureka

El microservicio se registra automáticamente en Eureka Server al iniciar mediante `eureka-js-client`.

```
instance: { app: 'ms-emergencias', hostName: 'ms-emergencias', port: { $: PORT }, vipAddress: 'ms-emergencias' }
eureka: { host: process.env.EUREKA_HOST || 'eureka-server', port: 8761, servicePath: '/eureka/apps/' }
```

**Ciclo de vida**: registro en `initEureka()`, heartbeat periódico, desregistro en graceful shutdown.

**Graceful shutdown**: detener Eureka → cerrar HTTP → cerrar pool PostgreSQL → salir (timeout 10s).

---

## Base de datos

### Tabla principal: `logs_despacho`

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | `UUID` (PK) | Identificador único |
| `alerta_id` | `UUID` | ID de la alerta origen |
| `correlation_id` | `UUID` | ID de trazabilidad entre servicios |
| `organismo` | `ENUM` | Organismo destino |
| `estado` | `ENUM` | `PENDIENTE`, `PROCESANDO`, `EXITOSO`, `FALLIDO`, `REINTENTANDO`, `CANCELADO` |
| `prioridad` | `ENUM` | `BAJA`, `MEDIA`, `ALTA`, `CRITICA` |
| `request_payload` | `JSONB` | Payload enviado |
| `response_payload` | `JSONB` | Respuesta del organismo |
| `endpoint_url` | `TEXT` | URL invocada |
| `intentos_actuales` | `INTEGER` | Contador de reintentos |
| `max_reintentos_permitidos` | `INTEGER` | Límite de reintentos |
| `duracion_ms` | `INTEGER` | Latencia de la llamada |
| `codigo_error_http` | `INTEGER` | Código HTTP de error |
| `error_detalle` | `TEXT` | Mensaje de error |
| `created_at` / `updated_at` / `finalizado_at` | `TIMESTAMPTZ` | Timestamps |

**Índices**: `alerta_id`, `correlation_id`, `created_at`, GIN sobre `request_payload`, índice parcial sobre estados pendientes/reintentando.

**Idempotencia**: `UNIQUE (correlation_id, organismo)` evita duplicados. En conflicto, incrementa `intentos_actuales` en lugar de insertar.

---

## Desarrollo

### Comandos útiles

```bash
docker compose logs -f ms-emergencias
curl http://localhost:3001/health
curl http://localhost:3001/metrics
npm test
```

### Flujo de despacho

```
API Gateway ──POST──► ms-emergencias ──POST──► Organismo API
                          │                        │
                     INSERT log             200/4xx/5xx
                     PENDIENTE                    │
                          │                  UPDATE estado
                          └──────────────────► EXITOSO / FALLIDO
```

1. API Gateway redirige a `ms-emergencias`.
2. Controlador valida body con Zod.
3. Repositorio inserta log con estado `PENDIENTE`.
4. Servicio llama a la API externa.
5. Si es exitoso (2xx): actualiza a `EXITOSO`.
6. Si falla: actualiza a `FALLIDO` con código y detalle.
7. `reintentarDespachosFallidos()` en batches de 3 procesa reintentos pendientes.

---

## Mantenimiento

### Agregar un organismo

1. Agregar valor a `OrganismoType` en `models/despacho.model.ts`.
2. Agregar valor al enum SQL `organismo_type` en `database/init.sql`.
3. Agregar URL y API Key en `envs.ts`.
4. Agregar API Key en `getApiKey()` en `services/despacho.service.ts`.
5. Opcional: agregar dominio al allowlist en `despacho.validator.ts` y `despacho.service.ts`.

---

## Licencia

ISC © FocoCero Team
