import { IsOptional, IsUUID, IsString, IsDateString, IsIn } from 'class-validator';
import { ORDER_STATUSES } from './update-order-status.dto';

/**
 * DTO para consultar pedidos con filtros opcionales
 */
export class QueryOrderDto {
  @IsOptional()
  @IsUUID('4')
  orderId?: string;

  @IsOptional()
  @IsUUID('4')
  clientId?: string;

  @IsOptional()
  @IsString()
  clientName?: string;

  @IsOptional()
  @IsIn(ORDER_STATUSES)
  status?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}


/**
 * DTO para listar pedidos
 */
export class OrderListItemDto {
  id: string;
  clientId: string;
  clientName: string;
  status: string;
  total: number;
  createdAt: Date;
}

/**
 * DTO para los detalles de los ítems de una ordena
 */
export class OrderItemDetailDto {
  productId: string;
  productName: string;
  productImageUrl?: string;
  unitPrice: number;
  quantity: number;
  subtotal: number;
}
/**
 * DTO para los detalles de una orden
 */
export class OrderDetailDto extends OrderListItemDto {
  shippingAddress: string;
  items: OrderItemDetailDto[];
  trackingNumber?: string;
  cancellationReason?: string;
}

