import { Injectable } from '@nestjs/common';
import { ChatOllama } from '@langchain/ollama';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { HumanMessage, ToolMessage } from '@langchain/core/messages';
import { config } from '../config';

@Injectable()
export class FunctionCallingService {
  private llm = new ChatOllama({
    model: config.ollama.chatModel,
    baseUrl: config.ollama.baseUrl,
    temperature: 0, // Function Calling 用 0，保证输出格式稳定
  });

  // ── 定义业务函数工具 ──────────────────────────────────

  // 工具一：查询商品库存
  private checkInventoryTool = tool(
    async ({ productName }: { productName: string }) => {
      // 模拟数据库查询
      const inventory: Record<string, { stock: number; price: number }> = {
        'iPhone 16': { stock: 50, price: 7999 },
        'MacBook Pro': { stock: 10, price: 15999 },
        'AirPods Pro': { stock: 200, price: 1799 },
        'iPad Air': { stock: 30, price: 4799 },
      };

      const item = inventory[productName];
      if (!item) {
        return JSON.stringify({
          found: false,
          message: `未找到商品：${productName}`,
        });
      }

      return JSON.stringify({
        found: true,
        productName,
        stock: item.stock,
        price: item.price,
        status: item.stock > 0 ? '有货' : '缺货',
      });
    },
    {
      name: 'check_inventory',
      description: '查询商品库存和价格信息',
      schema: z.object({
        productName: z
          .string()
          .describe('商品名称，例如 iPhone 16、MacBook Pro'),
      }),
    },
  );

  // 工具二：创建订单
  private createOrderTool = tool(
    async ({
      productName,
      quantity,
      customerName,
    }: {
      productName: string;
      quantity: number;
      customerName: string;
    }) => {
      // 模拟创建订单
      const orderId = `ORD-${Date.now()}`;
      return JSON.stringify({
        success: true,
        orderId,
        productName,
        quantity,
        customerName,
        createdAt: new Date().toLocaleString('zh-CN'),
        message: `订单 ${orderId} 创建成功`,
      });
    },
    {
      name: 'create_order',
      description: '为客户创建购买订单',
      schema: z.object({
        productName: z.string().describe('商品名称'),
        quantity: z.number().describe('购买数量'),
        customerName: z.string().describe('客户姓名'),
      }),
    },
  );

  // 工具三：查询订单状态
  private checkOrderTool = tool(
    async ({ orderId }: { orderId: string }) => {
      // 模拟订单状态
      const statuses = ['待支付', '已支付', '备货中', '已发货', '已完成'];
      const randomStatus =
        statuses[Math.floor(Math.random() * statuses.length)];
      return JSON.stringify({
        orderId,
        status: randomStatus,
        updatedAt: new Date().toLocaleString('zh-CN'),
      });
    },
    {
      name: 'check_order',
      description: '查询订单状态',
      schema: z.object({
        orderId: z.string().describe('订单号，格式 ORD-XXXXX'),
      }),
    },
  );

  // ── Function Calling 核心逻辑 ─────────────────────────
  async runFunctionCalling(userMessage: string) {
    const tools = [
      this.checkInventoryTool,
      this.createOrderTool,
      this.checkOrderTool,
    ];

    // 工具注册 Map
    const toolMap = {
      check_inventory: this.checkInventoryTool,
      create_order: this.createOrderTool,
      check_order: this.checkOrderTool,
    };

    // 把工具绑定到模型
    const llmWithTools = this.llm.bindTools(tools);

    const messages: any[] = [new HumanMessage(userMessage)];
    const toolCallLog: any[] = [];

    // 执行对话（最多 3 轮工具调用）
    for (let round = 0; round < 3; round++) {
      const response = await llmWithTools.invoke(messages);
      messages.push(response);

      // 没有工具调用，返回最终答案
      if (!response.tool_calls || response.tool_calls.length === 0) {
        break;
      }

      // 执行所有工具调用
      for (const toolCall of response.tool_calls) {
        const toolFn = toolMap[toolCall.name];
        if (!toolFn) continue;

        // 执行工具函数
        const result = await toolFn.invoke(toolCall.args);

        toolCallLog.push({
          tool: toolCall.name,
          args: toolCall.args,
          result: JSON.parse(result),
        });

        // 把工具结果加入消息历史
        messages.push(
          new ToolMessage({
            content: result,
            tool_call_id: toolCall.id,
          }),
        );
      }
    }

    // 最后一条 AI 消息的内容就是最终回答
    const lastMessage = [...messages]
      .reverse()
      .find((m) => m.constructor.name === 'AIMessage');
    const finalAnswer = lastMessage?.content || '处理完成';

    return {
      userMessage,
      toolCalls: toolCallLog,
      finalAnswer,
    };
  }
}
