import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository} from 'typeorm';
import { Order } from '../entities/order.entity';
import { OrderItem } from '../entities/order-item.entity';
import { CreateOrderDto } from '../dto/create-order.dto';
import { CancelOrderDto, UpdateOrderStatusDto } from '../dto/update-order-status.dto';
import { QueryOrderDto, OrderDetailDto } from '../dto/query-order.dto';
import { SendGridService } from '../services/sendgrid.service';
import { RabbitMQService } from '../services/rabbitmq.service';
/**
 * Servicio para gestionar órdenes de compra
 */
@Injectable()
export class OrdersService implements OnModuleInit {
  /**
   * Logger para el servicio de órdenes
   */
  private readonly logger = new Logger(OrdersService.name);

  /**
   * constructor del servicio de órdenes
   * @param orderRepository injectable repositorio de órdenes
   * @param orderItemRepository injectable repositorio de items de órdenes
   * @param sendGridService servicio para enviar emails
   * @param rabbitMQService servicio para comunicación con RabbitMQ
   */
  constructor(
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private orderItemRepository: Repository<OrderItem>,
    private sendGridService: SendGridService,
    private rabbitMQService: RabbitMQService,
  ) {}

  /**
   * Inicializa el consumidor de mensajes de RabbitMQ
   */
  async onModuleInit() {
    // Escuchar eventos de fallo de stock del Inventory Service
    await this.rabbitMQService.consumeMessages('order.failed.stock', async (data) => {
      await this.handleFailedStock(data);
    });
  }

  /**
   * Crea un nuevo pedido
   * @param createOrderDto Datos para crear el pedido
   */
  async create(createOrderDto: CreateOrderDto): Promise<Order> {
    this.logger.log(`Creando nuevo pedido para cliente ${createOrderDto.clientId}`);

    try {
      const productsWithStock = await this.rabbitMQService.validateStock(createOrderDto.items);

      if (!productsWithStock.allAvailable) {
        throw new BadRequestException({
          message: 'Algunos productos no tienen stock suficiente',
          unavailableProducts: productsWithStock.unavailable,
        });
      }

      const order = this.orderRepository.create({
        clientId: createOrderDto.clientId,
        clientName: createOrderDto.clientName,
        clientEmail: createOrderDto.clientEmail,
        shippingAddress: createOrderDto.shippingAddress,
        status: 'pendiente',
        total: 0,
      });

      let totalAmount = 0;
      const orderItems = await Promise.all(
        createOrderDto.items.map(async (itemDto) => {
          const productDetails = await this.getProductDetails(itemDto.productId);
          const subtotal = productDetails.price * itemDto.quantity;
          totalAmount += subtotal;

          return this.orderItemRepository.create({
            productId: itemDto.productId,
            productName: productDetails.name,
            productImageUrl: productDetails.imageUrl,
            unitPrice: productDetails.price,
            quantity: itemDto.quantity,
            subtotal,
          });
        }),
      );

      order.items = orderItems;
      order.total = totalAmount;

      const savedOrder = await this.orderRepository.save(order);
      this.logger.log(`Pedido ${savedOrder.id} creado exitosamente`);

      await this.publishOrderCreatedEvent(savedOrder);

      await this.sendGridService.sendOrderConfirmationEmail(savedOrder);

      return savedOrder;
    } catch (error) {
      this.logger.error(`Error al crear pedido: ${error.message}`, error.stack);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException('Error al procesar el pedido');
    }
  }

  /**
   * Obtiene listado de pedidos con filtros
   * @param queryDto Filtros para la consulta
   */
  async findAll(queryDto: QueryOrderDto): Promise<Order[]> { 
    this.logger.log('Consultando listado de pedidos');
    try {
      const queryBuilder = this.orderRepository
        .createQueryBuilder('order')
        .leftJoinAndSelect('order.items', 'items')
        .where('order.isDeleted = :isDeleted', { isDeleted: false });

      // Aplicar filtros
      if (queryDto.orderId) { 
        queryBuilder.andWhere('order.id = :orderId', { orderId: queryDto.orderId });
      }
      if (queryDto.clientId) { 
        queryBuilder.andWhere('order.clientId = :clientId', { clientId: queryDto.clientId });
      }
      if (queryDto.clientName) { 
        queryBuilder.andWhere('order.clientName LIKE :clientName', {
          clientName: `%${queryDto.clientName}%`,
        });
      }
      if (queryDto.status) { 
        queryBuilder.andWhere('order.status = :status', { status: queryDto.status });
      }
      if (queryDto.startDate && queryDto.endDate) { 
        queryBuilder.andWhere('order.createdAt BETWEEN :startDate AND :endDate', {
          startDate: queryDto.startDate,
          endDate: queryDto.endDate,
        });
      } else if (queryDto.startDate) { 
        queryBuilder.andWhere('order.createdAt >= :startDate', { startDate: queryDto.startDate });
      } else if (queryDto.endDate) { 
        queryBuilder.andWhere('order.createdAt <= :endDate', { endDate: queryDto.endDate });
      }

      queryBuilder.orderBy('order.createdAt', 'DESC');

      const orders = await queryBuilder.getMany();
      return orders;
      
    } catch (error) {
      this.logger.error(`Error al consultar pedidos: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Error al consultar pedidos');
    }
  }

  /**
   * Obtiene un pedido específico por ID
   * @param id ID del pedido a consultar
   */
  async findOne(id: string): Promise<OrderDetailDto> {
    this.logger.log(`Consultando pedido ${id}`);

    try {
      const order = await this.orderRepository.findOne({
        where: { id, isDeleted: false },
        relations: ['items'],
      });

      if (!order) {
        throw new NotFoundException(`Pedido con ID ${id} no encontrado`);
      }

      return {
        id: order.id,
        clientId: order.clientId,
        clientName: order.clientName,
        status: order.status,
        total: order.total,
        shippingAddress: order.shippingAddress,
        trackingNumber: order.trackingNumber,
        cancellationReason: order.cancellationReason,
        items: order.items.map((item) => ({
          id: item.id,
          productId: item.productId,
          productName: item.productName,
          productImageUrl: item.productImageUrl,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          subtotal: item.subtotal,
        })),
        createdAt: order.createdAt,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Error al consultar pedido ${id}: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Error al consultar el pedido');
    }
  }

  /**
   * Actualiza el estado de un pedido
   * @param id ID del pedido a actualizar
   * @param updateDto Datos para actualizar el estado
   */
  async updateStatus(id: string, updateDto: UpdateOrderStatusDto): Promise<Order> {
    this.logger.log(`Actualizando estado del pedido ${id} a ${updateDto.status}`);

    try {
      const order = await this.orderRepository.findOne({
        where: { id, isDeleted: false },
        relations: ['items'],
      });

      if (!order) {
        throw new NotFoundException(`Pedido con ID ${id} no encontrado`);
      }

      // Validar transición de estado
      this.validateStatusTransition(order.status, updateDto.status);

      const previousStatus = order.status;
      order.status = updateDto.status;

      // Lógica específica por estado
      switch (updateDto.status) {
        case 'enviado':
          if (!updateDto.trackingNumber) {
            throw new BadRequestException('Se requiere número de tracking para estado "enviado"');
          }
          order.trackingNumber = updateDto.trackingNumber;
          order.shippedAt = new Date();
          
          // Publicar evento de envío
          await this.rabbitMQService.publishOrderShipped({
            orderId: order.id,
            clientId: order.clientId,
            clientEmail: order.clientEmail,
            trackingNumber: order.trackingNumber,
            items: order.items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
            })),
          });
          break;

        case 'entregado':
          order.deliveredAt = new Date();
          
          // Publicar evento de entrega
          await this.rabbitMQService.publishOrderDelivered({
            orderId: order.id,
            clientId: order.clientId,
            clientEmail: order.clientEmail,
          });
          break;

        case 'cancelado':
          order.cancelledAt = new Date();
          break;
      }

      const updatedOrder = await this.orderRepository.save(order);

      
      await this.sendGridService.sendOrderStatusUpdateEmail(updatedOrder, previousStatus);

      this.logger.log(`Estado del pedido ${id} actualizado exitosamente`);
      return updatedOrder;
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`Error al actualizar estado del pedido ${id}: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Error al actualizar el estado del pedido');
    }
  }

  /**
   * Cancela un pedido
   * @param id ID del pedido a cancelar
   * @param cancelDto Datos para la cancelación
   */
  async cancel(id: string, cancelDto: CancelOrderDto): Promise<Order> {
    this.logger.log(`Cancelando pedido ${id}`);

    try {
      const order = await this.orderRepository.findOne({
        where: { id, isDeleted: false },
        relations: ['items'],
      });

      if (!order) {
        throw new NotFoundException(`Pedido con ID ${id} no encontrado`);
      }

      if (['entregado', 'cancelado'].includes(order.status)) {
        throw new BadRequestException(`No se puede cancelar un pedido con estado "${order.status}"`);
      }

      order.status = 'cancelado';
      order.cancellationReason = cancelDto.cancellationReason || 'Cancelado por el usuario';
      order.cancelledAt = new Date();

      const cancelledOrder = await this.orderRepository.save(order);

      // Enviar email de cancelación
      await this.sendGridService.sendOrderCancellationEmail(cancelledOrder);

      this.logger.log(`Pedido ${id} cancelado exitosamente`);
      return cancelledOrder;
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`Error al cancelar pedido ${id}: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Error al cancelar el pedido');
    }
  }

  /**
   * Obtiene el historial de pedidos de un cliente
   * @param clientId ID del cliente
   */
  async getClientHistory(clientId: string): Promise<Order[]> { 
    this.logger.log(`Consultando historial de pedidos del cliente ${clientId}`);
    const queryDto: QueryOrderDto = { clientId };
    return this.findAll(queryDto); 
  }

  /**
   * Obtiene detalles del producto desde el Products Service
   * @param productId ID del producto
   */
  private async getProductDetails(productId: string): Promise<any> {
    this.logger.log(`Obteniendo detalles del producto ${productId}`);
    
    return {
      id: productId,
      name: 'Producto de Ejemplo',
      price: 10000,
      imageUrl: 'https://via.placeholder.com/150',
    };
  }

  /**
   * Publica evento de orden creada a RabbitMQ
   * @param order Pedido creado
   */
  private async publishOrderCreatedEvent(order: Order): Promise<void> {
    try {
      const productsMap = order.items.reduce((acc, item) => {
        acc[item.productId] = item.quantity;
        return acc;
      }, {} as { [key: string]: number });

      const payload = {
        orderId: order.id,     
        products: productsMap, 
      };

      await this.rabbitMQService.publishOrderCreated(payload);
      
      this.logger.log(`Evento order.created publicado para OrderID ${order.id}`);

    } catch (error) {
      this.logger.error(`Error al publicar evento order.created: ${error.message}`);
    }
  }

  /**
   * Valida que la transición de estado sea válida
   * @param currentStatus Estado actual del pedido
   * @param newStatus Nuevo estado al que se quiere cambiar
   */
  private validateStatusTransition(currentStatus: string, newStatus: string): void {
    const validTransitions = {
      pendiente: ['en_procesamiento', 'cancelado'],
      en_procesamiento: ['enviado', 'cancelado'],
      enviado: ['entregado', 'cancelado'],
      entregado: [],
      cancelado: [],
    };

    const allowedStatuses = validTransitions[currentStatus] || [];

    if (!allowedStatuses.includes(newStatus)) {
      throw new BadRequestException(
        `No se puede cambiar de estado "${currentStatus}" a "${newStatus}"`
      );
    }
  }

  /**
   * Maneja eventos de fallo de stock desde Inventory Service
   * @param data Datos del mensaje recibido
   */
  private async handleFailedStock(data: any): Promise<void> {
    try {
      const messagePayload = data.message;

      if (!messagePayload) {
        this.logger.error('Error al manejar fallo de stock: Objeto "message" no encontrado en el payload', JSON.stringify(data));
        return;
      }

      const orderId = messagePayload.orderId || messagePayload.OrderId;

      if (!orderId) {
        this.logger.error('Error al manejar fallo de stock: orderId no encontrado en el objeto "message"', JSON.stringify(messagePayload));
        return;
      }
      
      const order = await this.orderRepository.findOne({ 
        where: { id: orderId, isDeleted: false },
        relations: ['items'],
      });

      if (!order || order.status !== 'pendiente') {
        this.logger.warn(`Orden ${orderId} no encontrada o ya no está pendiente. Omitiendo cancelación.`);
        return;
      }

      order.status = 'cancelado';
      order.cancellationReason = 'Stock insuficiente';
      order.cancelledAt = new Date();

      await this.orderRepository.save(order);
      await this.sendGridService.sendOrderCancellationEmail(order);

      this.logger.log(`Pedido ${order.id} cancelado por falta de stock`);
    } catch (error) {
      this.logger.error(`Error al manejar fallo de stock: ${error.message}`);
    }
  }
}