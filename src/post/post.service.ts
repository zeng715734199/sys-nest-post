import { Injectable } from '@nestjs/common';
import {CreatePostDto} from "./dto/create-post.dto";
import {PrismaService} from "../prisma/prisma.service";

@Injectable()
export class PostService {
    constructor(private readonly prismaService: PrismaService) {}
    async create(createPostDto: CreatePostDto) {
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
