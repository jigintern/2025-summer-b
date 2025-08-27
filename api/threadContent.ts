import { FormatDatePostModel, PostModel, ThreadModel } from "./models.ts";
import { Context } from "https://deno.land/x/hono@v4.3.11/mod.ts";
import samplePosts from "./data/samplePosts.json" with { type: "json" };

function convertToSamplePost(postModel: PostModel): FormatDatePostModel {
    const createdAt: Date = postModel.createdAt;
    const year: number = createdAt.getFullYear();
    const month: number = createdAt.getMonth() + 1;
    const day: number = createdAt.getDate();
    const hours: number = createdAt.getHours();
    const minutes: number = createdAt.getMinutes();
    const seconds: number = createdAt.getSeconds();

    const paddedYear: string = String(year).padStart(4, "0");
    const paddedMonth: string = String(month).padStart(2, "0");
    const paddedDay: string = String(day).padStart(2, "0");
    const paddedHours: string = String(hours).padStart(2, "0");
    const paddedMinutes: string = String(minutes).padStart(2, "0");
    const paddedSeconds: string = String(seconds).padStart(2, "0");

    const formattedDate: string =
        `${paddedYear}-${paddedMonth}-${paddedDay} ${paddedHours}:${paddedMinutes}:${paddedSeconds}`;

    return {
        ...postModel,
        createdAt: formattedDate,
    };
}

function convertToPostModel(samplePost: FormatDatePostModel): PostModel {
    return {
        ...samplePost,
        createdAt: new Date(samplePost.createdAt),
    };
}

function convertSamplePostsToPostModels(samplePosts: FormatDatePostModel[]): PostModel[] {
    return samplePosts.map(convertToPostModel);
}

const getThreadPosts = async (ctx: Context) => {
    const threadId: string | undefined = ctx.req.query("thread-id");
    if (!threadId) {
        return ctx.text("Missing thread-id parameter", 400);
    }

    const kv: Deno.Kv = await Deno.openKv();
    const postList: Deno.KvListIterator<PostModel> = await kv.list({ prefix: [threadId] });
    const threadPosts: FormatDatePostModel[] = [];
    for await (const post of postList) {
        threadPosts.push(convertToSamplePost(post.value));
    }

    return ctx.json(threadPosts);
};

const createThreadPosts = async (ctx: Context) => {
    const newspaperId: string | undefined = ctx.req.query("newspaper-id");
    const index: string | undefined = ctx.req.query("index");

    if (!newspaperId || !index) {
        return ctx.text("Missing newspaper-id or index parameter", 400);
    }

    const kv: Deno.Kv = await Deno.openKv();
    const threadData: Deno.KvEntryMaybe<ThreadModel> = await kv.get([
        newspaperId,
        Number(index),
    ]);

    if (!threadData.value) {
        return ctx.text("thread data is not found.", 404);
    }

    const newThreadData = { ...threadData.value, "title": "オイルショック" };
    await kv.set([newspaperId, index], newThreadData);

    const posts: PostModel[] = convertSamplePostsToPostModels(samplePosts as FormatDatePostModel[]);
    for (let i = 0; i < posts.length; i++) {
        await kv.set([threadData.value.uuid, i], posts[i]);
    }

    return ctx.text("create successful");
};

export { createThreadPosts, getThreadPosts };
