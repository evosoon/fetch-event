      
/**
 * 使用 Fetch 请求实现的 SSE 客户端
 * 支持 post 请求，设置 header 等
 */
class SSEClient {
    constructor(url, options = {}) {
      this.url = url
      this.options = {
        method: 'GET', // 默认 GET 请求
        headers: {},
        body: null,
        retryDelay: 3000, // 重连间隔时间
        autoReconnect: true, // 是否自动重连
        ...options
      }
      this.retryDelay = this.options.retryDelay
      this.eventListeners = {} // 事件监听器
      this.isConnected = false // 标志连接状态
      this.abortController = null // 控制请求中止
      this.buffer = '' // 存储 SSE 消息的缓冲区
    }
  
    // 启动 SSE 连接
    connect() {
      if (this.isConnected) {
        return
      }
      this.abortController = new AbortController()
  
      const { method, headers, body } = this.options
  
      fetch(this.url, {
        method,
        headers: {
          Accept: 'text/event-stream',
          'Cache-Control': 'no-cache',
          ...headers
        },
        body: method !== 'GET' ? JSON.stringify(body) : null,
        signal: this.abortController.signal
      })
        .then(async (response) => {
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`)
          }
  
          this.isConnected = true
          this.emit('open') // 连接成功时触发 open 事件
          const reader = response.body.getReader()
          const decoder = new TextDecoder('utf-8')
          this.buffer = ''
  
          for (;;) {
            const { done, value } = await reader.read()
            if (done) {
              this.emit('close')
              break
            }
            this.buffer += decoder.decode(value, { stream: true })
            // 处理每一行的 SSE 数据
            const lines = this.buffer.split('\n')
            this.buffer = lines.pop() // 保留最后一个未完成的部分
  
            for (const line of lines) {
              this.processLine(line)
            }
          }
        })
        .catch((error) => {
          this.emit('error', error) // 触发 error 事件
          this.handleDisconnect()
        })
    }
  
    // 处理断开连接
    handleDisconnect() {
      this.isConnected = false
      if (this.options.autoReconnect) {
        setTimeout(() => {
          this.connect() // 自动重连
        }, this.retryDelay)
      }
      this.emit('close') // 触发 close 事件
    }
  
    // 处理每一行的 SSE 数据
    processLine(line) {
      if (line.startsWith('data:')) {
        const eventData = line.slice(5)
        this.emit('message', eventData)
      } else if (line.startsWith('event:')) {
        this.currentEvent = line.slice(6)
      } else if (line.startsWith('id:')) {
        this.lastEventId = line.slice(3)
      } else if (line === '') {
        // 一个事件结束，触发当前事件
        if (this.currentEvent) {
          this.emit(this.currentEvent, this.lastEventId)
          this.currentEvent = null
        }
      }
    }
  
    // 手动断开连接
    disconnect() {
      if (this.abortController) {
        this.abortController.abort() // 中止 fetch 请求
      }
      this.isConnected = false
      this.emit('close') // 触发 close 事件
    }
  
    // 事件订阅
    on(event, callback) {
      if (!this.eventListeners[event]) {
        this.eventListeners[event] = []
      }
      this.eventListeners[event].push(callback)
    }
  
    // 事件触发
    emit(event, data) {
      if (this.eventListeners[event]) {
        this.eventListeners[event].forEach((callback) => callback(data))
      }
    }
  }
  
  export default SSEClient
  
      