import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Order } from './order.entity';

/**
 * Entidad que representa un ítem dentro de una orden de compra
 */
@Entity('order_items')
export class OrderItem {
  /**
   * Identificador único del ítem de la orden
   */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Identificador de la orden a la que pertenece el ítem
   */
  @Column({ type: 'varchar', length: 36, name: 'order_id' })
  orderId: string;

  /**
   * Identificador del producto
   */
  @Column({ type: 'varchar', length: 36, name: 'product_id' })
  productId: string;

  /**
   * Nombre del producto
   */
  @Column({ type: 'varchar', length: 255, name: 'product_name' })
  productName: string;

  /**
   * Precio unitario del producto
   */
  @Column({ type: 'decimal', precision: 10, scale: 2, name: 'unit_price' })
  unitPrice: number;

  /**
   * Cantidad del producto
   */
  @Column({ type: 'int', unsigned: true })
  quantity: number;

  /**
   * Subtotal del ítem (precio unitario * cantidad)
   */
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  subtotal: number;

  /**
   * URL de la imagen del producto
   */
  @Column({ type: 'text', nullable: true, name: 'product_image_url' })
  productImageUrl?: string;

  /**
   * Orden a la que pertenece el ítem
   */
  @ManyToOne(() => Order, (order) => order.items, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'order_id' })
  order: Order;
  /**
   * Fecha de creación del ítem
   */
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
