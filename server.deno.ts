import { serveDir } from "jsr:@std/http/file-server";
import { UUID } from "npm:uuidjs";

import newsList from "./public/data/news.json" with {type:"json"};
import samplePosts from "./public/data/samplePosts.json" with {type: "json"};

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
}

Deno.serve(async (req: Request) => {
	const pathname: string = new URL(req.url).pathname;

	if (req.method === "GET" && pathname === "/thread-titles") {
		const shuffleArray = (arr: string[]) =>
			arr.sort(() => Math.random() - Math.random());

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

		const threadPosts: PostModel[]  = []
		for await(const post of postList) {
			threadPosts.push(post.value);
		}

		return new Response(JSON.stringify(threadPosts), {
        status: 200,
        headers: { "Content-Type": "application/json" },
    });
    }

	// テスト会話データ作成用のAPI
	if (req.method === "GET" && pathname === "/create-posts") {
		const threadId: string | null = new URL(req.url).searchParams.get("thread-id");

		if (!threadId) {
            return new Response("Missing thread-id parameter", { status: 400 });
        }
		const kv: Deno.Kv = await Deno.openKv();

		const posts: PostModel[] = <PostModel[]>samplePosts;

		for (let i = 0; i < posts.length; i++){
			await kv.set([threadId, i], {posts});
		}

		return new Response("create successful", {
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
