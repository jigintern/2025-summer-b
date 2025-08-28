import { DateStringNewspaperModel, NewspaperModel } from "./models.ts";
import { UUID } from "npm:uuidjs";
import { Context } from "https://deno.land/x/hono@v4.3.11/mod.ts";

function convertToSamplePost(date: Date): string {
    const createdAt: Date = new Date(date);
    const year: number = createdAt.getFullYear();
    const month: number = createdAt.getMonth() + 1;
    const day: number = createdAt.getDate();
    const hours: number = createdAt.getHours();
    const minutes: number = createdAt.getMinutes();
    const seconds: number = createdAt.getSeconds();

    const paddedYear: string = String(year).padStart(4, "0");
    const paddedMonth: string = String(month).padStart(2, "0");
    const paddedDay: string = String(day).padStart(2, "0");
    const paddedHours: string = String(hours).padStart(2, "0");
    const paddedMinutes: string = String(minutes).padStart(2, "0");
    const paddedSeconds: string = String(seconds).padStart(2, "0");

    const formattedDate: string =
        `${paddedYear}-${paddedMonth}-${paddedDay} ${paddedHours}:${paddedMinutes}:${paddedSeconds}`;

    return formattedDate;
}

const getNewspaperList = async (ctx: Context) => {
    // Deno KVにアクセス
    const kv: Deno.Kv = await Deno.openKv();

    // list: 条件指定の取得
    const newspapers: Deno.KvListIterator<NewspaperModel> = kv.list({
        prefix: ["newspaper"],
    });

    const newspaperList: DateStringNewspaperModel[] = [];

    for await (const newspaper of newspapers) {
        if (newspaper.value.enable) {
            if (!newspaper.value.createdAt) {
                throw ctx.json("Newspaper enable is true but createdAt is null.", 400);
            }
            newspaperList.push({
                ...newspaper.value,
                createdAt: convertToSamplePost(new Date(newspaper.value.createdAt)),
            });
        }
    }

    newspaperList.sort((a, b) =>
        (new Date(b.createdAt).getTime()) - (new Date(a.createdAt).getTime())
    );

    // listをJSONとして返す
    return ctx.json(newspaperList, {
        headers: { "Content-Type": "application/json" },
    });
};

const createNewspapersData = async (ctx: Context) => {
    // Deno KVにアクセス
    const kv: Deno.Kv = await Deno.openKv();

    let newspaperUUID: string;
    let count: number = 0;

    newspaperUUID = UUID.generate();
    await kv.set(["newspaper", newspaperUUID], {
        "uuid": newspaperUUID,
        "enable": true,
        "createdAt": new Date(new Date().getTime() + count * 60 * 1000),
    });
    count++;

    newspaperUUID = UUID.generate();
    await kv.set(["newspaper", newspaperUUID], {
        "uuid": newspaperUUID,
        "enable": true,
        "createdAt": new Date(new Date().getTime() + count * 60 * 1000),
    });
    count++;

    newspaperUUID = UUID.generate();
    await kv.set(["newspaper", newspaperUUID], {
        "uuid": newspaperUUID,
        "enable": true,
        "createdAt": new Date(new Date().getTime() + count * 60 * 1000),
    });
    count++;

    newspaperUUID = UUID.generate();
    await kv.set(["newspaper", newspaperUUID], {
        "uuid": newspaperUUID,
        "enable": true,
        "createdAt": new Date(new Date().getTime() + count * 60 * 1000),
    });
    count++;

    newspaperUUID = UUID.generate();
    await kv.set(["newspaper", newspaperUUID], {
        "uuid": newspaperUUID,
        "enable": true,
        "createdAt": new Date(new Date().getTime() + count * 60 * 1000),
    });
    count++;

    newspaperUUID = UUID.generate();
    await kv.set(["newspaper", newspaperUUID], {
        "uuid": newspaperUUID,
        "enable": true,
        "createdAt": new Date(new Date().getTime() + count * 60 * 1000),
    });
    count++;

    return ctx.text("create successful");
};
export { createNewspapersData, getNewspaperList };
