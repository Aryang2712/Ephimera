const { WebSocketServer } = require('ws');
const wss = new WebSocketServer({ port: 8080 });

console.log('✅ QA Mock Signaling Server running on ws://localhost:8080');

wss.on('connection', (ws) => {
  console.log('[+] Peer connected');
  
  ws.on('message', (data) => {
    // Broadcast SDP/ICE candidates to every other connected peer
    wss.clients.forEach((client) => {
      if (client !== ws && client.readyState === ws.OPEN) {
        client.send(data.toString());
      }
    });
  });

  ws.on('close', () => console.log('[-] Peer disconnected'));
});
