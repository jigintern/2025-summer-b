import { NewspaperModel } from "./models.ts";
import { Context } from "https://deno.land/x/hono@v4.3.11/mod.ts";

const getNewspaperList = async (ctx: Context) => {
    // Deno KVにアクセス
    const kv: Deno.Kv = await Deno.openKv();

    // list: 条件指定の取得
    const newspapers: Deno.KvListIterator<NewspaperModel> = kv.list({
        prefix: ["newspaper"],
    });

    const newspaperList: Date[] = [];

    for await (const newspaper of newspapers) {
        if (newspaper.value.enable) {
            if (!newspaper.value.createdAt) {
                throw ctx.json("Newspaper enable is true but createdAt is null.", 400);
            }
            newspaperList.push(newspaper.value.createdAt);
        }
    }

    // listをJSONとして返す
    return ctx.json(newspaperList, {
        headers: { "Content-Type": "application/json" },
    });
};

export { getNewspaperList };
