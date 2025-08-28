import { FormatDatePostModel, PostModel, RegisterPostModel, ThreadModel } from "./models.ts";
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
    if (postsLength + 1 >= 20) {
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

const getWebSocketThreadPosts = async (threadId: string) => {
    const kv: Deno.Kv = await Deno.openKv();
    const postList: Deno.KvListIterator<PostModel> = await kv.list({ prefix: [threadId] });
    const threadPosts: FormatDatePostModel[] = [];
    for await (const post of postList) {
        threadPosts.push(convertToSamplePost(post.value));
    }

    return threadPosts;
};

/**
@param LIMIT_POST_NUMBER - 1スレッドの投稿上限を指定する定数
*/
const LIMIT_POST_NUMBER: number = 20;

/**
 * @description スレッドの投稿件数が上限かどうかを判定し、上限ならスレッドをクローズする関数
 * @param newspaperId - 新聞データが持っているUUID
 * @param threadIndex - 新聞データ内のスレッド番号
 * @param postListLength - 投稿の数
 * @param limit_post_number - 投稿の上限数
 * @returns {bool} - 投稿数が上限に達しているかどうか（上限に達しているならtrue）
 */
const checkIsReachedTheLimit = async (
    newspaperId: string,
    threadIndex: number,
    postListLength: number,
    limit_post_number: number,
) => {
    if (postListLength >= limit_post_number) {
        const kv: Deno.Kv = await Deno.openKv();
        const threadData: Deno.KvEntryMaybe<ThreadModel> = await kv.get([
            newspaperId,
            threadIndex,
        ]);
        if (!threadData.value) {
            return null;
        }
        const newThreadData = { ...threadData.value, enable: false };
        await kv.set([newspaperId, threadIndex], newThreadData);
        return false;
    } else {
        return true;
    }
};

const postAndGetUserPost = async (
    threadId: string,
    newspaperId: string,
    threadIndex: number,
    postData: RegisterPostModel,
    ws: WebSocket,
    sockets: Set<WebSocket>,
) => {
    const userName: string = postData.userName ?? "名無し";
    const postContent: string | null = postData.post;

    if (!postContent) {
        ws.send(JSON.stringify({
            type: "error",
            message: "投稿内容が見つかりませんでした。",
        }));
        return;
    }

    const kv: Deno.Kv = await Deno.openKv();

    const threadPostList: FormatDatePostModel[] = await getWebSocketThreadPosts(threadId);
    const postsLength: number = threadPostList.length;

    const isLimit: boolean | null = await checkIsReachedTheLimit(
        newspaperId,
        threadIndex,
        postsLength,
        LIMIT_POST_NUMBER,
    );
    if (isLimit === null) {
        ws.send(JSON.stringify({ type: "error", message: "スレッドが見つかりませんでした。" }));
        return;
    } else if (isLimit) {
        ws.send(
            JSON.stringify({ type: "full", message: "スレッド内の投稿数が上限に達しています。" }),
        );
        return;
    }

    const createdAt: Date = new Date();

    const post: PostModel = {
        userName: userName,
        post: postContent,
        createdAt: createdAt,
    };
    await kv.set([threadId, postsLength], post);

    for (const socket of sockets) {
        socket.send(
            JSON.stringify({
                type: postsLength + 1 === LIMIT_POST_NUMBER ? "max_new_post" : "new_post",
                index: postsLength,
                post: convertToSamplePost(post),
            }),
        );
    }
};

export {
    createThreadPosts,
    getThreadPosts,
    getWebSocketThreadPosts,
    postAndGetUserPost,
    registerThreadPosts,
};
