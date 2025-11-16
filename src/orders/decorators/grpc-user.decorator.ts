import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { status } from '@grpc/grpc-js';
/**
 * Interfaz que representa la información del usuario autenticado extraída de la metadata de gRPC.
 */
export interface AuthUser {
  userId: string;
  email: string;
  role: 'admin' | 'client';
}

/**
 * Decorador para extraer la información del usuario desde la metadata de gRPC.
 * Reemplaza a CurrentUser 
 */
export const GrpcUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): AuthUser => {
    
    const rpcContext = ctx.switchToRpc().getContext();
    if (!rpcContext) {
      throw new RpcException({
        code: status.INTERNAL,
        message: 'Contexto RPC no encontrado',
      });
    }

    const metadata = rpcContext.getMap();
    if (!metadata) {
       throw new RpcException({
        code: status.UNAUTHENTICATED,
        message: 'Metadata de gRPC no encontrada',
      });
    }

    const userId = metadata['x-user-id'];
    const userRole = metadata['x-user-role'];
    const userEmail = metadata['x-user-email'];

    if (!userId || !userRole) {
      throw new RpcException({
        code: status.UNAUTHENTICATED,
        message: 'Información de autenticación (metadata) faltante',
      });
    }

    return {
      userId,
      email: userEmail || '',
      role: userRole as 'admin' | 'client',
    };
  },
);