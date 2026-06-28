import { io } from 'socket.io-client'

let _socket = null

export function getSocket() {
  if (!_socket) {
    _socket = io('/', {
      transports: ['websocket', 'polling'],
    })
    _socket.on('connect', () => console.log('[socket] connected:', _socket.id))
    _socket.on('disconnect', r => console.log('[socket] disconnected:', r))
    _socket.on('connect_error', e => console.error('[socket] error:', e.message))
  }
  return _socket
}

export function disconnectSocket() {
  if (_socket) { _socket.disconnect(); _socket = null }
}