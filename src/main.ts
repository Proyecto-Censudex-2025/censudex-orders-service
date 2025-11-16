import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from 'src/orders/modules/app.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { join } from 'path';

/**
 * Función principal para iniciar el microservicio gRPC
 */
async function bootstrap() {
  
  /**
   * Creación del microservicio gRPC
   */
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      transport: Transport.GRPC,
      options: {
        package: 'orders',
        protoPath: join(__dirname, 'src/orders/proto/order.proto'),
        url: `0.0.0.0:${process.env.GRPC_PORT || 50051}`,
      },
    },
  );

  /**
   * Validación global de datos de entrada
   */
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  /** Iniciar el microservicio gRPC */
  await app.listen();
  
  console.log(`Orders gRPC Service está corriendo en el puerto ${process.env.GRPC_PORT || 50051}`);
}
/**
 * Función principal para iniciar el microservicio gRPC
 */
bootstrap();