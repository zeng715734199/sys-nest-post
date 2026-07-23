import { Injectable } from '@nestjs/common';
import { ChatOllama } from '@langchain/ollama';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import {
  HumanMessage,
  AIMessage,
  ToolMessage,
  SystemMessage,
  BaseMessage,
} from '@langchain/core/messages';
import { config } from '../config';

@Injectable()
export class AgentsService {
  private llm = new ChatOllama({
    model: config.ollama.chatModel,
    baseUrl: config.ollama.baseUrl,
    temperature: 0.1, // 低温度，让工具调用决策更稳定
    think: false,
    numPredict: 1024,
  });
  // ══════════════════════════════════════════════════════
  // 工具定义
  // tool() 把普通 JS 函数包装成模型能识别的格式
  //   name：工具名（模型据此决定何时调用）
  //   description：工具描述（模型据此理解这个工具能干什么）
  //   schema：参数定义（zod 格式，告诉模型调用时传什么参数）
  // ══════════════════════════════════════════════════════

  // ── 工具一：查询商品库存和价格的工具，输入参数是商品名字，输出的是一个字符串，包含商品的库存和价格信息
  private checkProductTool = tool(
    ({ productName }: { productName: string }) => {
      // 模拟商品信息
      const products: Record<
        string,
        { stock: number; price: number; category: string }
      > = {
        'iPhone 14': { stock: 0, price: 6999, category: '手机' },
        'MacBook Pro': { stock: 50, price: 14999, category: '电脑' },
        'AirPods Pro': { stock: 200, price: 1999, category: '耳机' },
        'iPad Pro': { stock: 80, price: 7999, category: '平板' },
        'Apple Watch': { stock: 150, price: 3299, category: '手表' },
      };
      const product = products[productName];
      if (!product) {
        return `商品 ${productName} 不存在`;
      }
      if (product.stock === 0) {
        return `商品 ${productName} 已售罄`;
      }
      return `商品 ${productName} 有货，库存是 ${product.stock}，价格是 ${product.price} 元，分类是 ${product.category}`;
    },
    {
      name: 'check_product',
      description:
        '查询商品库存和价格的工具，输入参数是商品名字，输出是一个字符串，包含库存和价格信息',
      schema: z.object({
        productName: z
          .string()
          .describe(
            '要查询的商品名称，例如： iPhone 14、MacBook Pro、AirPods Pro 等',
          ),
      }),
    },
  );
  // 工具二：创建订单
  private createOrderTool = tool(
    ({
      productName,
      quantity,
      customerName,
    }: {
      productName: string;
      quantity: number;
      customerName: string;
    }) => {
      // 模拟商品价格
      const prices: Record<string, number> = {
        'iPhone 14': 6999,
        'MacBook Pro': 14999,
        'AirPods Pro': 1999,
        'iPad Pro': 7999,
        'Apple Watch': 3299,
      };
      const price = prices[productName];
      const orderNo = `ORDER-${Math.floor(Math.random() * 100000)}`;
      if (!price) {
        return `商品 ${productName} 不存在`;
      }
      if (!quantity) {
        return `商品 ${productName} 已售罄，无法下单`;
      }
      return `创建订单成功，订单编号：${orderNo}；商品名称：${productName}；数量：${quantity}；总价：${price * quantity} 元；客户姓名：${customerName}`;
    },
    {
      name: 'create_order',
      description:
        '创建订单的工具，输入参数是商品名称、数量和客户姓名，输出是一个字符串，包含订单信息',
      schema: z.object({
        productName: z
          .string()
          .describe(
            '要创建订单的商品名称，例如：iPhone 14、MacBook Pro、AirPods Pro 等',
          ),
        quantity: z.number().describe('要创建订单的商品数量'),
        customerName: z.string().describe('客户姓名'),
      }),
    },
  );
  // 工具三：查询订单状态
  private checkOrderStatusTool = tool(
    ({ orderNo }: { orderNo: string }) => {
      // 模拟订单状态（实际项目查数据库）
      const statuses = ['待支付', '已支付待发货', '已发货运输中', '已签收'];
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      const extra = status === '已发货运输中' ? '，预计明天送达' : '';
      return `订单 ${orderNo} 当前状态：${status}${extra}。`;
    },
    {
      name: 'check_order',
      description:
        '查询订单状态的工具，输入参数是订单编号，输出是一个字符串，包含订单状态信息',
      schema: z.object({
        orderNo: z.string().describe('要查询的订单编号，例如：ORDER-123456'),
      }),
    },
  );
  // 工具四：申请退款
  private applyRefundTool = tool(
    ({ orderNo, reason }: { orderNo: string; reason: string }) => {
      const refundId = `REFUND-${Math.floor(Math.random() * 100000)}`;
      return `申请退款成功，退款编号：${refundId}；订单编号：${orderNo}；退款原因：${reason}`;
    },
    {
      name: 'apply_refund',
      description:
        '申请退款的工具，输入参数是订单编号和退款原因，输出是一个字符串，包含退款信息',
      schema: z.object({
        orderNo: z
          .string()
          .describe('要申请退款的订单编号，例如：ORDER-123456'),
        reason: z.string().describe('退款原因'),
      }),
    },
  );
  async runAgent(userMessage: string) {
    const tools = [
      this.checkOrderStatusTool,
      this.createOrderTool,
      this.checkProductTool,
      this.applyRefundTool,
    ];
    const toolMap = {
      check_order: this.checkOrderStatusTool,
      create_order: this.createOrderTool,
      check_product: this.checkProductTool,
      apply_refund: this.applyRefundTool,
    };
    // bindTools() 方法将工具绑定到 LLM 上，使其能够识别并调用这些工具
    // 注册后模型回复里会包含 tool_calls 字段（当它决定调用工具时）
    const llmWidthTools = this.llm.bindTools(tools);
    // 消息历史：Agent 每一轮都能看到完整的对话 + 工具结果
    const messages: BaseMessage[] = [
      // System 消息：设定客服角色和行为规范
      new SystemMessage(
        `你是「极速购」电商平台的 AI 智能客服助手。
你可以使用以下工具帮助客户：
- check_product：查询商品库存和价格
- create_order：为客户创建订单
- check_order：查询订单状态
- apply_refund：申请退款

工作原则：
1. 先用工具获取真实信息，再给客户答复
2. 下单前必须先查询库存确认有货
3. 下单需要知道客户姓名，如果用户没说，主动询问
4. 回答简洁友好，使用中文`,
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
        const toolResult = await tool.invoke(toolCall.args);
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
