import { IsIn, IsOptional, IsString, IsNotEmpty } from 'class-validator';

/**
 * Lista de estados válidos del pedido
 */
export const ORDER_STATUSES = ['pendiente', 'en_procesamiento', 'enviado', 'entregado', 'cancelado'] as const;
/**
 * Tipo que representa los estados válidos del pedido
 */
export type OrderStatus = typeof ORDER_STATUSES[number];

/**
 * DTO para actualizar el estado de un pedido
 */
export class UpdateOrderStatusDto {
  /**
   * Nuevo estado del pedido
   */
  @IsIn(ORDER_STATUSES)
  status: OrderStatus;

  /** 
   * Número de seguimiento (opcional)
   */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  trackingNumber?: string;
}

/**
 * DTO para cancelar un pedido
 */
export class CancelOrderDto {
  /**
   * Razón de cancelación
   */
  @IsOptional()
  @IsString()
  cancellationReason?: string;
}
