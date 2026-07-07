import {Injectable, NotImplementedException} from '@nestjs/common';
import {CreatePostDto} from "./dto/create-post.dto";
import {PrismaService} from "../prisma/prisma.service";

@Injectable()
export class PostService {
    constructor(private readonly prismaService: PrismaService) {}
    async create(createPostDto: CreatePostDto) {
        // 🌟 第一步：先检查作者是否存在
        const authorExists = await this.prismaService.user.findUnique({
            where: { id: createPostDto.authorId }, // 注意这里的类型要和 DTO 以及 schema 保持一致
        });

        if (!authorExists) {
            return { code: 500, msg: `未找到 id 为 ${createPostDto.authorId} 的用户，无法为其创建文章` }
        }
        const post =  await this.prismaService.post.create({
            data: {
                title: createPostDto.title,
                content: createPostDto.content,
                published: createPostDto.published ?? false,
                authorId: createPostDto.authorId
            }
        })
        return { code: 200, msg: '成功', data: post }
    }
}
