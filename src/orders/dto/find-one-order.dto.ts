import { IsUUID } from 'class-validator';

/**
 * DTO para encontrar un pedido por su ID
 */
export class FindOneOrderDto {
  @IsUUID('4')
  id: string;
}