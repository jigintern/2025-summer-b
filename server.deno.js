import { serveDir } from "jsr:@std/http/file-server";
import newsList from "./public/news.json" with {type:"json"};

Deno.serve(async (req) => {
	const pathname = new URL(req.url).pathname;

	if (req.method === "GET" && pathname === "/thread-titles") {
		const shuffleArray = (arr) =>
			arr.sort(() => Math.random() - Math.random());

		const shuffled = shuffleArray(newsList.titles);

		// listをJSONとして返す
		return new Response(JSON.stringify([...shuffled].slice(5)), {
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
