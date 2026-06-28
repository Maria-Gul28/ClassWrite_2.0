import { io } from 'socket.io-client'

let _socket = null

export function getSocket() {
  if (!_socket) {
    _socket = io('/', {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    })

    _socket.on('connect', () => {
      console.log('[socket] connected:', _socket.id)
    })
    _socket.on('disconnect', (reason) => {
      console.log('[socket] disconnected:', reason)
    })
    _socket.on('connect_error', (err) => {
      console.error('[socket] connect error:', err.message)
    })
  }
  return _socket
}

export function joinClassRoom(classId) {
  const socket = getSocket()
  socket.emit('join_class_room', { class_id: classId })
}

export function disconnectSocket() {
  if (_socket) {
    _socket.disconnect()
    _socket = null
  }
}