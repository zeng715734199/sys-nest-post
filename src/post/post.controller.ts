import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { PostService } from './post.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';

@Controller('post')
export class PostController {
  constructor(private readonly postService: PostService) {}
  // 增
  @Post('create')
  create(@Body() createPostDto: CreatePostDto) {
    return this.postService.create(createPostDto);
  }
  // 删
  @Delete('delete/:id')
  delete(@Param('id', ParseIntPipe) id: number) {
    return this.postService.delete(id);
  }
  // 改
  @Put('update/:id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updatePostDto: UpdatePostDto,
  ) {
    return this.postService.update(id, updatePostDto);
  }
  @Patch('publish/:id')
  publish(@Param('id', ParseIntPipe) id: number) {
    return this.postService.togglePublish(id);
  }
  // 查
  @Get('list')
  findAll(@Query('published') published?: string) {
    // 显式声明类型，并兼容 undefined 的情况
    const filterMap: Record<string, boolean> = { true: true, false: false };
    const filter = published ? filterMap[published] : undefined;
    return this.postService.findAll(filter);
  }
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.postService.findOne(id);
  }
  @Get('author/:authorId')
  findByAuthor(@Param('authorId', ParseIntPipe) id: number) {
    return this.postService.findByAuthor(id);
  }
}
