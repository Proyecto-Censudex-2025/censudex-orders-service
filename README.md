# Censudex - Orders Service

Servicio de administración de pedidos.

## Descripción

El Orders Service es uno de los microservicios que componen la arquitectura de Censudex. Es el módulo responsable de gestionar el ciclo de vida completo de los pedidos, desde su creación y validación de stock (vía eventos) hasta las notificaciones por correo electrónico.

## Arquitectura

Este proyecto utiliza una Arquitectura Modular (NestJS) y se comunica con otros servicios mediante gRPC para solicitudes síncronas y RabbitMQ para eventos asíncronos.

## Estructura del proyecto

```
censudex-orders-service/
├── src/
│   ├── orders/
│   │   ├── controllers/  # Controladores gRPC (orders.controller.ts)
│   │   ├── decorators/   # Decoradores personalizados (@GrpcUser)
│   │   ├── dto/          # DTOs (CreateOrderDto, UpdateOrderStatusDto)
│   │   ├── entities/     # Entidades de TypeORM (Order, OrderItem)
│   │   ├── modules/      # Módulos de NestJS (AppModule, OrdersModule)
│   │   ├── proto/        # Definición .proto (order.proto)
│   │   ├── services/     # Lógica de negocio (Order, RabbitMQ, SendGrid)
│   │   └── seed/         # Seeder de base de datos
├── .env                 # Variables de entorno
├── docker-compose.yml   # Configuración Docker
├── Dockerfile           # Imagen de la aplicación
├── nest-cli.json        # Config. de NestJS CLI (para copiar .proto)
└── tsconfig.json        # Config. de TypeScript
```

## Flujo de los datos

El servicio recibe solicitudes gRPC (usualmente desde un API Gateway) y también emite y consume eventos de RabbitMQ.

```mermaid
graph TD
    A[API Gateway] -- gRPC --> B[Controller gRPC]
    B --> C[Service Layer OrdersService]
    C -- Escribe/Lee --> D[TypeORM]
    D --> E[MySQL Database]
    C -- Publica Evento (order.created) --> F[RabbitMQ]
    C -- Envía Email (Confirmación) --> G[SendGrid]
    F -- Consume Evento (order.failed.stock) --> C
```
## Tecnologías usadas

### Tecnologías principales

- **NestJS (Node.js 20)**: Plataforma de desarrollo del microservicio.
- **TypeScript**: Lenguaje principal.
- **gRPC**: Protocolo para la comunicación síncrona entre servicios.
- **TypeORM**: ORM para las operaciones de base de datos.
- **MySQL**: Base de datos relacional para los pedidos.
- **RabbitMQ**: Agente de mensajes (Message Broker) para la comunicación asíncrona (eventos de stock).
- **SendGrid**: Servicio de envío de correos transaccionales.

### Herramientas de desarrollo
- **Postman (gRPC) o grpcurl**: Herramientas para probar endpoints gRPC.

### DevOps y despliegue
- **Docker / Docker Compose**: Contenerización.
- **GitHub**: Control de versiones.

## Requisitos

- [.Node.js v20 o superior](https://nodejs.org/en)
- [Docker y Docker compose](https://www.docker.com/products/docker-desktop/)
- [Git](https://git-scm.com/)
- Un cliente gRPC como [Postman](https://www.postman.com/) o [grpcurl](https://github.com/fullstorydev/grpcurl).

## Instalación y configuración

## 1.Clonar repositorio
```bash
$ git clone https://github.com/TU_ORGANIZACION/censudex-orders-service.git
cd censudex-orders-service
```

## 2.Configuración de Desarrollo (Recomendado)
Este método ejecuta las dependencias (MySQL, RabbitMQ) en Docker, y la aplicación NestJS localmente con hot-reloading para un desarrollo más rápido.

### 2.1. Configurar variables de entorno
Crea un archivo .env en la raíz del proyecto (/censudex-orders-service/.env) y configúralo para que apunte a localhost, ya que la aplicación correrá localmente.

```bash
# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=rootpassword
DB_DATABASE=censudex_orders

# SendGrid Configuration
SENDGRID_API_KEY=SG.tu.api.key
SENDGRID_FROM_EMAIL=tu_email_verificado@dominio.com

# RabbitMQ Configuration
RABBITMQ_URL=amqp://guest:guest@localhost:5672

# Application Configuration
PORT=3004
GRPC_PORT=50051
NODE_ENV=development
```

### 2.2 Levantar dependencias

```bash
docker compose up -d
```

### 2.3 Instalar dependencias

```bash
# Instalar paquetes de Node.js
npm install

# Ejecutar seeder (si es necesario)
npm run seed

# Ejecutar la app en modo "watch" (hot-reload)
npm run start:dev
```

## Data Seeder

El proyecto incluye un seeder con datos de prueba .

- 5 Pedidos de ejemplo (con diferentes estados).
- Múltiples items de pedido asociados.

Este seeder **no se ejecuta automáticamente**.

```bash
npm run seed
```
## API Endpoints (gRPC)

Este servicio expone métodos gRPC (definidos en orders.proto) en el puerto GRPC_PORT (ej. 50051). No expone endpoints REST/HTTP.

| Método gRPC | Descripción   |
|------|----------|
| CreateOrder  | Crea un nuevo pedido |
| FindAllOrders   | Obtiene un listado de pedidos (filtrable) |
| FindOneOrder  | Obtiene un pedido por su ID |
| UpdateOrderStatus | Actualiza el estado de un pedido (Admin) | 
| CancelOrder | Cancela un pedido (Cliente o Admin) | 
| GetClientHistory | Obtiene el historial de pedidos de un cliente.|
