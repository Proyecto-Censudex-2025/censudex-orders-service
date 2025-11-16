import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SendGridService } from '../services/sendgrid.service';

/**
 * Módulo para integrar SendGrid en la aplicación
 */
@Module({
  imports: [ConfigModule],
  providers: [SendGridService],
  exports: [SendGridService],
})
/**
 * Módulo SendGrid
 */
export class SendGridModule {}