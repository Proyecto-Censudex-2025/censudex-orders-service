import { IsUUID, IsString, IsEmail, IsArray, ValidateNested, IsNotEmpty, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';
/**
 * DTO para los ítems de una nueva orden
 */
class CreateOrderItemDto {
  @IsUUID('4')
  productId: string;

  @IsNumber()
  @Min(1)
  quantity: number;
}

/**
 * DTO para crear una nueva orden
 */
export class CreateOrderDto {
  @IsUUID('4')
  clientId: string;

  @IsString()
  @IsNotEmpty()
  clientName: string;

  @IsEmail()
  clientEmail: string;

  @IsString()
  @IsNotEmpty()
  shippingAddress: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];
}