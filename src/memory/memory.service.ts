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
  /**
   * 列出所有会话信息
   * @returns 返回包含会话总数和会话列表的对象，每个会话包含ID和对话轮次
   */
  listSessions() {
    // 获取会话Map中的所有条目，如果没有则使用空数组
    const sessionEntries = this.sessionMap.entries() || [];
    // 将Map条目转换为数组，并映射为包含会话ID和对话轮次的对象
    const allSessions = [...sessionEntries].map(([sessionId, history]) => {
      return {
        sessionId, // 会话ID
        turns: Math.floor(history.length - 1 / 2), // 计算对话轮次
      };
    });
    // 返回包含会话总数和会话列表的对象
    return { total: allSessions.length, sessions: allSessions };
  }
  /**
   * 清除指定ID的会话
   * @param sessionId 要清除的会话ID
   * @returns 返回操作结果对象，包含会话ID、清除状态和相关信息
   */
  clearSession(sessionId: string) {
    if (this.sessionMap.has(sessionId)) {
      this.sessionMap.delete(sessionId);
      return { sessionId, cleared: true, message: '会话已清除' };
    }
    return { sessionId, cleared: false, message: '会话不存在' };
  }
  /**
   * 获取指定会话的历史消息记录
   * @param sessionId 会话ID
   * @returns 返回包含会话信息、存在状态和消息记录的对象
   */
  getHistory(sessionId: string) {
    // 检查会话是否存在，如果不存在则返回包含空消息数组和存在状态为false的对象
    if (!this.sessionMap.has(sessionId)) {
      return { sessionId, exists: false, messages: [] };
    }
    // 获取会话中的消息，过滤掉系统消息，并格式化消息内容
    const messages = (this.sessionMap.get(sessionId) || [])
      .filter((item) => !(item instanceof SystemMessage)) // 过滤掉系统消息
      .map((m, i) => ({
        // 将消息映射为指定格式
        index: i + 1, // 消息索引，从1开始
        role: m instanceof HumanMessage ? 'user' : 'assistant', // 根据消息类型设置角色
        content: m.content, // 消息内容
      }));
    // 返回包含会话信息、存在状态为true、消息轮数和格式化后的消息的对象
    return {
      sessionId,
      exists: true,
      turns: Math.floor(messages.length / 2), // 计算消息轮数（一轮包含一个用户消息和一个助手消息）
      messages,
    };
  }
  // chatStream() {}
}
