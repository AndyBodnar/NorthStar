declare module 'ws' {
  export default class WebSocket {
    constructor(url: string, options?: any);
    on(event: string, callback: (data?: any) => void): void;
    send(data: string): void;
    close(): void;
  }
  export interface WebSocketServer {
    on(event: string, callback: (ws: any, request?: any) => void): void;
    clients: Set<any>;
  }
  export function WebSocketServer(options: any): WebSocketServer;
}