import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrdersController } from '../controllers/order.controller';
import { OrdersService } from '../services/order.service';
import { Order } from '../entities/order.entity';
import { OrderItem } from '../entities/order-item.entity';
import { SendGridModule } from '../modules/sendgrid.module';
import { RabbitMQModule } from '../modules/rabbitmq.module';

/**
 * Módulo de Órdenes
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderItem]),
    SendGridModule,
    RabbitMQModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
/**
 * Módulo de Órdenes
 */
export class OrdersModule {}
