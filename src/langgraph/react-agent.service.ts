import { Injectable, OnModuleInit } from '@nestjs/common';
import { BaseLLM } from 'src/llm';
import {
  StateGraph,
  START,
  END,
  MessagesAnnotation,
  MemorySaver,
} from '@langchain/langgraph';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { tool } from '@langchain/core/tools';
import {
  AIMessage,
  HumanMessage,
  SystemMessage,
} from '@langchain/core/messages';
import { z } from 'zod';

const queryWeatherTool = tool(
  ({ city }: { city: string }) => {
    const weatherMap = {
      北京: '天气晴朗，温度25摄氏度',
      上海: '天气多云，温度28摄氏度',
      深圳: '天气阴天，温度30摄氏度',
      福州: '天气小雨，温度20摄氏度',
    };
    return weatherMap[city] || '天气晴朗，温度31摄氏度';
  },
  {
    name: 'query_weather',
    description:
      '查询天气的工具，输入参数是城市名称，输出是一个字符串，包含城市天气信息',
    schema: z.object({
      city: z
        .string()
        .describe(
          '要查询的城市名称，例如：北京、上海、深圳，每次只能输入一个城市',
        ),
    }),
  },
);

const calculateTool = tool(
  ({ expression }: { expression: string }) => {
    const result = Function(`"return ${expression};"`)(); // 使用 Function 构造函数创建一个函数并执行
    return result.toString();
  },
  {
    name: 'calculate_expression',
    description: '计算表达式的工具，输入参数是表达式，输出是计算结果',
    schema: z.object({
      expression: z.string().describe('要计算的表达式，例如：2+3*4'),
    }),
  },
);

@Injectable()
export class ReactAgentService extends BaseLLM implements OnModuleInit {
  private reactAgentGraph!: ReturnType<typeof this.buildReactAgentGraph>;
  private tools = [queryWeatherTool, calculateTool];
  private llmWithTools = this.llm.bindTools(this.tools);
  constructor() {
    super();
  }
  onModuleInit() {
    this.reactAgentGraph = this.buildReactAgentGraph();
  }
  private buildReactAgentGraph() {
    const callModel = async (state: typeof MessagesAnnotation.State) => {
      const messages = [
        new SystemMessage(`你是专业的工具调用助手，可用工具：
- calculator：数学计算;
- get_weather：查询天气;
根据问题决定是否调用工具。`),
        ...state.messages,
      ];
      const response = await this.llmWithTools.invoke(messages);
      return {
        messages: [response],
      };
    };

    return new StateGraph(MessagesAnnotation)
      .addNode('callModel', callModel)
      .addNode('tools', new ToolNode(this.tools))
      .addEdge(START, 'callModel')
      .addConditionalEdges(
        'callModel',
        // 路由函数：检查最后一条消息是否包含 tool_calls
        (state: typeof MessagesAnnotation.State) => {
          const last = state.messages.at(-1) as AIMessage;
          return (last.tool_calls?.length ?? 0) > 0 ? 'tools' : END;
        },
        {
          tools: 'tools',
          [END]: END,
        },
      )
      .addEdge('tools', 'callModel') // 工具执行完 → 回到 LLM，形成循环
      .compile({ checkpointer: new MemorySaver() });
  }
  async chat(threadId: string, message: string) {
    const response = await this.reactAgentGraph.invoke(
      {
        messages: [new HumanMessage(message)],
      },
      { configurable: { thread_id: threadId }, recursionLimit: 10 },
    );
    return response.messages.at(-1)?.content as string;
  }
}
