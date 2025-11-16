import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { OrderItem } from './order-item.entity';

/**
 * Entidad que representa una orden de compra
 */
@Entity('orders')
export class Order {
  /**
   * Identificador único de la orden
   */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Identificador del cliente
   */
  @Column({ type: 'varchar', length: 36, name: 'client_id' })
  clientId: string;

  /**
   * Nombre del cliente
   */
  @Column({ type: 'varchar', length: 255, name: 'client_name' })
  clientName: string;

  /**
   * Correo electrónico del cliente
   */
  @Column({ type: 'varchar', length: 255, name: 'client_email' })
  clientEmail: string;

  /**
   * Estado de la orden
   */
  @Column({
    type: 'enum',
    enum: ['pendiente', 'en_procesamiento', 'enviado', 'entregado', 'cancelado'],
    default: 'pendiente',
  })
  status: string;

  /**   
   * Total de la orden
   */
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  total: number;

  /**
   * Dirección de envío
   */
  @Column({ type: 'text', name: 'shipping_address' })
  shippingAddress: string;

  /**
   * Número de seguimiento (si aplica)
   */
  @Column({ type: 'varchar', length: 100, nullable: true, name: 'tracking_number' })
  trackingNumber?: string;

  /**
   * Razón de cancelación (si aplica)
   */
  @Column({ type: 'text', nullable: true, name: 'cancellation_reason' })
  cancellationReason?: string;

  /**
   * Fechas de los diferentes estados de la orden
   */
  @Column({ type: 'datetime', nullable: true, name: 'shipped_at' })
  shippedAt?: Date;

  /**
   * Fecha de entrega
   */
  @Column({ type: 'datetime', nullable: true, name: 'delivered_at' })
  deliveredAt?: Date;

  /**
   * Fecha de cancelación
   */
  @Column({ type: 'datetime', nullable: true, name: 'cancelled_at' })
  cancelledAt?: Date;

  /**
   * Items asociados a la orden
   */
  @OneToMany(() => OrderItem, (item) => item.order, {
    cascade: true,
    eager: true,
  })
  items: OrderItem[];

  /**
   * Fecha de creación
   */
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  /**
   * Fecha de última actualización
   */
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  /**
   * Indicador de eliminación lógica
   */
  @Column({ type: 'boolean', default: false, name: 'is_deleted' })
  isDeleted: boolean;
}
