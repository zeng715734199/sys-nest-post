import { Injectable } from '@nestjs/common';
import { ChatOllama } from '@langchain/ollama';
import {
  HumanMessage,
  SystemMessage,
  AIMessageChunk,
} from '@langchain/core/messages';
import type { Response } from 'express';
import { config } from '../config';

@Injectable()
export class ModelsService {
  private llm = new ChatOllama({
    model: config.ollama.chatModel,
    temperature: config.ollama.temperature,
    baseUrl: config.ollama.baseUrl,
    // 是否开启思考模式
    think: false,
    // 生成文本的最大token长度
    numPredict: 512,
  });
  // 定义一个方法，接收用户输入的消息，调用Ollama模型进行对话，并返回模型的回答和使用情况
  async baseChat(message: string) {
    const response = await this.llm.invoke([new HumanMessage(message)]);
    return {
      question: message,
      answer: response.content,
      usage: response.usage_metadata,
    };
  }
  // SystemMessage 设定模型的角色和行为，HumanMessage是用户输入的消息
  async systemChat(system: string, message: string) {
    const response = await this.llm.invoke([
      new SystemMessage(system),
      new HumanMessage(message),
    ]);
    return {
      system,
      question: message,
      answer: response.content,
      usage: response.usage_metadata,
    };
  }
  /**
   * 流式处理聊天消息的异步方法
   * @param message - 用户输入的消息内容
   * @param response - HTTP响应对象，用于流式返回数据
   */
  async streamChat({
    message,
    system = '',
    response,
  }: {
    message: string;
    system?: string;
    response: Response;
  }) {
    // 设置响应头，指定为服务器发送事件(SSE)格式
    response.setHeader('Content-Type', 'text/event-stream');
    // 禁用缓存，确保实时数据传输
    response.setHeader('Cache-Control', 'no-cache');
    // 保持连接活跃，支持长连接
    response.setHeader('Connection', 'keep-alive');
    // 允许跨域请求
    response.setHeader('Access-Control-Allow-Origin', '*');
    // 调用大语言模型的流式接口，获取异步可迭代的消息流
    const stream: AsyncIterable<AIMessageChunk> = await this.llm.stream([
      new SystemMessage(system),
      new HumanMessage(message), // 创建人类消息对象
    ]);
    // 遍历消息流，将每个内容块写入响应
    for await (const chunk of stream) {
      console.log('chunk：', chunk.content);
      response.write(chunk.content); // 写入消息内容块
    }
    // 完成数据传输，关闭连接
    response.end();
  }
}
