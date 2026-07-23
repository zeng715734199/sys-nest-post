import { Injectable, OnModuleInit } from '@nestjs/common';
import { ChatOpenAI } from '@langchain/openai';
import {
  StateGraph,
  MessagesAnnotation,
  START,
  END,
  MemorySaver,
} from '@langchain/langgraph';
import {
  HumanMessage,
  SystemMessage,
  BaseMessage,
} from '@langchain/core/messages';
import { config } from '../config';

@Injectable()
export class LanggraphService implements OnModuleInit {
  private simpleGraph!: ReturnType<typeof this.buildSimpleGraph>;
  private memoryGraph!: ReturnType<typeof this.buildMemoryGraph>;
  private llm = new ChatOpenAI({
    model: process.env.LANGGRAPH_MODEL || 'llama3.2: 3b',
    temperature: 0.8,
    apiKey: config.langGraph.apiKey,
    configuration: { baseURL: config.langGraph.baseURL },
  });

  /**
   * 构建一个简单的状态图
   * 该方法创建一个包含单个节点的图，该节点调用语言模型处理消息
   * @returns {StateGraph} 编译后的状态图实例
   */
  private buildSimpleGraph() {
    // 定义一个异步函数，用于调用语言模型处理消息
    const callModel = async (state: typeof MessagesAnnotation.State) => {
      const { messages } = state;
      const response = await this.llm.invoke(messages);
      // 返回包含响应消息的新状态
      return { messages: [response] };
    };
    // 构造graph，返回值用于定义ts类型
    return new StateGraph(MessagesAnnotation)
      .addNode('callModel', callModel)
      .addEdge(START, 'callModel')
      .addEdge('callModel', END)
      .compile();
  }

  private buildMemoryGraph() {
    const callModel = async (state: typeof MessagesAnnotation.State) => {
      const messages = [
        new SystemMessage('你是专业的 AI 助手，能记忆对话历史。'),
        ...state.messages,
      ];
      const response = await this.llm.invoke(messages);
      // 返回包含响应消息的新状态
      return { messages: [response] };
    };
    // 构造graph，返回值用于定义ts类型
    return new StateGraph(MessagesAnnotation)
      .addNode('callModel', callModel)
      .addEdge(START, 'callModel')
      .addEdge('callModel', END)
      .compile({ checkpointer: new MemorySaver() });
  }
  // 初始化：构造graph
  onModuleInit() {
    this.simpleGraph = this.buildSimpleGraph();
    this.memoryGraph = this.buildMemoryGraph();
  }
  // 简单对话graph
  async simpleChat(message: string) {
    const answer = await this.simpleGraph.invoke({
      messages: [
        new SystemMessage('你是专业的 AI 助手，回答简洁清晰。'),
        new HumanMessage(message),
      ],
    });
    return answer.messages.at(-1)?.content;
  }
  // 持久对话graph
  async memoryChat(threadId: string, message: string) {
    const answer = await this.memoryGraph.invoke(
      {
        messages: [new HumanMessage(message)],
      },
      { configurable: { thread_id: threadId } },
    );
    return answer.messages.at(-1)?.content;
  }
  // 获取对话历史
  async getHistory(threadId: string) {
    const state = await this.memoryGraph.getState({
      configurable: { thread_id: threadId },
    });
    return (state.values.messages ?? []).map((m: BaseMessage, i: number) => ({
      index: i,
      role: m.type === 'human' ? 'user' : 'assistant',
      content: m.content,
    }));
  }
}
