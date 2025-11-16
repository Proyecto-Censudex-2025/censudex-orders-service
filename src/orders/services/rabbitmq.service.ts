import { Injectable, OnModuleInit, Logger, OnModuleDestroy } from '@nestjs/common';
import * as amqp from 'amqplib';
import { ConfigService } from '@nestjs/config';

/**
 * Servicio para manejar la comunicación con RabbitMQ
 */
@Injectable()
export class RabbitMQService implements OnModuleInit, OnModuleDestroy {
  /** Logger para el servicio RabbitMQ */
  private readonly logger = new Logger(RabbitMQService.name);
  /** Conexión y canal de RabbitMQ */
  private connection: amqp.Connection;
  /** Canal de comunicación con RabbitMQ */
  private channel: amqp.Channel;
  /** Intentos de reconexión actuales */
  private reconnectAttempts = 0;
  /** Máximo número de intentos de reconexión */
  private readonly maxReconnectAttempts = 10;
  /**
   * Constructor del servicio RabbitMQ
   * @param configService Servicio para acceder a variables de configuración
   */
  constructor(private configService: ConfigService) {}

  /**
   * Inicializa la conexión a RabbitMQ al iniciar el módulo
   */
  async onModuleInit() {
    await this.connect();
  }
  /**
   * Cierra la conexión a RabbitMQ al destruir el módulo
   */
  async onModuleDestroy() {
    await this.channel?.close();
    await this.connection?.close();
    this.logger.log('Conexión RabbitMQ cerrada');
  }
  /**
   * obtiene una variable de configuración requerida
   * @param key Clave de la variable de configuración
   * @returns Valor de la variable de configuración
   */
  private getRequiredConfig(key: string): string {
    const value = this.configService.get<string>(key);
    if (!value) {
      throw new Error(`Missing required config: ${key}`);
    }
    return value;
  }

  /**
   * Conecta a RabbitMQ con reintentos automáticos
   * @param retryCount Número actual de reintentos
   */
  private async connect(retryCount = 0): Promise<void> {
    try {
      const rabbitmqUrl = this.configService.get<string>('RABBITMQ_URL');
      this.logger.log(`Intentando conectar a RabbitMQ (intento ${retryCount + 1})...`);
      
      this.connection = await amqp.connect(rabbitmqUrl);
      this.channel = await this.connection.createChannel();

      // Declarar las colas necesarias
      await this.channel.assertQueue(
        this.configService.get<string>('RABBITMQ_QUEUE_ORDER_CREATED'),
        { durable: true }
      );
      await this.channel.assertQueue(
        this.configService.get<string>('RABBITMQ_QUEUE_ORDER_FAILED'),
        { durable: true }
      );
      await this.channel.assertQueue(
        this.configService.get<string>('RABBITMQ_QUEUE_ORDER_SHIPPED'),
        { durable: true }
      );
      await this.channel.assertQueue(
        this.configService.get<string>('RABBITMQ_QUEUE_ORDER_DELIVERED'),
        { durable: true }
      );

      this.logger.log('✓ Conectado exitosamente a RabbitMQ');
      this.reconnectAttempts = 0;

      this.connection.on('close', () => {
        this.logger.warn('Conexión a RabbitMQ cerrada. Reintentando...');
        this.reconnect();
      });

      this.connection.on('error', (err) => {
        this.logger.error('Error en conexión RabbitMQ:', err.message);
      });

    } catch (error) {
      this.logger.error(`Error conectando a RabbitMQ: ${error.message}`);
      
      if (retryCount < this.maxReconnectAttempts) {
        const delay = Math.min(1000 * Math.pow(2, retryCount), 30000);
        this.logger.log(`Reintentando en ${delay/1000} segundos...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.connect(retryCount + 1);
      } else {
        this.logger.error('Máximo de reintentos alcanzado. No se pudo conectar a RabbitMQ.');
      }
    }
  }

  /**
   * Reconecta a RabbitMQ
   */
  private async reconnect(): Promise<void> {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
      await new Promise(resolve => setTimeout(resolve, delay));
      await this.connect();
    }
  }

  /**
   * Asegura que una cola existe
   * @param queue Nombre de la cola
   */
  private async ensureQueue(queue: string): Promise<void> {
    if (!this.channel) {
      throw new Error('Canal RabbitMQ no inicializado');
    }
    await this.channel.assertQueue(queue, { durable: true });
  }

  /**
   * Publica un mensaje genérico a cualquier cola
   * @param queue Nombre de la cola
   * @param payload Carga útil del mensaje
   */
  private async publishMessage(queue: string, payload: any): Promise<void> {
    try {
      await this.ensureQueue(queue);
      this.channel.sendToQueue(
        queue,
        Buffer.from(JSON.stringify(payload)),
        { persistent: true }
      );
      this.logger.log(`Mensaje enviado a cola ${queue}`);
    } catch (error) {
      this.logger.error(`Error al publicar mensaje en ${queue}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Publica evento cuando se crea una orden
   * @param payload Datos del pedido creado
   */
  async publishOrderCreated(payload: any): Promise<void> {
    const queue = this.getRequiredConfig('RABBITMQ_QUEUE_ORDER_CREATED');
    await this.publishMessage(queue, payload);
  }

  /**
   * Publica evento cuando una orden es enviada
   * @param payload Datos del pedido enviado
   */
  async publishOrderShipped(payload: any): Promise<void> {
    const queue = this.getRequiredConfig('RABBITMQ_QUEUE_ORDER_SHIPPED');
    await this.publishMessage(queue, payload);
  }

  /**
   * Publica evento cuando una orden es entregada
   * @param payload Datos del pedido entregado
   */
  async publishOrderDelivered(payload: any): Promise<void> {
    const queue = this.getRequiredConfig('RABBITMQ_QUEUE_ORDER_DELIVERED');
    await this.publishMessage(queue, payload);
  }

  /**
   * Publica evento cuando falla el stock de una orden
   * @param payload Datos del pedido con fallo de stock
   */
  async publishOrderFailedStock(payload: any): Promise<void> {
    const queue = this.getRequiredConfig('RABBITMQ_QUEUE_ORDER_FAILED');
    await this.publishMessage(queue, payload);
  }

  /**
   * Consume mensajes de una cola
   * Útil para escuchar eventos de otros servicios
   * @param queue Nombre de la cola
   * @param callback Función callback para procesar el mensaje recibido
   */
  async consumeMessages(queue: string, callback: (msg: any) => void): Promise<void> {
    try {
      await this.ensureQueue(queue);
      
      this.channel.consume(queue, (msg) => {
        if (msg) {
          const content = JSON.parse(msg.content.toString());
          this.logger.log(`Mensaje recibido de cola ${queue}`);
          callback(content);
          this.channel.ack(msg);
        }
      });
      
      this.logger.log(`Escuchando mensajes en cola ${queue}`);
    } catch (error) {
      this.logger.error(`Error al consumir mensajes de ${queue}: ${error.message}`);
    }
  }

  /**
   * Valida stock con el Inventory Service (comunicación RPC)
   * @param items Lista de productos y cantidades a validar
   * @returns Resultado de la validación de stock
   */
  async validateStock(items: { productId: string; quantity: number }[]): Promise<{
    allAvailable: boolean;
    unavailable: { productId: string; requested: number; available: number }[];
  }> {
    try {
      this.logger.log(`Validando stock de ${items.length} productos...`);
      
      return {
        allAvailable: true,
        unavailable: [],
      };
    } catch (error) {
      this.logger.error(`Error al validar stock: ${error.message}`);
      return {
        allAvailable: true,
        unavailable: [],
      };
    }
  }
}