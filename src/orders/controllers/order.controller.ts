import {
  Controller,
  Logger,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { GrpcMethod, RpcException } from '@nestjs/microservices';
import { status } from '@grpc/grpc-js';
import { OrdersService } from '../services/order.service';
import { CreateOrderDto } from '../dto/create-order.dto';
import { UpdateOrderStatusDto, CancelOrderDto } from '../dto/update-order-status.dto';
import { QueryOrderDto } from '../dto/query-order.dto';
import { AuthUser } from '../decorators/grpc-user.decorator';
import { Order } from '../entities/order.entity';
import { OrderDetailDto } from '../dto/query-order.dto';

/**
 * Maneja errores en métodos gRPC y los convierte en RpcException adecuadas.
 * @param error Error capturado en el método gRPC
 * @param logger Instancia de Logger para registrar el error
 * @param methodName Nombre del método gRPC donde ocurrió el error
 */
function handleRpcError(error: any, logger: Logger, methodName: string) {
  logger.error(`Error en ${methodName}: ${error.message}`, error.stack);

  let rpcStatus = status.INTERNAL;
  let message = error.message || 'Error interno del servidor';

  if (error instanceof ForbiddenException) {
    rpcStatus = status.PERMISSION_DENIED;
    message = error.message;
  } else if (error instanceof NotFoundException) {
    rpcStatus = status.NOT_FOUND;
    message = error.message;
  } else if (error instanceof BadRequestException) {
    rpcStatus = status.INVALID_ARGUMENT;
    message = error.message;
  }
  
  throw new RpcException({
    code: rpcStatus,
    message: message,
  });
}

/**
 * Controlador gRPC para la gestión de órdenes
 */
@Controller()
export class OrdersController {
  private readonly logger = new Logger(OrdersController.name);
  constructor(private readonly ordersService: OrdersService) {}

  private mapOrderToResponse(order: Order | OrderDetailDto): any {
    if (!order) return null;
    const { items, ...rest } = order;
    const toTimestamp = (date: Date | string | null | undefined) => {
      if (!date) return undefined;
      const d = new Date(date);
      return { seconds: Math.floor(d.getTime() / 1000), nanos: (d.getTime() % 1000) * 1e6 };
    };
    return {
      ...rest,
      total: parseFloat(String(rest.total || 0)),
      items: (items || []).map((item: any) => ({
        ...item,
        unitPrice: parseFloat(String(item.unitPrice || 0)),
        subtotal: parseFloat(String(item.subtotal || 0)),
        createdAt: toTimestamp(item.createdAt),
      })),
      shippedAt: toTimestamp((rest as Order).shippedAt),
      deliveredAt: toTimestamp((rest as Order).deliveredAt),
      cancelledAt: toTimestamp((rest as Order).cancelledAt),
      createdAt: toTimestamp(rest.createdAt),
      updatedAt: toTimestamp((rest as Order).updatedAt),
    };
  }
  /**
   * Extrae la información del usuario autenticado desde la metadata de gRPC
   * @param metadata Metadata de gRPC recibida en el contexto RPC
   * @returns Información del usuario autenticado extraída de la metadata
   */
  private extractUserFromMetadata(metadata: any): AuthUser {
    const meta = metadata?.getMap?.() || {};
    return {
      userId: meta['x-user-id'] || '',
      role: meta['x-user-role'] || 'client',
      email: meta['x-user-email'] || '',
    };
  }

  /**
   * Metodo gRPC para crear una nueva orden
   * @param data Datos recibidos en la llamada gRPC
   * @param metadata Metadata de gRPC recibida en el contexto RPC
   * @returns Orden creada mapeada a la respuesta gRPC
   */
  @GrpcMethod('OrdersService', 'CreateOrder')
  async createOrder(data: any, metadata: any) {
    // Extraemos data y metadata
    const createOrderDto: CreateOrderDto = data;
    const user = this.extractUserFromMetadata(metadata);
    
    this.logger.log(`gRPC CreateOrder - Cliente ${user.userId}`);
    
    try {
      if (!createOrderDto || typeof createOrderDto !== 'object' || !createOrderDto.clientId) {
        throw new BadRequestException('El mensaje de solicitud (CreateOrderRequest) está vacío o es inválido.');
      }

      if (user.role === 'client' && createOrderDto.clientId !== user.userId) {
        throw new ForbiddenException('Solo puedes crear pedidos para ti mismo');
      }
      
      const order = await this.ordersService.create(createOrderDto);
      return this.mapOrderToResponse(order);
      
    } catch (error) {
      handleRpcError(error, this.logger, 'CreateOrder');
    }
  }

  /**
   * Metodo gRPC para obtener todas las órdenes con filtros opcionales
   * @param data Datos recibidos en la llamada gRPC
   * @param metadata Metadata de gRPC recibida en el contexto RPC
   * @returns Lista de órdenes mapeadas a la respuesta gRPC
   */
  @GrpcMethod('OrdersService', 'FindAllOrders')
  async findAllOrders(data: any, metadata: any) {
    const queryDto: QueryOrderDto = data;
    const user = this.extractUserFromMetadata(metadata);

    this.logger.log('gRPC FindAllOrders');
    
    try {
      const effectiveQueryDto = queryDto || {};

      if (user.role === 'client') {
        effectiveQueryDto.clientId = user.userId;
      }
      
      const orders = await this.ordersService.findAll(effectiveQueryDto);
      
      return {
        orders: orders.map(o => this.mapOrderToResponse(o)),
      };
    } catch (error) {
      handleRpcError(error, this.logger, 'FindAllOrders');
    }
  }

  /**
   * Metodo gRPC para obtener una orden por su ID
   * @param data Datos recibidos en la llamada gRPC
   * @param metadata Metadata de gRPC recibida en el contexto RPC
   * @returns Orden mapeada a la respuesta gRPC
   */
  @GrpcMethod('OrdersService', 'FindOneOrder')
  async findOneOrder(data: any, metadata: any) {
    try {
      this.logger.debug(`FindOneOrder - data recibido: ${JSON.stringify(data)}`);
      
      const user = this.extractUserFromMetadata(metadata);
      
      if (!data || typeof data !== 'object') {
        throw new BadRequestException(`El mensaje de solicitud es inválido. Recibido: ${typeof data}`);
      }
      if (!data.id || typeof data.id !== 'string' || data.id.trim() === '') {
        throw new BadRequestException(`El ID del pedido (id) es requerido en el mensaje. Recibido: ${JSON.stringify(data)}`);
      }
      const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
      if (!uuidRegex.test(data.id)) {
        throw new BadRequestException('El ID del pedido (id) debe ser un UUID v4 válido');
      }

      this.logger.log(`gRPC FindOneOrder - ID ${data.id}`);
      const order = await this.ordersService.findOne(data.id);
      
      if (user.role === 'client' && order.clientId !== user.userId) {
        throw new ForbiddenException('No tienes permiso para ver este pedido');
      }
      
      return this.mapOrderToResponse(order);

    } catch (error) {
      handleRpcError(error, this.logger, 'FindOneOrder');
    }
  }

  /**
   * Metodo gRPC para actualizar el estado de una orden
   * @param data Datos recibidos en la llamada gRPC
   * @param metadata Metadata de gRPC recibida en el contexto RPC
   * @returns Orden mapeada a la respuesta gRPC
   */
  @GrpcMethod('OrdersService', 'UpdateOrderStatus')
  async updateOrderStatus(data: any, metadata: any) {
    const request: UpdateOrderStatusDto & { id: string } = data;
    const user = this.extractUserFromMetadata(metadata);

    this.logger.log(`gRPC UpdateOrderStatus - ID ${request?.id}`);

    try {
      if (user.role !== 'admin') {
        throw new ForbiddenException('Solo administradores pueden actualizar estados');
      }

      if (!request || !request.id || !request.status) {
         throw new BadRequestException('Se requieren id y status en el mensaje');
      }
      
      const updateDto: UpdateOrderStatusDto = {
        status: request.status,
        trackingNumber: request.trackingNumber,
      };
      
      const order = await this.ordersService.updateStatus(request.id, updateDto);
      return this.mapOrderToResponse(order);

    } catch (error) {
      handleRpcError(error, this.logger, 'UpdateOrderStatus');
    }
  }
  /**
   * Metodo gRPC para cancelar una orden
   * @param data Datos recibidos en la llamada gRPC
   * @param metadata Metadata de gRPC recibida en el contexto RPC
   * @returns Orden mapeada a la respuesta gRPC
   */
  @GrpcMethod('OrdersService', 'CancelOrder')
  async cancelOrder(data: any, metadata: any) {
    const request: CancelOrderDto & { id: string } = data;
    const user = this.extractUserFromMetadata(metadata);
    
    this.logger.log(`gRPC CancelOrder - ID ${request?.id}`);
    
    try {
      if (!request || !request.id) {
         throw new BadRequestException('Se requiere un id en el mensaje');
      }

      const orderToAuth = await this.ordersService.findOne(request.id);
      if (user.role === 'client' && orderToAuth.clientId !== user.userId) {
        throw new ForbiddenException('No tienes permiso para cancelar este pedido');
      }
      
      const cancelledOrder = await this.ordersService.cancel(request.id, request);
      return this.mapOrderToResponse(cancelledOrder);
    
    } catch (error) {
      handleRpcError(error, this.logger, 'CancelOrder');
    }
  }

  /**
   * Metodo gRPC para obtener el historial de un cliente
   * @param data Datos recibidos en la llamada gRPC
   * @param metadata Metadata de gRPC recibida en el contexto RPC
   * @returns Historial de órdenes mapeado a la respuesta gRPC
   */
  @GrpcMethod('OrdersService', 'GetClientHistory')
  async getClientHistory(data: any, metadata: any) {
    const request: { clientId: string } = data;
    const user = this.extractUserFromMetadata(metadata);

    this.logger.log(`gRPC GetClientHistory - Cliente ${request?.clientId}`);

    try {
      if (!request || !request.clientId) {
         throw new BadRequestException('Se requiere clientId en el mensaje');
      }
      
      if (user.role === 'client' && request.clientId !== user.userId) {
        throw new ForbiddenException('No tienes permiso para ver el historial de este cliente');
      }
      
      const orders = await this.ordersService.getClientHistory(request.clientId);
      return {
        orders: orders.map(o => this.mapOrderToResponse(o)),
      };
    
    } catch (error) {
      handleRpcError(error, this.logger, 'GetClientHistory');
    }
  }

  
}