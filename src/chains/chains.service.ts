import { Injectable } from '@nestjs/common';
import { ChatOllama } from '@langchain/ollama';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import {
  RunnableSequence,
  RunnablePassthrough,
} from '@langchain/core/runnables';
import { config } from '../config';
@Injectable()
export class ChainsService {
  private llm = new ChatOllama({
    model: config.ollama.chatModel,
    baseUrl: config.ollama.baseUrl,
    temperature: config.ollama.temperature,
  });

  private parser = new StringOutputParser();
  /**
   *
   * 用 Chain（LCEL 语法）：
   * const chain = prompt1 | llm | parser | prompt2 | llm | parser
   * const result = await chain.invoke({ article })
   * 用 pipe（|）把步骤串联，自动传递数据
   */
  async polishArticle(article: string) {
    // 第一步：分析文章问题
    const analyzePrompt = ChatPromptTemplate.fromMessages([
      ['system', '你是专业编辑，只输出问题列表，不要其他内容。'],
      ['human', '分析这篇文章存在哪些问题：\n\n{article}'],
    ]);

    // 第二步：根据问题列表润色文章
    const polishPrompt = ChatPromptTemplate.fromMessages([
      ['system', '你是专业编辑，根据问题列表润色原文，保持原意。'],
      [
        'human',
        '原文：\n{article}\n\n问题列表：\n{issues}\n\n请输出润色后的文章：',
      ],
    ]);

    // 第一条链：article → 分析问题 → issues 字符串
    const analyzeChain = analyzePrompt.pipe(this.llm).pipe(this.parser);

    // 第二条链：{ article, issues } → 润色文章 → 最终文章
    const polishChain = polishPrompt.pipe(this.llm).pipe(this.parser);

    // RunnableSequence：把多个步骤组合成一个完整链
    const fullChain = RunnableSequence.from([
      // 步骤一：同时保留原文，并调用分析链得到 issues
      {
        // RunnablePassthrough 直接透传输入值，不做任何处理
        article: new RunnablePassthrough(),
        issues: analyzeChain,
      },
      // 步骤二：把 { article, issues } 传给润色链
      polishChain,
    ]);

    // invoke 传入原始文章，链自动完成所有步骤
    const result = await fullChain.invoke({ article });
    return { original: article, polished: result };
  }
}
