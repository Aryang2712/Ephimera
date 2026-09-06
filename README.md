# 🌐 EPHIMERA

**EPHIMERA** is a serverless, peer-to-peer (P2P) Content Delivery Network (CDN) designed to drastically reduce origin server load and bandwidth costs by utilizing browser-to-browser data streaming. 

By leveraging WebRTC data channels, EPHIMERA acts as a self-healing edge network where users currently streaming a video share cached chunks directly with new viewers.

## 🚀 How It Works

1. **Signaling:** When a client joins, they connect to a lightweight signaling server to discover peers.
2. **P2P Connection:** Clients establish direct WebRTC connections using STUN/TURN servers.
3. **Chunk Streaming:** Video segments are streamed directly between browser tabs. 
4. **Origin Fallback:** If a chunk is not available in the peer network, the client gracefully falls back to the origin server.