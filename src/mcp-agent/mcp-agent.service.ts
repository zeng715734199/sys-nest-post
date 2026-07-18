import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ChatOllama } from '@langchain/ollama';
import { MultiServerMCPClient } from '@langchain/mcp-adapters';
import {
  BaseMessage,
  HumanMessage,
  AIMessage,
  ToolMessage,
  SystemMessage,
} from '@langchain/core/messages';
import { config } from '../config';

@Injectable()
export class McpAgentService implements OnModuleInit, OnModuleDestroy {
  private llm = new ChatOllama({
    model: config.ollama.chatModel,
    baseUrl: config.ollama.baseUrl,
    think: false,
    numPredict: 1024,
    temperature: 0.1,
  });
  // MultiServerMCPClient：同时连接多个 MCP Server
  private mcpClient!: MultiServerMCPClient;
  // 从 MCP 转换来的 LangChain Tools
  private mcpTools: any[] = [];

  async onModuleInit() {
    this.mcpClient = new MultiServerMCPClient({
      mcpServers: {
        // 自定义的本地 MCP Server（stdio 模式）
        'local-tools': {
          transport: 'stdio',
          command: 'ts-node',
          args: ['src/mcp-server/server.ts'],
          env: { ...process.env } as Record<string, string>,
        },
      },
    });
    this.mcpTools = await this.mcpClient.getTools();
    console.log(`✅ MCP Agent 已加载 ${this.mcpTools.length} 个工具：`);
    this.mcpTools.forEach((t) =>
      console.log(`   - ${t.name}: ${t.description?.slice(0, 50)}`),
    );
  }
  async onModuleDestroy() {
    await this.mcpClient.close();
    console.log('✅ MCP Agent 已关闭');
  }
  listMcpTools() {
    return this.mcpTools.map((t) => ({
      name: t.name,
      description: t.description,
    }));
  }
  async runAgent(userMessage: string) {
    if (this.mcpTools.length === 0) {
      return {
        error: 'MCP Agent 没有加载任何工具',
      };
    }
    // 工具 Map（通过 name 找到对应 Tool 执行）
    const toolMap = Object.fromEntries(this.mcpTools.map((t) => [t.name, t]));
    // 注册后模型回复里会包含 tool_calls 字段（当它决定调用工具时）
    const llmWidthTools = this.llm.bindTools(this.mcpTools);
    // 消息历史：Agent 每一轮都能看到完整的对话 + 工具结果
    const messages: BaseMessage[] = [
      new SystemMessage(
        `你是一个智能助手，可以使用以下工具帮助用户：
- query_users：查询用户数据库
- read_file：读取项目文件
- get_weather：查询城市天气

根据用户的问题，选择合适的工具获取信息后回答。用中文回答。`,
      ),
      new HumanMessage(userMessage),
    ];
    // 记录一下每步的执行的过程（用于前端展示、调试）
    const steps: string[] = [];
    let roundCount = 0;
    // ── Agent 循环
    // 每一轮：模型看消息历史 → 决定调用工具还是直接回答
    // 直到模型不再调用工具为止（最多 6 轮，防止死循环）
    while (roundCount < 6) {
      roundCount++;
      console.log(`第${roundCount}轮对话`);
      const response = await llmWidthTools.invoke(messages);
      // 把模型回复加入历史
      messages.push(response);
      // tool_calls 为空 → 模型有了最终答案，退出循环
      if (!response.tool_calls || response.tool_calls.length === 0) {
        steps.push(`【最终回答】：${response.content as string}`);
        break;
      }

      for (const toolCall of response.tool_calls) {
        steps.push(
          `🔧 [调用工具] ${toolCall.name}(${JSON.stringify(toolCall.args)})`,
        );
        const tool = toolMap[toolCall.name];
        if (!tool) {
          const errMsg = `工具「${toolCall.name}」不存在`;
          steps.push(`【错误】：${errMsg}`);
          messages.push(
            new ToolMessage({
              content: errMsg,
              tool_call_id: toolCall.id ?? '',
            }),
          );
          continue;
        }
        // 执行工具，获取结果
        const toolResult = (await tool.invoke(toolCall.args as any)) as string;
        steps.push(`【工具结果】：${toolResult}`);
        messages.push(
          new ToolMessage({
            content: String(toolResult),
            tool_call_id: toolCall.id ?? '',
          }),
        );
        console.log(`[工具结果] ${toolResult}`);
      }
    }
    // 获取最终回答
    const lastAI = [...messages].reverse().find((m) => m instanceof AIMessage);

    return {
      userMessage,
      steps,
      totalRounds: roundCount,
      answer: lastAI?.content ?? '抱歉，暂时无法处理您的请求',
    };
  }
}
