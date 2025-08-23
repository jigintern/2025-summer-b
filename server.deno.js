import { serveDir } from "jsr:@std/http/file-server";
import { UUID } from "npm:uuidjs";

import newsList from "./public/data/news.json" with { type: "json" };

Deno.serve(async (req) => {
    const pathname = new URL(req.url).pathname;
    console.log(pathname);

    if (req.method === "GET" && pathname === "/thread-titles") {
        const shuffleArray = (arr) => arr.sort(() => Math.random() - Math.random());

        const shuffled = shuffleArray(newsList.titles);

        // Deno KVにアクセス
        const kv = await Deno.openKv();

        const newsUUID = UUID.generate();

        await kv.set(["newspaper", newsUUID], {
            "uuid": newsUUID,
            "enable": true,
            "createdAt": null,
        });

        // Deno KVに保存
        // 第一引数はkey, 第二引数はvalue
        // keyが既に存在する場合は、更新
        const selectedTitles = shuffled.slice(5);
        for await (const news of selectedTitles) {
            const threadUUID = UUID.generate();
            await kv.set([newsUUID, threadUUID], {
                "uuid": threadUUID,
                "title": news,
                "summary": null,
            });
        }

        // listをJSONとして返す
        return new Response(JSON.stringify(selectedTitles), {
            headers: { "Content-Type": "application/json" },
        });
    }

    // スレッド内のメッセージを要約するAPI
    if (req.method === "POST" && pathname === "/thread-summary") {
        const API_KEY = Deno.env.get("GOOGLE_API_KEY");
        const API_URL =
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

        if (!API_KEY) {
            throw new Error("GOOGLE_API_KEY is not set in environment variables.");
        }

        const requestJson = await req.json();
        const title = requestJson.title;
        const conversation = requestJson.conversation;

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
                  ${() => {
                                conversation.forEach((postData) => {
                                    return `${postData.userName}: ${postData.post}\n`;
                                });
                            }}`,
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
            const summary = data.candidates[0].content.parts[0].text;

            const threadUuid = requestJson.thredUuid;
            const index = requestJson.index;

            const kv = Deno.openKv();
            const threadData = (await kv).get([thredUuid, index]);
            await kv.set([threadUuid, index], { ...threadData, "summary": summary });
            return new Response(text, { status: 200 });
        } catch (error) {
            console.error("An error occurred:", error);
            return new Response(`An error occurred: ${error.message}`, {
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
