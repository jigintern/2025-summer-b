import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { PostModel, ThreadModel } from "./models.ts";
import { Context } from "https://deno.land/x/hono@v4.3.11/mod.ts";

const createThreadSummary = async (ctx: Context) => {
    const API_KEY: string | undefined = Deno.env.get("GOOGLE_API_KEY");
    const API_URL: string =
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

    if (!API_KEY) {
        return ctx.text("GOOGLE_API_KEY is not set in environment variables.", 500);
    }

    const requestJson = await ctx.req.json();
    const newspaperId: string = requestJson.uuid;
    const index: number = requestJson.index;

    const kv: Deno.Kv = await Deno.openKv();
    const threadData: Deno.KvEntryMaybe<ThreadModel> = await kv.get([newspaperId, index]);

    if (!threadData.value) {
        return ctx.text("thread data is not found.", 404);
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
        return ctx.json(selectedThread);
    } catch (error) {
        console.error("An error occurred:", error);
        return ctx.text(`An error occurred: ${error}`, 500);
    }
};

export { createThreadSummary };
