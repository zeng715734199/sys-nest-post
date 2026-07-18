import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { handleDatabaseQuery } from './tools/database.tool';
import { handleFileReader } from './tools/file.tool';
import { handleWeatherQuery } from './tools/weather.tool';
const server = new McpServer({
  name: 'Example Mcp Server',
  description: 'This is an example Mcp Server',
  version: '1.0.0',
});

// 工具1：查询数据库
server.registerTool(
  'queryDatabase',
  {
    description: 'Query the database for users based on name, role, and limit',
    inputSchema: z.object({
      name: z.string().optional().describe('The name of the user'),
      role: z
        .enum(['admin', 'user', 'guest'])
        .optional()
        .describe('The role of the user'),
      limit: z
        .number()
        .optional()
        .describe('The maximum number of users to return'),
    }),
  },
  async (args) => {
    try {
      const result = await handleDatabaseQuery(args);
      return {
        content: [
          {
            type: 'text',
            text: result,
          },
        ],
      };
    } catch (error) {
      console.log(error, 'error');
      return {
        content: [
          {
            type: 'text',
            text: 'Error occurred while querying the database',
          },
        ],
      };
    }
  },
);


// 工具2： 读取文件的工具
server.registerTool('readFile', {
  description: 'Read the contents of a file given its path',
  inputSchema: z.object({
    filePath: z.string().describe('The path to the file to read'),
  }),
}, async (args) => {
  try {
    const fileContent = await handleFileReader(args.filePath);
    return {
      content: [
        {
          type: 'text',
          text: fileContent,
        },
      ],
    }
  } catch (error) {
    console.error('读取文件失败：', error);
    return {
      content: [
        {
          type: 'text',
          text: `Error occurred while reading the file: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
    };
  }
})


// 工具3：查询天气
server.registerTool('queryWeather', {
  description: 'Query the weather for a given location',
  inputSchema: z.object({
    location: z.string().describe('The location to query the weather for'),
  }),
}, async (args) => {
  try {
    const result = await handleWeatherQuery(args);
    return {
      content: [
        {
          type: 'text',
          text: result,
        },
      ],
    }
  } catch (error) {
    console.log('查询天气失败：', error);
    return {
      content: [
        {
          type: 'text',
          text: `Error occurred while querying the weather: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
    };
  }
})


async function startServer() {
  try {
    const transport = new StdioServerTransport();
    // 工具函数注册在server上，在server启动后，可以通过server调用工具函数
    await server.connect(transport);
    console.log('Mcp Server is running on port 3000')
  } catch (error) {
    console.error('Failed to start the server:', error);
  }
}
startServer();
