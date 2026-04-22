import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { UserRole } from '@prisma/client';
import { Server, Socket } from 'socket.io';
import { JwtPayload } from '../auth/strategies/jwt.strategy';

@WebSocketGateway({
  namespace: '/tracking',
  cors: { origin: true, credentials: true },
})
export class TrackingGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(TrackingGateway.name);

  constructor(private readonly jwt: JwtService) {}

  async handleConnection(client: Socket) {
    const token =
      (client.handshake.auth as { token?: string })?.token ??
      (typeof client.handshake.query.token === 'string' ? client.handshake.query.token : undefined);
    if (!token) {
      client.disconnect(true);
      return;
    }
    try {
      const payload = await this.jwt.verifyAsync<JwtPayload>(token);
      if (payload.role !== UserRole.ADMIN) {
        client.disconnect(true);
        return;
      }
      (client.data as { user?: JwtPayload }).user = payload;
      this.logger.log(`Admin WS connected ${client.id}`);
    } catch {
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`WS disconnected ${client.id}`);
  }

  emitLocation(payload: {
    vehicleId: string;
    driverId: string;
    latitude: number;
    longitude: number;
    recordedAt: string;
  }) {
    this.server.emit('location', payload);
  }
}
