import { serveDir } from "jsr:@std/http/file-server";
import { UUID } from "npm:uuidjs";

import newsList from "./public/news.json" with {type:"json"};

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

		const newsUUID: string = UUID.generate();

		await kv.set(["newspaper", newsUUID], {
			"uuid": newsUUID,
			"enable": true,
			"createdAt": null,
		});

		const objectList: ThreadModel[] = [];

		// Deno KVに保存
		// 第一引数はkey, 第二引数はvalue
		// keyが既に存在する場合は、更新
		const selectedTitles: string[] = shuffled.slice(5);
		for await (const news of selectedTitles) {
			const threadUUID: string = UUID.generate();
			objectList.push({
				"uuid": threadUUID,
				"title": news,
				"summary": null,
			});
			await kv.set([newsUUID, threadUUID], objectList.at(-1));
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
