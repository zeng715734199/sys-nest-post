import { Injectable, OnModuleInit } from '@nestjs/common';
import {
  StateGraph,
  START,
  END,
  Annotation,
  Send,
  Command,
} from '@langchain/langgraph';
import { HumanMessage } from '@langchain/core/messages';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { BaseLLM } from 'src/llm';

const ParallelTaskState = Annotation.Root({
  // 输入
  task: Annotation<string>(),
  // 子任务处理结果
  results: Annotation<{ task: string; result: string }[]>({
    reducer: (pre, cur) => [...pre, ...cur],
    default: () => [],
  }),
  // 报告
  report: Annotation<string>(),
});

const ChildTaskState = Annotation.Root({
  task: Annotation<string>(),
});

@Injectable()
export class ParallelService extends BaseLLM implements OnModuleInit {
  private parallelTaskGraph!: ReturnType<typeof this.buildTaskGraph>;
  private handleOutput(prompt: ChatPromptTemplate) {
    return prompt
      .pipe(this.llm)
      .pipe(new StringOutputParser())
      .pipe((text: string) =>
        text.replace(/^(assistant|ai|system|user)[:\s\n]*/i, '').trim(),
      );
  }
  constructor() {
    super({ temperature: 0 });
  }

  onModuleInit() {
    this.parallelTaskGraph = this.buildTaskGraph();
  }
  buildTaskGraph() {
    const splitTask = async (state: typeof ParallelTaskState.State) => {
      const prompt = ChatPromptTemplate.fromMessages([
        [
          'system',
          `
- 角色
你是一个专业的任务拆分专家。
- 描述
把用户输入的任务拆分成 3 个子任务，每个子任务独占一行，使用换行符"\n"分隔开。
如：1. xxx\n2. xxx\n3. xxx。
***除了子任务内容外，不要输出其他内容！***
- 输入任务
{task}`,
        ],
      ]);
      const chain = this.handleOutput(prompt);
      const childTaskStr = await chain.invoke({ task: state.task });
      console.log('生成子任务：', childTaskStr);
      const childTasks = childTaskStr
        .split('\n')
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 3);

      return new Command({
        goto: childTasks.map((task) => new Send('processSubTask', { task })),
      });
    };

    const processSubTask = async (state: typeof ChildTaskState.State) => {
      const prompt = ChatPromptTemplate.fromMessages([
        [
          'system',
          `
- 角色
你是一个专业的任务处理专家。
- 技能
能处理用户输入的任务，并返回处理结果。***只需要返回处理结果即可，不要输出其他内容。***
- 输入任务
{task}`,
        ],
      ]);
      const chain = this.handleOutput(prompt);
      const result = await chain.invoke({ task: state.task });
      console.log(`子任务: ${state.task}； 处理结果：`, result);
      // 接受子任务的数据，返回的时候主任务的数据
      return {
        results: [{ task: state.task, result }],
      };
    };

    const mergeResults = async (state: typeof ParallelTaskState.State) => {
      const text = state.results
        .map((r, i) => `${i + 1}. 子任务：${r.task}；结果：${r.result}`)
        .join('\n\n');
      const res = await this.llm.invoke([
        new HumanMessage(
          `根据以下子任务结果，生成 200 字综合报告：\n\n${text}`,
        ),
      ]);
      return {
        report: res.content,
      };
    };
    /**
        START → splitTask ──Send──→ processSubTask（实例1）─┐
                          ──Send──→ processSubTask（实例2）─┤→ mergeResults → END
                          ──Send──→ processSubTask（实例3）─┘

        执行说明：
        splitTask：LLM 把大任务拆成 3 个子任务，返回 Send 数组。3 个 processSubTask 实例同时并行执行，全部完成后结果通过 reducer 合并到主图 State。
        mergeResults：汇总所有子任务结果，生成综合报告。
    */
    return new StateGraph(ParallelTaskState)
      .addNode('splitTask', splitTask, { ends: ['processSubTask'] })
      .addNode('processSubTask', processSubTask, { ends: ['mergeResults'] })
      .addNode('mergeResults', mergeResults)
      .addEdge(START, 'splitTask')
      .addEdge('processSubTask', 'mergeResults')
      .addEdge('mergeResults', END)
      .compile();
  }
  async run(task: string) {
    const t0 = Date.now();
    const result = await this.parallelTaskGraph.invoke({ task });
    console.log('总耗时：', (Date.now() - t0) / 1000, '秒');
    return {
      subTasks: result.results.map(
        (r: { task: string; result: string }) => r.task,
      ),
      results: result.results,
      report: result.report,
      totalTime: `${(Date.now() - t0) / 1000} s`,
    };
  }
}
