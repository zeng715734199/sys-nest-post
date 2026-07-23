import { Injectable, OnModuleInit } from '@nestjs/common';
import { ChatOllama } from '@langchain/ollama';
import { StateGraph, START, END, Annotation } from '@langchain/langgraph';
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
  /**
   * 构建文章处理图，包含关键词提取和摘要生成两个主要步骤
   * @returns {StateGraph} 编译后的状态图
   */
  buildArticleGraph() {
    // 定义文章状态结构，包含文章内容、关键词、摘要和处理日志
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
    /**
     * 提取文章关键词的异步函数
     * @param {typeof ArticleState.State} state - 当前文章状态
     * @returns {Promise<{keywords: string[], log: string[]}> - 包含提取的关键词和处理日志
     */
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
    /**
     * 生成文章摘要的异步函数
     * @param state - 包含文章内容和关键词的状态对象，类型为ArticleState.State
     * @returns 返回一个包含摘要和日志信息的对象
     */
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
      // 处理响应内容，移除"assistant\n\n"前缀
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
