import { Injectable, OnModuleInit } from '@nestjs/common';
import {
  StateGraph,
  START,
  END,
  Annotation,
  Send,
  Command,
} from '@langchain/langgraph';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { BaseLLM } from 'src/llm';

const CodeReviewState = Annotation.Root({
  code: Annotation<string>(),
  language: Annotation<string>(),
  report: Annotation<string>(),
  results: Annotation<{ aspect: string; score: number; issues: string[] }[]>({
    reducer: (pre, cur) => [...pre, ...cur],
    default: () => [],
  }),
});

const AgentReviewState = Annotation.Root({
  code: Annotation<string>(),
  language: Annotation<string>(),
  aspect: Annotation<string>(),
  prompt: Annotation<string>(),
});
@Injectable()
export class CodeReviewService extends BaseLLM implements OnModuleInit {
  private codeReviewGraph!: ReturnType<typeof this.buildCodeReviewGraph>;
  buildCodeReviewGraph() {
    const dispatchFn = (state: typeof CodeReviewState.State) => {
      const tasks = [
        {
          aspect: '安全性',
          prompt: `检查代码安全问题（SQL 注入、XSS、敏感信息泄露等）。
输出 JSON（不要其他内容）：{"issues":["问题描述"],"score":7}`,
        },
        {
          aspect: '性能',
          prompt: `检查代码性能问题（算法复杂度、N+1 查询、内存泄漏等）。
输出 JSON（不要其他内容）：{"issues":["问题描述"],"score":7}`,
        },
        {
          aspect: '代码规范',
          prompt: `检查代码规范（命名、注释、DRY 原则、错误处理等）。
输出 JSON（不要其他内容）：{"issues":["问题描述"],"score":7}`,
        },
      ];
      return new Command({
        goto: tasks.map((task) => {
          return new Send('reviewAgent', {
            ...task,
            code: state.code,
            language: state.language,
          });
        }),
      });
    };

    const reviewAgent = async (state: typeof AgentReviewState.State) => {
      const messages = [
        new SystemMessage(`
        - 角色
        你是一个代码${state.aspect}专家。
        - 要求
        ${state.prompt}
        - 规则
        issues: 问题描述；score: 代码${state.aspect}评分（0-10分）。`),
        new HumanMessage(`
          - ${state.language || 'javascript'}代码:
          \`\`\`
          ${state.code}
          \`\`\`
          `),
      ];
      const res = await this.llm.invoke(messages);
      let parsed: { issues: string[]; score: number };
      console.log(res.content, 'resss');
      try {
        const json = (res.content as string)
          .replace(/```json\n?|\n?```/g, '')
          .trim();
        parsed = JSON.parse(json);
      } catch {
        parsed = { issues: ['结果解析失败'], score: 5 };
      }
      return {
        results: [{ aspect: state.aspect, ...parsed }],
      };
    };

    const generateReport = async (state: typeof CodeReviewState.State) => {
      const { results } = state;
      const averageScore = (
        results.reduce((pre, cur) => pre + cur.score, 0) / results.length
      ).toFixed(2);
      const issues = results.reduce((issues, cur) => {
        return `${issues}[${cur.aspect}]：${cur.issues.join('；')}\n`;
      }, '');
      const messages = [
        new HumanMessage(
          `请根据下面提供的代码以及issure，进行综合分析，并生成一份代码质量分析报告。
          - ${state.language || 'javascript'}代码:
          \`\`\`
          ${state.code}
          \`\`\`
          - issure
          ${issues}
          `,
        ),
      ];
      const res = await this.llm.invoke(messages);
      return {
        report: `综合评分：${averageScore}分\n建议：${res.content}`,
      };
    };

    return new StateGraph(CodeReviewState)
      .addNode('dispatch', dispatchFn, { ends: ['reviewAgent'] })
      .addNode('reviewAgent', reviewAgent)
      .addNode('generateReport', generateReport)
      .addEdge(START, 'dispatch')
      .addEdge('reviewAgent', 'generateReport')
      .addEdge('generateReport', END)
      .compile();
  }
  onModuleInit() {
    this.codeReviewGraph = this.buildCodeReviewGraph();
  }
  async review(code: string, language?: string) {
    const response = await this.codeReviewGraph.invoke({
      code,
      language: language,
    });
    return {
      code,
      results: response.results.reduce((str, item) => {
        return `${str}【${item.aspect}】：${item.score}分；问题：${item.issues.join('；')}\n`;
      }, ''),
      report: response.report,
    };
  }
}
