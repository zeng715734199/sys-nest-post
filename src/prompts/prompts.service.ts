import {
  ChatPromptTemplate,
  FewShotPromptTemplate,
  PromptTemplate,
} from '@langchain/core/prompts';
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
  /**
   * 对输入的文本进行情感分类的方法
   * @param text - 需要进行情感分类的文本内容
   * @returns 返回一个包含原始文本和分类结果的对象
   */
  async classify(text: string) {
    // 定义示例数据，包含输入文本及其对应的情感标签
    const examples = [
      { input: '真倒霉，出门没带伞淋雨了', label: '消极' },
      { input: '今天天气很好，风和日丽', label: '积极' },
      { input: '这个产品质量一般，不太满意', label: '消极' },
      { input: '这个产品很好用，推荐给大家', label: '积极' },
      { input: '这个电影还行，有些地方不错', label: '中性' },
      { input: '这道菜还可以，不难吃', label: '中性' },
    ];
    // 创建示例提示模板，用于格式化示例输入和输出
    const examplePrompt = PromptTemplate.fromTemplate(
      '输入 {input}，输出 {label}',
    );
    // 创建少样本提示模板，用于构建完整的提示
    const fewShotPrompt = new FewShotPromptTemplate({
      examples, // 使用上面定义的示例数据
      examplePrompt, // 使用上面创建的示例提示模板
      prefix: '请根据输入文本内容进行情感分类，输出为积极、消极或中性；', // 添加前缀说明任务
      suffix: '输入：{text} \n输出', // 添加后缀，待填充的输入文本
      inputVariables: ['text'], // 定义输入变量
    });
    const formattedPrompt = await fewShotPrompt.format({ text });
    const res = await this.llm.invoke(formattedPrompt);
    /**
     *    // TODO 使用处理链的写法：
     *    // 创建处理链：少样本提示 -> 语言模型 -> 字符串输出解析器
     *    const chain = fewShotPrompt.pipe(this.llm).pipe(new StringOutputParser());
     *    // 调用处理链，传入待分类的文本，获取分类结果
     *    const answer = await chain.invoke({ text });
     */

    // 返回包含原始文本和分类结果的对象
    return {
      text,
      answer: res.content,
    };
  }
}
