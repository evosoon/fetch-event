// server.js
import express from "express";

const app = express();
const PORT = 3007;

// SSE 路由
app.get("/sse", (req, res) => {
  // 设置 SSE 必要的响应头
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");

  // 发送欢迎消息
  res.write(`data: ${JSON.stringify({ message: "连接成功" })}\n\n`);

  // 每隔 2 秒推送一条消息（限制 5 次后关闭）
  let count = 0;
  const timer = setInterval(() => {
    const data = { time: new Date().toISOString(), index: count + 1 };
    res.write(`data: ${JSON.stringify(data)}\n\n`);
    count++;

    if (count >= 5) {
      // 通知客户端即将关闭，并结束响应
      res.write(`event: end\n`);
      res.write(`data: ${JSON.stringify({ message: "服务端主动关闭连接" })}\n\n`);
      clearInterval(timer);
      res.end();
    }
  }, 2000);

  // 断开连接时清理
  req.on("close", () => {
    clearInterval(timer);
    console.log("客户端断开连接");
  });
});

app.listen(PORT, () => {
  console.log(`SSE server running at http://localhost:${PORT}`);
});
