import { FormatDatePostModel, PostModel, ThreadModel } from "./models.ts";
import { Context } from "https://deno.land/x/hono@v4.3.11/mod.ts";
import samplePosts from "./data/samplePosts.json" with { type: "json" };

function convertToSamplePost(postModel: PostModel): FormatDatePostModel {
    const createdAt: Date = new Date(postModel.createdAt);
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

// samplePostのcreatedAtをstringからDateに変換する関数
function convertToPostModel(samplePost: FormatDatePostModel): PostModel {
    return {
        ...samplePost,
        createdAt: new Date(samplePost.createdAt),
    };
}

// samplePostsの要素をすべてconvertToPostModelに送る関数
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

    return ctx.json(threadPosts, { headers: { "Content-Type": "application/json" } });
};

const registerThreadPosts = async (ctx: Context) => {
    const newspaperId: string | undefined = ctx.req.query("newspaper-id");
    const threadIndexStr: string | undefined = ctx.req.query("index");
    const threadId: string | undefined = ctx.req.query("thread-id");
    const userName: string = ctx.req.query("user-name") ?? "名無し";
    const postContent: string | undefined = ctx.req.query("post-content");

    if (!newspaperId || !threadIndexStr) {
        return ctx.json(
            { "text": "Missing newspaper-id or index parameter", "enoughPosts": false },
            {
                status: 400,
                headers: { "Content-Type": "application/json" },
            },
        );
    }
    const threadIndex: number | null = Number(threadIndexStr);

    if (!threadId) {
        return ctx.json({ "text": "Missing thread-id parameter", "enoughPosts": false }, {
            status: 400,
            headers: { "Content-Type": "application/json" },
        });
    }
    if (!postContent) {
        return ctx.json({ "text": "Missing post-content parameter", "enoughPosts": false }, {
            status: 400,
            headers: { "Content-Type": "application/json" },
        });
    }

    const kv: Deno.Kv = await Deno.openKv();

    // const threadData: Deno.KvEntryMaybe<ThreadModel> = await kv.get([
    //     newspaperId,
    //     threadIndex,
    // ]);
    // if (!threadData.value) {
    //     throw ctx.text("thread data is not found.");
    // }

    const posts: Deno.KvListIterator<PostModel> = kv.list({ prefix: [threadId] });
    let postsLength: number = 0;
    for await (const _ of posts) postsLength++;

    const createdAt: string = new Date().toISOString();

    const post: FormatDatePostModel = { userName, post: postContent, createdAt };

    await kv.set([threadId, postsLength + 1], post);

    // 投稿数が必要に達しているか見る

    let enoughPosts: boolean = false;
    if (postsLength + 1 >= 5) {
        const threadData: Deno.KvEntryMaybe<ThreadModel> = await kv.get([
            newspaperId,
            threadIndex,
        ]);
        if (!threadData.value) {
            throw ctx.json({ "text": "thread data is not found.", "enoughPosts": false });
        }
        const newThreadData = { ...threadData.value, "enable": false };
        await kv.set([newspaperId, threadIndex], newThreadData);
        enoughPosts = true;
    }

    return ctx.json({ "text": "create successful", "enoughPosts": enoughPosts }, {
        status: 200,
        headers: { "Content-Type": "application/json" },
    });
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

export { createThreadPosts, getThreadPosts, registerThreadPosts };
