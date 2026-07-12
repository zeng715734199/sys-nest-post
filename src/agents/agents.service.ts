import { Injectable } from '@nestjs/common';
import { ChatOllama } from '@langchain/ollama';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import {
  HumanMessage,
  AIMessage,
  ToolMessage,
  SystemMessage,
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
      return `商品 ${productName} 的库存是 ${product.stock}，价格是 ${product.price} 元，分类是 ${product.category}`;
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
  runAgent(message: string) {}
}
