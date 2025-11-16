import { Module, Global } from '@nestjs/common';
import { RabbitMQService } from '../services/rabbitmq.service';


/**
 * Módulo para integrar RabbitMQ en la aplicación
 */
@Global()
@Module({
  providers: [RabbitMQService],
  exports: [RabbitMQService],
})
/**
 *  Módulo RabbitMQ
 */
export class RabbitMQModule {}
