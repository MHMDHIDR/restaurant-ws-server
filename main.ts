import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { WebSocketServer } from 'https://deno.land/x/websocket@v0.1.4/mod.ts'

const wss = new WebSocketServer()

// Store connected clients
const clients = new Map<string, Set<WebSocket>>()

wss.on('connection', (ws: WebSocket) => {
  console.log('New client connected')

  ws.onmessage = event => {
    try {
      const data = JSON.parse(event.data)
      // Handle subscription to specific order IDs
      if (data.type === 'subscribe' && data.orderIds) {
        data.orderIds.forEach((orderId: string) => {
          if (!clients.has(orderId)) {
            clients.set(orderId, new Set())
          }
          clients.get(orderId)?.add(ws)
        })
      }
    } catch (error) {
      console.error('Error parsing message:', error)
    }
  }

  ws.onclose = () => {
    // Clean up when client disconnects
    clients.forEach(wsSet => {
      wsSet.delete(ws)
    })
  }
})

// HTTP endpoint to receive order updates
async function handleOrderUpdate(req: Request) {
  if (req.method === 'POST') {
    try {
      const { orderId, status } = await req.json()

      // Broadcast to all clients subscribed to this order
      const subscribers = clients.get(orderId)
      if (subscribers) {
        const message = JSON.stringify({ orderId, status })
        subscribers.forEach(client => {
          client.send(message)
        })
      }

      return new Response('Update sent', { status: 200 })
    } catch (error) {
      return new Response('Error processing update', { status: 400 })
    }
  }

  return new Response('Method not allowed', { status: 405 })
}

// Start the server
serve(
  req => {
    if (req.headers.get('upgrade') === 'websocket') {
      return wss.handleRequest(req)
    }
    return handleOrderUpdate(req)
  },
  { port: 8000 }
)
