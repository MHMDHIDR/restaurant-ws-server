import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const clients = new Map<string, Set<WebSocket>>()

async function handleOrderUpdate(req: Request) {
  if (req.method === 'POST') {
    try {
      const { orderId, status } = await req.json()

      const subscribers = clients.get(orderId)
      if (subscribers) {
        const message = JSON.stringify({ orderId, status })
        subscribers.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(message)
          } else {
            clients.forEach(wsSet => wsSet.delete(client))
          }
        })
      }

      return new Response('Update sent', { status: 200 })
    } catch (_error) {
      return new Response('Error processing update', { status: 400 })
    }
  }

  return new Response('Method not allowed', { status: 405 })
}

serve(
  async req => {
    if (req.headers.get('upgrade') === 'websocket') {
      try {
        const { socket, response } = await Deno.upgradeWebSocket(req)

        socket.onopen = () => {
          console.log('WebSocket opened')
        }

        socket.onmessage = event => {
          try {
            const data = JSON.parse(event.data)

            if (
              data.type === 'subscribe' &&
              data.orderIds &&
              Array.isArray(data.orderIds)
            ) {
              data.orderIds.forEach((orderId: string) => {
                if (!clients.has(orderId)) {
                  clients.set(orderId, new Set())
                }
                clients.get(orderId)?.add(socket)
                console.log(`Client subscribed to order ${orderId}`)
              })
            }
          } catch (_error) {
            console.error('Error parsing WebSocket message:', _error)
          }
        }

        socket.onclose = () => {
          console.log('WebSocket closed')

          clients.forEach(wsSet => {
            wsSet.delete(socket)
          })
        }

        socket.onerror = event => {
          console.error('WebSocket error:', (event as ErrorEvent).error)
        }

        return response
      } catch (error) {
        console.error('Error upgrading WebSocket:', error)
        return new Response('WebSocket upgrade failed', { status: 500 })
      }
    }

    return handleOrderUpdate(req)
  },
  { port: 8000 }
)
