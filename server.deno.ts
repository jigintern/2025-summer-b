import { serveDir } from "jsr:@std/http/file-server";
import { UUID } from "npm:uuidjs";
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import newsList from "./api/data/news.json" with { type: "json" };
import samplePosts from "./api/data/samplePosts.json" with { type: "json" };

type newspaperModel = {
    "uuid": string;
    "enable": boolean;
    "createdAt": Date | null;
};

type ThreadModel = {
    "uuid": string;
    "title": string;
    "summary": string | null;
};

type PostModel = {
    userName: string;
    post: string;
    createdAt: Date;
};

type SamplePost = {
    userName: string;
    post: string;
    createdAt: string;
};

type ThreadData = {
    title: string;
    summary: string | null;
};

Deno.serve(async (req: Request) => {
    const pathname: string = new URL(req.url).pathname;
    const params: URLSearchParams = new URL(req.url).searchParams;

    // 掲示板一覧を取得するAPI
    if (req.method === "GET" && pathname === "/thread-titles") {
        const shuffleArray = (arr: string[]) => arr.sort(() => Math.random() - Math.random());

        const shuffled: string[] = shuffleArray(newsList.titles);

        // Deno KVにアクセス
        const kv: Deno.Kv = await Deno.openKv();

        const threadList: ThreadModel[] = [];

        let newspaperUUID: string = "";

        // list: 条件指定の取得
        const newspapers: Deno.KvListIterator<newspaperModel> = kv.list({ prefix: ["newspaper"] });

        let enableIsTrue: boolean = true;
        for await (const newspaper of newspapers) {
            if (!newspaper.value.enable) {
                enableIsTrue = false;
                newspaperUUID = newspaper.value.uuid;
                break;
            }
        }
        if (!enableIsTrue) {
            /*
             * 開いててまだ新聞ができてないスレッド
             */
            const runningThreads: Deno.KvListIterator<ThreadModel> = kv.list({
                prefix: [newspaperUUID],
            });

            for await (const runningThread of runningThreads) threadList.push(runningThread.value);
        } else {
            newspaperUUID = UUID.generate();
            await kv.set(["newspaper", newspaperUUID], {
                "uuid": newspaperUUID,
                "enable": false,
                "createdAt": null,
            });

            // Deno KVに保存
            // 第一引数はkey, 第二引数はvalue
            // keyが既に存在する場合は、更新
            const selectedTitles: string[] = shuffled.slice(0, 5);

            for (let i = 0; i < selectedTitles.length; i++) {
                const threadUUID: string = UUID.generate();
                threadList.push({
                    "uuid": threadUUID,
                    "title": selectedTitles[i],
                    "summary": null,
                });
                await kv.set([newspaperUUID, i], threadList.at(-1));
            }
        }

        // listをJSONとして返す
        return new Response(
            JSON.stringify({ "newspaperUuid": newspaperUUID, "threads": threadList }),
            { headers: { "Content-Type": "application/json" } },
        );
    }

    // postModelのcreatedAtをDateからstringに変換する関数
    function convertToSamplePost(postModel: PostModel): SamplePost {
        const createdAt: Date = new Date(postModel.createdAt); // 例: 2025-08-21T10:00:00.000Z
        const year: number = createdAt.getFullYear(); // 年を取得
        const month: number = createdAt.getMonth() + 1; // 月は0から始まるので1を足す
        const day: number = createdAt.getDate(); // 日を取得
        const hours: number = createdAt.getHours(); // 時を取得
        const minutes: number = createdAt.getMinutes(); // 分を取得
        const seconds: number = createdAt.getSeconds(); // 秒を取得

        // ゼロ埋め処理
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

    // 掲示板の投稿を取得するAPI
    if (req.method === "GET" && pathname === "/thread-posts") {
        const newspaperId: string | null = params.get("newspaper-id");
        const threadIndexStr: string | null = params.get("index");

        if (!newspaperId || !threadIndexStr) {
            return new Response("Missing newspaper-id parameter", { status: 400 });
        }

        const threadIndex: number | null = Number(threadIndexStr);

        const kv: Deno.Kv = await Deno.openKv();

        const threadData: Deno.KvEntryMaybe<ThreadModel> = await kv.get([
            newspaperId,
            threadIndex,
        ]);
        if (!threadData.value) {
            throw new Error("thread data is not found.");
        }

        const posts: Deno.KvListIterator<PostModel> = kv.list({ prefix: [threadData.value.uuid] });
        const threadPosts: SamplePost[] = [];
        for await (const post of posts) {
            threadPosts.push(convertToSamplePost(post.value));
        }

        return new Response(JSON.stringify(threadPosts), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        });
    }

    // samplePostのcreatedAtをstringからDateに変換する関数
    function convertToPostModel(samplePost: SamplePost): PostModel {
        return {
            ...samplePost,
            createdAt: new Date(samplePost.createdAt),
        };
    }

    // samplePostsの要素をすべてconvertToPostModelに送る関数
    function convertSamplePostsToPostModels(samplePosts: SamplePost[]): PostModel[] {
        return samplePosts.map(convertToPostModel);
    }

    // 新しい投稿を作成するのAPI
    if (req.method === "GET" && pathname === "/new-posts") {
        const newspaperId: string | null = new URL(req.url).searchParams.get("newspaper-id");
        const threadIndexStr: string | null = new URL(req.url).searchParams.get("index");
        const userName: string = params.get("user-name") ?? "名無し";
        const postContent: string | null = params.get("post-content");

        // const threadId: string | null = new URL(req.url).searchParams.get("thread-id");

        if (!newspaperId || !threadIndexStr) {
            return new Response("Missing newspaper-id or index parameter", { status: 400 });
        }
        if (!postContent) {
            return new Response("Missing post-content parameter", { status: 400 });
        }

        const threadIndex: number | null = Number(threadIndexStr);

        const kv: Deno.Kv = await Deno.openKv();

        const threadData: Deno.KvEntryMaybe<ThreadModel> = await kv.get([
            newspaperId,
            threadIndex,
        ]);
        if (!threadData.value) {
            throw new Error("thread data is not found.");
        }

        const posts: Deno.KvListIterator<PostModel> = kv.list({ prefix: [threadData.value.uuid] });
        let postsLength: number = 0;
        for await (const _ of posts) postsLength++;

        const createdAt: string = new Date().toISOString();

        const post: SamplePost = { userName, post: postContent, createdAt };

        await kv.set([threadData.value.uuid, postsLength + 1], post);

        return new Response("create successful", {
            status: 200,
            headers: { "Content-Type": "application/json" },
        });
    }

    // テスト会話データ作成用のAPI
    if (req.method === "GET" && pathname === "/create-posts") {
        const newspaperId: string | null = new URL(req.url).searchParams.get("newspaper-id");
        const index: string | null = new URL(req.url).searchParams.get("index");

        // const threadId: string | null = new URL(req.url).searchParams.get("thread-id");

        if (!newspaperId || !index) {
            return new Response("Missing newspaper-id or index parameter", { status: 400 });
        }
        const kv: Deno.Kv = await Deno.openKv();

        const threadData: Deno.KvEntryMaybe<ThreadModel> = await kv.get([
            newspaperId,
            Number(index),
        ]);
        if (!threadData.value) {
            throw new Error("thread data is not found.");
        }
        const newThreadData = { ...threadData.value, "title": "オイルショック" };
        await kv.set([newspaperId, index], newThreadData);

        const posts: PostModel[] = convertSamplePostsToPostModels(samplePosts as SamplePost[]);

        for (let i = 0; i < posts.length; i++) {
            await kv.set([threadData.value.uuid, i], posts[i]);
        }

        return new Response("create successful", {
            status: 200,
            headers: { "Content-Type": "application/json" },
        });
    }

    // スレッド内のメッセージを要約するAPI
    if (req.method === "POST" && pathname === "/thread-summary") {
        const API_KEY: string | undefined = Deno.env.get("GOOGLE_API_KEY");
        const API_URL: string =
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

        if (!API_KEY) {
            throw new Error("GOOGLE_API_KEY is not set in environment variables.");
        }

        const requestJson = await req.json();
        const newspaperId: string = requestJson.uuid;
        const index = requestJson.index;

        const kv: Deno.Kv = await Deno.openKv();
        const threadData: Deno.KvEntryMaybe<ThreadModel> = await kv.get([newspaperId, index]);
        if (!threadData.value) {
            throw new Error("thread data is not found.");
        }
        const threadId: string = threadData.value.uuid;
        const title: string = threadData.value.title;
        const postDataList: Deno.KvListIterator<PostModel> = kv.list({ prefix: [threadId] });

        let postList: string = "";

        for await (const postData of postDataList) {
            postList += `${postData.value.userName}: ${postData.value.post}\n`;
        }

        const body = JSON.stringify({
            contents: [
                {
                    parts: [
                        {
                            text:
                                `今から提示するスレッド内の会話を300字の誤差10文字以内で要約してください。
                  要約するときの文章は、新聞と同じような構成でお願いします。
                  見出しは不要なので、本文のみを生成してください。
                  記事に改行は含まないでください。
                  "名無し"は名前が存在しない人の名前です。

                  ## 記事見出し: ${title}
                  ${postList}`,
                        },
                    ],
                },
            ],
        });

        try {
            const response = await fetch(`${API_URL}?key=${API_KEY}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: body,
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(
                    `API request failed: ${response.status} ${response.statusText} - ${
                        JSON.stringify(errorData)
                    }`,
                );
            }

            const data = await response.json();
            const summary: string = data.candidates[0].content.parts[0].text;
            const selectedThread: ThreadModel = {
                "uuid": threadId,
                "title": title,
                "summary": summary,
            };

            await kv.set([newspaperId, index], selectedThread);
            return new Response(JSON.stringify(selectedThread), { status: 200 });
        } catch (error) {
            console.error("An error occurred:", error);
            return new Response(`An error occurred: ${error}`, {
                status: 500,
            });
        }
    }

    // 要約を取得するAPI
    if (req.method === "GET" && pathname === "/get-summary") {
        const newspaperId: string | null = new URL(req.url).searchParams.get("newspaper-id");

        if (!newspaperId) {
            return new Response("Missing newspaper-id parameter", { status: 400 });
        }
        console.log("newspaperId", newspaperId);

        const kv: Deno.Kv = await Deno.openKv();
        const threads: Deno.KvListIterator<ThreadModel> = kv.list<ThreadModel>({
            prefix: [
                newspaperId,
            ],
        });

        const titleAndSummaryList: ThreadData[] = [];

        console.log("threads");
        for await (const thread of threads) {
            if (!thread.value) {
                return new Response("threads not found", { status: 404 });
            }
            titleAndSummaryList.push({
                "title": thread.value.title,
                "summary": thread.value.summary,
            });
            console.log(titleAndSummaryList);
        }

        return new Response(JSON.stringify(titleAndSummaryList), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        });
    }

    return serveDir(req, {
        fsRoot: "public",
        urlRoot: "",
        showDirListing: true,
        enableCors: true,
    });
});
