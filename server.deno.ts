import { Hono } from "https://deno.land/x/hono@v4.3.11/mod.ts";
import { logger, serveStatic } from "https://deno.land/x/hono@v4.3.11/middleware.ts";
import { getThreadTitles } from "./api/threadList.ts";
import { createThreadPosts, getThreadPosts, registerThreadPosts } from "./api/threadContent.ts";
import { createNewspapersData, getNewspaperList } from "./api/newspaperList.ts";
import {
    createThreadSummary,
    generateSummary,
    getThreadSummaryList,
} from "./api/newspaperContent.ts";
import { websocketPost } from "./api/websocket.ts";
import kv from "./api/lib/kv.ts";

const app = new Hono();

app.use(logger());

/**
@description スレッドのタイトル一覧を取得するAPI
 */
app.get("/thread-titles", getThreadTitles);

/**
 * 新聞の生成時間一覧を取得するAPI
 */
app.get("/newspaper-list", getNewspaperList);

/**
@description スレッドの投稿一覧を取得するAPI
@param thread-id - スレッドが持っているUUID
 */
app.get("/thread-posts", getThreadPosts);

/**
@description 新しい投稿を作成するAPI
@param thread-id - スレッドが持っているUUID
@param user-id - 投稿するユーザの名前
@param post-content - 投稿内容
 */
app.get("/new-posts", registerThreadPosts);

/**
@description テスト用のダミー投稿データを作成するAPI
@param newspaper-id - 新聞が持っているUUID
@param index - ダミー投稿を作成したいスレッドの新聞内のスレッド番号(リストの順番)(0 ~ 4)
 */
app.get("/create-posts", createThreadPosts);

/**
@description スレッドの投稿内容を新聞の記事風に要約生成するAPI
@param newspaperId - 新聞が持っているUUID
@param index - 投稿要約を作成したいスレッドの新聞内のスレッド番号(リストの順番)(0 ~ 4)
 */
app.post("/thread-summary", createThreadSummary);

/**
@description 新聞描画用のスレッドの要約を取得するAPI
@param newspaper-id - 新聞が持っているUUID
 */
app.get("/get-summary", getThreadSummaryList);

/**
@description テスト用の新聞のenableをtrueするAPI
 */
app.get("/create-news", createNewspapersData);

/**
@description WebSocket接続を行い、スレッド内の投稿を反映する
@param newspaper-id - 新聞が持っているUUID
@param index - ダミー投稿を作成したいスレッドの新聞内のスレッド番号(リストの順番)(0 ~ 4)
@param thread-id - スレッドが持っているUUID
 */
app.get("/ws", websocketPost);

/**
@description Deno KVのqueueでセットされたタスクを実行する
 */
kv.listenQueue(async (message) => {
    if (
        typeof message === "object" && message !== null && "type" in message &&
        message.type === "summarize" && "payload" in message &&
        typeof message.payload === "object" && message.payload !== null &&
        "newspaperId" in message.payload && typeof message.payload.newspaperId === "string" &&
        "index" in message.payload && typeof message.payload.index === "number"
    ) {
        const { newspaperId, index } = message.payload;
        console.log(`要約タスクを受信: newspaperId=${newspaperId}, index=${index}`);
        try {
            await generateSummary(newspaperId, index);
            console.log(`要約タスクが正常に完了: newspaperId=${newspaperId}, index=${index}`);
        } catch (error) {
            console.error(
                `要約タスクの処理中にエラーが発生しました: newspaperId=${newspaperId}, index=${index}`,
                error,
            );
            // エラーを再スローしてDeno KVにリトライさせる
            throw error;
        }
    } else {
        console.warn("未対応または不正な形式のメッセージを受信しました:", message);
    }
});

// 静的ファイル配信
app.get(
    "*",
    serveStatic({
        root: "./public",
        rewriteRequestPath: (path) => {
            if (path === "/") {
                return "/index.html";
            }
            if (!path.includes(".")) {
                return `${path}.html`;
            }
            return path;
        },
    }),
);

Deno.serve(app.fetch);
