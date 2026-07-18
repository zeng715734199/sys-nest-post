import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
@Injectable()
export class McpClientService implements OnModuleInit, OnModuleDestroy {
  private client!: Client;
  private transport!: StdioClientTransport;
  async onModuleInit() {
    this.client = new Client({
      name: 'nestjs-mcp-client',
      version: '1.0.0',
      description: 'nestjs mcp client',
    });
    this.transport = new StdioClientTransport({
      command: 'ts-node',
      args: ['src/mcp-server/server.ts'],
      // 把当前环境变量传给子进程（包含 DATABASE_URL 等）
      env: { ...process.env } as Record<string, string>,
    });
    await this.client.connect(this.transport);
    console.log('✅ MCP Client 已连接到 MCP Server');
  }
  // ── 获取所有可用工具列表 ──────────────────────────
  async listTools() {
    const response = await this.client.listTools();
    return response.tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    }));
  }

  async callTool(name: string, args: Record<string, any>) {
    const response = await this.client.callTool({ name, arguments: args });
    // MCP 响应里 content 是数组，取第一个 text 内容
    const textContent = (
      response.content as Array<{ type: string; text?: string }>
    ).find((c) => c.type === 'text');
    return {
      tool: name,
      result: textContent?.text ?? '工具无返回内容',
      isError: response.isError ?? false,
    };
  }
  async onModuleDestroy() {
    await this.client.close();
    console.log('✅ MCP Client 已断开连接');
  }
}
