import { serveDir } from "jsr:@std/http/file-server";
import { UUID } from "npm:uuidjs";
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import newsList from "./public/data/news.json" with { type: "json" };
import samplePosts from "./public/data/samplePosts.json" with { type: "json" };

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

Deno.serve(async (req: Request) => {
    const pathname: string = new URL(req.url).pathname;

    if (req.method === "GET" && pathname === "/thread-titles") {
        const shuffleArray = (arr: string[]) => arr.sort(() => Math.random() - Math.random());

        const shuffled: string[] = shuffleArray(newsList.titles);

        // Deno KVにアクセス
        const kv: Deno.Kv = await Deno.openKv();

        const threadList: ThreadModel[] = [];

        let newsUUID: string = "";

        // list: 条件指定の取得
        const newspapers: Deno.KvListIterator<newspaperModel> = kv.list({
            prefix: ["newspaper"],
        });

        let enableIsTrue: boolean = true;
        for await (const newspaper of newspapers) {
            if (!newspaper.value.enable) {
                enableIsTrue = false;
                newsUUID = newspaper.value.uuid;
                break;
            }
        }
        if (!enableIsTrue) {
            const runningThreads: Deno.KvListIterator<ThreadModel> = kv.list({
                prefix: [newsUUID],
            });

            for await (const runningThread of runningThreads) {
                threadList.push(runningThread.value);
            }
        } else {
            newsUUID = UUID.generate();
            await kv.set(["newspaper", newsUUID], {
                "uuid": newsUUID,
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
                await kv.set([newsUUID, threadUUID], threadList.at(-1));
            }
        }

        // listをJSONとして返す
        return new Response(JSON.stringify(threadList), {
            headers: { "Content-Type": "application/json" },
        });
    }

    if (req.method === "GET" && pathname === "/thread-posts") {
        const threadId: string | null = new URL(req.url).searchParams.get("thread-id");

        if (!threadId) {
            return new Response("Missing thread-id parameter", { status: 400 });
        }

        const kv: Deno.Kv = await Deno.openKv();
        const postList: Deno.KvListIterator<PostModel> = await kv.list({ prefix: [threadId] });

        const threadPosts: PostModel[] = [];
        for await (const post of postList) {
            threadPosts.push(post.value);
        }

        return new Response(JSON.stringify(threadPosts), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        });
    }
    function convertToPostModel(samplePost: SamplePost): PostModel {
        return {
            ...samplePost,
            createdAt: new Date(samplePost.createdAt),
        };
    }

    function convertSamplePostsToPostModels(samplePosts: SamplePost[]): PostModel[] {
        return samplePosts.map(convertToPostModel);
    }

    // テスト会話データ作成用のAPI
    if (req.method === "GET" && pathname === "/create-posts") {
        const threadId: string | null = new URL(req.url).searchParams.get("thread-id");

        if (!threadId) {
            return new Response("Missing thread-id parameter", { status: 400 });
        }
        const kv: Deno.Kv = await Deno.openKv();

        const posts: PostModel[] = convertSamplePostsToPostModels(samplePosts);

        for (let i = 0; i < posts.length; i++) {
            await kv.set([threadId, i], posts[i]);
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
        const threadId: string = requestJson.uuid;
        const title: string = requestJson.title;

        const kv: Deno.Kv = await Deno.openKv();
        const postDataList: Deno.KvListIterator<PostModel> = await kv.list({ prefix: [threadId] });

        let postList: string = "";

        for await (const postData of postDataList) {
            postList += `${postData.value.userName}: ${postData.value.post}\n`;
        }

        const body = JSON.stringify({
            contents: [
                {
                    parts: [
                        {
                            text: `今から提示するスレッド内の会話を190~200字程度で要約してください。
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
            const index = requestJson.index;
            const selectedThread: ThreadModel = {
                "uuid": threadId,
                "title": title,
                "summary": summary,
            };

            await kv.set([threadId, index], selectedThread);
            return new Response(JSON.stringify(selectedThread), { status: 200 });
        } catch (error) {
            console.error("An error occurred:", error);
            return new Response(`An error occurred: ${error}`, {
                status: 500,
            });
        }
    }

    return serveDir(req, {
        fsRoot: "public",
        urlRoot: "",
        showDirListing: true,
        enableCors: true,
    });
});
