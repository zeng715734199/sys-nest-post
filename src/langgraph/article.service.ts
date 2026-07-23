import { Injectable, OnModuleInit } from '@nestjs/common';
import { ChatOllama } from '@langchain/ollama';
import {
  StateGraph,
  START,
  END,
  MemorySaver,
  Annotation,
} from '@langchain/langgraph';
import { SystemMessage } from '@langchain/core/messages';
import { config } from '../config';

@Injectable()
export class ArticleService implements OnModuleInit {
  private articleGraph!: ReturnType<typeof this.buildArticleGraph>;
  private llm = new ChatOllama({
    model: config.ollama.chatModel,
    baseUrl: config.ollama.baseUrl,
    temperature: 0.3, // 低温度，让工具调用决策更稳定
    think: false,
    numPredict: 1024,
  });
  buildArticleGraph() {
    const ArticleState = Annotation.Root({
      // 文章：新值覆盖旧
      article: Annotation<string>(),
      // 关键词：数组，追加
      keywords: Annotation<string[]>({
        reducer: (prev, curr) => [...prev, ...curr],
        default: () => [],
      }),
      // 摘要：新值覆盖旧
      summary: Annotation<string>(),
      // 日志：数组，追加
      log: Annotation<string[]>({
        reducer: (prev, curr) => [...prev, ...curr],
        default: () => [],
      }),
    });
    const extractKeywords = async (state: typeof ArticleState.State) => {
      const extraStartTime = Date.now();
      const { article } = state;
      const messages = [
        new SystemMessage(
          `你是一个专业的文章关键词提取助手，根据我提供的文章内容提取 5-8 个核心关键词，关键词之间必须使用英文逗号","隔开，只输出关键词不要其他内容。\n\n文章内容：${article}`,
        ),
      ];
      const response = await this.llm.invoke(messages);
      const content = ((response.content as string) || '').replaceAll(
        'assistant\n\n',
        '',
      );
      return {
        keywords: content
          .split(/[,，]/)
          .map((s) => s.trim())
          .filter(Boolean),
        log: [
          `关键词提取：${content}，耗时：[${Date.now() - extraStartTime} ms]`,
        ],
      };
    };
    const generateSummary = async (state: typeof ArticleState.State) => {
      const generateStartTime = Date.now();
      const { article, keywords } = state;
      const messages = [
        new SystemMessage(
          `你是一个专业的文章摘要生成助手。根据我提供的文章内容生成摘要，摘要长度在100-200字之间。\n\n文章内容：${article}\n\n关键词：${keywords.join(
            '、',
          )}`,
        ),
      ];
      const response = await this.llm.invoke(messages);
      const summary = ((response.content as string) || '').replaceAll(
        'assistant\n\n',
        '',
      );
      return {
        summary,
        log: [
          `摘要生成：${summary}，耗时：${Date.now() - generateStartTime} ms}`,
        ],
      };
    };
    return new StateGraph(ArticleState)
      .addNode('extractKeywords', extractKeywords)
      .addNode('generateSummary', generateSummary)
      .addEdge(START, 'extractKeywords')
      .addEdge('extractKeywords', 'generateSummary')
      .addEdge('generateSummary', END)
      .compile();
  }
  onModuleInit() {
    this.articleGraph = this.buildArticleGraph();
  }
  async process(article: string) {
    const response = await this.articleGraph.invoke({
      article,
    });
    return {
      keywords: response.keywords,
      summary: response.summary,
      log: response.log,
    };
  }
}
