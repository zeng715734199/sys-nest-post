import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ChatOllama } from '@langchain/ollama';
import { MultiServerMCPClient } from '@langchain/mcp-adapters';
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
    return this.mcpTools
      .map((t) => ({
        name: t.name,
        description: t.description,
      }))
      .join('\n');
  }
  async runAgent(message: string) {
    console.log(message);
  }
}
