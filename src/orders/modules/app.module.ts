import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrdersModule } from '../modules/orders.module';
import { SendGridModule } from '../modules/sendgrid.module';
import { RabbitMQModule } from '../modules/rabbitmq.module';
import { Order } from '../entities/order.entity';
import { OrderItem } from '../entities/order-item.entity';
/**
 * Módulo principal de la aplicación
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      useFactory: () => ({
        type: 'mysql',
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '3306', 10),
        username: process.env.DB_USERNAME || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_DATABASE || 'censudex_orders',
        entities: [Order, OrderItem],
        synchronize: process.env.NODE_ENV === 'development',
        logging: process.env.NODE_ENV === 'development',
      }),
    }),
    OrdersModule,
    SendGridModule,
    RabbitMQModule,
  ],
})
/**
 * Módulo principal de la aplicación
 */
export class AppModule {}
