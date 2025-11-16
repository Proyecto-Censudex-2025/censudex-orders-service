import { Injectable, Logger } from '@nestjs/common';
import * as sgMail from '@sendgrid/mail';
import { ConfigService } from '@nestjs/config';
import { Order } from '../entities/order.entity';

/**
 * Servicio para enviar emails usando SendGrid
 */
@Injectable()
export class SendGridService {
  /**
   * Logger para el servicio SendGrid
   */
  private readonly logger = new Logger(SendGridService.name);

  /**
   * Constructor del servicio SendGrid
   * @param configService Servicio para acceder a variables de configuración
   */
  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('SENDGRID_API_KEY');
    if (!apiKey) {
      this.logger.warn('SendGrid API Key no configurada. Las notificaciones no se enviarán.');
    } else {
      sgMail.setApiKey(apiKey);
      this.logger.log('SendGrid configurado correctamente');
    }
  }
  /**
   * Establece el email del remitente
   * @returns Dirección de correo electrónico del remitente
   */

  private fromEmail(): string {
    return this.configService.get<string>('SENDGRID_FROM_EMAIL') || 'noreply@censudex.cl';
  }

  /**
   * Configura y envía el email de confirmación de pedido
   * @param order Pedido para el cual se enviará el email de confirmación
   */
  async sendOrderConfirmationEmail(order: Order): Promise<void> {
    try {
      const msg = {
        to: order.clientEmail,
        from: this.fromEmail(),
        subject: `✅ Confirmación de Pedido #${order.id.slice(0, 8).toUpperCase()}`,
        text: `Hola ${order.clientName}, tu pedido ha sido creado exitosamente.`,
        html: this.buildOrderConfirmationHtml(order),
      };

      await sgMail.send(msg);
      this.logger.log(`✉️ Email de confirmación enviado a ${order.clientEmail}`);
    } catch (error) {
      this.logger.error(
        `❌ Error al enviar email de confirmación: ${error?.message || error}`,
        error?.response?.body?.errors || error?.stack
      );
    }
  }

  /**
   * Envía email cuando cambia el estado del pedido
   * @param order Pedido cuyo estado ha cambiado
   * @param previousStatus Estado anterior del pedido
   */
  async sendOrderStatusUpdateEmail(order: Order, previousStatus: string): Promise<void> {
    try {
      const statusEmojis = {
        pendiente: 'Pendiente 🕒',
        en_procesamiento: 'En procesamiento 📦',
        enviado: 'Enviado 🚚',
        entregado: 'Entregado ✅',
        cancelado: 'Cancelado ❌',
      };

      const emoji = statusEmojis[order.status] || 'ℹ️';
      const subject = `${emoji} Actualización de Pedido #${order.id.slice(0, 8).toUpperCase()}`;
      const html = this.buildStatusUpdateHtml(order, previousStatus);

      const msg = {
        to: order.clientEmail,
        from: this.fromEmail(),
        subject,
        html,
      };

      await sgMail.send(msg);
      this.logger.log(`✉️ Email de actualización de estado enviado a ${order.clientEmail}`);
    } catch (error) {
      this.logger.error(
        `Error al enviar email de actualización: ${error?.message || error}`,
        error?.response?.body?.errors || error?.stack
      );
    }
  }

  /**
   * Envía email cuando se cancela un pedido
   * @param order Pedido que ha sido cancelado
   */
  async sendOrderCancellationEmail(order: Order): Promise<void> {
    try {
      const msg = {
        to: order.clientEmail,
        from: this.fromEmail(),
        subject: `Cancelación de Pedido #${order.id.slice(0, 8).toUpperCase()}`,
        text: `Hola ${order.clientName}, tu pedido ha sido cancelado.`,
        html: this.buildCancellationHtml(order),
      };

      await sgMail.send(msg);
      this.logger.log(`Email de cancelación enviado a ${order.clientEmail}`);
    } catch (error) {
      this.logger.error(
        `Error al enviar email de cancelación: ${error?.message || error}`,
        error?.response?.body?.errors || error?.stack
      );
    }
  }

  /**
   * Plantilla HTML para confirmación de pedido
   * @param order Pedido para el cual se genera la plantilla
   * @returns HTML del email de confirmación
   */
  private buildOrderConfirmationHtml(order: Order): string {
    const itemsHtml = order.items
      .map(
        (item) => `
          <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 15px; text-align: left;">
              <strong>${item.productName}</strong>
            </td>
            <td style="padding: 15px; text-align: center;">${item.quantity}</td>
            <td style="padding: 15px; text-align: right;">$${item.unitPrice.toLocaleString('es-CL')}</td>
            <td style="padding: 15px; text-align: right;"><strong>$${item.subtotal.toLocaleString('es-CL')}</strong></td>
          </tr>
        `
      )
      .join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4;">
        <div style="max-width: 600px; margin: 20px auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">

          <div style="background: #764ba2; padding: 40px 20px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Pedido Confirmado!</h1>
            <p style="color: rgba(255, 255, 255, 0.9); margin: 10px 0 0 0; font-size: 16px;">🎉 Gracias por tu compra en censudex 🎉</p>
          </div>

          <div style="padding: 30px 20px;">
            <p style="font-size: 16px; margin-bottom: 20px;">Hola <strong>${order.clientName}</strong>,</p>
            <p style="font-size: 14px; color: #666; margin-bottom: 30px;">
              Tu pedido ha sido creado exitosamente y está siendo procesado. Te mantendremos informado sobre su estado.
            </p>

            <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
              <h3 style="margin: 0 0 15px 0; color: #667eea; font-size: 18px;">Detalles del Pedido</h3>
              <table style="width: 100%; font-size: 14px;">
                <tr>
                  <td style="padding: 8px 0; color: #666;">Número de Pedido:</td>
                  <td style="padding: 8px 0; text-align: right;"><strong>#${order.id.slice(0, 8).toUpperCase()}</strong></td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666;">Fecha:</td>
                  <td style="padding: 8px 0; text-align: right;"><strong>${new Date(order.createdAt).toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' })}</strong></td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666;">Estado:</td>
                  <td style="padding: 8px 0; text-align: right;">
                    <span style="background: #ffeaa7; color: #d63031; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: bold;">
                      PENDIENTE
                    </span>
                  </td>
                </tr>
              </table>
            </div>

            <h3 style="margin: 0 0 15px 0; color: #333; font-size: 18px;">Productos</h3>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 14px;">
              <thead>
                <tr style="background: #f8f9fa; border-bottom: 2px solid #ddd;">
                  <th style="padding: 15px; text-align: left;">Producto</th>
                  <th style="padding: 15px; text-align: center;">Cant.</th>
                  <th style="padding: 15px; text-align: right;">Precio Unit.</th>
                  <th style="padding: 15px; text-align: right;">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHtml}
              </tbody>
              <tfoot>
                <tr style="background: #f8f9fa; font-size: 16px;">
                  <td colspan="3" style="padding: 20px; text-align: right;"><strong>Total:</strong></td>
                  <td style="padding: 20px; text-align: right; color: #667eea;"><strong>$${order.total.toLocaleString('es-CL')}</strong></td>
                </tr>
              </tfoot>
            </table>

            <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
              <h3 style="margin: 0 0 10px 0; color: #667eea; font-size: 16px;">📍 Dirección de Envío</h3>
              <p style="margin: 0; font-size: 14px; color: #666;">${order.shippingAddress}</p>
            </div>

            <p style="font-size: 14px; color: #666; margin: 30px 0 0 0;">
              Recibirás una notificación cuando tu pedido sea enviado.
            </p>
          </div>

          <div style="background: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #999;">
            <p style="margin: 0 0 10px 0;">© ${new Date().getFullYear()} Censudex. Todos los derechos reservados.</p>
            <p style="margin: 0;">Si tienes alguna pregunta, contáctanos a soporte@censudex.cl</p>
          </div>

        </div>
      </body>
      </html>
    `;
  }

  /**
   * Plantilla HTML para actualización de estado
   * @param order Pedido para el cual se genera la plantilla
   * @param previousStatus Estado anterior del pedido
   * @returns HTML del email de actualización de estado
   */
  private buildStatusUpdateHtml(order: Order, previousStatus: string): string {
    const statusMessages = {
      en_procesamiento: {
        title: 'Tu pedido está siendo preparado',
        message: 'Estamos preparando tu pedido con cuidado. Pronto estará listo para ser enviado.',
        color: '#3498db',
      },
      enviado: {
        title: 'Tu pedido está en camino',
        message: `Tu pedido ha sido enviado y está en camino. ${order.trackingNumber ? `Número de seguimiento: <strong>${order.trackingNumber}</strong>` : ''}`,
        color: '#f39c12',
      },
      entregado: {
        title: 'Tu pedido ha sido entregado',
        message: '¡Tu pedido ha sido entregado exitosamente! Esperamos que disfrutes tu compra.',
        color: '#27ae60',
      },
      cancelado: {
        title: 'Tu pedido ha sido cancelado',
        message: 'Tu pedido ha sido cancelado. Si tienes alguna pregunta, no dudes en contactarnos.',
        color: '#e74c3c',
      },
    };

    const statusInfo = statusMessages[order.status] || {
      title: 'Actualización de Pedido',
      message: `El estado de tu pedido ha cambiado de "${previousStatus}" a "${order.status}".`,
      color: '#95a5a6',
    };

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4;">
        <div style="max-width: 600px; margin: 20px auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          
          <div style="background: ${statusInfo.color}; padding: 40px 20px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">${statusInfo.title}</h1>
          </div>

          <div style="padding: 30px 20px;">
            <p style="font-size: 16px; margin-bottom: 20px;">Hola <strong>${order.clientName}</strong>,</p>
            <p style="font-size: 14px; color: #666; margin-bottom: 30px;">${statusInfo.message}</p>

            <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
              <table style="width: 100%; font-size: 14px;">
                <tr>
                  <td style="padding: 8px 0; color: #666;">Número de Pedido:</td>
                  <td style="padding: 8px 0; text-align: right;"><strong>#${order.id.slice(0, 8).toUpperCase()}</strong></td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666;">Estado Actual:</td>
                  <td style="padding: 8px 0; text-align: right;"><strong style="color: ${statusInfo.color}; text-transform: uppercase;">${order.status.replace('_', ' ')}</strong></td>
                </tr>
                ${order.trackingNumber ? `
                <tr>
                  <td style="padding: 8px 0; color: #666;">Tracking:</td>
                  <td style="padding: 8px 0; text-align: right;"><strong>${order.trackingNumber}</strong></td>
                </tr>
                ` : ''}
              </table>
            </div>

            <p style="font-size: 14px; color: #666; margin: 30px 0 0 0;">
              Gracias por confiar en nosotros.
            </p>
          </div>

          <div style="background: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #999;">
            <p style="margin: 0 0 10px 0;">© ${new Date().getFullYear()} Censudex. Todos los derechos reservados.</p>
            <p style="margin: 0;">Si tienes alguna pregunta, contáctanos a soporte@censudex.cl</p>
          </div>

        </div>
      </body>
      </html>
    `;
  }

  /**
   * Plantilla HTML para cancelación
   * @param order Pedido para el cual se genera la plantilla
   * @returns HTML del email de cancelación
   */
  private buildCancellationHtml(order: Order): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4;">
        <div style="max-width: 600px; margin: 20px auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          
          <div style="background: #e74c3c; padding: 40px 20px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Pedido Cancelado</h1>
          </div>

          <div style="padding: 30px 20px;">
            <p style="font-size: 16px; margin-bottom: 20px;">Hola <strong>${order.clientName}</strong>,</p>
            <p style="font-size: 14px; color: #666; margin-bottom: 30px;">
              Tu pedido <strong>#${order.id.slice(0, 8).toUpperCase()}</strong> ha sido cancelado.
            </p>

            <div style="background: #fee; border-left: 4px solid #e74c3c; padding: 15px; margin-bottom: 20px;">
              <p style="margin: 0; font-size: 14px; color: #666;">
                <strong>Motivo:</strong> ${order.cancellationReason || 'No especificado'}
              </p>
            </div>

            <div style="background: #f8f9fa; border-radius: 8px; padding: 20px;">
              <p style="margin: 0 0 10px 0; font-size: 14px; color: #666;">
                <strong>Total del pedido:</strong> $${order.total.toLocaleString('es-CL')}
              </p>
              <p style="margin: 0; font-size: 14px; color: #666;">
                Si tienes alguna pregunta sobre esta cancelación o el proceso de reembolso, no dudes en contactarnos.
              </p>
            </div>

            <p style="font-size: 14px; color: #666; margin: 30px 0 0 0;">
              Lamentamos cualquier inconveniente. Esperamos poder servirte en el futuro.
            </p>
          </div>

          <div style="background: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #999;">
            <p style="margin: 0 0 10px 0;">© ${new Date().getFullYear()} Censudex. Todos los derechos reservados.</p>
            <p style="margin: 0;">Si tienes alguna pregunta, contáctanos a soporte@censudex.cl</p>
          </div>

        </div>
      </body>
      </html>
    `;
  }
}