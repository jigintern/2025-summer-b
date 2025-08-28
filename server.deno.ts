import { Hono } from "https://deno.land/x/hono@v4.3.11/mod.ts";
import { serveStatic } from "https://deno.land/x/hono@v4.3.11/middleware.ts";
import { getThreadTitles } from "./api/threadList.ts";
import { createThreadPosts, getThreadPosts, registerThreadPosts } from "./api/threadContent.ts";
import { getNewspaperList } from "./api/newspaperList.ts";
import { createThreadSummary, getThreadSummaryList } from "./api/newspaperContent.ts";
import { websocketPost } from "./api/websocket.ts";

const app = new Hono();

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
@description WebSocket接続を行い、スレッド内の投稿を反映する
@param newspaper-id - 新聞が持っているUUID
@param index - ダミー投稿を作成したいスレッドの新聞内のスレッド番号(リストの順番)(0 ~ 4)
@param thread-id - スレッドが持っているUUID
 */
app.get("/ws", websocketPost);

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
