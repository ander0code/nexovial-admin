import {io, type Socket} from 'socket.io-client';
import {API_URL} from './client';

let socket: Socket | null = null;

/** Singleton: una sola conexión Socket.io por sesión del dashboard */
export function getSocket(companyId: string): Socket {
  if (!socket) {
    socket = io(API_URL);
    socket.emit('join_company', companyId);
    socket.on('connect', () => {
      // reconexión: volver a unirse al room de la empresa
      socket?.emit('join_company', companyId);
    });
  }
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
