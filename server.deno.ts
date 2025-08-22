import { serveDir } from "jsr:@std/http/file-server";
import { UUID } from "npm:uuidjs";

import newsList from "./public/news.json" with {type:"json"};

type newpapersModel = {
	"uuid": string;
	"enable": boolean;
	"createdAt": Date | null;
};

type ThreadModel = {
	"uuid": string;
	"title": string;
	"summary": string | null;
};

Deno.serve(async (req: Request) => {
	const pathname: string = new URL(req.url).pathname;

	if (req.method === "GET" && pathname === "/thread-titles") {
		const shuffleArray = (arr: string[]) =>
			arr.sort(() => Math.random() - Math.random());

		const shuffled: string[] = shuffleArray(newsList.titles);

		// Deno KVにアクセス
		const kv: Deno.Kv = await Deno.openKv();

		const objectList: ThreadModel[] = [];

		let newsUUID: string = "";

		// list: 条件指定の取得
		const newspapers: Deno.KvListIterator<newpapersModel> = kv.list({
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
				objectList.push(runningThread.value);
			}
		}

			else{
				newsUUID = UUID.generate();
				await kv.set(["newspaper", newsUUID], {
					"uuid": newsUUID,
					"enable": false,
					"createdAt": null,
				});

				// Deno KVに保存
				// 第一引数はkey, 第二引数はvalue
				// keyが既に存在する場合は、更新
				const selectedTitles: string[] = shuffled.slice(0,5);

				for await (const selectedTitle of selectedTitles) {
					const threadUUID: string = UUID.generate();
					objectList.push({
						"uuid": threadUUID,
						"title": selectedTitle,
						"summary": null,
					});
					await kv.set([newsUUID, threadUUID], objectList.at(-1));
				}
			}

		// listをJSONとして返す
		return new Response(JSON.stringify(objectList), {
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
