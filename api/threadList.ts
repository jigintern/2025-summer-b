import { NewspaperModel, ThreadModel } from "./models.ts";
import { UUID } from "npm:uuidjs";
import { Context } from "https://deno.land/x/hono@v4.3.11/mod.ts";
import newsList from "./data/news.json" with { type: "json" };
import kv from "./lib/kv.ts";

const shuffleArray = (arr: string[]) => arr.sort(() => Math.random() - Math.random());

const getThreadTitles = async (ctx: Context) => {
    const shuffled: string[] = shuffleArray(newsList.titles);

    const threadList: ThreadModel[] = [];

    let newspaperUUID: string = "";

    // list: 条件指定の取得
    const newspapers: Deno.KvListIterator<NewspaperModel> = kv.list({
        prefix: ["newspaper"],
    });

    let enableIsTrue: boolean = true;
    for await (const newspaper of newspapers) {
        if (!newspaper.value.enable) {
            enableIsTrue = false;
            newspaperUUID = newspaper.value.uuid;
            break;
        }
    }
    if (!enableIsTrue) {
        const runningThreads: Deno.KvListIterator<ThreadModel> = kv.list({
            prefix: [newspaperUUID],
        });

        for await (const runningThread of runningThreads) {
            threadList.push(runningThread.value);
        }
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
                "enable": true,
                "summary": null,
            });
            await kv.set([newspaperUUID, i], threadList.at(-1));
        }
    }

    // listをJSONとして返す
    return ctx.json({ "newspaperUuid": newspaperUUID, "threads": threadList }, {
        headers: { "Content-Type": "application/json" },
    });
};

export { getThreadTitles };
