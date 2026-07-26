import { Injectable, OnModuleInit } from '@nestjs/common';
import {
  StateGraph,
  START,
  END,
  MessagesAnnotation,
  Annotation,
} from '@langchain/langgraph';
import {
  HumanMessage,
  SystemMessage,
  AIMessage,
} from '@langchain/core/messages';
import { BaseLLM } from 'src/llm';
import { filterRedundantString } from 'src/utils';

/**
 * 定义状态模型
 * Supervisor（调度agent）
 * 调度agent需要返回什么参数？
 * 1. nextAgent: 下一步需要调用的agent名称(必要条件)
 * 2. completedAgent: 已经调用过哪些agent(辅助决策)
 * Supervisor => agent
 * 调用agent需要返回什么参数？
 * 1. systemPrompt：每个单独的agent都有一套自己的人设
 * 2. messages：截取近4段对话历史，辅助决策
 * 3. logger: 日志追溯
 * 何时结束？
 * Supervisor决定
 *
 */
const SupervisorState = Annotation.Root({
  // 下一个需要调用的agent
  nextAgent: Annotation<string>(),
  // 已经调用过的agent
  completedAgent: Annotation<string[]>({
    reducer: (prev, curr) => [...prev, ...curr],
    default: () => [],
  }),
  messages: MessagesAnnotation.spec.messages,
});

@Injectable()
export class SupervisorService extends BaseLLM implements OnModuleInit {
  private supervisorGraph!: ReturnType<typeof this.buildSupervisorGraph>;
  constructor() {
    super({ temperature: 0 });
  }
  onModuleInit() {
    this.supervisorGraph = this.buildSupervisorGraph();
  }
  /**
   * 构建主管图（Supervisor Graph），用于调度不同的agent
   * @returns {StateGraph} 编译后的状态图
   */
  buildSupervisorGraph() {
    const supervisorNode = async (state: typeof SupervisorState.State) => {
      const messages = [
        new SystemMessage(
          `你是一个专业的agent调度专家，能分析用户输入，每次返回最合适的agent来解决问题。
以下是各个agent的介绍：
- researcher：收集信息、搜索资料；
- analyst：数据分析、逻辑推理；
- writer：撰写报告、优化表达；
- FINISH：终止信号，无合适场景可返回此。

1. 支持多轮调用，每次只返回一个agent名称。
2. ***每次只输出agent名称，不要返回其他内容。***

${state.completedAgent?.length ? `- 已调用的agent：${state.completedAgent.join('、')}` : ''}
`,
        ),
        ...state.messages,
      ];
      console.log('当前上下文', messages);
      console.log(`已调用的agent：${state.completedAgent.join('、')}`);
      const response = await this.llm.invoke(messages);
      const nextAgent = filterRedundantString(response.content as string);
      console.log(`下一步调用agent：${nextAgent}`);
      return {
        nextAgent,
        messages: nextAgent
          ? [new AIMessage(`[Supervisor] 下一步 → ${nextAgent}`)]
          : [],
      };
    };

    const agentCommonAction = (name: string, systemPrompt: string = '') => {
      return async (state: typeof SupervisorState.State) => {
        // 取第一条用户消息作为任务描述
        const userMsg = state.messages.find((m) => m.type === 'human');
        // 取最近 4 条消息作为上下文（包含其他 Agent 的输出）
        const context = state.messages
          .slice(-4)
          .map((m) => m.content)
          .join('\n');

        console.log('当前上下文：', context);
        const messages = [
          new SystemMessage(systemPrompt),
          new HumanMessage(
            `原始任务：${userMsg?.content ?? ''}\n\n当前上下文：\n${context}`,
          ),
        ];
        const response = await this.llm.invoke(messages);

        console.log(`[${name}]：${response.content}`);

        return {
          completedAgent: [name],
          messages: [new AIMessage(`[${name}]：${response.content}`)],
        };
      };
    };
    return new StateGraph(SupervisorState)
      .addNode('supervisor', supervisorNode)
      .addNode(
        'researcher',
        agentCommonAction('researcher', '你是一个专业的收集信息、搜索资料专家'),
      )
      .addNode(
        'analyst',
        agentCommonAction('analyst', '你是一个专业的数据分析、逻辑推理专家'),
      )
      .addNode(
        'writer',
        agentCommonAction('writer', '你是一个专业的撰写报告、优化表达专家'),
      )
      .addEdge(START, 'supervisor')
      .addConditionalEdges(
        'supervisor',
        (state: typeof SupervisorState.State) =>
          ['researcher', 'analyst', 'writer', 'FINISH'].includes(
            state.nextAgent,
          )
            ? state.nextAgent
            : 'FINISH',
        {
          researcher: 'researcher',
          analyst: 'analyst',
          writer: 'writer',
          FINISH: END,
        },
      )
      .addEdge('researcher', 'supervisor')
      .addEdge('analyst', 'supervisor')
      .addEdge('writer', 'supervisor')
      .compile();
  }
  async run(input: string) {
    const response = await this.supervisorGraph.invoke(
      {
        messages: [new HumanMessage(input)],
      },
      {
        recursionLimit: 10,
      },
    );
    console.log(response, 'resssss');
    const agentLog = response.messages.reduce((arr, m) => {
      if ((m.content as string)?.startsWith?.('[')) {
        return arr.concat(m.content as string);
      }
      return arr;
    }, [] as string[]);
    // 整理报告
    let finalReport = '';
    if (response.completedAgent.includes('writer')) {
      const writerOutputs = agentLog.filter((l) => l.startsWith('[writer]'));
      finalReport = writerOutputs.length
        ? writerOutputs.at(-1)!.replace('[writer] ', '')
        : (agentLog.at(-1) ?? '无输出');
    } else {
      finalReport = agentLog.at(-1) ?? '无输出';
    }

    return {
      input,
      agentLog: response.messages.reduce((arr, m) => {
        if ((m.content as string)?.startsWith?.('[')) {
          return arr.concat(m.content as string);
        }
        return arr;
      }, [] as string[]),
      completedAgent: response.completedAgent,
      finalReport,
    };
  }
}
