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
    // 是否开启思考模式
    think: false,
    // 生成文本的最大token长度
    numPredict: 512,
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
  async generateBlog(keywords: string, style: string) {
    // 第一步：生成大纲
    const outlinePrompt = ChatPromptTemplate.fromMessages([
      ['system', '你是专业博客作者，只输出大纲，不要正文。'],
      [
        'human',
        '根据关键词"{keywords}"，写一篇{style}风格的博客大纲（3-5个章节）',
      ],
    ]);

    // 第二步：根据大纲生成文章
    const articlePrompt = ChatPromptTemplate.fromMessages([
      ['system', '你是专业博客作者，按照大纲写完整文章。'],
      ['human', '大纲：\n{outline}\n\n请写出完整的博客文章：'],
    ]);

    // 第三步：生成 SEO 标题
    const titlePrompt = ChatPromptTemplate.fromMessages([
      ['system', '你是 SEO 专家，只输出5个候选标题，不要其他内容。'],
      ['human', '根据以下文章，生成5个吸引点击的 SEO 标题：\n\n{article}'],
    ]);
    // 执行第一步：生成大纲
    const outlineChain = outlinePrompt.pipe(this.llm).pipe(this.parser);
    const outline = await outlineChain.invoke({ keywords, style });

    // 执行第二步：生成文章
    const articleChain = articlePrompt.pipe(this.llm).pipe(this.parser);
    const article = await articleChain.invoke({ outline });

    // 执行第三步：生成 SEO 标题
    const titleChain = titlePrompt.pipe(this.llm).pipe(this.parser);
    const titles = await titleChain.invoke({ article });

    return { keywords, style, outline, article, titles };
  }
}
