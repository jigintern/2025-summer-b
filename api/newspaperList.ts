import { NewspaperModel } from "./models.ts";
import { Context } from "https://deno.land/x/hono@v4.3.11/mod.ts";

const getThreadTitles = async (ctx: Context) => {
    // Deno KVにアクセス
    const kv: Deno.Kv = await Deno.openKv();

    // list: 条件指定の取得
    const newspapers: Deno.KvListIterator<NewspaperModel> = kv.list({
        prefix: ["newspaper"],
    });

    const newspaperList: NewspaperModel[] = [];

    for await (const newspaper of newspapers) {
        if (newspaper.value.enable) {
            newspaperList.push(newspaper.value);
        }
    }

    // listをJSONとして返す
    return ctx.json(newspaperList, {
        headers: { "Content-Type": "application/json" },
    });
};

export { getThreadTitles };
