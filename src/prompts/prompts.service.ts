import { ChatPromptTemplate } from '@langchain/core/prompts';
import { ChatOllama } from '@langchain/ollama';
import { Injectable } from '@nestjs/common';
import { config } from '../config';
import { StringOutputParser } from '@langchain/core/output_parsers';

@Injectable()
export class PromptsService {
  private llm = new ChatOllama({
    model: config.ollama.chatModel,
    temperature: config.ollama.temperature,
    baseUrl: config.ollama.baseUrl,
    // 是否开启思考模式
    think: false,
    // 生成文本的最大token长度
    numPredict: 512,
  });
  async translate(text: string, targetLanguage: string) {
    // fromMessages 接受一个消息数组，每个消息数组包含两个元素，第一个是角色，第二个是消息内容，消息内容可以使用占位符，如：{text}、{targetLanguage}
    const prompt = ChatPromptTemplate.fromMessages([
      [
        'system',
        '你是一个精通多国语言的翻译专家，只输出翻译结果，帮助用户将指定文本翻译成目标语言。',
      ],
      ['human', '请将以下内容翻译成 {targetLanguage}：{text}'],
    ]);
    // pipe 把 prompt、llm 、parser 连接起来，形成一个链式调用
    // invoke({ text, targetLanguage }) 会先把用户输入的文本和目标语言替换到模板中，生成一个完整的消息
    // 然后传毒给 llm 进行处理，最后通过 StringOutputParser 解析 llm 的输出，返回翻译结果
    const chain = prompt.pipe(this.llm).pipe(new StringOutputParser());
    const answer = await chain.invoke({ text, targetLanguage });

    return {
      text,
      answer,
    };
  }
  /**
   * @description 异步总结给定文本，将其压缩至指定的最大字数内。
   * @param {string} text - 需要被总结的原始文本内容。
   * @param {number} maxWords - 总结后文本允许的最大字数。
   * @returns {Promise<{ text: string; answer: string }>} 返回一个包含原始文本和总结后文本的对象。
   */
  async summarize(text: string, maxWords: number) {
    const prompt = ChatPromptTemplate.fromTemplate(
      '请将以下内容总结成不超过 {maxWords} 个字的版本：{text}',
    );
    const chain = prompt.pipe(this.llm).pipe(new StringOutputParser());
    const answer = await chain.invoke({ text, maxWords });

    return {
      text,
      answer,
    };
  }
}
