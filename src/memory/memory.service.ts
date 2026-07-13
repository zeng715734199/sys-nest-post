import { Injectable } from '@nestjs/common';
import { ChatOllama } from '@langchain/ollama';
import { config } from '../config';
import {
  BaseMessage,
  SystemMessage,
  HumanMessage,
} from '@langchain/core/messages';

@Injectable()
export class MemoryService {
  private llm = new ChatOllama({
    model: config.ollama.chatModel,
    baseUrl: config.ollama.baseUrl,
    temperature: 0.1, // 低温度，让工具调用决策更稳定
    think: false,
    numPredict: 1024,
  });
  private sessionMap = new Map<string, BaseMessage[]>();
  private systemPrompt = new SystemMessage(
    '你是一个智能助手，能够记住对话的历史，并且严格按照上下文回答问题',
  );
  getOrSetHistory(sessionId: string) {
    if (!this.sessionMap.has(sessionId)) {
      this.sessionMap.set(sessionId, [this.systemPrompt]);
    }
    return this.sessionMap.get(sessionId) || [this.systemPrompt];
  }
  async memoryChat(sessionId: string, message: string) {
    const history = this.getOrSetHistory(sessionId);
    history.push(new HumanMessage(message));
    const response = await this.llm.invoke(history);
    history.push(response);
    return {
      sessionId,
      message,
      reply: response.content,
      turns: Math.floor(history.length / 2),
    };
  }
}
