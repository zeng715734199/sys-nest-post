import {Injectable} from '@nestjs/common';
import {CreatePostDto} from "./dto/create-post.dto";
import {PrismaService} from "../prisma/prisma.service";
import {PostFindManyArgs} from "../generated/prisma/models/Post";
import {UpdatePostDto} from "./dto/update-post.dto";

@Injectable()
export class PostService {
    constructor(private readonly prismaService: PrismaService) {}
    // 添加文章
    async create(createPostDto: CreatePostDto) {
        // 🌟 第一步：先检查作者是否存在
        const authorExists = await this.prismaService.user.findUnique({
            where: { id: createPostDto.authorId }, // 注意这里的类型要和 DTO 以及 schema 保持一致
        });

        if (!authorExists) {
            return { success: false, msg: `未找到 id 为 ${createPostDto.authorId} 的用户，无法为其创建文章` }
        }
        const post =  await this.prismaService.post.create({
            data: {
                title: createPostDto.title,
                content: createPostDto.content,
                published: createPostDto.published ?? false,
                author: { connect: { id: createPostDto.authorId } },
            },
            include: {
                author: { select: { id: true, name: true, email: true, role: true } }
            }
        })
        return { success: true, data: post }
    }
    // 删除文章
    async delete(id: number) {
        const isExists = await this.prismaService.post.findUnique({
            where: { id },
        });
        if (!isExists) {
            return { success: false, msg: `未找到 id 为 ${id} 的文章` }
        }
        try {
            const data = await this.prismaService.post.delete({
                where: { id },
            })
            return { success: true, msg: `文章id: ${id}, 已删除`, data }
        } catch {
            return { success: true, msg: `删除失败`}
        }
    }
    // 更新文章
    async update(id: number, updatePostDto: UpdatePostDto) {
        const isExists = await this.prismaService.post.findUnique({
            where: { id },
        });
        if (!isExists) {
            return { success: false, msg: `未找到 id 为 ${id} 的文章` }
        }
        const data = await this.prismaService.post.update({
            where: { id },
            data: {
                title: updatePostDto.title,
                content: updatePostDto.content,
                published: updatePostDto.published ?? false,
            },
            include: {
                author: { select: { id: true, name: true, email: true, role: true } }
            }
        })
        return { success: true, msg: `文章id: ${id}, 已更新`, data }
    }
    async togglePublish(id: number) {
        const post = await this.prismaService.post.findUnique({
            where: { id },
        });
        if (!post) {
            return { success: false, msg: `未找到 id 为 ${id} 的文章` }
        }
        const { published } = post;
        const data = await this.prismaService.post.update({
            where: { id },
            data: { published: !published },
            include: {
                author: { select: { id: true, name: true, email: true, role: true } }
            }
        })
        const { published: published1 } = data;
        return { success: true, msg: `文章id: ${id}, ${published1 ? '文章已发布' : '文章已取消发布'}`, data }
    }
    async findAll(published?: boolean){
        const posts = await this.prismaService.post.findMany({
            where: published !== undefined ? { published } : {},
            include: {
                author: { select: { id: true, name: true, email: true } },
            },
            orderBy: { createdAt: 'desc' }
        } as PostFindManyArgs)
        return { total: posts.length, list: posts }
    }
    async findOne(id: number) {
       const post = await this.prismaService.post.findUnique({
            where: { id },
            include: {
                author: { select: { id: true, name: true, email: true, role: true } }
            }
        })
        if(!post) {
            return { success: false, msg: `未找到 id 为 ${id} 的文章` }
        }
        return { success: true, data: post }
    }
    async findByAuthor(authorId: number) {
        const data = await this.prismaService.post.findMany({
            where: { authorId },
            orderBy: { createdAt: 'desc'}
        } as PostFindManyArgs)
        return { total: data.length, list: data }
    }
}
